import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  buildPierreEmailMetadata,
  getResolvedPierreEmailIdentity,
} from "@/lib/pierre-email-identity";
import { evaluateLegacyExecuteGovernance } from "@/lib/pierre/legacy-execute-governance";

// P0.2 SIBLING SURFACES CLOSURE (2026-07-23) — cette route appelait auparavant Make.com
// directement pour email.send/doc.generate dès que l'auth+entitlement passaient, SANS
// AUCUNE évaluation CloneGuard/gouvernance (même défaut que /api/pierre/execute, fermé en
// P0.1). Correctif : réutilise TEL QUEL evaluateLegacyExecuteGovernance (P0.1,
// src/lib/pierre/legacy-execute-governance.ts) avant tout appel Make. email.send est
// désormais refusé (floor CloneGuard non-contournable) ; doc.generate exige une
// validation humaine par défaut (aucune publication externe automatique, cf. Phase 9 du
// bloc de fermeture) tant qu'aucun contexte de confiance réel n'est câblé. Voir
// audit-20260723-full/P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md.

type AllowedActionType = "email.send" | "doc.generate";

type ActionAttachmentInput = {
  filename?: string;
  url?: string;
  content_type?: string;
};

type PierreActionBody = {
  action_type?: AllowedActionType;

  // P0.2 idempotence : clé optionnelle fournie par l'appelant pour éviter une double
  // exécution (double-clic, retry réseau) — voir checkIdempotentAction ci-dessous.
  request_id?: string;

  // email
  to?: string;
  subject?: string;
  cc?: string | string[];
  bcc?: string | string[];

  // shared content
  html?: string;
  text?: string;

  // doc
  filename?: string;
  title?: string;

  // premium email attachment support
  attachments?: ActionAttachmentInput[];
  pdf_url?: string;
  pdf_filename?: string;

  metadata?: Record<string, unknown>;
};

type EmailAttachmentValidated = {
  filename: string;
  url: string;
  content_type?: string;
};

type EmailActionValidated = {
  action_type: "email.send";
  to: string[];
  subject: string;
  cc: string[];
  bcc: string[];
  html: string;
  text: string;
  attachments: EmailAttachmentValidated[];
  metadata: Record<string, unknown>;
};

type DocActionValidated = {
  action_type: "doc.generate";
  html: string;
  text: string;
  title: string;
  filename: string;
  metadata: Record<string, unknown>;
};

type ValidatedAction = EmailActionValidated | DocActionValidated;

type ValidateBodyResult =
  | { ok: true; value: ValidatedAction }
  | { ok: false; error: string };

type MakePayloadAttachment = {
  filename: string;
  url: string;
  content_type?: string;
};

type MakePayload = {
  action_type: AllowedActionType;
  agent_slug: "pierre";
  user_id: string;
  user_email: string | null;
  ts: string;
  request_id: string;
  environment: string;

  from?: string;
  reply_to?: string;

  to?: string;
  to_list?: string[];
  subject?: string;
  cc?: string;
  cc_list?: string[];
  bcc?: string;
  bcc_list?: string[];

  html?: string;
  text?: string;

  filename?: string;
  title?: string;

  pdf_url?: string;
  pdf_filename?: string;

  attachments?: MakePayloadAttachment[];
  has_attachments?: boolean;

  metadata?: Record<string, unknown>;
};

type NormalizedMakeResponse = {
  raw: unknown;
  parsed: Record<string, unknown> | null;
  pdf_url?: string;
  file_url?: string;
  output_url?: string;
  link?: string;
  message?: string;
  ok?: boolean;
};

type WebhookResolution = {
  url: string;
  mode: "unified" | "split-email" | "split-doc";
};

type PierreAccessResult = {
  ok: boolean;
  error: string | null;
  orderId?: string | null;
};

type LogPierreActionAttemptInput = {
  userId: string;
  actionType: AllowedActionType;
  ok: boolean;
  error?: string;
  payload: Record<string, unknown>;
  response?: Record<string, unknown> | null;
  requestId: string;
  idempotencyKey?: string | null;
  durationMs?: number;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getBearerToken(req: NextRequest) {
  const auth =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function buildRequestId() {
  return `pierre_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isAllowedActionType(value: unknown): value is AllowedActionType {
  return value === "email.send" || value === "doc.generate";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clampString(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function toJsonSafe(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "serialization_failed" });
  }
}

function truncateForLog(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildFilename(raw: string) {
  const base = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-_. ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return base || "document-pierre";
}

function ensurePdfExtension(raw: string) {
  const base = buildFilename(raw);
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

function buildSafeAttachmentFilename(raw: string) {
  const base = buildFilename(raw);
  return clampString(base, 180);
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseUnknownJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseNestedJson(value: unknown, maxDepth = 3): unknown {
  let current = value;
  for (let i = 0; i < maxDepth; i += 1) {
    const parsed = parseUnknownJsonString(current);
    if (parsed === current) return current;
    current = parsed;
  }
  return current;
}

function resolveWebhook(actionType: AllowedActionType): WebhookResolution | null {
  const generic = getEnv("MAKE_PIERRE_ACTION_WEBHOOK_URL");
  const email = getEnv("MAKE_PIERRE_EMAIL_WEBHOOK_URL");
  const doc = getEnv("MAKE_PIERRE_DOC_WEBHOOK_URL");

  if (generic) {
    return {
      url: generic,
      mode: "unified",
    };
  }

  if (actionType === "email.send" && email) {
    return {
      url: email,
      mode: "split-email",
    };
  }

  if (actionType === "doc.generate" && doc) {
    return {
      url: doc,
      mode: "split-doc",
    };
  }

  return null;
}

function makeServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configuré.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<{ error: string | null; user: User | null }> {
  const token = getBearerToken(req);

  if (!token) {
    return { error: "Token manquant.", user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: error?.message || "Utilisateur non authentifié.",
      user: null,
    };
  }

  return { error: null, user: data.user };
}

async function hasPierreAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<PierreAccessResult> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, orderId: null };
  }

  return {
    ok: Boolean(data),
    error: null,
    orderId: data?.id ?? null,
  };
}

function normalizeEmailList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => safeString(item).toLowerCase())
      .filter(Boolean);
  }

  const single = safeString(value);
  if (!single) return [];

  return single
    .split(/[;,]/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueEmailList(list: string[]) {
  return Array.from(new Set(list));
}

function validateEmailList(
  list: string[],
  fieldLabel: string
): { ok: true; value: string[] } | { ok: false; error: string } {
  const unique = uniqueEmailList(list);

  if (unique.length > 50) {
    return {
      ok: false,
      error: `${fieldLabel} contient trop d’adresses email.`,
    };
  }

  for (const email of unique) {
    if (!isValidEmail(email)) {
      return {
        ok: false,
        error: `${fieldLabel} contient une adresse invalide : ${email}`,
      };
    }
  }

  return { ok: true, value: unique };
}

function normalizeAttachmentArray(
  rawAttachments: ActionAttachmentInput[] | undefined,
  rawPdfUrl: string,
  rawPdfFilename: string
): EmailAttachmentValidated[] {
  const clean: EmailAttachmentValidated[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawAttachments)) {
    for (const item of rawAttachments) {
      const filename = buildSafeAttachmentFilename(
        safeString(item?.filename) || "piece-jointe-pierre"
      );
      const url = safeString(item?.url);
      const contentType = safeString(item?.content_type);

      if (!url) continue;
      if (!isValidHttpUrl(url)) continue;

      const dedupeKey = `${filename}__${url}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      clean.push({
        filename,
        url,
        content_type: contentType || undefined,
      });
    }
  }

  const pdfUrl = safeString(rawPdfUrl);
  if (pdfUrl && isValidHttpUrl(pdfUrl)) {
    const pdfFilename = buildSafeAttachmentFilename(
      safeString(rawPdfFilename) || "document-pierre.pdf"
    );
    const dedupeKey = `${pdfFilename}__${pdfUrl}`;

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      clean.push({
        filename: pdfFilename,
        url: pdfUrl,
        content_type: "application/pdf",
      });
    }
  }

  return clean.slice(0, 10);
}

function validateBody(raw: PierreActionBody): ValidateBodyResult {
  if (!isAllowedActionType(raw.action_type)) {
    return { ok: false, error: "action_type invalide." };
  }

  if (raw.action_type === "email.send") {
    const toListValidation = validateEmailList(normalizeEmailList(raw.to), "to");
    if (!toListValidation.ok) {
      return { ok: false, error: toListValidation.error };
    }

    const ccListValidation = validateEmailList(normalizeEmailList(raw.cc), "cc");
    if (!ccListValidation.ok) {
      return { ok: false, error: ccListValidation.error };
    }

    const bccListValidation = validateEmailList(normalizeEmailList(raw.bcc), "bcc");
    if (!bccListValidation.ok) {
      return { ok: false, error: bccListValidation.error };
    }

    const to = toListValidation.value;
    const cc = ccListValidation.value;
    const bcc = bccListValidation.value;

    const subject = clampString(safeString(raw.subject), 240);
    const html = clampString(safeString(raw.html), 400000);
    const text = clampString(safeString(raw.text), 180000);

    if (!to.length) {
      return { ok: false, error: "Destinataire email manquant." };
    }

    if (!subject) {
      return { ok: false, error: "Objet email manquant." };
    }

    if (!html && !text) {
      return { ok: false, error: "Contenu email manquant." };
    }

    const attachments = normalizeAttachmentArray(
      Array.isArray(raw.attachments) ? raw.attachments : [],
      safeString(raw.pdf_url),
      safeString(raw.pdf_filename)
    );

    return {
      ok: true,
      value: {
        action_type: "email.send",
        to,
        subject,
        cc,
        bcc,
        html,
        text,
        attachments,
        metadata: safeMetadata(raw.metadata),
      },
    };
  }

  const html = clampString(safeString(raw.html), 400000);
  const text = clampString(safeString(raw.text), 180000);
  const title = clampString(safeString(raw.title), 240) || "Document Pierre";
  const filename = clampString(
    ensurePdfExtension(safeString(raw.filename || raw.title || "document-pierre")),
    180
  );

  if (!html && !text) {
    return { ok: false, error: "Contenu document manquant." };
  }

  return {
    ok: true,
    value: {
      action_type: "doc.generate",
      html,
      text,
      title,
      filename,
      metadata: safeMetadata(raw.metadata),
    },
  };
}

function mergeMetadata(
  base: Record<string, unknown>,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    ...extra,
  };
}

function extractBestUrl(record: Record<string, unknown> | null) {
  if (!record) return "";

  const direct =
    safeString(record.url) ||
    safeString(record.pdf_url) ||
    safeString(record.file_url) ||
    safeString(record.output_url) ||
    safeString(record.output) ||
    safeString(record.link) ||
    safeString(record.download_url) ||
    safeString(record.public_url);

  if (direct && isValidHttpUrl(direct)) return direct;

  const data = safeRecord(record.data);
  if (data) {
    const nested =
      safeString(data.url) ||
      safeString(data.pdf_url) ||
      safeString(data.file_url) ||
      safeString(data.output_url) ||
      safeString(data.output) ||
      safeString(data.link) ||
      safeString(data.download_url) ||
      safeString(data.public_url);

    if (nested && isValidHttpUrl(nested)) return nested;
  }

  return "";
}

function normalizeMakeResponse(input: unknown): NormalizedMakeResponse {
  const raw = input;
  const deeplyParsed = parseNestedJson(input, 4);
  const parsed = safeRecord(deeplyParsed);

  const pdfUrl = extractBestUrl(parsed);
  const fileUrl =
    safeString(parsed?.file_url) ||
    safeString(safeRecord(parsed?.data)?.file_url) ||
    undefined;

  const outputUrl =
    safeString(parsed?.output_url) ||
    safeString(safeRecord(parsed?.data)?.output_url) ||
    safeString(parsed?.output) ||
    safeString(safeRecord(parsed?.data)?.output) ||
    undefined;

  const link =
    safeString(parsed?.link) ||
    safeString(safeRecord(parsed?.data)?.link) ||
    undefined;

  const message =
    safeString(parsed?.message) ||
    safeString(safeRecord(parsed?.data)?.message) ||
    undefined;

  const ok =
    typeof parsed?.ok === "boolean"
      ? parsed.ok
      : typeof safeRecord(parsed?.data)?.ok === "boolean"
      ? (safeRecord(parsed?.data)?.ok as boolean)
      : undefined;

  return {
    raw,
    parsed,
    pdf_url: pdfUrl || undefined,
    file_url: fileUrl,
    output_url: outputUrl,
    link,
    message,
    ok,
  };
}

async function logPierreActionAttempt(
  supabase: SupabaseClient,
  input: LogPierreActionAttemptInput
) {
  try {
    const payloadForLog = {
      ...input.payload,
      html:
        typeof input.payload.html === "string"
          ? truncateForLog(input.payload.html, 4000)
          : input.payload.html,
      text:
        typeof input.payload.text === "string"
          ? truncateForLog(input.payload.text, 3000)
          : input.payload.text,
    };

    const responseForLog = input.response
      ? {
          ...input.response,
          make_response_raw:
            typeof input.response.make_response_raw === "string"
              ? truncateForLog(input.response.make_response_raw, 4000)
              : input.response.make_response_raw,
        }
      : null;

    await supabase.from("agent_history").insert({
      user_id: input.userId,
      agent_slug: "pierre",
      created_at: new Date().toISOString(),
      input: toJsonSafe({
        kind: "action",
        request_id: input.requestId,
        idempotency_key: input.idempotencyKey ?? null,
        action_type: input.actionType,
        duration_ms: input.durationMs ?? null,
        payload: payloadForLog,
      }),
      preset: "free",
      tone: "pro",
      language: "fr",
      title:
        input.actionType === "email.send"
          ? "Action email Pierre"
          : "Action document Pierre",
      doc_type: input.actionType,
      ok: input.ok,
      error: input.error || null,
      favorite: false,
      pinned: false,
      tags: toJsonSafe([
        "action",
        input.actionType,
        input.ok ? "ok" : "err",
      ]),
      note: null,
      response: responseForLog ? toJsonSafe(responseForLog) : null,
    });
  } catch {
    // best effort
  }
}

/**
 * P0.2 — idempotence best-effort : si l'appelant fournit un request_id déjà associé à une
 * exécution réussie (ok=true) pour ce user+action_type, on renvoie le résultat en cache
 * plutôt que de ré-exécuter (double-clic, retry réseau). Même esprit que
 * maybeReturnIdempotentResult dans /api/pierre/execute (P0.1), adapté au schéma réel de
 * cette route (agent_history.input est une chaîne JSON, pas une colonne jsonb interrogeable
 * par containment — on la parse donc côté application plutôt que de supposer un opérateur
 * .contains() qui pourrait ne pas s'appliquer ici).
 */
async function checkIdempotentAction(
  supabase: SupabaseClient,
  userId: string,
  actionType: AllowedActionType,
  idempotencyKey: string
): Promise<Record<string, unknown> | null> {
  if (!idempotencyKey) return null;

  try {
    const { data, error } = await supabase
      .from("agent_history")
      .select("input,response,ok")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("doc_type", actionType)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !Array.isArray(data)) return null;

    for (const row of data as Array<Record<string, unknown>>) {
      if (row.ok !== true) continue;
      const input = parseUnknownJsonString(row.input);
      const inputRecord = safeRecord(input);
      if (inputRecord?.idempotency_key === idempotencyKey) {
        const response = parseUnknownJsonString(row.response);
        return safeRecord(response) ?? {};
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (e: unknown) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Configuration serveur invalide.",
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);

  if (authError || !user) {
    return json(401, {
      ok: false,
      error: authError || "Non authentifié.",
    });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return json(500, { ok: false, error: access.error });
  }

  if (!access.ok) {
    return json(403, {
      ok: false,
      error: "Pierre n’est pas actif sur ce compte.",
    });
  }

  const { identity, onboarding, error } = await getResolvedPierreEmailIdentity(
    supabase,
    user.id
  );

  if (error) {
    return json(500, { ok: false, error });
  }

  const unifiedWebhook = getEnv("MAKE_PIERRE_ACTION_WEBHOOK_URL");
  const emailWebhook = getEnv("MAKE_PIERRE_EMAIL_WEBHOOK_URL");
  const docWebhook = getEnv("MAKE_PIERRE_DOC_WEBHOOK_URL");

  return json(200, {
    ok: true,
    identity,
    onboarding_exists: Boolean(onboarding),
    available_actions: ["email.send", "doc.generate"],
    attachment_support: true,
    webhook_mode: unifiedWebhook
      ? "unified"
      : emailWebhook || docWebhook
      ? "split"
      : "missing",
    webhook_config: {
      unified: Boolean(unifiedWebhook),
      email: Boolean(emailWebhook),
      doc: Boolean(docWebhook),
    },
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = buildRequestId();

  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (e: unknown) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Configuration serveur invalide.",
      request_id: requestId,
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);

  if (authError || !user) {
    return json(401, {
      ok: false,
      error: authError || "Non authentifié.",
      request_id: requestId,
    });
  }

  const access = await hasPierreAccess(supabase, user.id);

  if (access.error) {
    return json(500, {
      ok: false,
      error: access.error,
      request_id: requestId,
    });
  }

  if (!access.ok) {
    return json(403, {
      ok: false,
      error: "Pierre n’est pas actif sur ce compte.",
      request_id: requestId,
    });
  }

  let body: PierreActionBody;

  try {
    body = (await req.json()) as PierreActionBody;
  } catch {
    return json(400, {
      ok: false,
      error: "Body JSON invalide.",
      request_id: requestId,
    });
  }

  const validated = validateBody(body);

  if (!validated.ok) {
    return json(400, {
      ok: false,
      error: validated.error,
      request_id: requestId,
    });
  }

  const action = validated.value;

  // P0.2 — idempotence : un request_id déjà exécuté avec succès renvoie le résultat en
  // cache, jamais une seconde exécution réelle.
  if (typeof body.request_id === "string" && body.request_id.trim()) {
    const cached = await checkIdempotentAction(
      supabase,
      user.id,
      action.action_type,
      body.request_id.trim()
    );
    if (cached) {
      return json(200, { ok: true, idempotent: true, request_id: requestId, ...cached });
    }
  }

  // P0.2 — gouvernance canonique (réutilise TEL QUEL le module de P0.1, aucune nouvelle
  // architecture) : évaluée AVANT toute résolution de webhook ou appel Make. email.send est
  // refusé (floor CloneGuard non-contournable) ; doc.generate exige une validation humaine
  // par défaut (aucun contexte de confiance réel disponible ici) — aucune publication
  // externe automatique dans les deux cas.
  const governanceDecision = evaluateLegacyExecuteGovernance({
    action: action.action_type,
    payload: action as unknown as Record<string, unknown>,
    now: new Date().toISOString(),
  });

  if (governanceDecision.outcome !== "ALLOW") {
    await logPierreActionAttempt(supabase, {
      userId: user.id,
      actionType: action.action_type,
      ok: false,
      error: governanceDecision.explanation,
      payload: { ...action, request_id: body.request_id ?? null } as unknown as Record<string, unknown>,
      response: { governance: governanceDecision.summary },
      requestId,
      idempotencyKey: body.request_id ?? null,
    });

    return json(governanceDecision.outcome === "DENY" ? 403 : 202, {
      ok: false,
      request_id: requestId,
      action_type: action.action_type,
      decision: governanceDecision.outcome,
      error: governanceDecision.explanation,
      governance: governanceDecision.summary,
    });
  }

  const webhook = resolveWebhook(action.action_type);

  if (!webhook?.url) {
    return json(500, {
      ok: false,
      error:
        action.action_type === "email.send"
          ? "Webhook Make email non configuré."
          : "Webhook Make document non configuré.",
      request_id: requestId,
    });
  }

  const { identity, onboarding, error: identityError } =
    await getResolvedPierreEmailIdentity(supabase, user.id);

  if (identityError) {
    return json(500, {
      ok: false,
      error: identityError,
      request_id: requestId,
    });
  }

  const metadataBase = buildPierreEmailMetadata(identity);
  const metadata = mergeMetadata(metadataBase, action.metadata || {});

  const payload: MakePayload = {
    action_type: action.action_type,
    agent_slug: "pierre",
    user_id: user.id,
    user_email: user.email ?? null,
    ts: new Date().toISOString(),
    request_id: requestId,
    environment: getEnv("NODE_ENV") || "production",
    from: identity.from,
    reply_to: identity.replyTo || undefined,
    metadata,
  };

  if (action.action_type === "email.send") {
    payload.to = action.to.join(", ");
    payload.to_list = action.to;
    payload.subject = action.subject;

    if (action.cc.length) {
      payload.cc = action.cc.join(", ");
      payload.cc_list = action.cc;
    }

    if (action.bcc.length) {
      payload.bcc = action.bcc.join(", ");
      payload.bcc_list = action.bcc;
    }

    payload.html = action.html;
    payload.text = action.text;
    payload.attachments = action.attachments;
    payload.has_attachments = action.attachments.length > 0;

    const pdfAttachment = action.attachments.find(
      (item) => item.content_type === "application/pdf" || /\.pdf$/i.test(item.filename)
    );

    if (pdfAttachment) {
      payload.pdf_url = pdfAttachment.url;
      payload.pdf_filename = pdfAttachment.filename;
    }
  } else {
    payload.html = action.html;
    payload.text = action.text;
    payload.title = action.title;
    payload.filename = action.filename;
  }

  const makeSecret = getEnv("MAKE_PIERRE_ACTION_SECRET");

  try {
    const makeRes = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(makeSecret ? { "x-clonestore-secret": makeSecret } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const contentType = makeRes.headers.get("content-type") || "";
    let makeData: unknown = null;

    if (contentType.includes("application/json")) {
      makeData = await makeRes.json().catch(() => null);
    } else {
      const text = await makeRes.text().catch(() => "");
      makeData = text || null;
    }

    const normalizedMake = normalizeMakeResponse(makeData);
    const durationMs = Date.now() - startedAt;

    if (!makeRes.ok) {
      await logPierreActionAttempt(supabase, {
        userId: user.id,
        actionType: action.action_type,
        ok: false,
        error: "Make a refusé l’action.",
        payload,
        response: {
          make_status: makeRes.status,
          webhook_mode: webhook.mode,
          make_response_raw:
            typeof normalizedMake.raw === "string"
              ? normalizedMake.raw
              : toJsonSafe(normalizedMake.raw),
          make_response_parsed: normalizedMake.parsed,
          pdf_url: normalizedMake.pdf_url || null,
          file_url: normalizedMake.file_url || null,
          output_url: normalizedMake.output_url || null,
          link: normalizedMake.link || null,
          message: normalizedMake.message || null,
        },
        requestId,
        idempotencyKey: body.request_id ?? null,
        durationMs,
      });

      return json(502, {
        ok: false,
        error: "Make a refusé l’action.",
        request_id: requestId,
        action_type: action.action_type,
        make_status: makeRes.status,
        webhook_mode: webhook.mode,
        make_response: normalizedMake.raw,
        make_response_parsed: normalizedMake.parsed,
        pdf_url: normalizedMake.pdf_url || null,
        file_url: normalizedMake.file_url || null,
        output_url: normalizedMake.output_url || null,
        link: normalizedMake.link || null,
        make_message: normalizedMake.message || null,
        identity,
        onboarding_exists: Boolean(onboarding),
        duration_ms: durationMs,
      });
    }

    await logPierreActionAttempt(supabase, {
      userId: user.id,
      actionType: action.action_type,
      ok: true,
      payload,
      response: {
        make_status: makeRes.status,
        webhook_mode: webhook.mode,
        make_response_raw:
          typeof normalizedMake.raw === "string"
            ? normalizedMake.raw
            : toJsonSafe(normalizedMake.raw),
        make_response_parsed: normalizedMake.parsed,
        pdf_url: normalizedMake.pdf_url || null,
        file_url: normalizedMake.file_url || null,
        output_url: normalizedMake.output_url || null,
        link: normalizedMake.link || null,
        message: normalizedMake.message || null,
      },
      requestId,
      idempotencyKey: body.request_id ?? null,
      durationMs,
    });

    return json(200, {
      ok: true,
      request_id: requestId,
      action_type: action.action_type,
      make_status: makeRes.status,
      webhook_mode: webhook.mode,
      make_response: normalizedMake.raw,
      make_response_parsed: normalizedMake.parsed,
      pdf_url: normalizedMake.pdf_url || null,
      file_url: normalizedMake.file_url || null,
      output_url: normalizedMake.output_url || null,
      link: normalizedMake.link || null,
      make_message: normalizedMake.message || null,
      attachments_count:
        action.action_type === "email.send" ? action.attachments.length : 0,
      identity,
      onboarding_exists: Boolean(onboarding),
      duration_ms: durationMs,
    });
  } catch (e: unknown) {
    const durationMs = Date.now() - startedAt;

    await logPierreActionAttempt(supabase, {
      userId: user.id,
      actionType: action.action_type,
      ok: false,
      error: e instanceof Error ? e.message : "Erreur lors de l’appel Make.",
      payload,
      response: null,
      requestId,
      idempotencyKey: body.request_id ?? null,
      durationMs,
    });

    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Erreur lors de l’appel Make.",
      request_id: requestId,
      action_type: action.action_type,
      webhook_mode: webhook.mode,
      identity,
      onboarding_exists: Boolean(onboarding),
      duration_ms: durationMs,
    });
  }
}