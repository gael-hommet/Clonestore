// CloneStore Technologies Foundation — Configuration (Bloc 18)
// Pure module: no Supabase, no Next, no async, no side effects.

import type {
  TechnologyDefinition,
  TechnologyCompanySetting,
  TechnologyRegistry,
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

const VALID_STATUSES = new Set<TechnologyOperationalStatus>([
  "enabled", "disabled", "degraded", "maintenance", "not_configured",
]);
const VALID_AUTONOMY = new Set<TechnologyAutonomyLevel>([
  "off", "suggest_only", "supervised", "semi_autonomous", "autonomous",
]);
const VALID_RISK_MODES = new Set<TechnologyRiskMode>([
  "normal", "guarded", "strict", "locked",
]);

// Fields that cannot be overwritten by a customer PATCH request
const PROTECTED_FIELDS = new Set([
  "technology_slug", "created_at",
]);

// ── validateTechnologySetting ────────────────────────────────────────────────

export function validateTechnologySetting(
  setting: TechnologyCompanySetting,
  definition: TechnologyDefinition,
): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!VALID_STATUSES.has(setting.status)) {
    errors.push(`status invalide : "${setting.status}".`);
  }
  if (!VALID_AUTONOMY.has(setting.autonomy_level)) {
    errors.push(`autonomy_level invalide : "${setting.autonomy_level}".`);
  }
  if (!VALID_RISK_MODES.has(setting.risk_mode)) {
    errors.push(`risk_mode invalide : "${setting.risk_mode}".`);
  }

  if (!definition.is_customer_configurable && setting.status !== definition.default_status) {
    errors.push(`La technologie ${definition.slug} n'est pas configurable par le client. Le statut ne peut pas être modifié.`);
  }

  if (definition.is_platform_core && setting.status === "disabled") {
    errors.push(`La technologie noyau ${definition.slug} ne peut pas être désactivée.`);
  }

  if (setting.autonomy_level === "autonomous" && definition.requires_human_validation) {
    errors.push(`${definition.slug} requiert une validation humaine — autonomy_level "autonomous" non autorisé.`);
  }

  if (setting.risk_mode === "normal" && definition.default_risk_mode === "strict") {
    warnings.push(`${definition.slug} a un mode de risque par défaut "strict". Passer à "normal" réduit la protection.`);
  }

  if (setting.enabled_for_employee_slugs.length > 0 && setting.disabled_for_employee_slugs.length > 0) {
    const overlap = setting.enabled_for_employee_slugs.filter((s) => setting.disabled_for_employee_slugs.includes(s));
    if (overlap.length > 0) {
      warnings.push(`Employés présents dans enabled et disabled : ${overlap.join(", ")}. disabled_for a priorité.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── mergeTechnologySettings ──────────────────────────────────────────────────

export function mergeTechnologySettings(
  existing: TechnologyCompanySetting,
  updates: Partial<TechnologyCompanySetting>,
  definition: TechnologyDefinition,
  now?: Date,
): TechnologyCompanySetting {
  const ts = (now ?? new Date()).toISOString();
  const merged = { ...existing, updated_at: ts };

  for (const field of PROTECTED_FIELDS) {
    delete (updates as Record<string, unknown>)[field];
  }

  if (updates.status !== undefined && VALID_STATUSES.has(updates.status)) {
    if (definition.is_platform_core && updates.status === "disabled") {
      // Silently ignore: cannot disable platform core
    } else if (!definition.is_customer_configurable) {
      // Silently ignore: not customer configurable
    } else {
      merged.status = updates.status;
    }
  }

  if (updates.autonomy_level !== undefined && VALID_AUTONOMY.has(updates.autonomy_level)) {
    if (definition.requires_human_validation && updates.autonomy_level === "autonomous") {
      // Silently ignore: human validation required
    } else {
      merged.autonomy_level = updates.autonomy_level;
    }
  }

  if (updates.risk_mode !== undefined && VALID_RISK_MODES.has(updates.risk_mode)) {
    merged.risk_mode = updates.risk_mode;
  }

  if (Array.isArray(updates.enabled_for_employee_slugs)) {
    merged.enabled_for_employee_slugs = updates.enabled_for_employee_slugs.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
  }

  if (Array.isArray(updates.disabled_for_employee_slugs)) {
    merged.disabled_for_employee_slugs = updates.disabled_for_employee_slugs.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
  }

  if (isObject(updates.custom_rules)) {
    merged.custom_rules = { ...existing.custom_rules, ...updates.custom_rules };
  }
  if (isObject(updates.validation_rules)) {
    merged.validation_rules = { ...existing.validation_rules, ...updates.validation_rules };
  }
  if (isObject(updates.notification_rules)) {
    merged.notification_rules = { ...existing.notification_rules, ...updates.notification_rules };
  }
  if (isObject(updates.memory_rules)) {
    merged.memory_rules = { ...existing.memory_rules, ...updates.memory_rules };
  }

  const configuredFields = [
    merged.status !== definition.default_status,
    merged.autonomy_level !== definition.default_autonomy,
    merged.risk_mode !== definition.default_risk_mode,
    merged.enabled_for_employee_slugs.length > 0,
    Object.keys(merged.custom_rules).length > 0,
  ].filter(Boolean).length;

  let configuration_status: TechnologyConfigurationStatus = "missing";
  if (configuredFields >= 4) configuration_status = "optimized";
  else if (configuredFields >= 2) configuration_status = "configured";
  else if (configuredFields >= 1) configuration_status = "partial";
  merged.configuration_status = configuration_status;

  return merged;
}

// ── buildTechnologyConfigurationReport ──────────────────────────────────────

export type TechnologyConfigurationReport = {
  missing_configs: string[];
  partial_configs: string[];
  optimized_configs: string[];
  urgent_actions: string[];
  warnings: string[];
};

export function buildTechnologyConfigurationReport(
  registry: TechnologyRegistry,
): TechnologyConfigurationReport {
  const missing_configs: string[] = [];
  const partial_configs: string[] = [];
  const optimized_configs: string[] = [];
  const urgent_actions: string[] = [];
  const warnings: string[] = [];

  for (const def of registry.definitions) {
    const setting = registry.settings.find((s) => s.technology_slug === def.slug);
    if (!setting) {
      missing_configs.push(def.slug);
      continue;
    }
    const cs = setting.configuration_status;
    if (cs === "missing") missing_configs.push(def.slug);
    else if (cs === "partial") partial_configs.push(def.slug);
    else if (cs === "optimized") optimized_configs.push(def.slug);

    if (def.is_platform_core && setting.status !== "enabled") {
      urgent_actions.push(`${def.slug} est noyau plateforme mais n'est pas activé.`);
    }
    if (setting.status === "degraded") {
      urgent_actions.push(`${def.slug} est en état dégradé — intervention requise.`);
    }
    if (setting.status === "not_configured" && def.is_platform_core) {
      urgent_actions.push(`${def.slug} n'est pas configuré (noyau).`);
    }
    const validation = validateTechnologySetting(setting, def);
    for (const w of validation.warnings) warnings.push(`[${def.slug}] ${w}`);
    for (const e of validation.errors) urgent_actions.push(`[${def.slug}] ${e}`);
  }

  return { missing_configs, partial_configs, optimized_configs, urgent_actions, warnings };
}

// ── buildTechnologyEmployeeMatrix ────────────────────────────────────────────

export type TechnologyEmployeeMatrixEntry = {
  technology_slug: string;
  [employeeSlug: string]: string;
};

export type TechnologyEmployeeMatrix = {
  rows: TechnologyEmployeeMatrixEntry[];
  employee_slugs: string[];
  technology_slugs: string[];
};

type EmployeeMatrixCellValue = "enabled" | "disabled" | "inherited" | "blocked";

export function buildTechnologyEmployeeMatrix(
  registry: TechnologyRegistry,
  employeeSlugs: string[],
): TechnologyEmployeeMatrix {
  const rows: TechnologyEmployeeMatrixEntry[] = [];
  const technology_slugs: string[] = registry.definitions.map((d) => d.slug);

  for (const def of registry.definitions) {
    const setting = registry.settings.find((s) => s.technology_slug === def.slug);
    const row: TechnologyEmployeeMatrixEntry = { technology_slug: def.slug };

    for (const empSlug of employeeSlugs) {
      let value: EmployeeMatrixCellValue = "inherited";
      const status = setting?.status ?? def.default_status;

      if (status === "disabled" || status === "not_configured") {
        value = "disabled";
      } else if (setting && setting.disabled_for_employee_slugs.includes(empSlug)) {
        value = "blocked";
      } else if (setting && setting.enabled_for_employee_slugs.length > 0) {
        value = setting.enabled_for_employee_slugs.includes(empSlug) ? "enabled" : "disabled";
      } else {
        value = "inherited";
      }

      row[empSlug] = value;
    }
    rows.push(row);
  }

  return { rows, employee_slugs: [...employeeSlugs], technology_slugs };
}

// ── buildTechnologyGovernanceSnapshot ───────────────────────────────────────

export type TechnologyGovernanceSnapshot = {
  global_autonomy: TechnologyAutonomyLevel;
  global_risk_mode: TechnologyRiskMode;
  strict_technologies: string[];
  autonomous_technologies: string[];
  human_required_technologies: string[];
  unconfigured_critical: string[];
  governance_health: "good" | "attention" | "critical";
};

export function buildTechnologyGovernanceSnapshot(
  registry: TechnologyRegistry,
): TechnologyGovernanceSnapshot {
  const strict_technologies: string[] = [];
  const autonomous_technologies: string[] = [];
  const human_required_technologies: string[] = [];
  const unconfigured_critical: string[] = [];

  const autonomyRank: Record<TechnologyAutonomyLevel, number> = {
    off: 0, suggest_only: 1, supervised: 2, semi_autonomous: 3, autonomous: 4,
  };
  const riskRank: Record<TechnologyRiskMode, number> = {
    normal: 0, guarded: 1, strict: 2, locked: 3,
  };

  let minAutonomyRank = 4;
  let maxRiskRank = 0;

  for (const def of registry.definitions) {
    const setting = registry.settings.find((s) => s.technology_slug === def.slug);
    const autonomy = setting?.autonomy_level ?? def.default_autonomy;
    const riskMode = setting?.risk_mode ?? def.default_risk_mode;
    const status = setting?.status ?? def.default_status;

    if (autonomyRank[autonomy] < minAutonomyRank) minAutonomyRank = autonomyRank[autonomy];
    if (riskRank[riskMode] > maxRiskRank) maxRiskRank = riskRank[riskMode];

    if (riskMode === "strict" || riskMode === "locked") strict_technologies.push(def.slug);
    if (autonomy === "autonomous") autonomous_technologies.push(def.slug);
    if (def.requires_human_validation) human_required_technologies.push(def.slug);
    if (def.is_platform_core && status !== "enabled") unconfigured_critical.push(def.slug);
  }

  const autonomyLevels: TechnologyAutonomyLevel[] = ["off", "suggest_only", "supervised", "semi_autonomous", "autonomous"];
  const riskModes: TechnologyRiskMode[] = ["normal", "guarded", "strict", "locked"];
  const global_autonomy = autonomyLevels[Math.min(minAutonomyRank, 4)];
  const global_risk_mode = riskModes[Math.min(maxRiskRank, 3)];

  let governance_health: "good" | "attention" | "critical" = "good";
  if (unconfigured_critical.length > 0) governance_health = "critical";
  else if (strict_technologies.length > 0 || autonomous_technologies.length > 0) governance_health = "attention";

  return {
    global_autonomy,
    global_risk_mode,
    strict_technologies,
    autonomous_technologies,
    human_required_technologies,
    unconfigured_critical,
    governance_health,
  };
}

// ── Re-export useful type ────────────────────────────────────────────────────
export type { TechnologyConfigurationStatus };
