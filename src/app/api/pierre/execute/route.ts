// src/app/api/pierre/execute/route.ts
//
// P0 GOVERNANCE CLOSURE (2026-07-23) — cette route legacy ("V0", auth HMAC externe)
// exécutait auparavant email.send/doc.generate/hris.sync en appelant directement des
// webhooks Make.com, SANS AUCUNE évaluation CloneGuard/gouvernance — contradiction directe
// avec la règle "un email n'est jamais auto-exécuté par Pierre" appliquée partout ailleurs
// (voir src/lib/pierre/hr/cloneguard.ts, src/lib/pierre/tasks/execute-task.ts).
//
// Correctif : chaque action passe désormais par les MÊMES évaluateurs canoniques purs que
// le moteur v1/hr (evaluatePierreCloneGuard + evaluateGovernance) avant toute exécution.
// Toute décision autre que "autorisé" est refusée ou mise en attente d'approbation humaine —
// jamais un fallback silencieux vers l'ancien comportement permissif. Les appels sortants
// directs vers Make.com (email/document/HRIS) ont été retirés : cette route ne peut plus,
// par construction, déclencher un effet externe réel (email envoyé, document publié,
// synchronisation HRIS). Voir audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/p0-governance-closure/.
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import {
  evaluateLegacyExecuteGovernance,
  type LegacyExecuteDecision,
} from "@/lib/pierre/legacy-execute-governance";

export const runtime = "nodejs";

/**
 * =========================================
 * 0) Runtime (lazy — jamais évalué à l'import)
 * =========================================
 * Vercel importe cette route pendant "Collecting page data" : toute validation
 * d'environnement ou instanciation de client AU NIVEAU MODULE y fait échouer le
 * build. getRuntime() lit process.env et construit le client Supabase UNIQUEMENT
 * au premier appel réel (depuis POST()), puis met le résultat en cache pour les
 * invocations suivantes de la même instance de fonction.
 */
class RuntimeConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing env vars: ${missing.join(", ")}`);
  }
}

// Type dérivé d'un appel CONCRET (2 arguments string) plutôt que de `typeof createClient`
// (surchargé) : `ReturnType<typeof createClient>` résout vers une surcharge générique dont le
// schéma vaut `never`, ce qui casse tous les `.from(...)` en aval. Ce wrapper reproduit
// exactement la résolution de surcharge de l'appel direct d'origine.
function instantiateSupabaseAdmin(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } });
}
type SupabaseAdminClient = ReturnType<typeof instantiateSupabaseAdmin>;

type PierreExecuteRuntime = {
  supabaseAdmin: SupabaseAdminClient;
  routerHmacSecret: string;
};

let cachedRuntime: PierreExecuteRuntime | null = null;

function getRuntime(): PierreExecuteRuntime {
  if (cachedRuntime) return cachedRuntime;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const routerHmacSecret = process.env.ROUTER_HMAC_SECRET;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!routerHmacSecret) missing.push("ROUTER_HMAC_SECRET");
  if (missing.length) throw new RuntimeConfigError(missing);

  // Non-null : la présence des trois valeurs vient d'être prouvée ci-dessus (aucune
  // affirmation au niveau module — uniquement ici, après le garde runtime réel).
  cachedRuntime = {
    supabaseAdmin: instantiateSupabaseAdmin(supabaseUrl!, supabaseServiceKey!),
    routerHmacSecret: routerHmacSecret!,
  };
  return cachedRuntime;
}

/**
 * =========================================
 * 1) Helpers
 * =========================================
 */
type ApiErrorCode =
  | "UNAUTHORIZED"
  | "CLIENT_ID_MISMATCH"
  | "BAD_REQUEST"
  | "UNKNOWN_ACTION"
  | "FORBIDDEN"
  | "GOVERNANCE_BLOCKED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

function jsonOk(action: string, result: any) {
  return NextResponse.json({ ok: true, action, result }, { status: 200 });
}

/**
 * Réponse 202 : action reçue et classée, mais retenue en attente d'une validation humaine.
 * Jamais exécutée automatiquement — aucun effet externe déclenché.
 */
function jsonPendingApproval(action: string, decision: LegacyExecuteDecision) {
  return NextResponse.json(
    {
      ok: false,
      action,
      error: {
        code: "HUMAN_APPROVAL_REQUIRED" as ApiErrorCode,
        message: decision.explanation,
      },
      decision: "REQUIRE_APPROVAL",
      governance: decision.summary,
    },
    { status: 202 }
  );
}

function jsonFail(code: ApiErrorCode, message: string, details?: any, status = 400) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

function isPostgrestError(e: any): e is PostgrestError {
  return e && typeof e === "object" && typeof e.message === "string" && typeof e.details === "string";
}

function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * =========================================
 * 2) Router Auth (HMAC + anti-replay)
 * =========================================
 * headers requis :
 * - x-client-id
 * - x-timestamp (ms)
 * - x-signature = HMAC_SHA256(secret, `${clientId}.${timestamp}.${rawBody}`) hex
 */
function assertRouterAuth(req: Request, rawBody: string, routerHmacSecret: string) {
  const clientId = req.headers.get("x-client-id") || "";
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";

  if (!clientId || !timestamp || !signature) throw new Error("UNAUTHORIZED");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("UNAUTHORIZED");

  const now = Date.now();
  if (Math.abs(now - ts) > 5 * 60 * 1000) throw new Error("UNAUTHORIZED");

  const expected = crypto
    .createHmac("sha256", routerHmacSecret)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");

  if (!timingSafeEqualHex(expected, signature)) throw new Error("UNAUTHORIZED");
  return clientId;
}

/**
 * =========================================
 * 3) Audit (best-effort)
 * =========================================
 */
async function auditLog(params: {
  client_id: string;
  action: string;
  payload: any;
  ok: boolean;
  result: any;
  actor?: string;
  supabaseAdmin: SupabaseAdminClient;
}) {
  const { client_id, action, payload, ok, result, actor, supabaseAdmin } = params;
  try {
    await supabaseAdmin.from("audit_log").insert({
      client_id,
      action,
      payload: payload ?? {},
      ok,
      result: result ?? {},
      actor: actor ?? "system",
    });
  } catch {
    // ignore
  }
}

/**
 * =========================================
 * 4) Idempotency (optional)
 * =========================================
 */
async function maybeReturnIdempotentResult(
  client_id: string,
  action: string,
  payload: any,
  supabaseAdmin: SupabaseAdminClient
) {
  const request_id = typeof payload?.request_id === "string" ? payload.request_id.trim() : "";
  if (!request_id) return null;

  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("ok,result,created_at")
    .eq("client_id", client_id)
    .eq("action", action)
    .contains("payload", { request_id })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  const row: any = data[0];
  if (row?.ok === true) return row.result ?? {};
  return null;
}

/**
 * =========================================
 * 5) Access check
 * =========================================
 */
async function assertPierreAccess(client_id: string, supabaseAdmin: SupabaseAdminClient) {
  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("agent_configs")
    .select("client_id,agent_key")
    .eq("client_id", client_id)
    .eq("agent_key", "pierre")
    .maybeSingle();

  if (cfgErr) throw cfgErr;
  if (!cfg) throw new Error("FORBIDDEN");
}

/**
 * =========================================
 * 7) Schemas
 * =========================================
 */
const ExecuteSchema = z.object({
  client_id: z.string().min(3),
  action: z.string().min(3),
  payload: z.object({}).passthrough().default({}),
});

function withRequestId<T extends z.ZodTypeAny>(schema: T) {
  return schema.and(z.object({ request_id: z.string().min(6).optional() }));
}

/**
 * email.send
 */
const EmailSendSchema = withRequestId(
  z.object({
    to: z.array(z.string().min(3)).min(1),
    subject: z.string().min(1),
    body_html: z.string().min(1),
    reply_to: z.string().email().optional(),
  })
);

/**
 * doc.generate
 * - Format A (pro) : doc_type/template_id/data
 * - Format B (simple) : html/filename direct
 */
const DocGenerateSchema = withRequestId(
  z.union([
    z.object({
      employee_id: z.string().uuid().optional(),
      doc_type: z.string().min(2),
      template_id: z.string().min(2),
      title: z.string().optional(),
      data: z.object({}).passthrough().default({}),
    }),
    z.object({
      title: z.string().optional(),
      html: z.string().min(1),
      filename: z.string().optional(),
      doc_type: z.string().optional(),
    }),
  ])
);

/**
 * hris.sync
 * ✅ On supporte 2 formats :
 * - ancien : payload objet
 * - nouveau (depuis generate strict) : payload_json string (JSON.stringify)
 */
const HrisSyncSchema = withRequestId(
  z.object({
    vendor: z.string().optional(),
    mode: z.enum(["import", "api", "both"]).optional(),
    payload: z.object({}).passthrough().optional(),
    payload_json: z.string().optional(),
  })
);

/**
 * Best-effort : enregistrer doc_url dans documents si la table existe
 */
async function tryInsertDocument(params: {
  client_id: string;
  doc_url: string | null;
  title?: string | null;
  doc_type?: string | null;
  employee_id?: string | null;
  metadata?: any;
  supabaseAdmin: SupabaseAdminClient;
}): Promise<string | null> {
  try {
    const { data, error } = await params.supabaseAdmin
      .from("documents")
      .insert({
        client_id: params.client_id,
        doc_url: params.doc_url,
        title: params.title ?? null,
        doc_type: params.doc_type ?? null,
        employee_id: params.employee_id ?? null,
        // P19 — status honesty: a freshly generated artifact is "generated", not "final". "final" implies an
        // approved/finalized document (see finalizeVersion state machine + real signature) and must never be
        // fabricated at generation time.
        status: "generated",
        version: 1,
        metadata: params.metadata ?? {},
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return typeof (data as any)?.id === "string" ? (data as any).id : null;
  } catch {
    return null;
  }
}

/**
 * Helper: parse payload_json safely
 */
function safeParseJsonString(s: any) {
  if (typeof s !== "string") return null;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * =========================================
 * 8) Handler
 * =========================================
 */
export async function POST(req: Request) {
  let runtime: PierreExecuteRuntime;
  try {
    runtime = getRuntime();
  } catch (e) {
    if (e instanceof RuntimeConfigError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    throw e;
  }
  const { supabaseAdmin, routerHmacSecret } = runtime;

  const raw = await req.text();

  // 1) HMAC auth
  let client_id_from_header = "";
  try {
    client_id_from_header = assertRouterAuth(req, raw, routerHmacSecret);
  } catch {
    return jsonFail("UNAUTHORIZED", "Router signature invalid or missing", undefined, 401);
  }

  // 2) Parse JSON body
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonFail("BAD_REQUEST", "Invalid JSON body");
  }

  // 3) Validate envelope
  let envelope: { client_id: string; action: string; payload: any };
  try {
    envelope = ExecuteSchema.parse(body);
  } catch (e: any) {
    return jsonFail("BAD_REQUEST", "Invalid request format", { zod: e?.errors ?? e }, 400);
  }

  const { client_id, action, payload } = envelope;

  // 4) client_id must match signed header
  if (client_id !== client_id_from_header) {
    await auditLog({
      client_id,
      action,
      payload,
      ok: false,
      result: { error: "CLIENT_ID_MISMATCH" },
      supabaseAdmin,
    });
    return jsonFail("CLIENT_ID_MISMATCH", "client_id mismatch", undefined, 403);
  }

  // 5) Access
  try {
    await assertPierreAccess(client_id, supabaseAdmin);
  } catch {
    await auditLog({ client_id, action, payload, ok: false, result: { error: "FORBIDDEN" }, supabaseAdmin });
    return jsonFail("FORBIDDEN", "Pierre access denied or not configured", undefined, 403);
  }

  // 6) Idempotency
  try {
    const prev = await maybeReturnIdempotentResult(client_id, action, payload, supabaseAdmin);
    if (prev) return jsonOk(action, { idempotent: true, ...prev });
  } catch {
    // ignore
  }

  // 6.5) Gouvernance canonique — évaluée pour TOUTE action reconnue, avant toute exécution.
  // Une décision DENY/REQUIRE_APPROVAL est journalisée et retournée SANS jamais tomber sur
  // l'ancien comportement permissif (plus aucun appel externe direct dans cette route).
  const now = new Date().toISOString();
  const recognizedActions = new Set(["email.send", "doc.generate", "hris.sync"]);
  let decision: LegacyExecuteDecision | null = null;

  if (recognizedActions.has(action)) {
    decision = evaluateLegacyExecuteGovernance({ action, payload, now });

    if (decision.outcome === "DENY") {
      await auditLog({
        client_id,
        action,
        payload,
        ok: false,
        result: {
          governance: decision.summary,
          audit: decision.governanceAudit.meta_json,
          cloneguard_audit: decision.cloneGuardAudit.meta_json,
        },
        supabaseAdmin,
      });
      return jsonFail("GOVERNANCE_BLOCKED", decision.explanation, decision.summary, 403);
    }

    if (decision.outcome === "REQUIRE_APPROVAL") {
      await auditLog({
        client_id,
        action,
        payload,
        ok: false,
        result: {
          governance: decision.summary,
          audit: decision.governanceAudit.meta_json,
          cloneguard_audit: decision.cloneGuardAudit.meta_json,
        },
        supabaseAdmin,
      });
      return jsonPendingApproval(action, decision);
    }

    // decision.outcome === "ALLOW" à partir d'ici.
  }

  // 7) Execute (uniquement atteint pour une action ALLOW ou non reconnue — cf. branche
  // "Unknown action" ci-dessous, qui reste fail-closed comme avant ce correctif)
  try {
    /**
     * =========================
     * email.send
     * =========================
     * Garde de sécurité absolue : CloneGuard force allowed_to_auto_execute=false pour
     * TOUTE action email.send, quelle que soit la configuration (cloneguard.ts, règle
     * "email_send_block" + garde explicite non-contournable). Cette branche ne devrait
     * donc jamais être atteinte avec outcome==="ALLOW" — le garde ci-dessous le prouve
     * en refusant explicitement plutôt que d'envoyer quoi que ce soit.
     */
    if (action === "email.send") {
      await auditLog({
        client_id,
        action,
        payload,
        ok: false,
        result: { error: "EMAIL_SEND_NEVER_AUTO_EXECUTED" },
        supabaseAdmin,
      });
      return jsonFail(
        "GOVERNANCE_BLOCKED",
        "Un email n'est jamais auto-exécuté par Pierre, même via cette route legacy.",
        undefined,
        403
      );
    }

    /**
     * =========================
     * doc.generate
     * =========================
     * P0 governance closure : plus aucun appel externe (ex-MAKE_DOC_WEBHOOK_URL). Le document
     * est enregistré localement en statut "generated" (brouillon), jamais publié
     * automatiquement à l'extérieur — cohérent avec le cycle de vie canonique
     * draft→review→approved→final (src/lib/pierre/v1/documents.ts).
     *
     * Constat vérifié (test unitaire) : cette branche n'est aujourd'hui atteinte QUE si
     * evaluateLegacyExecuteGovernance renvoie ALLOW — ce qui n'arrive en pratique jamais
     * pour cette route, car aucune donnée de confiance/historique réelle (company_trust_score)
     * ne lui est transmise : CloneTrust retombe alors sur "supervised" (40/100), qui force
     * REQUIRE_APPROVAL même pour un contenu bénin. Cette branche reste néanmoins nécessaire :
     * elle est correcte et s'activerait si un contexte de confiance réel était un jour fourni.
     */
    if (action === "doc.generate") {
      const p = DocGenerateSchema.parse(payload) as any;
      const isSimple = typeof p?.html === "string" && p.html.length > 0;

      const title = p.title ?? (isSimple ? "Document" : undefined);
      const docType = isSimple ? (p.doc_type ?? "document") : p.doc_type;
      const employeeId = isSimple ? null : (p.employee_id ?? null);

      const documentId = await tryInsertDocument({
        client_id,
        doc_url: null,
        title: title ?? null,
        doc_type: docType ?? null,
        employee_id: employeeId,
        metadata: {
          source: "pierre_execute_legacy",
          governance: decision?.summary ?? null,
          externally_published: false,
        },
        supabaseAdmin,
      });

      const result = {
        generated: true,
        externally_published: false,
        document_id: documentId,
        status: "generated",
        request_id: (p as any)?.request_id ?? null,
      };

      await auditLog({ client_id, action, payload, ok: true, result, supabaseAdmin });
      return jsonOk(action, result);
    }

    /**
     * =========================
     * hris.sync
     * =========================
     * P0 governance closure : la nouvelle règle CloneGuard "integration_sync_require"
     * (src/lib/pierre/hr/cloneguard.ts) classe systématiquement hris.sync en
     * require_approval — cette branche ne devrait donc jamais être atteinte avec
     * outcome==="ALLOW". Garde de sécurité absolue : aucun appel externe direct n'est
     * effectué depuis cette route, quelle que soit la décision.
     */
    if (action === "hris.sync") {
      await auditLog({
        client_id,
        action,
        payload,
        ok: false,
        result: { error: "HRIS_SYNC_REQUIRES_CANONICAL_ADAPTER" },
        supabaseAdmin,
      });
      return jsonFail(
        "GOVERNANCE_BLOCKED",
        "La synchronisation HRIS ne peut pas être exécutée directement par cette route legacy.",
        undefined,
        403
      );
    }

    /**
     * =========================
     * Unknown action
     * =========================
     */
    await auditLog({ client_id, action, payload, ok: false, result: { error: "UNKNOWN_ACTION" }, supabaseAdmin });
    return jsonFail("UNKNOWN_ACTION", "Unknown action", { action }, 400);
  } catch (e: any) {
    let code: ApiErrorCode = "INTERNAL_ERROR";
    let message = "Unexpected error";
    let details: any = undefined;
    let status = 500;

    if (isPostgrestError(e)) {
      code = "DB_ERROR";
      message = "Database error";
      details = { db: e.message, hint: e.hint, details: e.details };
      status = 500;
    } else if (e?.name === "ZodError") {
      code = "BAD_REQUEST";
      message = "Validation error";
      details = { zod: e.errors };
      status = 400;
    } else if (e?.message === "FORBIDDEN") {
      code = "FORBIDDEN";
      message = "Forbidden";
      status = 403;
    } else if (e?.message) {
      code = "INTERNAL_ERROR";
      message = String(e.message);
      status = 500;
    }

    await auditLog({
      client_id: (body?.client_id ?? "unknown") as string,
      action: (body?.action ?? "unknown") as string,
      payload: body?.payload ?? {},
      ok: false,
      result: { error: { code, message, details } },
      supabaseAdmin,
    });

    return jsonFail(code, message, details, status);
  }
}

