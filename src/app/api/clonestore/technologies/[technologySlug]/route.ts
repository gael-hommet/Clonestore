import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getCloneStoreTechnologyDefinitions,
  getTechnologyDefinition,
  buildDefaultTechnologyCompanySettings,
  normalizeTechnologyCompanySetting,
  buildTechnologyRegistry,
  buildTechnologyPublicDigest,
  isTechnologyEnabledForEmployee,
  validateLegacyConfigurationSlug,
} from "../../../../../lib/clonestore/technologies/registry";
import {
  validateTechnologySetting,
  mergeTechnologySettings,
} from "../../../../../lib/clonestore/technologies/configuration";
import {
  normalizeDbRow,
  mapRowToSetting,
  mapSettingToUpsertPayload,
  legacyExtractSettings,
} from "../../../../../lib/clonestore/technologies/storage";
import type {
  TechnologyCompanySetting,
  TechnologySlug,
  TechnologyOperationalStatus,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
} from "../../../../../lib/clonestore/technologies/contracts";

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

// ── Storage helpers ───────────────────────────────────────────────────────────

// Read single technology from dedicated platform table.
async function loadFromPlatformTable(
  admin: SupabaseClient,
  userId: string,
  slug: TechnologySlug,
): Promise<TechnologyCompanySetting | null> {
  try {
    const def = getTechnologyDefinition(slug);
    if (!def) return null;
    const { data, error } = await admin
      .from("clonestore_company_technologies")
      .select("*")
      .eq("user_id", userId)
      .eq("technology_key", slug)
      .maybeSingle();
    if (error || !data) return null;
    const row = normalizeDbRow(data);
    if (!row) return null;
    return mapRowToSetting(row, def);
  } catch { return null; }
}

// Legacy fallback: read single technology from pierre_company_memory JSON blob.
async function loadFromLegacyJson(
  admin: SupabaseClient,
  userId: string,
  slug: TechnologySlug,
): Promise<TechnologyCompanySetting | null> {
  try {
    const def = getTechnologyDefinition(slug);
    if (!def) return null;
    const { data } = await admin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return null;
    const defs = getCloneStoreTechnologyDefinitions();
    const all = legacyExtractSettings(data.reusable_rh_context_json as Record<string, unknown>, defs);
    return all.find((s) => s.technology_slug === slug) ?? null;
  } catch { return null; }
}

// Unified load: new table first, legacy JSON fallback, then definition defaults.
async function loadSingleSetting(
  admin: SupabaseClient,
  userId: string,
  slug: TechnologySlug,
): Promise<{ setting: TechnologyCompanySetting; source: "platform_table" | "legacy_json" | "defaults" }> {
  const def = getTechnologyDefinition(slug);
  if (!def) throw { status: 404, message: `Technologie "${slug}" introuvable.`, code: "TECHNOLOGY_NOT_FOUND" };

  const fromTable = await loadFromPlatformTable(admin, userId, slug);
  if (fromTable) return { setting: fromTable, source: "platform_table" };

  const fromLegacy = await loadFromLegacyJson(admin, userId, slug);
  if (fromLegacy) return { setting: fromLegacy, source: "legacy_json" };

  return { setting: normalizeTechnologyCompanySetting(null, def), source: "defaults" };
}

// Write single technology to dedicated platform table.
// Writes ONLY to the new platform table — never to pierre_company_memory.
async function saveSingleSetting(
  admin: SupabaseClient,
  userId: string,
  setting: TechnologyCompanySetting,
  technologyName: string,
): Promise<void> {
  const payload = mapSettingToUpsertPayload(setting, userId, technologyName);
  const { error } = await admin
    .from("clonestore_company_technologies")
    .upsert(payload, { onConflict: "user_id,technology_key" });
  if (error) throw error;
}

// ── GET /api/clonestore/technologies/[technologySlug] ─────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ technologySlug: string }> },
) {
  try {
    const { technologySlug } = await params;
    // P20 : validation CANONIQUE d'abord — distingue inconnue / à venir / externe au lieu d'un 404 plat.
    const canonical = validateLegacyConfigurationSlug(technologySlug);
    if (!canonical.ok) {
      const status = canonical.code === "UNKNOWN_TECHNOLOGY" ? 404 : 409;
      return jsonError(canonical.message, status, { code: canonical.code });
    }
    const definition = getTechnologyDefinition(technologySlug);
    if (!definition) return jsonError(`Technologie "${technologySlug}" introuvable.`, 404, { code: "TECHNOLOGY_NOT_FOUND" });

    const admin = createAdminClient();
    const userId = await authenticateRequest(request, admin);
    const access = await hasAnyActiveOrder(admin, userId);
    if (!access) return jsonError("Accès CloneStore requis.", 403, { code: "ACCESS_DENIED" });

    const { setting, source: storageSource } = await loadSingleSetting(admin, userId, definition.slug as TechnologySlug);

    const allDefs = getCloneStoreTechnologyDefinitions();
    const defaults = buildDefaultTechnologyCompanySettings(allDefs);
    const allSettings: TechnologyCompanySetting[] = allDefs.map((def) => {
      if (def.slug === definition.slug) return setting;
      return defaults.find((s) => s.technology_slug === def.slug)!;
    });

    const registry = buildTechnologyRegistry({ definitions: allDefs, rawSettings: allSettings });
    const runtime_state = registry.runtime_states.find((s) => s.technology_slug === definition.slug) ?? null;
    const validation = validateTechnologySetting(setting, definition);

    return NextResponse.json({
      ok: true,
      technology: definition,
      setting,
      runtime_state,
      validation,
      enabled_for_pierre: isTechnologyEnabledForEmployee(registry, definition.slug, "pierre"),
      meta: {
        route: `/api/clonestore/technologies/${definition.slug}`,
        userId,
        fetchedAt: new Date().toISOString(),
        storage_source: storageSource,
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

// ── PATCH /api/clonestore/technologies/[technologySlug] ───────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ technologySlug: string }> },
) {
  try {
    const { technologySlug } = await params;
    // P20 : validation CANONIQUE d'abord — distingue inconnue / à venir / externe au lieu d'un 404 plat.
    const canonical = validateLegacyConfigurationSlug(technologySlug);
    if (!canonical.ok) {
      const status = canonical.code === "UNKNOWN_TECHNOLOGY" ? 404 : 409;
      return jsonError(canonical.message, status, { code: canonical.code });
    }
    const definition = getTechnologyDefinition(technologySlug);
    if (!definition) return jsonError(`Technologie "${technologySlug}" introuvable.`, 404, { code: "TECHNOLOGY_NOT_FOUND" });

    const admin = createAdminClient();
    const userId = await authenticateRequest(request, admin);
    const access = await hasAnyActiveOrder(admin, userId);
    if (!access) return jsonError("Accès CloneStore requis.", 403, { code: "ACCESS_DENIED" });

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { rawBody = {}; }
    if (!isObject(rawBody)) return jsonError("Corps de requête invalide.", 400, { code: "INVALID_BODY" });

    const updates: Partial<TechnologyCompanySetting> = {};
    const validStatuses: TechnologyOperationalStatus[] = ["enabled", "disabled", "degraded", "maintenance", "not_configured"];
    const validAutonomy: TechnologyAutonomyLevel[] = ["off", "suggest_only", "supervised", "semi_autonomous", "autonomous"];
    const validRiskModes: TechnologyRiskMode[] = ["normal", "guarded", "strict", "locked"];

    const rawStatus = asString(rawBody.status);
    if (rawStatus && validStatuses.includes(rawStatus as TechnologyOperationalStatus)) {
      updates.status = rawStatus as TechnologyOperationalStatus;
    }
    const rawAutonomy = asString(rawBody.autonomy_level);
    if (rawAutonomy && validAutonomy.includes(rawAutonomy as TechnologyAutonomyLevel)) {
      updates.autonomy_level = rawAutonomy as TechnologyAutonomyLevel;
    }
    const rawRiskMode = asString(rawBody.risk_mode);
    if (rawRiskMode && validRiskModes.includes(rawRiskMode as TechnologyRiskMode)) {
      updates.risk_mode = rawRiskMode as TechnologyRiskMode;
    }
    if (Array.isArray(rawBody.enabled_for_employee_slugs)) {
      updates.enabled_for_employee_slugs = rawBody.enabled_for_employee_slugs;
    }
    if (Array.isArray(rawBody.disabled_for_employee_slugs)) {
      updates.disabled_for_employee_slugs = rawBody.disabled_for_employee_slugs;
    }
    if (isObject(rawBody.custom_rules)) updates.custom_rules = rawBody.custom_rules;
    if (isObject(rawBody.validation_rules)) updates.validation_rules = rawBody.validation_rules;
    if (isObject(rawBody.notification_rules)) updates.notification_rules = rawBody.notification_rules;
    if (isObject(rawBody.memory_rules)) updates.memory_rules = rawBody.memory_rules;

    if (Object.keys(updates).length === 0) {
      return jsonError("Aucun champ modifiable fourni.", 400, { code: "NO_UPDATES" });
    }

    const { setting: existingSetting } = await loadSingleSetting(admin, userId, definition.slug as TechnologySlug);

    const now = new Date();
    const merged = mergeTechnologySettings(existingSetting, updates, definition, now);
    const validation = validateTechnologySetting(merged, definition);

    if (!validation.ok) {
      return jsonError("Configuration invalide.", 400, {
        code: "VALIDATION_FAILED",
        details: { errors: validation.errors, warnings: validation.warnings },
      });
    }

    // Write to platform table only — not to pierre_company_memory
    await saveSingleSetting(admin, userId, merged, definition.name);

    // Non-blocking log
    void Promise.resolve(admin.from("pierre_task_logs").insert({
      user_id: userId,
      agent_slug: "pierre",
      task_id: null,
      mission_id: null,
      event_type: "technology_setting_updated",
      message: `Paramètres de ${definition.name} mis à jour (platform table).`,
      meta_json: {
        technology_slug: definition.slug,
        updates: Object.keys(updates),
        updated_at: now.toISOString(),
        storage: "clonestore_company_technologies",
      },
    })).catch(() => {});

    return NextResponse.json({
      ok: true,
      technology: definition,
      setting: merged,
      validation,
      meta: {
        route: `/api/clonestore/technologies/${definition.slug}`,
        userId,
        updatedAt: now.toISOString(),
        storage: "clonestore_company_technologies",
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
