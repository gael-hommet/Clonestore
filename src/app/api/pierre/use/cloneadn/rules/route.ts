// src/app/api/pierre/use/cloneadn/rules/route.ts
// CloneADN rules — GET (list), POST (add/replace rule)
// Bloc 28. No email. No mission. No throw.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readPierreCloneADNFromReusableContext,
  buildPierreCloneADNStoragePatch,
  sanitizeCloneADNProfile,
  buildCloneADNRuleSummary,
} from "../../../../../../lib/pierre/adn/cloneadn";
import {
  buildDefaultCloneADNProfile,
  sanitizeCloneADNRule,
} from "../../../../../../lib/clonestore/adn/profile";
import type { CloneADNRule } from "../../../../../../lib/clonestore/adn/types";

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

async function writeReusableContext(admin: SupabaseClient, userId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await admin.from("pierre_company_memory").upsert(
    { user_id: userId, agent_slug: "pierre", reusable_rh_context_json: patch },
    { onConflict: "user_id,agent_slug" },
  );
  if (error) throw { status: 500, code: "DB_WRITE_FAILED", message: "Failed to save rules." };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const rh = await readReusableContext(admin, userId);
    const profile = readPierreCloneADNFromReusableContext(rh) ?? buildDefaultCloneADNProfile();
    const summary = buildCloneADNRuleSummary(profile);

    return NextResponse.json({
      ok: true,
      rules: profile.rules,
      summary,
    });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}

// ── POST (upsert rule) ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const body: unknown = await request.json();
    if (!isObject(body)) return jsonError("Request body must be an object.", 400, { code: "INVALID_BODY" });

    const rule = sanitizeCloneADNRule(body);
    if (!rule) return jsonError("Invalid rule data. 'id' and 'label' are required.", 400, { code: "INVALID_RULE" });

    const rh = await readReusableContext(admin, userId);
    const existing = readPierreCloneADNFromReusableContext(rh) ?? buildDefaultCloneADNProfile();

    // Upsert: replace existing rule with same id, otherwise append
    const existingRules: CloneADNRule[] = existing.rules;
    const idx = existingRules.findIndex((r) => r.id === rule.id);
    let updatedRules: CloneADNRule[];
    if (idx >= 0) {
      updatedRules = [...existingRules];
      updatedRules[idx] = rule;
    } else {
      if (existingRules.length >= 100) {
        return jsonError("Maximum 100 rules per company.", 400, { code: "MAX_RULES_EXCEEDED" });
      }
      updatedRules = [...existingRules, rule];
    }

    const updatedProfile = sanitizeCloneADNProfile({ ...existing, rules: updatedRules });
    if (!updatedProfile) return jsonError("Failed to update profile.", 500, { code: "PROFILE_UPDATE_FAILED" });

    const existingRh = rh ?? {};
    const patch = buildPierreCloneADNStoragePatch({ reusableRhContextJson: existingRh, profile: updatedProfile });
    await writeReusableContext(admin, userId, patch);

    return NextResponse.json({
      ok: true,
      rule,
      total_rules: updatedRules.length,
    });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}
