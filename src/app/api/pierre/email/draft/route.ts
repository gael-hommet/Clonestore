import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type DraftEmailBody = {
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
  subject?: string | null;
  body?: string | null;
  tone?: string | null;
  language?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  missionId?: string | null;
  attachments?: unknown;
};

type SenderIdentityResolved = {
  senderName: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  source: "payload" | "memory" | "fallback" | "none";
};

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const key of directCandidates) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
    if (!cookie.name.includes("auth-token")) continue;

    const raw = cookie.value;
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (typeof candidate === "string") return candidate;
      }

      if (isObject(parsed)) {
        const currentSession = getNestedObject(parsed, "currentSession");

        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");

        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return {
    userId: data.user.id,
    accessToken,
  };
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

function normalizeBody(raw: unknown): DraftEmailBody {
  if (!isObject(raw)) {
    return {
      to: null,
      cc: null,
      bcc: null,
      subject: null,
      body: null,
      tone: null,
      language: null,
      senderName: null,
      senderEmail: null,
      missionId: null,
      attachments: null,
    };
  }

  return {
    to: asString(raw.to),
    cc: asString(raw.cc),
    bcc: asString(raw.bcc),
    subject: asString(raw.subject),
    body: asString(raw.body),
    tone: asString(raw.tone),
    language: asString(raw.language),
    senderName: asString(raw.senderName),
    senderEmail: asString(raw.senderEmail),
    missionId: asString(raw.missionId),
    attachments: raw.attachments ?? null,
  };
}

async function verifyMissionOwnershipIfNeeded(
  supabaseAdmin: SupabaseClient,
  missionId: string | null | undefined,
  userId: string,
): Promise<DbRow | null> {
  if (!missionId) return null;

  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select("*")
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Mission not found.",
      code: "MISSION_NOT_FOUND",
    };
  }

  return data as DbRow;
}

async function loadCompanyMemory(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow | null> {
  const { data, error } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load company memory.",
      code: "COMPANY_MEMORY_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? null) as DbRow | null;
}

function resolveSenderIdentity(
  body: DraftEmailBody,
  memory: DbRow | null,
): SenderIdentityResolved {
  const senderIdentity = isObject(memory?.sender_identity)
    ? memory?.sender_identity
    : null;

  const payloadName = body.senderName;
  const payloadEmail = body.senderEmail;

  if (payloadName || payloadEmail) {
    const email = payloadEmail || null;
    return {
      senderName: payloadName || null,
      senderEmail: email,
      senderDomain: email && email.includes("@") ? email.split("@")[1] : null,
      source: "payload",
    };
  }

  const memoryName =
    asString(memory?.sender_name) ||
    asString(senderIdentity?.sender_name) ||
    asString(senderIdentity?.name);
  const memoryEmail =
    asString(memory?.sender_email) ||
    asString(senderIdentity?.sender_email) ||
    asString(senderIdentity?.email);

  if (memoryName || memoryEmail) {
    return {
      senderName: memoryName || null,
      senderEmail: memoryEmail || null,
      senderDomain:
        asString(memory?.sender_domain) ||
        (memoryEmail && memoryEmail.includes("@") ? memoryEmail.split("@")[1] : null),
      source: "memory",
    };
  }

  const fallbackName = asString(process.env.PIERRE_FALLBACK_SENDER_NAME);
  const fallbackEmail = asString(process.env.PIERRE_FALLBACK_SENDER_EMAIL);

  if (fallbackName || fallbackEmail) {
    return {
      senderName: fallbackName || null,
      senderEmail: fallbackEmail || null,
      senderDomain:
        fallbackEmail && fallbackEmail.includes("@")
          ? fallbackEmail.split("@")[1]
          : null,
      source: "fallback",
    };
  }

  return {
    senderName: null,
    senderEmail: null,
    senderDomain: null,
    source: "none",
  };
}

function buildDraftSubject(body: DraftEmailBody): string {
  return body.subject || "Email RH";
}

function buildDraftBody(params: {
  body: DraftEmailBody;
  sender: SenderIdentityResolved;
  memory: DbRow | null;
}): string {
  const { body, sender, memory } = params;

  if (body.body) return body.body;

  const language =
    body.language ||
    asString(memory?.preferred_language) ||
    "fr";

  const tone =
    body.tone ||
    asString(memory?.tone_guide) ||
    asString(memory?.communication_style) ||
    "professionnel";

  if (language === "en") {
    return [
      "Hello,",
      "",
      "This is a premium HR draft prepared by Pierre.",
      `Requested tone: ${tone}.`,
      sender.senderName ? `Proposed sender identity: ${sender.senderName}.` : null,
      "",
      "Please complete or adjust the operational content before final validation.",
      "",
      "Best regards,",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "Bonjour,",
    "",
    "Ceci est un brouillon RH premium préparé par Pierre.",
    `Ton demandé : ${tone}.`,
    sender.senderName ? `Identité d’envoi proposée : ${sender.senderName}.` : null,
    "",
    "Merci de compléter ou ajuster le contenu opérationnel avant validation finale.",
    "",
    "Bien cordialement,",
  ]
    .filter(Boolean)
    .join("\n");
}

async function insertDraftEmail(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  sender: SenderIdentityResolved;
  body: DraftEmailBody;
  subject: string;
  content: string;
}): Promise<DbRow> {
  const { supabaseAdmin, missionId, sender, body, subject, content } = params;

  const insertPayload = {
    mission_id: missionId,
    to: body.to || null,
    cc: body.cc || null,
    bcc: body.bcc || null,
    subject,
    body_text: content,
    body_html: null,
    sender_name: sender.senderName,
    sender_email: sender.senderEmail,
    status: "draft",
    attachments: body.attachments ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_outbound_emails")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to save email draft.",
      code: "EMAIL_DRAFT_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return data as DbRow;
}

async function insertMissionLogIfNeeded(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  subject: string;
  emailId: string;
}) {
  const { supabaseAdmin, missionId, subject, emailId } = params;
  if (!missionId) return;

  const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
    mission_id: missionId,
    level: "info",
    event: "email_draft_created",
    message: `Brouillon email créé : ${subject}`,
    payload: {
      email_id: emailId,
      subject,
    },
  });

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission log.",
      code: "MISSION_LOG_CREATE_FAILED",
      details: mapDbError(error),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json());

    if (!body.subject && !body.body) {
      return jsonError("Email subject or body is required.", 400, {
        code: "EMAIL_DRAFT_CONTENT_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const [mission, memory] = await Promise.all([
      verifyMissionOwnershipIfNeeded(supabaseAdmin, body.missionId, auth.userId),
      loadCompanyMemory(supabaseAdmin, auth.userId),
    ]);

    const sender = resolveSenderIdentity(body, memory);
    const subject = buildDraftSubject(body);
    const content = buildDraftBody({ body, sender, memory });

    const email = await insertDraftEmail({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      sender,
      body,
      subject,
      content,
    });

    await insertMissionLogIfNeeded({
      supabaseAdmin,
      missionId: mission ? (mission.id as string) : null,
      subject,
      emailId: String(email.id),
    });

    return NextResponse.json({
      ok: true,
      email,
      draft: email,
      meta: {
        fetchedAt: new Date().toISOString(),
        missionId: mission ? (mission.id as string) : null,
        senderIdentityResolved: sender,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: error.details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);

    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}