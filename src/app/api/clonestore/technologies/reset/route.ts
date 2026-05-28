// B46 — POST /api/clonestore/technologies/reset
// Reset technology configuration to safe defaults. Auth required. Cache: no-store.
// Requires exact confirmation phrase. Never disables CloneGuard/CloneTrace.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildAllB46TechnologyItems } from "../../../../../lib/clonestore/technologies/technology-b46-registry";
import { getDefaultB46ReadinessContext } from "../../../../../lib/clonestore/technologies/technology-readiness";

const RESET_CONFIRMATION_PHRASE = "RESET_CLONESTORE_TECHNOLOGIES";

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

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch {
      return NextResponse.json(
        { ok: false, error: "Corps JSON invalide.", code: "INVALID_JSON_BODY" },
        { status: 400, headers },
      );
    }

    const body = isObject(rawBody) ? rawBody : {};

    // Confirmation phrase required
    const confirmation = asString(body.confirmation);
    if (confirmation !== RESET_CONFIRMATION_PHRASE) {
      return NextResponse.json(
        {
          ok: false,
          error: `Phrase de confirmation requise : "${RESET_CONFIRMATION_PHRASE}".`,
          code: "RESET_CONFIRMATION_REQUIRED",
          required_phrase: RESET_CONFIRMATION_PHRASE,
        },
        { status: 400, headers },
      );
    }

    // Build safe defaults — CloneGuard/CloneTrace always remain active
    const context = getDefaultB46ReadinessContext({
      email_runtime_mode: process.env.EMAIL_RUNTIME_MODE ?? "mock",
      ai_runtime_mode: process.env.AI_RUNTIME_MODE ?? "mock",
    });

    const resetItems = buildAllB46TechnologyItems(context, {
      // Force locked technologies to active — they can never be reset to disabled
      cloneguard: "active",
      clonetrace: "active",
    });

    return NextResponse.json(
      {
        ok: true,
        reset: true,
        technologies: resetItems.map((t) => ({
          id: t.id,
          status: t.status,
          locked: t.locked,
          enabled: t.enabled,
          runtime_mode: t.runtime_mode,
        })),
        guardrails: {
          cloneguard_preserved: true,
          clonetrace_preserved: true,
          note: "CloneGuard et CloneTrace ne peuvent jamais être désactivés par reset.",
        },
        meta: {
          user_id: userId,
          persisted: false, // memory adapter — wire Supabase for persistence
          generated_at: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return NextResponse.json(
        { ok: false, error: asString(error.message) || "Requête échouée.", code: asString(error.code) ?? undefined },
        { status: error.status as number, headers },
      );
    }
    const msg = error instanceof Error ? error.message : "Erreur interne reset.";
    return NextResponse.json({ ok: false, error: msg, code: "RESET_INTERNAL_ERROR" }, { status: 500, headers });
  }
}
