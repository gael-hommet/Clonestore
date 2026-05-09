// src/app/api/pierre/run/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * =========================================
 * 0) ENV
 * =========================================
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ROUTER_HMAC_SECRET = process.env.ROUTER_HMAC_SECRET!;

function assertEnv() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!ROUTER_HMAC_SECRET) missing.push("ROUTER_HMAC_SECRET");
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}
assertEnv();

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * =========================================
 * 1) Helpers
 * =========================================
 */
type ApiErrorCode =
  | "UNAUTHORIZED"
  | "CLIENT_ID_MISMATCH"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "GENERATE_ERROR"
  | "EXECUTE_ERROR"
  | "INTERNAL_ERROR";

function jsonOk(result: any) {
  return NextResponse.json({ ok: true, result }, { status: 200 });
}

function jsonFail(code: ApiErrorCode, message: string, details?: any, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
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
 */
function assertRouterAuth(req: Request, rawBody: string) {
  const clientId = req.headers.get("x-client-id") || "";
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";

  if (!clientId || !timestamp || !signature) throw new Error("UNAUTHORIZED");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("UNAUTHORIZED");

  const now = Date.now();
  if (Math.abs(now - ts) > 5 * 60 * 1000) throw new Error("UNAUTHORIZED");

  const expected = crypto
    .createHmac("sha256", ROUTER_HMAC_SECRET)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");

  if (!timingSafeEqualHex(expected, signature)) throw new Error("UNAUTHORIZED");
  return clientId;
}

/**
 * =========================================
 * 3) Access check (Pierre configuré)
 * =========================================
 */
async function assertPierreAccess(client_id: string) {
  const { data: cfg, error } = await supabaseAdmin
    .from("agent_configs")
    .select("client_id,agent_key")
    .eq("client_id", client_id)
    .eq("agent_key", "pierre")
    .maybeSingle();

  if (error) throw error;
  if (!cfg) throw new Error("FORBIDDEN");
}

/**
 * =========================================
 * 4) Audit best-effort
 * =========================================
 */
async function auditLog(params: {
  client_id: string;
  action: string;
  payload: any;
  ok: boolean;
  result: any;
  actor?: string;
}) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      client_id: params.client_id,
      action: params.action,
      payload: params.payload ?? {},
      ok: params.ok,
      result: params.result ?? {},
      actor: params.actor ?? "system",
    });
  } catch {
    // ignore
  }
}

/**
 * =========================================
 * 5) Schemas
 * =========================================
 */
const RunSchema = z.object({
  client_id: z.string().min(3),
  request_id: z.string().min(3),
  mission: z.enum(["doc", "email", "hris"]),
  payload: z.object({}).passthrough().default({}),
});

/**
 * generate output minimal (on valide le strict côté generate déjà)
 */
const GeneratedActionSchema = z.object({
  type: z.literal("call_execute"),
  action: z.string().min(3),
  payload: z.object({}).passthrough(),
});

const GenerateResultSchema = z.object({
  agent: z.literal("pierre"),
  request_id: z.string().min(3),
  reasoning_summary: z.string().min(1),
  actions: z.array(GeneratedActionSchema).min(1),
  safety: z
    .object({
      pii_detected: z.boolean(),
      requires_human_review: z.boolean(),
      notes: z.string().optional(),
    })
    .passthrough(),
});

/**
 * =========================================
 * 6) Internal fetch (robust + timeout)
 * =========================================
 */
async function fetchJson(url: string, options: RequestInit, timeoutMs = 45000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _non_json: true, text };
    }

    return { ok: res.ok, status: res.status, json };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      json: { _fetch_error: true, message: e?.message ?? "unknown" },
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * =========================================
 * 7) Handler
 * =========================================
 */
export async function POST(req: Request) {
  const raw = await req.text();

  // 1) Auth HMAC
  let client_id_from_header = "";
  try {
    client_id_from_header = assertRouterAuth(req, raw);
  } catch {
    return jsonFail("UNAUTHORIZED", "Router signature invalid or missing", undefined, 401);
  }

  // 2) Parse JSON
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonFail("BAD_REQUEST", "Invalid JSON body");
  }

  // 3) Validate input
  let input: z.infer<typeof RunSchema>;
  try {
    input = RunSchema.parse(body);
  } catch (e: any) {
    return jsonFail("BAD_REQUEST", "Validation error", { zod: e?.errors ?? e }, 400);
  }

  const { client_id, request_id, mission, payload } = input;

  // 4) client_id must match signed header
  if (client_id !== client_id_from_header) {
    await auditLog({
      client_id,
      action: "pierre.run",
      payload: input,
      ok: false,
      result: { error: "CLIENT_ID_MISMATCH" },
    });
    return jsonFail("CLIENT_ID_MISMATCH", "client_id mismatch", undefined, 403);
  }

  // 5) Access check
  try {
    await assertPierreAccess(client_id);
  } catch (e: any) {
    await auditLog({
      client_id,
      action: "pierre.run",
      payload: input,
      ok: false,
      result: { error: "FORBIDDEN" },
    });
    return jsonFail("FORBIDDEN", "Pierre access denied or not configured", undefined, 403);
  }

  // 6) Build base url (same host)
  const origin = new URL(req.url).origin;

  // Propagate HMAC headers + worker secret to /generate and /execute
  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": req.headers.get("x-client-id") || "",
    "x-timestamp": req.headers.get("x-timestamp") || "",
    "x-signature": req.headers.get("x-signature") || "",
  };
  const workerSecretEnv = process.env.PIERRE_QUEUE_WORKER_SECRET;
  if (workerSecretEnv) {
    forwardHeaders["x-pierre-worker-secret"] = workerSecretEnv;
  }

  // 7) Call generate
  const generateBody = { client_id, request_id, mission, payload };
  const gen = await fetchJson(`${origin}/api/pierre/generate`, {
    method: "POST",
    headers: forwardHeaders,
    body: JSON.stringify(generateBody),
  });

  if (!gen.ok) {
    await auditLog({
      client_id,
      action: "pierre.run",
      payload: { step: "generate", generateBody },
      ok: false,
      result: { status: gen.status, response: gen.json },
    });
    return jsonFail(
      "GENERATE_ERROR",
      "Generate failed",
      { status: gen.status, ok: gen.ok, json: gen.json },
      502
    );
  }

  const genResultRaw = gen.json?.result;
  let genResult: z.infer<typeof GenerateResultSchema>;
  try {
    genResult = GenerateResultSchema.parse(genResultRaw);
  } catch (e: any) {
    await auditLog({
      client_id,
      action: "pierre.run",
      payload: { step: "generate_parse", generateBody },
      ok: false,
      result: { zod: e?.errors ?? e, raw: gen.json },
    });
    return jsonFail(
      "GENERATE_ERROR",
      "Generate returned invalid format",
      { zod: e?.errors ?? e, raw: gen.json },
      502
    );
  }

  // 8) Execute actions sequentially (safe + traceable)
  const executions: Array<{
    index: number;
    action: string;
    ok: boolean;
    status: number;
    response: any;
  }> = [];

  for (let i = 0; i < genResult.actions.length; i++) {
    const a = genResult.actions[i];

    const execBody = {
      client_id,
      action: a.action,
      payload: a.payload ?? {},
    };

    const exec = await fetchJson(`${origin}/api/pierre/execute`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(execBody),
    });

    executions.push({
      index: i,
      action: a.action,
      ok: exec.ok,
      status: exec.status,
      response: exec.json,
    });

    // stop on first failure (premium safety)
    if (!exec.ok) break;
  }

  const allOk = executions.length > 0 && executions.every((x) => x.ok);

  // 9) Audit run summary
  await auditLog({
    client_id,
    action: "pierre.run",
    payload: { client_id, request_id, mission },
    ok: allOk,
    result: {
      reasoning_summary: genResult.reasoning_summary,
      actions_count: genResult.actions.length,
      executed_count: executions.length,
      executions,
    },
  });

  // 10) Return summary
  return jsonOk({
    agent: "pierre",
    request_id,
    mission,
    reasoning_summary: genResult.reasoning_summary,
    planned_actions: genResult.actions,
    executions,
    ok: allOk,
  });
}





