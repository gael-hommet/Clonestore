import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getCloneStoreTechnologyDefinitions,
  buildDefaultTechnologyCompanySettings,
  buildTechnologyRegistry,
} from "../../../../lib/clonestore/technologies/registry";
import {
  mapRowsToSettings,
  legacyExtractSettings,
} from "../../../../lib/clonestore/technologies/storage";
import {
  buildRuntimeSnapshot,
  buildRuntimeContext,
  evaluateRuntimeAction,
  normalizeRuntimeEmployeeSlug,
  normalizeRuntimeActionType,
  normalizeRuntimeRiskLevel,
} from "../../../../lib/clonestore/runtime/engine";
import type { TechnologyCompanySetting } from "../../../../lib/clonestore/technologies/contracts";

// ── Helpers ──────────────────────────────────────────────────────────────────

type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}
function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
function mapDbError(e: unknown) {
  if (isObject(e)) return { message: asString(e.message) || "Database error.", code: asString(e.code) };
  if (e instanceof Error) return { message: e.message, code: null };
  return { message: "Database error.", code: null };
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured.");
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

async function authenticateRequest(request: NextRequest, admin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasAnyActiveOrder(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.from("orders").select("id").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

// ── Storage helpers (same pattern as /api/clonestore/technologies) ────────────

async function loadFromPlatformTable(
  admin: SupabaseClient,
  userId: string,
): Promise<TechnologyCompanySetting[] | null> {
  try {
    const { data, error } = await admin
      .from("clonestore_company_technologies")
      .select("*")
      .eq("user_id", userId);
    if (error) return null;
    if (!data || data.length === 0) return null;
    const defs = getCloneStoreTechnologyDefinitions();
    return mapRowsToSettings(data, defs);
  } catch { return null; }
}

async function loadFromLegacyJson(
  admin: SupabaseClient,
  userId: string,
): Promise<TechnologyCompanySetting[]> {
  try {
    const { data } = await admin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return [];
    const defs = getCloneStoreTechnologyDefinitions();
    return legacyExtractSettings(data.reusable_rh_context_json as Record<string, unknown>, defs);
  } catch { return []; }
}

async function loadTechnologySettings(
  admin: SupabaseClient,
  userId: string,
): Promise<{ settings: TechnologyCompanySetting[]; source: "platform_table" | "legacy_json" | "defaults" }> {
  const fromTable = await loadFromPlatformTable(admin, userId);
  if (fromTable !== null && fromTable.length > 0) {
    return { settings: fromTable, source: "platform_table" };
  }
  const fromLegacy = await loadFromLegacyJson(admin, userId);
  if (fromLegacy.length > 0) {
    return { settings: fromLegacy, source: "legacy_json" };
  }
  return { settings: [], source: "defaults" };
}

// ── Shared: build full registry from DB for a user ───────────────────────────

async function buildRegistryForUser(admin: SupabaseClient, userId: string) {
  const definitions = getCloneStoreTechnologyDefinitions();
  const { settings: dbSettings, source } = await loadTechnologySettings(admin, userId);
  const defaults = buildDefaultTechnologyCompanySettings(definitions);
  const mergedSettings: TechnologyCompanySetting[] = definitions.map((def) => {
    const db = dbSettings.find((s) => s.technology_slug === def.slug);
    return db ?? defaults.find((s) => s.technology_slug === def.slug)!;
  });
  const registry = buildTechnologyRegistry({ definitions, rawSettings: mergedSettings });
  return { registry, definitions, dbSettings, source };
}

// ── GET /api/clonestore/runtime ───────────────────────────────────────────────
// Returns a full CloneRuntimeSnapshot for the requested employee_slug.
// Query params:
//   employee_slug  — defaults to "pierre"

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticateRequest(request, admin);
    const access = await hasAnyActiveOrder(admin, userId);
    if (!access) return jsonError("Accès CloneStore requis.", 403, { code: "ACCESS_DENIED" });

    const url = new URL(request.url);
    const rawEmployeeSlug = url.searchParams.get("employee_slug");
    const employeeSlug = normalizeRuntimeEmployeeSlug(rawEmployeeSlug);

    const { registry, dbSettings, source: storageSource } = await buildRegistryForUser(admin, userId);
    const now = new Date().toISOString();
    const snapshot = buildRuntimeSnapshot(registry, employeeSlug, now);

    return NextResponse.json({
      ok: true,
      snapshot,
      meta: {
        route: "/api/clonestore/runtime",
        userId,
        employeeSlug,
        fetchedAt: now,
        storage_source: storageSource,
        settings_loaded: dbSettings.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, { code: asString(error.code) });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}

// ── POST /api/clonestore/runtime ──────────────────────────────────────────────
// Evaluates an action against the runtime context for the given employee.
// Body (JSON):
//   employee_slug?           — defaults to "pierre"
//   action_type              — required
//   task_type?               — optional hint
//   risk_level?              — "normal"|"guarded"|"strict"|"locked"|"red"|"black"
//   approval_required?       — boolean
//   contains_sensitive_keywords? — boolean

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticateRequest(request, admin);
    const access = await hasAnyActiveOrder(admin, userId);
    if (!access) return jsonError("Accès CloneStore requis.", 403, { code: "ACCESS_DENIED" });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Corps de requête JSON invalide.", 400, { code: "INVALID_JSON" });
    }

    if (!isObject(body)) {
      return jsonError("Corps de requête invalide — objet attendu.", 400, { code: "INVALID_BODY" });
    }

    const employeeSlug = normalizeRuntimeEmployeeSlug(body.employee_slug);
    const actionType = normalizeRuntimeActionType(body.action_type);

    const rawRiskLevel = typeof body.risk_level === "string" ? body.risk_level : null;
    const riskLevel = normalizeRuntimeRiskLevel(rawRiskLevel);
    const approvalRequired = body.approval_required === true;
    const containsSensitiveKeywords =
      body.contains_sensitive_keywords === true ? true :
      body.contains_sensitive_keywords === false ? false : null;

    const { registry, dbSettings, source: storageSource } = await buildRegistryForUser(admin, userId);
    const now = new Date().toISOString();

    const context = buildRuntimeContext(registry, employeeSlug, now);
    const evaluation = evaluateRuntimeAction(
      context,
      actionType,
      {
        approval_required: approvalRequired,
        risk_level: riskLevel,
        contains_sensitive_keywords: containsSensitiveKeywords,
      },
      now,
    );

    return NextResponse.json({
      ok: true,
      evaluation,
      context_summary: {
        employee_slug: context.employee_slug,
        autonomy_level: context.autonomy_level,
        guard_mode: context.guard_mode,
        active_technology_count: context.active_technologies.length,
      },
      meta: {
        route: "/api/clonestore/runtime",
        method: "POST",
        userId,
        employeeSlug,
        action_type: actionType,
        evaluatedAt: now,
        storage_source: storageSource,
        settings_loaded: dbSettings.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, { code: asString(error.code) });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
