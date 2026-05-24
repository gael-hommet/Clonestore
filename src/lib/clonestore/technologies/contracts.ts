// CloneStore Technologies Foundation — Contracts (Bloc 18)
// Pure module: no Supabase, no Next, no async, no side effects.
// Source of truth for all technology types across the CloneStore platform.

// ── Core identity types ──────────────────────────────────────────────────────

export type TechnologySlug =
  | "cloneos"
  | "cloneadn"
  | "cloneguard"
  | "clonetrace"
  | "clonecontinuum"
  | "clonetrust"
  | "clonereview"
  | "clonesignals"
  | "clonelearn"
  | "clonevoice"
  | "clonechat"
  | "clonebrief";

export type TechnologyVisibility =
  | "public"
  | "internal"
  | "beta"
  | "hidden";

export type TechnologyOperationalStatus =
  | "enabled"
  | "disabled"
  | "degraded"
  | "maintenance"
  | "not_configured";

export type TechnologyScope =
  | "platform"
  | "company"
  | "employee"
  | "mission"
  | "task"
  | "document"
  | "communication"
  | "voice"
  | "support";

export type TechnologyAutonomyLevel =
  | "off"
  | "suggest_only"
  | "supervised"
  | "semi_autonomous"
  | "autonomous";

export type TechnologyRiskMode =
  | "normal"
  | "guarded"
  | "strict"
  | "locked";

export type TechnologyConfigurationStatus =
  | "missing"
  | "partial"
  | "configured"
  | "optimized";

// ── Capability descriptor ────────────────────────────────────────────────────

export type TechnologyCapability = {
  id: string;
  label: string;
  description: string;
  scopes: TechnologyScope[];
  required: boolean;
  configurable: boolean;
  default_enabled: boolean;
};

// ── Technology definition (platform-level, immutable at runtime) ─────────────

export type TechnologyDefinition = {
  slug: TechnologySlug;
  name: string;
  short_name: string;
  public_label: string;
  one_liner: string;
  description: string;
  visibility: TechnologyVisibility;
  scopes: TechnologyScope[];
  default_status: TechnologyOperationalStatus;
  default_autonomy: TechnologyAutonomyLevel;
  default_risk_mode: TechnologyRiskMode;
  capabilities: TechnologyCapability[];
  applies_to_employee_slugs: string[];
  is_platform_core: boolean;
  is_customer_configurable: boolean;
  requires_human_validation: boolean;
  created_for: string;
};

// ── Per-company configuration (mutable, persisted in DB) ────────────────────

export type TechnologyCompanySetting = {
  technology_slug: TechnologySlug;
  status: TechnologyOperationalStatus;
  autonomy_level: TechnologyAutonomyLevel;
  risk_mode: TechnologyRiskMode;
  configuration_status: TechnologyConfigurationStatus;
  enabled_for_employee_slugs: string[];
  disabled_for_employee_slugs: string[];
  custom_rules: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  notification_rules: Record<string, unknown>;
  memory_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ── Runtime state (computed at request time, not persisted) ─────────────────

export type TechnologyRuntimeState = {
  technology_slug: TechnologySlug;
  status: TechnologyOperationalStatus;
  health_score: number;
  last_event_at: string | null;
  warnings: string[];
  blockers: string[];
  configured: boolean;
  active_for_employee_slugs: string[];
};

// ── Registry ─────────────────────────────────────────────────────────────────

export type TechnologyRegistry = {
  definitions: TechnologyDefinition[];
  settings: TechnologyCompanySetting[];
  runtime_states: TechnologyRuntimeState[];
  summary: TechnologyRegistrySummary;
};

export type TechnologyRegistrySummary = {
  total: number;
  enabled: number;
  disabled: number;
  degraded: number;
  not_configured: number;
  customer_configurable: number;
  platform_core: number;
};
