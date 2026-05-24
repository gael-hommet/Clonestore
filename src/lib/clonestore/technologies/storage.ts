// CloneStore Technologies Foundation — Storage (Bloc 18.1)
// Pure module: no Supabase, no Next, no async, no side effects.
// DB row types and mapper functions for clonestore_company_technologies table.
// Replaces the legacy pierre_company_memory.reusable_rh_context_json.clone_technologies storage.

import type {
  TechnologySlug,
  TechnologyDefinition,
  TechnologyCompanySetting,
  TechnologyOperationalStatus,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
  TechnologyConfigurationStatus,
} from "./contracts";

// ── Internal helpers ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

const VALID_SLUGS = new Set<TechnologySlug>([
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonecontinuum",
  "clonetrust", "clonereview", "clonesignals", "clonelearn",
  "clonevoice", "clonechat", "clonebrief",
]);

function isTechnologySlug(v: unknown): v is TechnologySlug {
  return typeof v === "string" && VALID_SLUGS.has(v as TechnologySlug);
}

const VALID_STATUSES = new Set<TechnologyOperationalStatus>([
  "enabled", "disabled", "degraded", "maintenance", "not_configured",
]);
const VALID_AUTONOMY = new Set<TechnologyAutonomyLevel>([
  "off", "suggest_only", "supervised", "semi_autonomous", "autonomous",
]);
const VALID_RISK_MODES = new Set<TechnologyRiskMode>([
  "normal", "guarded", "strict", "locked",
]);
const VALID_CONFIG_STATUSES = new Set<TechnologyConfigurationStatus>([
  "missing", "partial", "configured", "optimized",
]);

function validStatus(v: unknown, fallback: TechnologyOperationalStatus): TechnologyOperationalStatus {
  return typeof v === "string" && VALID_STATUSES.has(v as TechnologyOperationalStatus)
    ? (v as TechnologyOperationalStatus) : fallback;
}
function validAutonomy(v: unknown, fallback: TechnologyAutonomyLevel): TechnologyAutonomyLevel {
  return typeof v === "string" && VALID_AUTONOMY.has(v as TechnologyAutonomyLevel)
    ? (v as TechnologyAutonomyLevel) : fallback;
}
function validRiskMode(v: unknown, fallback: TechnologyRiskMode): TechnologyRiskMode {
  return typeof v === "string" && VALID_RISK_MODES.has(v as TechnologyRiskMode)
    ? (v as TechnologyRiskMode) : fallback;
}
function validConfigStatus(v: unknown, fallback: TechnologyConfigurationStatus): TechnologyConfigurationStatus {
  return typeof v === "string" && VALID_CONFIG_STATUSES.has(v as TechnologyConfigurationStatus)
    ? (v as TechnologyConfigurationStatus) : fallback;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

// ── DB Row types ─────────────────────────────────────────────────────────────

export type CloneStoreTechnologyRow = {
  id: string;
  user_id: string;
  technology_key: string;
  technology_name: string;
  enabled: boolean;
  mode: string;
  autonomy_level: string;
  config_json: Record<string, unknown>;
  rules_json: unknown[];
  preferences_json: Record<string, unknown>;
  limits_json: Record<string, unknown>;
  connections_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CloneStoreTechnologyUpsertPayload = {
  user_id: string;
  technology_key: string;
  technology_name: string;
  enabled: boolean;
  mode: string;
  autonomy_level: string;
  config_json: Record<string, unknown>;
  rules_json: unknown[];
  preferences_json: Record<string, unknown>;
  limits_json: Record<string, unknown>;
  connections_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
};

// ── normalizeDbRow ────────────────────────────────────────────────────────────
// Coerce an unknown DB result to a typed CloneStoreTechnologyRow.
// Returns null if the input is not a usable row (missing required fields).

export function normalizeDbRow(raw: unknown): CloneStoreTechnologyRow | null {
  if (!isObject(raw)) return null;
  const key = asStr(raw.technology_key);
  if (!key) return null;

  return {
    id: asStr(raw.id) ?? "",
    user_id: asStr(raw.user_id) ?? "",
    technology_key: key,
    technology_name: asStr(raw.technology_name) ?? key,
    enabled: asBool(raw.enabled, true),
    mode: asStr(raw.mode) ?? "standard",
    autonomy_level: asStr(raw.autonomy_level) ?? "controlled",
    config_json: isObject(raw.config_json) ? (raw.config_json as Record<string, unknown>) : {},
    rules_json: Array.isArray(raw.rules_json) ? raw.rules_json : [],
    preferences_json: isObject(raw.preferences_json) ? (raw.preferences_json as Record<string, unknown>) : {},
    limits_json: isObject(raw.limits_json) ? (raw.limits_json as Record<string, unknown>) : {},
    connections_json: isObject(raw.connections_json) ? (raw.connections_json as Record<string, unknown>) : {},
    metadata_json: isObject(raw.metadata_json) ? (raw.metadata_json as Record<string, unknown>) : {},
    created_at: asStr(raw.created_at) ?? new Date().toISOString(),
    updated_at: asStr(raw.updated_at) ?? new Date().toISOString(),
  };
}

// ── mapRowToSetting ───────────────────────────────────────────────────────────
// Convert a DB row to a TechnologyCompanySetting.
// Primary source: config_json (lossless round-trip).
// Fallback: synthesize from individual columns + definition defaults.

export function mapRowToSetting(
  row: CloneStoreTechnologyRow,
  definition: TechnologyDefinition,
): TechnologyCompanySetting {
  const cfg = row.config_json;

  // If config_json contains a complete TechnologyCompanySetting, use it directly.
  if (isTechnologySlug(cfg.technology_slug)) {
    const ts = asStr(cfg.created_at) ?? row.created_at;
    const tu = asStr(cfg.updated_at) ?? row.updated_at;
    return {
      technology_slug: isTechnologySlug(cfg.technology_slug) ? cfg.technology_slug : definition.slug,
      status: validStatus(cfg.status, definition.default_status),
      autonomy_level: validAutonomy(cfg.autonomy_level, definition.default_autonomy),
      risk_mode: validRiskMode(cfg.risk_mode, definition.default_risk_mode),
      configuration_status: validConfigStatus(cfg.configuration_status, "missing"),
      enabled_for_employee_slugs: strArray(cfg.enabled_for_employee_slugs),
      disabled_for_employee_slugs: strArray(cfg.disabled_for_employee_slugs),
      custom_rules: isObject(cfg.custom_rules) ? cfg.custom_rules : {},
      validation_rules: isObject(cfg.validation_rules) ? cfg.validation_rules : {},
      notification_rules: isObject(cfg.notification_rules) ? cfg.notification_rules : {},
      memory_rules: isObject(cfg.memory_rules) ? cfg.memory_rules : {},
      created_at: ts,
      updated_at: tu,
    };
  }

  // Fallback: synthesize from individual columns.
  // enabled: true → "enabled" (or read status from metadata_json if present)
  const meta = row.metadata_json;
  const statusFromMeta = asStr(meta.status);
  const status: TechnologyOperationalStatus = statusFromMeta && VALID_STATUSES.has(statusFromMeta as TechnologyOperationalStatus)
    ? (statusFromMeta as TechnologyOperationalStatus)
    : (row.enabled ? "enabled" : "disabled");

  return {
    technology_slug: definition.slug,
    status,
    autonomy_level: validAutonomy(row.autonomy_level, definition.default_autonomy),
    risk_mode: validRiskMode(row.mode, definition.default_risk_mode),
    configuration_status: validConfigStatus(meta.configuration_status, "partial"),
    enabled_for_employee_slugs: strArray(meta.enabled_for_employee_slugs),
    disabled_for_employee_slugs: strArray(meta.disabled_for_employee_slugs),
    custom_rules: isObject(meta.custom_rules) ? meta.custom_rules : {},
    validation_rules: isObject(row.preferences_json) ? row.preferences_json : {},
    notification_rules: isObject(row.limits_json) ? row.limits_json : {},
    memory_rules: {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── mapSettingToUpsertPayload ─────────────────────────────────────────────────
// Convert a TechnologyCompanySetting to the DB upsert payload for
// clonestore_company_technologies.

export function mapSettingToUpsertPayload(
  setting: TechnologyCompanySetting,
  userId: string,
  technologyName: string,
): CloneStoreTechnologyUpsertPayload {
  // Denormalized queryable fields
  const enabled = setting.status !== "disabled" && setting.status !== "not_configured";
  // Map TechnologyRiskMode → mode column (DB check constraint accepts: standard, guarded, strict, locked, normal)
  // "normal" → "normal" (DB allows it), others pass through
  const mode = setting.risk_mode === "normal" ? "normal" : setting.risk_mode;

  return {
    user_id: userId,
    technology_key: setting.technology_slug,
    technology_name: technologyName,
    enabled,
    mode,
    autonomy_level: setting.autonomy_level,
    // config_json = complete TechnologyCompanySetting for lossless round-trip
    config_json: setting as unknown as Record<string, unknown>,
    // rules_json = validation_rules as array of entries (queryable)
    rules_json: Object.entries(setting.validation_rules).map(([k, v]) => ({ key: k, value: v })),
    // preferences_json = notification_rules
    preferences_json: setting.notification_rules,
    // limits_json = memory_rules
    limits_json: setting.memory_rules,
    connections_json: {},
    // metadata_json = auxiliary queryable fields
    metadata_json: {
      status: setting.status,
      configuration_status: setting.configuration_status,
      enabled_for_employee_slugs: setting.enabled_for_employee_slugs,
      disabled_for_employee_slugs: setting.disabled_for_employee_slugs,
      custom_rules: setting.custom_rules,
    },
  };
}

// ── mapRowsToSettings ─────────────────────────────────────────────────────────
// Convert an array of raw DB rows to TechnologyCompanySetting[], skipping
// rows that cannot be mapped (unknown technology_key, malformed data).

export function mapRowsToSettings(
  rawRows: unknown[],
  definitions: TechnologyDefinition[],
): TechnologyCompanySetting[] {
  const defsBySlug = new Map(definitions.map((d) => [d.slug, d]));
  const results: TechnologyCompanySetting[] = [];
  for (const raw of rawRows) {
    const row = normalizeDbRow(raw);
    if (!row) continue;
    if (!isTechnologySlug(row.technology_key)) continue;
    const def = defsBySlug.get(row.technology_key as TechnologySlug);
    if (!def) continue;
    results.push(mapRowToSetting(row, def));
  }
  return results;
}

// ── legacyExtractSettings ─────────────────────────────────────────────────────
// Extract TechnologyCompanySetting[] from the legacy JSON blob stored in
// pierre_company_memory.reusable_rh_context_json.clone_technologies.
// Used as fallback when clonestore_company_technologies table is empty.

export function legacyExtractSettings(
  contextJson: unknown,
  definitions: TechnologyDefinition[],
): TechnologyCompanySetting[] {
  if (!isObject(contextJson)) return [];
  const raw = contextJson.clone_technologies;
  if (!isObject(raw)) return [];
  const results: TechnologyCompanySetting[] = [];
  for (const def of definitions) {
    const rawSetting = raw[def.slug];
    if (rawSetting === undefined) continue;
    // Re-use normalizeDbRow pattern via mapRowToSetting on a synthetic row
    const syntheticRow: CloneStoreTechnologyRow = {
      id: "",
      user_id: "",
      technology_key: def.slug,
      technology_name: def.name,
      enabled: true,
      mode: def.default_risk_mode,
      autonomy_level: def.default_autonomy,
      config_json: isObject(rawSetting) ? rawSetting : {},
      rules_json: [],
      preferences_json: {},
      limits_json: {},
      connections_json: {},
      metadata_json: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    results.push(mapRowToSetting(syntheticRow, def));
  }
  return results;
}
