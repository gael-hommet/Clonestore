// src/app/api/pierre/tick/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, PostgrestError } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * ========= ENV =========
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

// Pour appeler ton execute interne (HTTP)
const BASE_URL = (process.env.CLONESTORE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const ROUTER_HMAC_SECRET = process.env.ROUTER_HMAC_SECRET!;

function assertEnv() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!CRON_SECRET) missing.push("CRON_SECRET");
  if (!BASE_URL) missing.push("CLONESTORE_BASE_URL");
  if (!ROUTER_HMAC_SECRET) missing.push("ROUTER_HMAC_SECRET");
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}
assertEnv();

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * ========= Helpers =========
 */
type ApiErrorCode = "UNAUTHORIZED" | "BAD_REQUEST" | "DB_ERROR" | "INTERNAL_ERROR";

function jsonFail(code: ApiErrorCode, message: string, details?: any, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, { status });
}

function jsonOk(result: any) {
  return NextResponse.json({ ok: true, result }, { status: 200 });
}

function isPostgrestError(e: any): e is PostgrestError {
  return e && typeof e === "object" && typeof e.message === "string";
}

function signHmac(clientId: string, rawBody: string) {
  const timestamp = String(Date.now());
  const signature = crypto
    .createHmac("sha256", ROUTER_HMAC_SECRET)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");
  return { timestamp, signature };
}

/**
 * ========= Schema =========
 * tick appelé par cron via query ?secret=...
 */
const TickQuerySchema = z.object({
  secret: z.string().min(10),
  limit: z.coerce.number().int().min(1).max(25).default(5),
});

/**
 * ========= Core =========
 */
async function pickOneTask(limit: number) {
  // On prend des tâches prêtes, puis on lock côté app.
  const { data, error } = await supabaseAdmin
    .from("pierre_queue")
    .select("id, client_id, action, payload, attempts, run_at, status")
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function lockTask(id: string) {
  const lockToken = crypto.randomBytes(16).toString("hex");

  // lock best-effort: on ne lock que si encore queued + pas lock_token
  const { data, error } = await supabaseAdmin
    .from("pierre_queue")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      lock_token: lockToken,
    })
    .eq("id", id)
    .eq("status", "queued")
    .is("lock_token", null)
    .select("id, client_id, action, payload, attempts, lock_token")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as any;
}

async function markDone(id: string, lockToken: string) {
  const { error } = await supabaseAdmin
    .from("pierre_queue")
    .update({
      status: "done",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", id)
    .eq("lock_token", lockToken);

  if (error) throw error;
}

function nextRunAt(attempts: number) {
  // backoff simple: 1m, 2m, 4m, 8m, 15m max
  const mins = Math.min(15, Math.max(1, Math.pow(2, attempts)));
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

async function markFailedAndRetry(id: string, lockToken: string, attempts: number, errMsg: string) {
  const next = nextRunAt(attempts + 1);

  const { error } = await supabaseAdmin
    .from("pierre_queue")
    .update({
      status: attempts + 1 >= 6 ? "dead" : "queued",
      attempts: attempts + 1,
      last_error: errMsg,
      run_at: attempts + 1 >= 6 ? new Date().toISOString() : next,
      locked_at: null,
      lock_token: null,
    })
    .eq("id", id)
    .eq("lock_token", lockToken);

  if (error) throw error;
}

async function callExecute(client_id: string, action: string, payload: any) {
  const bodyObj = { client_id, action, payload };
  const raw = JSON.stringify(bodyObj);
  const { timestamp, signature } = signHmac(client_id, raw);

  const res = await fetch(`${BASE_URL}/api/pierre/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": client_id,
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    body: raw,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok || !json?.ok) {
    const reason = typeof json === "string" ? json : JSON.stringify(json);
    throw new Error(`execute_failed: ${res.status} ${reason}`);
  }
  return json;
}

/**
 * ========= Handler =========
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = TickQuerySchema.safeParse({
      secret: url.searchParams.get("secret"),
      limit: url.searchParams.get("limit") ?? "5",
    });

    if (!parsed.success) {
      return jsonFail("BAD_REQUEST", "Invalid query", parsed.error.issues, 400);
    }

    if (parsed.data.secret !== CRON_SECRET) {
      return jsonFail("UNAUTHORIZED", "Invalid cron secret", undefined, 401);
    }

    const limit = parsed.data.limit;

    const candidates = await pickOneTask(limit);

    let processed = 0;
    let done = 0;
    let failed = 0;

    for (const c of candidates) {
      const locked = await lockTask(c.id);
      if (!locked) continue;

      processed++;

      try {
        await callExecute(locked.client_id, locked.action, locked.payload ?? {});
        await markDone(locked.id, locked.lock_token);
        done++;
      } catch (e: any) {
        const msg = String(e?.message ?? "unknown_error");
        await markFailedAndRetry(locked.id, locked.lock_token, locked.attempts ?? 0, msg);
        failed++;
      }
    }

    return jsonOk({ processed, done, failed });
  } catch (e: any) {
    if (isPostgrestError(e)) {
      return jsonFail("DB_ERROR", "Database error", e, 500);
    }
    return jsonFail("INTERNAL_ERROR", String(e?.message ?? "Internal error"), undefined, 500);
  }
}



