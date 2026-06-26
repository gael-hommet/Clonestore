// TECH-03 — Global Technology Config Snapshot & Resolution Helpers
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Provides snapshot generation, employee-coverage resolution,
// and technology config merging utilities.

import type {
  GlobalTechnologyKey,
  GlobalTechnologyConfig,
  GlobalTechnologyConfigSummary,
  GlobalTechnologyConfigSnapshot,
  GlobalTechnologyConfigPatch,
  GlobalTechnologyEmployeeOverride,
} from "./global-tech-config";
import { ALL_GLOBAL_TECHNOLOGY_KEYS } from "./global-tech-config";
import {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
} from "./global-tech-defaults";

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildGlobalTechnologyConfigSummary(
  configs: GlobalTechnologyConfig[],
): GlobalTechnologyConfigSummary {
  const active = configs.filter((c) => c.status === "active").length;
  const partial = configs.filter((c) => c.status === "partial").length;
  const roadmap = configs.filter((c) => c.status === "roadmap").length;
  const disabled = configs.filter((c) => c.status === "disabled").length;
  const locked = configs.filter((c) => c.status === "locked").length;
  const customerConfigurable = configs.filter((c) => c.configurable_by_customer).length;
  const platformLocked = configs.filter((c) => c.locked_by_platform).length;
  const requiredForRuntime = configs.filter((c) => c.required_for_employee_runtime).length;
  const avgScore =
    configs.length > 0
      ? Math.round(configs.reduce((s, c) => s + c.readiness_score, 0) / configs.length)
      : 0;

  return {
    total: configs.length,
    active,
    partial,
    roadmap,
    disabled,
    locked,
    customer_configurable: customerConfigurable,
    platform_locked: platformLocked,
    required_for_employee_runtime: requiredForRuntime,
    average_readiness_score: avgScore,
  };
}

// ── Employee coverage ─────────────────────────────────────────────────────────
// Returns: employeeSlug → array of GlobalTechnologyKey required for that employee

export function buildEmployeeCoverageMap(
  configs: GlobalTechnologyConfig[],
): Record<string, GlobalTechnologyKey[]> {
  const coverageByEmployee: Record<string, Set<GlobalTechnologyKey>> = {};

  for (const config of configs) {
    for (const override of config.employee_overrides) {
      if (override.enabled) {
        if (!coverageByEmployee[override.employee_slug]) {
          coverageByEmployee[override.employee_slug] = new Set();
        }
        coverageByEmployee[override.employee_slug].add(config.key);
      }
    }
  }

  const result: Record<string, GlobalTechnologyKey[]> = {};
  for (const [slug, keys] of Object.entries(coverageByEmployee)) {
    result[slug] = Array.from(keys);
  }
  return result;
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildGlobalTechnologyConfigSnapshot(
  configs?: GlobalTechnologyConfig[],
): GlobalTechnologyConfigSnapshot {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIG_LIST;
  return {
    generated_at: new Date().toISOString(),
    technologies: resolved,
    summary: buildGlobalTechnologyConfigSummary(resolved),
    employee_coverage: buildEmployeeCoverageMap(resolved),
  };
}

// ── Config resolution ─────────────────────────────────────────────────────────

/**
 * Returns the base config for a technology key.
 * Returns default if no override map is provided.
 */
export function resolveGlobalTechConfig(
  key: GlobalTechnologyKey,
  overrides?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): GlobalTechnologyConfig {
  if (overrides && overrides[key]) {
    return overrides[key]!;
  }
  return DEFAULT_GLOBAL_TECH_CONFIGS[key];
}

/**
 * Resolves the effective config for a given employee.
 * Merges base config with employee-specific overrides if present.
 */
export function resolveTechnologyConfigForEmployee(
  key: GlobalTechnologyKey,
  employeeSlug: string,
  baseConfigs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): GlobalTechnologyConfig {
  const base = resolveGlobalTechConfig(key, baseConfigs);

  if (!base.supports_employee_overrides) {
    return base;
  }

  const employeeOverride = base.employee_overrides.find(
    (o) => o.employee_slug === employeeSlug,
  );

  if (!employeeOverride) {
    return base;
  }

  return {
    ...base,
    mode: employeeOverride.mode,
    risk_mode: employeeOverride.risk_mode,
    autonomy_level: employeeOverride.autonomy_level,
    settings: {
      ...base.settings,
      ...employeeOverride.settings,
    },
  };
}

/**
 * Returns all technology configs required for a specific employee.
 * Required = required_for_employee_runtime OR employee has an override enabled.
 */
export function listTechnologiesForEmployee(
  employeeSlug: string,
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): GlobalTechnologyConfig[] {
  const result: GlobalTechnologyConfig[] = [];

  for (const key of ALL_GLOBAL_TECHNOLOGY_KEYS) {
    const config = resolveGlobalTechConfig(key, configs);
    const hasOverride = config.employee_overrides.some(
      (o) => o.employee_slug === employeeSlug && o.enabled,
    );
    if (config.required_for_employee_runtime || hasOverride) {
      result.push(resolveTechnologyConfigForEmployee(key, employeeSlug, configs));
    }
  }

  return result;
}

// ── Patch application ─────────────────────────────────────────────────────────

export function applyGlobalTechConfigPatch(
  base: GlobalTechnologyConfig,
  patch: GlobalTechnologyConfigPatch,
): GlobalTechnologyConfig {
  const updated: GlobalTechnologyConfig = { ...base };

  if (patch.status !== undefined) updated.status = patch.status;
  if (patch.mode !== undefined) updated.mode = patch.mode;
  if (patch.risk_mode !== undefined) updated.risk_mode = patch.risk_mode;
  if (patch.autonomy_level !== undefined) updated.autonomy_level = patch.autonomy_level;
  if (patch.settings !== undefined) {
    updated.settings = { ...base.settings, ...patch.settings };
  }
  if (patch.employee_overrides !== undefined) {
    updated.employee_overrides = patch.employee_overrides;
  }
  updated.updated_at = new Date().toISOString();

  return updated;
}

/**
 * Apply a list of patches to the default config set.
 * Returns a new record — does not mutate defaults.
 */
export function applyGlobalTechConfigPatches(
  patches: GlobalTechnologyConfigPatch[],
): Record<GlobalTechnologyKey, GlobalTechnologyConfig> {
  const result: Record<GlobalTechnologyKey, GlobalTechnologyConfig> = {
    ...DEFAULT_GLOBAL_TECH_CONFIGS,
  };

  for (const patch of patches) {
    const base = result[patch.key];
    result[patch.key] = applyGlobalTechConfigPatch(base, patch);
  }

  return result;
}

// ── Employee override helpers ─────────────────────────────────────────────────

export function addEmployeeOverride(
  config: GlobalTechnologyConfig,
  override: GlobalTechnologyEmployeeOverride,
): GlobalTechnologyConfig {
  if (!config.supports_employee_overrides) {
    return config; // silently skip — locked config
  }

  const existing = config.employee_overrides.filter(
    (o) => o.employee_slug !== override.employee_slug,
  );

  return {
    ...config,
    employee_overrides: [...existing, override],
    updated_at: new Date().toISOString(),
  };
}

export function removeEmployeeOverride(
  config: GlobalTechnologyConfig,
  employeeSlug: string,
): GlobalTechnologyConfig {
  return {
    ...config,
    employee_overrides: config.employee_overrides.filter(
      (o) => o.employee_slug !== employeeSlug,
    ),
    updated_at: new Date().toISOString(),
  };
}

// ── Readiness helpers ─────────────────────────────────────────────────────────

export function getAverageReadinessScore(configs: GlobalTechnologyConfig[]): number {
  if (configs.length === 0) return 0;
  const sum = configs.reduce((acc, c) => acc + c.readiness_score, 0);
  return Math.round(sum / configs.length);
}

export function getEmployeeRuntimeReadinessScore(
  employeeSlug: string,
  configs?: Partial<Record<GlobalTechnologyKey, GlobalTechnologyConfig>>,
): number {
  const required = listTechnologiesForEmployee(employeeSlug, configs).filter(
    (c) => c.required_for_employee_runtime,
  );
  return getAverageReadinessScore(required);
}
