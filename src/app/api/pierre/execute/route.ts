// src/app/api/pierre/execute/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import { evaluateLegacyExecuteGovernance } from "@/lib/pierre/legacy-execute-governance";

export const runtime = "nodejs";

// P0.1 EXECUTE ROUTE GOVERNANCE RE-CLOSURE (2026-07-24) — cette route appelait
// auparavant Make.com directement pour email.send/doc.generate/hris.sync dès que
// l'auth HMAC + l'entitlement passaient, sans aucune évaluation CloneGuard/gouvernance
// (le câblage de gouvernance écrit le 2026-07-23 n'a jamais été commité et a été
// écrasé sur disque par un chantier externe concurrent le 2026-07-24 — voir
// audit-20260723-full/P0_1_GIT_FORENSIC_TIMELINE.md). Correctif : réutilise TEL QUEL
// evaluateLegacyExecuteGovernance (src/lib/pierre/legacy-execute-governance.ts, même
// module que /api/pierre/action en P0.2) avant toute action. Aucune règle canonique
// actuelle ne permet à email.send/doc.generate/hris.sync d'atteindre ALLOW sur cette
// route (email.send bloqué en dur ; doc.generate et hris.sync exigent une approbation
// humaine tant qu'aucun contexte CloneTrust réel n'est câblé ici) : le connecteur Make
// direct (callMake, 3 URLs MAKE_*) a donc été retiré entièrement plutôt que laissé
// comme code mort inatteignable — voir audit-20260723-full/P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md.

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
  | "EXECUTION_NOT_AVAILABLE"
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
 * 6) Schemas
 * =========================================
 */
const ExecuteSchema = z.object({
  client_id: z.string().min(3),
  action: z.string().min(3),
  payload: z.object({}).passthrough().default({}),
});

/**
 * =========================================
 * 7) Handler
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

  // 7) Governance (CloneGuard + Governance canonique) puis exécution
  const KNOWN_ACTIONS = ["email.send", "doc.generate", "hris.sync"] as const;

  try {
    if ((KNOWN_ACTIONS as readonly string[]).includes(action)) {
      const governanceDecision = evaluateLegacyExecuteGovernance({
        action,
        payload: payload ?? null,
        now: new Date().toISOString(),
      });

      // Hard route floor : hris.sync ne peut jamais dispatcher depuis cette route,
      // même si le moteur canonique retournait un jour ALLOW par erreur — ce plancher
      // est délibérément indépendant du moteur lui-même (défense en profondeur exigée
      // par le bloc de re-clôture P0.1).
      const outcome =
        action === "hris.sync" && governanceDecision.outcome === "ALLOW"
          ? "REQUIRE_APPROVAL"
          : governanceDecision.outcome;

      if (outcome !== "ALLOW") {
        const code: ApiErrorCode = outcome === "DENY" ? "GOVERNANCE_BLOCKED" : "HUMAN_APPROVAL_REQUIRED";
        const status = outcome === "DENY" ? 403 : 202;

        await auditLog({
          client_id,
          action,
          payload,
          ok: false,
          result: { decision: outcome, governance: governanceDecision.summary },
          supabaseAdmin,
        });

        return NextResponse.json(
          {
            ok: false,
            action,
            decision: outcome,
            error: {
              code,
              message: governanceDecision.explanation,
              governance: governanceDecision.summary,
            },
          },
          { status }
        );
      }

      // outcome === "ALLOW" : aucune règle canonique actuelle ne produit ce résultat
      // pour email.send/doc.generate/hris.sync sur cette route (voir
      // audit-20260723-full/P0_1_GOVERNANCE_DECISION_MATRIX.md). Le connecteur Make
      // direct a été retiré entièrement de ce fichier (Phase 6 de la re-clôture) plutôt
      // que laissé comme code mort inatteignable : il n'existe donc physiquement plus
      // aucun chemin de dispatch ici. Si ce résultat survenait malgré tout (évolution
      // future du moteur canonique), on refuse explicitement plutôt que de laisser un
      // chemin non testé s'exécuter.
      await auditLog({
        client_id,
        action,
        payload,
        ok: false,
        result: { decision: "ALLOW", governance: governanceDecision.summary },
        supabaseAdmin,
      });
      return jsonFail(
        "EXECUTION_NOT_AVAILABLE",
        "Direct dispatch has been removed from this route; a reviewed connector reintroduction is required before any ALLOW outcome can execute.",
        { action },
        501
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

