// src/app/api/pierre/execute/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, PostgrestError } from "@supabase/supabase-js";

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
  makeEmailWebhookUrl: string;
  makeDocWebhookUrl: string;
  makeIntegrationsWebhookUrl: string;
};

let cachedRuntime: PierreExecuteRuntime | null = null;

function getRuntime(): PierreExecuteRuntime {
  if (cachedRuntime) return cachedRuntime;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const routerHmacSecret = process.env.ROUTER_HMAC_SECRET;
  const makeEmailWebhookUrl = process.env.MAKE_EMAIL_WEBHOOK_URL;
  const makeDocWebhookUrl = process.env.MAKE_DOC_WEBHOOK_URL;
  const makeIntegrationsWebhookUrl = process.env.MAKE_INTEGRATIONS_WEBHOOK_URL;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!routerHmacSecret) missing.push("ROUTER_HMAC_SECRET");
  if (!makeEmailWebhookUrl) missing.push("MAKE_EMAIL_WEBHOOK_URL");
  if (!makeDocWebhookUrl) missing.push("MAKE_DOC_WEBHOOK_URL");
  if (!makeIntegrationsWebhookUrl) missing.push("MAKE_INTEGRATIONS_WEBHOOK_URL");
  if (missing.length) throw new RuntimeConfigError(missing);

  // Non-null : la présence des six valeurs vient d'être prouvée ci-dessus (aucune
  // affirmation au niveau module — uniquement ici, après le garde runtime réel).
  cachedRuntime = {
    supabaseAdmin: instantiateSupabaseAdmin(supabaseUrl!, supabaseServiceKey!),
    routerHmacSecret: routerHmacSecret!,
    makeEmailWebhookUrl: makeEmailWebhookUrl!,
    makeDocWebhookUrl: makeDocWebhookUrl!,
    makeIntegrationsWebhookUrl: makeIntegrationsWebhookUrl!,
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
  | "MAKE_ERROR"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

function jsonOk(action: string, result: any) {
  return NextResponse.json({ ok: true, action, result }, { status: 200 });
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
 * 6) Make call (ROBUST)
 * =========================================
 */
async function callMake(url: string, payload: any) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return { ok: false, error: "MAKE_HTTP_ERROR", status: res.status, body: parsed };
    }

    if (parsed && typeof parsed === "object") return parsed;
    return { ok: true, data: parsed };
  } catch (e: any) {
    return { ok: false, error: "MAKE_FETCH_ERROR", message: e?.message ?? "unknown" };
  }
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
  doc_url: string;
  title?: string | null;
  doc_type?: string | null;
  employee_id?: string | null;
  metadata?: any;
  supabaseAdmin: SupabaseAdminClient;
}) {
  try {
    await params.supabaseAdmin.from("documents").insert({
      client_id: params.client_id,
      doc_url: params.doc_url,
      title: params.title ?? null,
      doc_type: params.doc_type ?? null,
      employee_id: params.employee_id ?? null,
      status: "final",
      version: 1,
      metadata: params.metadata ?? {},
    });
  } catch {
    // ignore
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
  const {
    supabaseAdmin,
    routerHmacSecret,
    makeEmailWebhookUrl,
    makeDocWebhookUrl,
    makeIntegrationsWebhookUrl,
  } = runtime;

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

  // 7) Execute
  try {
    /**
     * =========================
     * email.send
     * =========================
     */
    if (action === "email.send") {
      const p = EmailSendSchema.parse(payload);

      const { data: cfg, error: cfgErr } = await supabaseAdmin
        .from("agent_configs")
        .select("sender_email,sender_name,email_signature,legal_footer,email_provider")
        .eq("client_id", client_id)
        .eq("agent_key", "pierre")
        .maybeSingle();

      if (cfgErr) throw cfgErr;

      const signature = cfg?.email_signature ? `<br><br>${cfg.email_signature}` : "";
      const footer = cfg?.legal_footer ? `<br><br><small>${cfg.legal_footer}</small>` : "";

      const makePayload = {
        client_id,
        from: cfg?.sender_email,
        from_name: cfg?.sender_name ?? "Pierre",
        to: p.to,
        subject: p.subject,
        body_html: p.body_html + signature + footer,
        reply_to: p.reply_to,
        request_id: (p as any).request_id,
      };

      const makeRes = await callMake(makeEmailWebhookUrl, makePayload);

      if (makeRes?.ok === false) {
        await auditLog({ client_id, action, payload, ok: false, result: { make: makeRes }, supabaseAdmin });
        return jsonFail("MAKE_ERROR", "Make execution failed", makeRes, 502);
      }

      await auditLog({ client_id, action, payload, ok: true, result: makeRes, supabaseAdmin });
      return jsonOk(action, makeRes);
    }

    /**
     * =========================
     * doc.generate
     * =========================
     */
    if (action === "doc.generate") {
      const p = DocGenerateSchema.parse(payload) as any;

      const isSimple = typeof p?.html === "string" && p.html.length > 0;

      const makePayload = isSimple
        ? {
            client_id,
            request_id: p.request_id,
            title: p.title ?? "Document",
            html: p.html,
            filename: p.filename ?? "document.pdf",
            doc_type: p.doc_type ?? "document",
          }
        : {
            client_id,
            employee_id: p.employee_id,
            doc_type: p.doc_type,
            template_id: p.template_id,
            title: p.title,
            data: p.data ?? {},
            request_id: p.request_id,
          };

      const makeRes = await callMake(makeDocWebhookUrl, makePayload);
      if (makeRes?.ok === false) {
        await auditLog({ client_id, action, payload, ok: false, result: { make: makeRes }, supabaseAdmin });
        return jsonFail("MAKE_ERROR", "Make execution failed", makeRes, 502);
      }

      const doc_url = makeRes?.doc_url ?? makeRes?.data?.doc_url;
      if (typeof doc_url === "string" && doc_url.startsWith("http")) {
        await tryInsertDocument({
          client_id,
          doc_url,
          title: makePayload?.title ?? null,
          doc_type: makePayload?.doc_type ?? null,
          employee_id: makePayload?.employee_id ?? null,
          metadata: { make: makeRes },
          supabaseAdmin,
        });
      }

      await auditLog({ client_id, action, payload, ok: true, result: makeRes, supabaseAdmin });
      return jsonOk(action, makeRes);
    }

    /**
     * =========================
     * hris.sync
     * =========================
     */
    if (action === "hris.sync") {
      const p = HrisSyncSchema.parse(payload) as any;

      // ✅ NOUVEAU: si payload_json string existe, on le parse
      const parsedFromString = safeParseJsonString(p?.payload_json);
      const payloadObj =
        parsedFromString ??
        (p?.payload && typeof p.payload === "object" ? p.payload : {}) ??
        {};

      const makePayload = {
        client_id,
        vendor: p.vendor,
        mode: p.mode,
        payload: payloadObj,
        request_id: p.request_id,
      };

      const makeRes = await callMake(makeIntegrationsWebhookUrl, makePayload);
      if (makeRes?.ok === false) {
        await auditLog({ client_id, action, payload, ok: false, result: { make: makeRes }, supabaseAdmin });
        return jsonFail("MAKE_ERROR", "Make execution failed", makeRes, 502);
      }

      await auditLog({ client_id, action, payload, ok: true, result: makeRes, supabaseAdmin });
      return jsonOk(action, makeRes);
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

