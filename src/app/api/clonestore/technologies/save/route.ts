// B46 — POST /api/clonestore/technologies/save
// Safe patch for technology configuration. Auth required. Cache: no-store.
// Strips tenant spoofing. Refuses dangerous patches. Never disables locked techs.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildB46TechnologyItem, getTechnologyById } from "../../../../../lib/clonestore/technologies/technology-b46-registry";
import { getDefaultB46ReadinessContext } from "../../../../../lib/clonestore/technologies/technology-readiness";
import {
  isLockedTechnology,
  canEditTechnologyConfig,
  resolveAccessLevel,
} from "../../../../../lib/clonestore/technologies/technology-permissions";
import type {
  CloneStoreTechnologyId,
  B46TechnologyStatus,
  B46TechnologyRuntimeMode,
  TechnologyAccessLevel,
} from "../../../../../lib/clonestore/technologies/technology-b46-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

const TENANT_SPOOFING_FIELDS = new Set(["user_id", "company_id", "organization_id", "tenant_id", "id"]);

function stripTenantSpoofing(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!TENANT_SPOOFING_FIELDS.has(k)) result[k] = v;
  }
  return result;
}

const VALID_IDS = new Set<CloneStoreTechnologyId>(["cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat"]);
const VALID_STATUSES = new Set<B46TechnologyStatus>(["disabled", "draft", "needs_configuration", "ready", "active", "degraded", "blocked"]);
const VALID_RUNTIME_MODES = new Set<B46TechnologyRuntimeMode>(["mock", "dry_run", "sandbox", "production", "disabled"]);

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

async function resolveUserAccessLevel(admin: SupabaseClient, userId: string): Promise<TechnologyAccessLevel> {
  try {
    const { data } = await admin.from("orders").select("id")
      .eq("user_id", userId).in("status", ["active", "trialing"]).limit(1).maybeSingle();
    return resolveAccessLevel({
      has_active_order: Boolean(data),
      is_internal_admin: false,
      is_authenticated: true,
      is_trial: false,
    });
  } catch {
    return "logged_unpaid";
  }
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
    const accessLevel = await resolveUserAccessLevel(admin, userId);

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch {
      return NextResponse.json(
        { ok: false, error: "Corps JSON invalide.", code: "INVALID_JSON_BODY" },
        { status: 400, headers },
      );
    }

    const body = isObject(rawBody) ? rawBody : {};

    // Strip tenant spoofing from entire body
    const safeBody = stripTenantSpoofing(body);

    const techId = asString(safeBody.technology_id);
    if (!techId || !VALID_IDS.has(techId as CloneStoreTechnologyId)) {
      return NextResponse.json(
        { ok: false, error: "technology_id invalide ou manquant.", code: "INVALID_TECHNOLOGY_ID" },
        { status: 400, headers },
      );
    }
    const id = techId as CloneStoreTechnologyId;

    // Permission check
    if (!canEditTechnologyConfig(accessLevel, id)) {
      return NextResponse.json(
        { ok: false, error: `Modification de ${id} non autorisée pour ce niveau d'accès.`, code: "EDIT_NOT_PERMITTED" },
        { status: 403, headers },
      );
    }

    // Block setting CloneVoice to production by customer
    const patchRaw = isObject(safeBody.patch) ? safeBody.patch : {};
    const patch = stripTenantSpoofing(patchRaw);

    if (
      id === "clonevoice" &&
      typeof patch.runtime_mode === "string" &&
      patch.runtime_mode === "production" &&
      accessLevel !== "internal_admin"
    ) {
      return NextResponse.json(
        { ok: false, error: "CloneVoice ne peut pas être mis en mode production sans admin interne.", code: "CLONEVOICE_PRODUCTION_DENIED" },
        { status: 403, headers },
      );
    }

    // Block disabling locked technologies
    if (isLockedTechnology(id) && (patch.status === "disabled" || patch.enabled === false)) {
      return NextResponse.json(
        { ok: false, error: `${id} est verrouillé et ne peut pas être désactivé.`, code: "TECHNOLOGY_LOCKED" },
        { status: 403, headers },
      );
    }

    // Build the updated item (no real DB write without Supabase tables — returns computed state)
    const context = getDefaultB46ReadinessContext({
      email_runtime_mode: process.env.EMAIL_RUNTIME_MODE ?? "mock",
      ai_runtime_mode: process.env.AI_RUNTIME_MODE ?? "mock",
    });

    const newStatus = (
      typeof patch.status === "string" && VALID_STATUSES.has(patch.status as B46TechnologyStatus)
    ) ? patch.status as B46TechnologyStatus : undefined;

    const updatedItem = buildB46TechnologyItem(id, context, newStatus);
    const techDisplay = getTechnologyById(id);

    return NextResponse.json(
      {
        ok: true,
        technology_id: id,
        updated: updatedItem,
        display: techDisplay.display,
        meta: {
          user_id: userId,
          access_level: accessLevel,
          applied_patch_keys: Object.keys(patch),
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
    const msg = error instanceof Error ? error.message : "Erreur interne save.";
    return NextResponse.json({ ok: false, error: msg, code: "SAVE_INTERNAL_ERROR" }, { status: 500, headers });
  }
}
