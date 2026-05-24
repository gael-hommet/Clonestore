// src/app/api/pierre/use/cloneadn/analyze/route.ts
// CloneADN analysis — GET (profile analysis), POST (action analysis)
// Bloc 28. Read-only analysis. No writes. No email. No mission. No throw.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readPierreCloneADNFromReusableContext,
  analyzeCloneADNProfile,
  buildCloneADNApplicationContext,
  evaluatePierreActionWithCloneADN,
} from "../../../../../../lib/pierre/adn/cloneadn";
import { buildDefaultCloneADNProfile } from "../../../../../../lib/clonestore/adn/profile";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(request: NextRequest, admin: SupabaseClient): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) throw { status: 401, code: "AUTH_SESSION_MISSING", message: "Auth session missing." };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, code: "AUTH_INVALID", message: "Unable to authenticate." };
  return data.user.id;
}

async function hasPierreAccess(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.from("orders").select("id").eq("user_id", userId).eq("agent_slug", "pierre").eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

async function readReusableContext(admin: SupabaseClient, userId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data } = await admin.from("pierre_company_memory").select("reusable_rh_context_json").eq("user_id", userId).eq("agent_slug", "pierre").maybeSingle();
    if (!data) return null;
    return isObject(data.reusable_rh_context_json) ? (data.reusable_rh_context_json as Record<string, unknown>) : null;
  } catch { return null; }
}

// ── GET — profile analysis ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const rh = await readReusableContext(admin, userId);
    const profile = readPierreCloneADNFromReusableContext(rh) ?? buildDefaultCloneADNProfile();
    const analysis = analyzeCloneADNProfile(profile);
    const appContext = buildCloneADNApplicationContext(profile);

    return NextResponse.json({
      ok: true,
      analysis,
      app_context: appContext,
      profile_status: profile.status,
      completeness_score: profile.completeness_score,
    });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}

// ── POST — action analysis (evaluate a specific action against CloneADN) ──────

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const body: unknown = await request.json();
    if (!isObject(body)) return jsonError("Request body must be an object.", 400, { code: "INVALID_BODY" });

    const taskType = typeof body["task_type"] === "string" ? body["task_type"] : null;
    const domain = typeof body["domain"] === "string" ? body["domain"] : null;
    const riskLevel = typeof body["risk_level"] === "string" ? body["risk_level"] : null;
    const sensitiveTopics = Array.isArray(body["sensitive_topics"])
      ? (body["sensitive_topics"] as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    const text = typeof body["text"] === "string" ? body["text"] : null;

    const rh = await readReusableContext(admin, userId);
    const profile = readPierreCloneADNFromReusableContext(rh) ?? buildDefaultCloneADNProfile();

    const evaluation = evaluatePierreActionWithCloneADN({
      profile,
      taskType,
      domain,
      riskLevel,
      sensitiveTopics,
      text,
    });

    return NextResponse.json({
      ok: true,
      task_type: taskType,
      domain,
      risk_level: riskLevel,
      evaluation,
    });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}
