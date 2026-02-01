// src/app/api/pierre/enqueue/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * ========= ENV =========
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
 * ========= Helpers =========
 */
function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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
 * ========= Schema =========
 */
const EnqueueSchema = z.object({
  client_id: z.string().min(3),
  mission: z.enum(["doc", "email", "hris"]),
  // payload libre, on le stocke tel quel
  payload: z.any().optional(),
  // optionnel : exécuter plus tard (ISO string)
  run_at: z.string().datetime().optional(),
});

/**
 * ========= Handler =========
 */
export async function POST(req: Request) {
  const raw = await req.text();

  // 1) HMAC
  let clientFromHeader = "";
  try {
    clientFromHeader = assertRouterAuth(req, raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Router signature invalid or missing" } },
      { status: 401 }
    );
  }

  // 2) JSON parse
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  // 3) Validate
  const parsed = EnqueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Validation error", details: parsed.error.issues } },
      { status: 400 }
    );
  }

  const { client_id, mission, payload, run_at } = parsed.data;

  // 4) client_id must match signature header
  if (client_id !== clientFromHeader) {
    return NextResponse.json(
      { ok: false, error: { code: "CLIENT_ID_MISMATCH", message: "client_id mismatch" } },
      { status: 403 }
    );
  }

  // 5) Map mission -> action (IMPORTANT : action NOT NULL)
  const action =
    mission === "doc" ? "doc.generate" : mission === "email" ? "email.send" : "hris.sync";

  // 6) Insert queue row
  const row = {
    client_id,
    action,            // ✅ rempli => plus de 500 "action null"
    task_type: mission, // ✅ aussi, vu que tu l’as dans la table
    payload: payload ?? {},
    status: "queued",
    run_at: run_at ? new Date(run_at).toISOString() : new Date().toISOString(),
    attempts: 0,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_queue")
    .insert(row)
    .select("id, client_id, action, task_type, status, run_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "DB_ERROR", message: "Insert failed", details: error } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, result: data }, { status: 200 });
}
