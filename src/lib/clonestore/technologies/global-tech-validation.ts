// TECH-03 — Global Technology Config Validation
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Validates individual GlobalTechnologyConfig entries and full config sets.
// 20 validation rules enforced.

import type {
  GlobalTechnologyKey,
  GlobalTechnologyConfig,
  GlobalTechnologyConfigValidationIssue,
  GlobalTechnologyConfigValidationReport,
} from "./global-tech-config";
import { ALL_GLOBAL_TECHNOLOGY_KEYS, GLOBAL_TECHNOLOGY_KEY_SET } from "./global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIG_LIST } from "./global-tech-defaults";

// ── Single config validation ──────────────────────────────────────────────────

export type GlobalTechConfigValidationResult = {
  ok: boolean;
  key: GlobalTechnologyKey;
  errors: string[];
  warnings: string[];
};

export function validateGlobalTechnologyConfig(
  config: GlobalTechnologyConfig,
): GlobalTechConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1 — key must be a valid GlobalTechnologyKey
  if (!GLOBAL_TECHNOLOGY_KEY_SET.has(config.key)) {
    errors.push(`[R01] Unknown technology key: "${config.key}"`);
  }

  // Rule 2 — display_name must be non-empty
  if (!config.display_name || config.display_name.trim().length === 0) {
    errors.push(`[R02] display_name must be non-empty for key "${config.key}"`);
  }

  // Rule 3 — short_description must be non-empty
  if (!config.short_description || config.short_description.trim().length === 0) {
    errors.push(`[R03] short_description must be non-empty for key "${config.key}"`);
  }

  // Rule 4 — readiness_score must be 0–100
  if (
    typeof config.readiness_score !== "number" ||
    config.readiness_score < 0 ||
    config.readiness_score > 100
  ) {
    errors.push(
      `[R04] readiness_score must be 0–100 for "${config.key}", got: ${config.readiness_score}`,
    );
  }

  // Rule 5 — platform_locked configs must not be configurable_by_customer
  if (config.locked_by_platform && config.configurable_by_customer) {
    errors.push(
      `[R05] "${config.key}" is locked_by_platform but configurable_by_customer=true — contradiction`,
    );
  }

  // Rule 6 — internal_only configs must not be visible_to_customer
  if (config.control_level === "internal_only" && config.visible_to_customer) {
    errors.push(
      `[R06] "${config.key}" has control_level=internal_only but visible_to_customer=true`,
    );
  }

  // Rule 7 — required_for_public_launch implies required_for_employee_runtime
  if (config.required_for_public_launch && !config.required_for_employee_runtime) {
    errors.push(
      `[R07] "${config.key}" required_for_public_launch=true but required_for_employee_runtime=false — cannot launch without runtime requirement`,
    );
  }

  // Rule 8 — roadmap configs must not be required_for_employee_runtime
  if (config.status === "roadmap" && config.required_for_employee_runtime) {
    errors.push(
      `[R08] "${config.key}" status=roadmap but required_for_employee_runtime=true — roadmap techs cannot be required for runtime`,
    );
  }

  // Rule 9 — mode=roadmap must have status=roadmap
  if (config.mode === "roadmap" && config.status !== "roadmap") {
    errors.push(
      `[R09] "${config.key}" mode=roadmap but status=${config.status} — mode and status must align`,
    );
  }

  // Rule 10 — not_implemented runtime must correspond to roadmap/disabled status
  if (
    config.runtime_status === "not_implemented" &&
    config.status !== "roadmap" &&
    config.status !== "disabled"
  ) {
    warnings.push(
      `[R10] "${config.key}" runtime_status=not_implemented but status=${config.status} — verify alignment`,
    );
  }

  // Rule 11 — supports_employee_overrides requires employee_override_allowed or company_configurable
  if (
    config.supports_employee_overrides &&
    config.control_level !== "employee_override_allowed" &&
    config.control_level !== "company_configurable"
  ) {
    warnings.push(
      `[R11] "${config.key}" supports_employee_overrides=true but control_level=${config.control_level} — consider employee_override_allowed`,
    );
  }

  // Rule 12 — employee_overrides must only reference employee_slug (non-empty)
  for (const ov of config.employee_overrides) {
    if (!ov.employee_slug || ov.employee_slug.trim().length === 0) {
      errors.push(`[R12] "${config.key}" has an employee_override with empty employee_slug`);
    }
  }

  // Rule 13 — employee_overrides on non-supporting config
  if (!config.supports_employee_overrides && config.employee_overrides.length > 0) {
    errors.push(
      `[R13] "${config.key}" supports_employee_overrides=false but employee_overrides is non-empty`,
    );
  }

  // Rule 14 — dependencies must reference valid GlobalTechnologyKeys
  for (const dep of config.dependencies) {
    if (!GLOBAL_TECHNOLOGY_KEY_SET.has(dep)) {
      errors.push(`[R14] "${config.key}" has unknown dependency: "${dep}"`);
    }
  }

  // Rule 15 — conflicts must reference valid GlobalTechnologyKeys
  for (const conflict of config.conflicts) {
    if (!GLOBAL_TECHNOLOGY_KEY_SET.has(conflict)) {
      errors.push(`[R15] "${config.key}" has unknown conflict reference: "${conflict}"`);
    }
  }

  // Rule 16 — a key cannot conflict with itself
  if (config.conflicts.includes(config.key)) {
    errors.push(`[R16] "${config.key}" lists itself in conflicts`);
  }

  // Rule 17 — a key cannot depend on itself
  if (config.dependencies.includes(config.key)) {
    errors.push(`[R17] "${config.key}" lists itself in dependencies`);
  }

  // Rule 18 — governance category should have conservative or balanced risk_mode
  if (
    config.category === "governance" &&
    (config.risk_mode === "permissive" || config.risk_mode === "disabled") &&
    config.status !== "roadmap" &&
    config.status !== "disabled"
  ) {
    warnings.push(
      `[R18] "${config.key}" category=governance but risk_mode=${config.risk_mode} — governance techs should be conservative or balanced`,
    );
  }

  // Rule 19 — created_at must be present
  if (!config.created_at || config.created_at.trim().length === 0) {
    errors.push(`[R19] "${config.key}" missing created_at`);
  }

  // Rule 20 — updated_at must be present
  if (!config.updated_at || config.updated_at.trim().length === 0) {
    errors.push(`[R20] "${config.key}" missing updated_at`);
  }

  return {
    ok: errors.length === 0,
    key: config.key,
    errors,
    warnings,
  };
}

// ── Config set validation ─────────────────────────────────────────────────────

export function validateGlobalTechnologyConfigSet(
  configs: GlobalTechnologyConfig[],
): GlobalTechConfigValidationResult[] {
  return configs.map(validateGlobalTechnologyConfig);
}

// ── Full validation report ────────────────────────────────────────────────────

export function getGlobalTechnologyConfigValidationReport(
  configs?: GlobalTechnologyConfig[],
): GlobalTechnologyConfigValidationReport {
  const resolved = configs ?? DEFAULT_GLOBAL_TECH_CONFIG_LIST;
  const results = validateGlobalTechnologyConfigSet(resolved);

  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const issues: GlobalTechnologyConfigValidationIssue[] = [];

  for (const r of results) {
    for (const msg of r.errors) {
      allErrors.push(`${r.key}: ${msg}`);
      issues.push({ key: r.key, severity: "error", code: msg.slice(1, 4), message: msg });
    }
    for (const msg of r.warnings) {
      allWarnings.push(`${r.key}: ${msg}`);
      issues.push({ key: r.key, severity: "warning", code: msg.slice(1, 4), message: msg });
    }
  }

  // Check coverage: all 13 keys must be present
  const presentKeys = new Set(resolved.map((c) => c.key));
  for (const key of ALL_GLOBAL_TECHNOLOGY_KEYS) {
    if (!presentKeys.has(key)) {
      allErrors.push(`MISSING: no config found for required key "${key}"`);
      issues.push({
        key,
        severity: "error",
        code: "MISSING",
        message: `No config found for required key "${key}"`,
      });
    }
  }

  const activeCount = resolved.filter((c) => c.status === "active").length;
  const partialCount = resolved.filter((c) => c.status === "partial").length;
  const roadmapCount = resolved.filter((c) => c.status === "roadmap").length;
  const lockedCount = resolved.filter((c) => c.status === "locked").length;
  const runtimeRequired = resolved.filter((c) => c.required_for_employee_runtime).length;
  const totalRequired = ALL_GLOBAL_TECHNOLOGY_KEYS.length;

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    issues,
    config_count: resolved.length,
    active_count: activeCount,
    partial_count: partialCount,
    roadmap_count: roadmapCount,
    locked_count: lockedCount,
    employee_runtime_coverage:
      totalRequired > 0 ? Math.round((runtimeRequired / totalRequired) * 100) : 0,
    checked_at: new Date().toISOString(),
  };
}

// ── Quick check helpers ───────────────────────────────────────────────────────

export function isGlobalTechConfigValid(config: GlobalTechnologyConfig): boolean {
  return validateGlobalTechnologyConfig(config).ok;
}

export function areAllDefaultConfigsValid(): boolean {
  return getGlobalTechnologyConfigValidationReport().ok;
}
