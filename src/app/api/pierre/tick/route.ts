// src/app/api/pierre/tick/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, PostgrestError } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * ========= ENV (NE JAMAIS THROW AU TOP-LEVEL) =========
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ROUTER_HMAC_SECRET = process.env.ROUTER_HMAC_SECRET || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

function jsonFail(code: string, message: string, details?: any, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, { status });
}
function jsonOk(result: any) {
  return NextResponse.json({ ok: true, result }, { status: 200 });
}

function isPostgrestError(e: any): e is PostgrestError {
  return e && typeof e === "object" && typeof e.message === "string";
}

function getOrigin(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

function signHmac(clientId: string, rawBody: string) {
  const timestamp = String(Date.now());
  const signature = crypto
    .createHmac("sha256", ROUTER_HMAC_SECRET)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");
  return { timestamp, signature };
}

const TickQuerySchema = z.object({
  secret: z.string().min(10),
  limit: z.coerce.number().int().min(1).max(25).default(5),
});

function nextRunAt(attempts: number) {
  const mins = Math.min(15, Math.max(1, Math.pow(2, attempts)));
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export async function GET(req: Request) {
  // ✅ Validation env au runtime (pas au build)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonFail("ENV_ERROR", "Missing Supabase env vars", { need: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] }, 500);
  }
  if (!ROUTER_HMAC_SECRET) {
    return jsonFail("ENV_ERROR", "Missing ROUTER_HMAC_SECRET", undefined, 500);
  }
  if (!CRON_SECRET) {
    return jsonFail("ENV_ERROR", "Missing CRON_SECRET", undefined, 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

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

    const origin = getOrigin(req);
    if (!origin) {
      return jsonFail("INTERNAL_ERROR", "Cannot determine origin (host/proto)", undefined, 500);
    }

    const limit = parsed.data.limit;

    // 1) pick tasks
    const { data: candidates, error: pickErr } = await supabaseAdmin
      .from("pierre_queue")
      .select("id, client_id, action, payload, attempts, run_at, status")
      .eq("status", "queued")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(limit);

    if (pickErr) throw pickErr;

    let processed = 0;
    let done = 0;
    let failed = 0;

    for (const c of candidates ?? []) {
      // 2) lock task
      const lockToken = crypto.randomBytes(16).toString("hex");

      const { data: locked, error: lockErr } = await supabaseAdmin
        .from("pierre_queue")
        .update({
          status: "processing",
          locked_at: new Date().toISOString(),
          lock_token: lockToken,
        })
        .eq("id", c.id)
        .eq("status", "queued")
        .is("lock_token", null)
        .select("id, client_id, action, payload, attempts, lock_token")
        .maybeSingle();

      if (lockErr) throw lockErr;
      if (!locked) continue;

      processed++;

      // 3) call execute
      try {
        const bodyObj = { client_id: locked.client_id, action: locked.action, payload: locked.payload ?? {} };
        const raw = JSON.stringify(bodyObj);
        const { timestamp, signature } = signHmac(locked.client_id, raw);

        const res = await fetch(`${origin}/api/pierre/execute`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-client-id": locked.client_id,
            "x-timestamp": timestamp,
            "x-signature": signature,
          },
          body: raw,
        });

        const text = await res.text();
        let json: any;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = text;
        }

        if (!res.ok || !json?.ok) {
          const reason = typeof json === "string" ? json : JSON.stringify(json);
          throw new Error(`execute_failed: ${res.status} ${reason}`);
        }

        // 4) done
        const { error: doneErr } = await supabaseAdmin
          .from("pierre_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", locked.id)
          .eq("lock_token", locked.lock_token);

        if (doneErr) throw doneErr;

        done++;
      } catch (e: any) {
        const attempts = Number(locked.attempts ?? 0);
        const msg = String(e?.message ?? "unknown_error");

        const isDead = attempts + 1 >= 6;
        const runAt = isDead ? new Date().toISOString() : nextRunAt(attempts + 1);

        const { error: failErr } = await supabaseAdmin
          .from("pierre_queue")
          .update({
            status: isDead ? "dead" : "queued",
            attempts: attempts + 1,
            last_error: msg,
            run_at: runAt,
            locked_at: null,
            lock_token: null,
          })
          .eq("id", locked.id)
          .eq("lock_token", locked.lock_token);

        if (failErr) throw failErr;

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




