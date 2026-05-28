// B46 — GET /api/clonestore/technologies/snapshot
// Full B46 TechnologiesSnapshot. Auth required. Cache: no-store.
// No Supabase mandatory — works with defaults if not configured.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildTechnologiesSnapshot } from "../../../../../lib/clonestore/technologies/technology-b46-registry";
import { getDefaultB46ReadinessContext } from "../../../../../lib/clonestore/technologies/technology-readiness";
import type { B46ReadinessContext } from "../../../../../lib/clonestore/technologies/technology-b46-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadCookieToken(request: NextRequest): string | null {
  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const v = request.cookies.get(key)?.value;
    if (v) return v;
  }
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.includes("auth-token")) continue;
    const raw = cookie.value;
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const c = parsed.find((i): i is string => typeof i === "string" && i.split(".").length === 3);
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
      }
    } catch { if (raw.split(".").length === 3) return raw; }
  }
  return null;
}

async function authenticateRequest(
  request: NextRequest,
  admin: SupabaseClient,
): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session manquante.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Authentification échouée.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasActiveOrder(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.from("orders").select("id")
      .eq("user_id", userId).in("status", ["active", "trialing"]).limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

function buildReadinessContext(): B46ReadinessContext {
  return getDefaultB46ReadinessContext({
    email_runtime_mode: process.env.EMAIL_RUNTIME_MODE ?? "mock",
    ai_runtime_mode: process.env.AI_RUNTIME_MODE ?? "mock",
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Supabase non configuré.", code: "SUPABASE_NOT_CONFIGURED" },
        { status: 503, headers },
      );
    }

    const userId = await authenticateRequest(request, admin);
    await hasActiveOrder(admin, userId); // best-effort — no block if query fails

    const context = buildReadinessContext();
    const snapshot = buildTechnologiesSnapshot({ userId, context });

    return NextResponse.json({ ok: true, snapshot }, { status: 200, headers });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return NextResponse.json(
        { ok: false, error: asString(error.message) || "Requête échouée.", code: asString(error.code) ?? undefined },
        { status: error.status as number, headers },
      );
    }
    const msg = error instanceof Error ? error.message : "Erreur interne snapshot.";
    return NextResponse.json({ ok: false, error: msg, code: "SNAPSHOT_INTERNAL_ERROR" }, { status: 500, headers });
  }
}
