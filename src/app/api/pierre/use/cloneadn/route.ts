// src/app/api/pierre/use/cloneadn/route.ts
// CloneADN profile — GET (read), PUT (full replace), PATCH (merge)
// Bloc 28. No email. No mission creation. No task creation. No throw.
// Writes only to reusable_rh_context_json.clone_adn.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readPierreCloneADNFromReusableContext,
  buildPierreCloneADNStoragePatch,
  sanitizeCloneADNProfile,
  analyzeCloneADNProfile,
  buildCloneADNApplicationContext,
} from "../../../../../lib/pierre/adn/cloneadn";
import {
  buildDefaultCloneADNProfile,
  mergeCloneADNProfilePatch,
} from "../../../../../lib/clonestore/adn/profile";
import type { CloneADNProfilePatch } from "../../../../../lib/clonestore/adn/types";

// ── Types ─────────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function authenticate(request: NextRequest, admin: SupabaseClient): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    const cookies = request.cookies.getAll();
    let cookieToken: string | null = null;
    for (const c of cookies) {
      if (c.name.includes("auth-token") && c.value) {
        try {
          const parsed: unknown = JSON.parse(c.value);
          if (Array.isArray(parsed)) {
            const candidate = parsed.find((x): x is string => typeof x === "string" && x.split(".").length === 3);
            if (candidate) { cookieToken = candidate; break; }
          }
        } catch {
          if (c.value.split(".").length === 3) { cookieToken = c.value; break; }
        }
      }
    }
    if (!cookieToken) throw { status: 401, code: "AUTH_SESSION_MISSING", message: "Auth session missing." };
    const { data, error } = await admin.auth.getUser(cookieToken);
    if (error || !data.user) throw { status: 401, code: "AUTH_INVALID", message: "Unable to authenticate." };
    return data.user.id;
  }

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

// ── Company memory helpers ────────────────────────────────────────────────────

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
  if (error) throw { status: 500, code: "DB_WRITE_FAILED", message: "Failed to save CloneADN profile." };
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
    const analysis = analyzeCloneADNProfile(profile);
    const appContext = buildCloneADNApplicationContext(profile);

    return NextResponse.json({
      ok: true,
      profile,
      analysis,
      app_context: appContext,
    });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}

// ── PUT (full replace) ────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const body: unknown = await request.json();
    if (!isObject(body)) return jsonError("Request body must be an object.", 400, { code: "INVALID_BODY" });

    const profile = sanitizeCloneADNProfile(body);
    if (!profile) return jsonError("Invalid CloneADN profile data.", 400, { code: "INVALID_PROFILE" });

    const rh = (await readReusableContext(admin, userId)) ?? {};
    const patch = buildPierreCloneADNStoragePatch({ reusableRhContextJson: rh, profile });
    await writeReusableContext(admin, userId, patch);

    const analysis = analyzeCloneADNProfile(profile);
    return NextResponse.json({ ok: true, profile, analysis });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}

// ── PATCH (merge) ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(request, admin);
    const access = await hasPierreAccess(admin, userId);
    if (!access) return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const body: unknown = await request.json();
    if (!isObject(body)) return jsonError("Request body must be an object.", 400, { code: "INVALID_BODY" });

    const rh = await readReusableContext(admin, userId);
    const existing = readPierreCloneADNFromReusableContext(rh) ?? buildDefaultCloneADNProfile();

    const merged = mergeCloneADNProfilePatch(existing, body as CloneADNProfilePatch);

    const existingRh = rh ?? {};
    const patch = buildPierreCloneADNStoragePatch({ reusableRhContextJson: existingRh, profile: merged });
    await writeReusableContext(admin, userId, patch);

    const analysis = analyzeCloneADNProfile(merged);
    return NextResponse.json({ ok: true, profile: merged, analysis });
  } catch (err) {
    if (isObject(err) && typeof (err as Record<string, unknown>).status === "number") {
      const e = err as { status: number; code?: string; message?: string };
      return jsonError(e.message ?? "Request failed.", e.status, { code: e.code });
    }
    return jsonError("Internal server error.", 500);
  }
}
