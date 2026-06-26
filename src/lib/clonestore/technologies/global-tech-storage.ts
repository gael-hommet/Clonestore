// TECH-03 — Global Technology Config Storage Payload Helpers
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Provides serialization/deserialization helpers for persisting GlobalTechnologyConfig
// to a generic key-value store. Does NOT import any DB client.
// The actual Supabase upsert is handled by the data layer (not this module).

import type {
  GlobalTechnologyKey,
  GlobalTechnologyConfig,
  GlobalTechnologyConfigPatch,
} from "./global-tech-config";
import { ALL_GLOBAL_TECHNOLOGY_KEYS } from "./global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "./global-tech-defaults";
import { applyGlobalTechConfigPatches } from "./global-tech-snapshot";

// ── Storage payload ───────────────────────────────────────────────────────────

export type GlobalTechStorageRow = {
  key: GlobalTechnologyKey;
  company_id: string;
  status: string;
  mode: string;
  risk_mode: string;
  autonomy_level: string;
  settings: Record<string, unknown>;
  employee_overrides: unknown[];
  updated_at: string;
};

export type GlobalTechStoragePayload = {
  company_id: string;
  rows: GlobalTechStorageRow[];
  generated_at: string;
};

// ── Serialization ─────────────────────────────────────────────────────────────

export function serializeGlobalTechConfig(
  config: GlobalTechnologyConfig,
  companyId: string,
): GlobalTechStorageRow {
  return {
    key: config.key,
    company_id: companyId,
    status: config.status,
    mode: config.mode,
    risk_mode: config.risk_mode,
    autonomy_level: config.autonomy_level,
    settings: config.settings,
    employee_overrides: config.employee_overrides,
    updated_at: config.updated_at,
  };
}

export function buildDefaultGlobalTechStoragePayload(
  companyId: string,
): GlobalTechStoragePayload {
  const rows = ALL_GLOBAL_TECHNOLOGY_KEYS.map((key) =>
    serializeGlobalTechConfig(DEFAULT_GLOBAL_TECH_CONFIGS[key], companyId),
  );

  return {
    company_id: companyId,
    rows,
    generated_at: new Date().toISOString(),
  };
}

// ── Deserialization / normalization ───────────────────────────────────────────

/**
 * Normalizes a raw storage row into a clean GlobalTechStorageRow.
 * Returns null if the key is invalid.
 */
export function normalizeGlobalTechStorageRow(
  raw: Record<string, unknown>,
): GlobalTechStorageRow | null {
  const key = raw["key"];
  if (
    typeof key !== "string" ||
    !(ALL_GLOBAL_TECHNOLOGY_KEYS as string[]).includes(key)
  ) {
    return null;
  }

  return {
    key: key as GlobalTechnologyKey,
    company_id: typeof raw["company_id"] === "string" ? raw["company_id"] : "",
    status: typeof raw["status"] === "string" ? raw["status"] : "disabled",
    mode: typeof raw["mode"] === "string" ? raw["mode"] : "disabled",
    risk_mode: typeof raw["risk_mode"] === "string" ? raw["risk_mode"] : "disabled",
    autonomy_level: typeof raw["autonomy_level"] === "string" ? raw["autonomy_level"] : "none",
    settings: typeof raw["settings"] === "object" && raw["settings"] !== null
      ? (raw["settings"] as Record<string, unknown>)
      : {},
    employee_overrides: Array.isArray(raw["employee_overrides"]) ? raw["employee_overrides"] : [],
    updated_at: typeof raw["updated_at"] === "string" ? raw["updated_at"] : new Date().toISOString(),
  };
}

export function normalizeGlobalTechStoragePayload(
  rawRows: Record<string, unknown>[],
): GlobalTechStorageRow[] {
  const result: GlobalTechStorageRow[] = [];
  for (const raw of rawRows) {
    const normalized = normalizeGlobalTechStorageRow(raw);
    if (normalized !== null) {
      result.push(normalized);
    }
  }
  return result;
}

// ── Merge: stored row → GlobalTechnologyConfig ────────────────────────────────

/**
 * Merges stored row data onto the default GlobalTechnologyConfig.
 * The stored row overrides: status, mode, risk_mode, autonomy_level, settings, employee_overrides.
 * Platform-locked fields (locked_by_platform, guardrails, dependencies) are NOT overridable.
 */
export function mergeGlobalTechConfigWithStoredRow(
  row: GlobalTechStorageRow,
): GlobalTechnologyConfig {
  const base = DEFAULT_GLOBAL_TECH_CONFIGS[row.key];

  // Platform-locked configs cannot be overridden by stored values
  if (base.locked_by_platform) {
    return base;
  }

  return {
    ...base,
    status: (row.status as GlobalTechnologyConfig["status"]) ?? base.status,
    mode: (row.mode as GlobalTechnologyConfig["mode"]) ?? base.mode,
    risk_mode: (row.risk_mode as GlobalTechnologyConfig["risk_mode"]) ?? base.risk_mode,
    autonomy_level: (row.autonomy_level as GlobalTechnologyConfig["autonomy_level"]) ?? base.autonomy_level,
    settings: { ...base.settings, ...row.settings },
    employee_overrides: row.employee_overrides as GlobalTechnologyConfig["employee_overrides"],
    updated_at: row.updated_at,
  };
}

/**
 * Merges all stored rows with defaults, returning a full GlobalTechnologyConfig map.
 * Technologies not found in stored rows use their default config.
 */
export function mergeGlobalTechConfigsWithStoredRows(
  rows: GlobalTechStorageRow[],
): Record<GlobalTechnologyKey, GlobalTechnologyConfig> {
  const result: Record<GlobalTechnologyKey, GlobalTechnologyConfig> = {
    ...DEFAULT_GLOBAL_TECH_CONFIGS,
  };

  for (const row of rows) {
    result[row.key] = mergeGlobalTechConfigWithStoredRow(row);
  }

  return result;
}

// ── Legacy B46 fallback ───────────────────────────────────────────────────────

export type LegacyB46FallbackRow = {
  technology_id: string;
  enabled: boolean;
  runtime_mode: string;
  status: string;
};

/**
 * Builds a legacy B46-compatible fallback structure from global configs.
 * Allows old code using B46 storage format to still function.
 * Only covers the 6 B46-visible technologies.
 */
export function buildLegacyB46FallbackFromGlobalConfigs(
  configs?: Record<GlobalTechnologyKey, GlobalTechnologyConfig>,
): LegacyB46FallbackRow[] {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIGS;
  const b46Keys: GlobalTechnologyKey[] = ["cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat"];

  return b46Keys.map((key) => {
    const config = resolved[key];
    return {
      technology_id: key,
      enabled: config.status === "active" || config.status === "partial",
      runtime_mode: config.mode === "production" ? "production" : "sandbox",
      status: config.status,
    };
  });
}

// ── Patch → storage payload ───────────────────────────────────────────────────

/**
 * Converts a list of patches into storage rows ready for upsert.
 * Applies patches to defaults, then serializes.
 */
export function buildStoragePayloadFromPatches(
  patches: GlobalTechnologyConfigPatch[],
  companyId: string,
): GlobalTechStoragePayload {
  const patched = applyGlobalTechConfigPatches(patches);

  const rows = patches.map((p) =>
    serializeGlobalTechConfig(patched[p.key], companyId),
  );

  return {
    company_id: companyId,
    rows,
    generated_at: new Date().toISOString(),
  };
}
