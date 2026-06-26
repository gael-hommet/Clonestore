// TECH-03 — Global Technology Config Model — Types
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Unified type layer covering all 13 CloneStore technologies.
// Supersedes the B46 visible-only layer for internal configuration purposes.
// B46 compatibility is preserved via global-tech-b46-bridge.ts.
//
// 13 technologies covered:
//   Visible/core:   cloneos, cloneadn, cloneguard, clonetrace, clonevoice, clonechat
//   Internal:       clonepolicy, clonecontinuum, clonetrust, clonereview, clonesignals, clonelearn
//   Premium light:  clonebrief
//
// NOTE: "clonepolicy" is a GlobalTechnologyKey but NOT a TechnologySlug (contracts.ts).
// This is intentional — ClonePolicy operates as an internal engine within CloneGuard's
// pipeline (CloneGuard → ClonePolicy → CloneTrust). It is listed here for completeness
// and configuration purposes, not as a standalone customer-visible product.

// ── GlobalTechnologyKey — all 13 technologies ─────────────────────────────────
// Superset of TechnologySlug (contracts.ts). Adds "clonepolicy" as 13th key.

export type GlobalTechnologyKey =
  | "cloneos"
  | "cloneadn"
  | "cloneguard"
  | "clonetrace"
  | "clonevoice"
  | "clonechat"
  | "clonepolicy"
  | "clonecontinuum"
  | "clonetrust"
  | "clonereview"
  | "clonesignals"
  | "clonelearn"
  | "clonebrief";

export const ALL_GLOBAL_TECHNOLOGY_KEYS: GlobalTechnologyKey[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat",
  "clonepolicy", "clonecontinuum", "clonetrust", "clonereview", "clonesignals",
  "clonelearn", "clonebrief",
];

export const GLOBAL_TECHNOLOGY_KEY_SET = new Set<GlobalTechnologyKey>(ALL_GLOBAL_TECHNOLOGY_KEYS);

export function isGlobalTechnologyKey(v: unknown): v is GlobalTechnologyKey {
  return typeof v === "string" && GLOBAL_TECHNOLOGY_KEY_SET.has(v as GlobalTechnologyKey);
}

// Keys that are also valid TechnologySlug (contracts.ts) — the 12 shared keys
export const TECHNOLOGY_SLUG_SUBSET = new Set<string>([
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonecontinuum",
  "clonetrust", "clonereview", "clonesignals", "clonelearn",
  "clonevoice", "clonechat", "clonebrief",
]);

export function isInTechnologySlugSubset(key: GlobalTechnologyKey): boolean {
  return TECHNOLOGY_SLUG_SUBSET.has(key);
}

// ── Category ──────────────────────────────────────────────────────────────────

export type GlobalTechnologyCategory =
  | "core"        // CloneOS — orchestration engine
  | "governance"  // CloneGuard, ClonePolicy, CloneTrust
  | "memory"      // CloneADN
  | "traceability" // CloneTrace
  | "interface"   // CloneVoice, CloneChat
  | "automation"  // CloneContinuum, CloneSignals
  | "quality"     // CloneReview
  | "learning"    // CloneLearn
  | "executive";  // CloneBrief

// ── Visibility ────────────────────────────────────────────────────────────────

export type GlobalTechnologyVisibility =
  | "public"          // visible to all users and customers
  | "customer_only"   // visible only to paying customers
  | "internal"        // CloneStore internal only
  | "beta"            // beta access only
  | "hidden";         // not shown anywhere

// ── Status ────────────────────────────────────────────────────────────────────

export type GlobalTechnologyStatus =
  | "active"    // fully operational
  | "partial"   // partially implemented or Pierre-only
  | "disabled"  // explicitly disabled
  | "roadmap"   // planned, not yet built
  | "locked";   // locked by platform, cannot be changed

// ── Mode ──────────────────────────────────────────────────────────────────────

export type GlobalTechnologyMode =
  | "production"   // live, full operation
  | "supervised"   // operational with human oversight
  | "test"         // test/sandbox mode
  | "disabled"     // not running
  | "roadmap";     // not yet implemented

// ── Runtime status ────────────────────────────────────────────────────────────

export type GlobalTechnologyRuntimeStatus =
  | "operational"       // running and healthy
  | "partial"           // running with limitations
  | "unavailable"       // configured but not reachable
  | "not_implemented";  // not yet built

// ── Control level ─────────────────────────────────────────────────────────────

export type GlobalTechnologyControlLevel =
  | "platform_locked"           // CloneStore controls, customer cannot change
  | "company_configurable"      // Customer can configure within guardrails
  | "employee_override_allowed" // Customer can set per-employee overrides
  | "internal_only";            // Internal engine, not customer-facing

// ── Risk mode ─────────────────────────────────────────────────────────────────

export type GlobalTechnologyRiskMode =
  | "conservative"  // maximum guardrails, blocks on any doubt
  | "balanced"      // standard guardrails
  | "permissive"    // minimum guardrails (not recommended for governance techs)
  | "disabled";     // no risk mode applied (only for non-governance techs)

// ── Autonomy level ────────────────────────────────────────────────────────────
// CloneTrust = autonomie graduelle, NOT zero-trust.

export type GlobalTechnologyAutonomyLevel =
  | "none"            // no automation at all
  | "suggest_only"    // suggestions only, human decides
  | "supervised"      // acts but notifies human every time
  | "semi_autonomous" // acts autonomously within defined boundaries
  | "autonomous";     // fully autonomous (only for non-sensitive techs)

// ── Config scope ──────────────────────────────────────────────────────────────

export type GlobalTechnologyConfigScope =
  | "platform"
  | "company"
  | "employee"
  | "mission"
  | "task";

// ── Guardrails ────────────────────────────────────────────────────────────────

export type GlobalTechnologyGuardrails = {
  requires_human_validation: boolean;
  blocks_autonomous_actions: boolean;
  requires_audit_trail: boolean;
  requires_paid_access: boolean;
  no_live_production_without_approval: boolean;
  max_autonomy_allowed: GlobalTechnologyAutonomyLevel;
};

// ── Employee override ─────────────────────────────────────────────────────────
// Allows per-employee adjustments to the global technology configuration.
// Only valid when GlobalTechnologyConfig.supports_employee_overrides = true.

export type GlobalTechnologyEmployeeOverride = {
  employee_slug: string;
  enabled: boolean;
  mode: GlobalTechnologyMode;
  risk_mode: GlobalTechnologyRiskMode;
  autonomy_level: GlobalTechnologyAutonomyLevel;
  settings: Record<string, unknown>;
  notes: string;
};

// ── Main config ───────────────────────────────────────────────────────────────

export type GlobalTechnologyConfig = {
  key: GlobalTechnologyKey;
  display_name: string;
  short_description: string;
  category: GlobalTechnologyCategory;
  visibility: GlobalTechnologyVisibility;
  status: GlobalTechnologyStatus;
  mode: GlobalTechnologyMode;
  runtime_status: GlobalTechnologyRuntimeStatus;
  control_level: GlobalTechnologyControlLevel;
  risk_mode: GlobalTechnologyRiskMode;
  autonomy_level: GlobalTechnologyAutonomyLevel;
  configurable_by_customer: boolean;
  locked_by_platform: boolean;
  visible_to_customer: boolean;
  required_for_public_launch: boolean;
  required_for_employee_runtime: boolean;
  supports_employee_overrides: boolean;
  employee_overrides: GlobalTechnologyEmployeeOverride[];
  settings: Record<string, unknown>;
  guardrails: GlobalTechnologyGuardrails;
  dependencies: GlobalTechnologyKey[];
  conflicts: GlobalTechnologyKey[];
  readiness_score: number; // 0–100 based on TECH-01 real audit
  created_at: string;
  updated_at: string;
};

// ── Snapshot ──────────────────────────────────────────────────────────────────

export type GlobalTechnologyConfigSummary = {
  total: number;
  active: number;
  partial: number;
  roadmap: number;
  disabled: number;
  locked: number;
  customer_configurable: number;
  platform_locked: number;
  required_for_employee_runtime: number;
  average_readiness_score: number;
};

export type GlobalTechnologyConfigSnapshot = {
  generated_at: string;
  technologies: GlobalTechnologyConfig[];
  summary: GlobalTechnologyConfigSummary;
  employee_coverage: Record<string, GlobalTechnologyKey[]>; // employeeSlug → tech keys required
};

// ── Patch ─────────────────────────────────────────────────────────────────────

export type GlobalTechnologyConfigPatch = {
  key: GlobalTechnologyKey;
  status?: GlobalTechnologyStatus;
  mode?: GlobalTechnologyMode;
  risk_mode?: GlobalTechnologyRiskMode;
  autonomy_level?: GlobalTechnologyAutonomyLevel;
  settings?: Record<string, unknown>;
  employee_overrides?: GlobalTechnologyEmployeeOverride[];
};

// ── Validation issue ──────────────────────────────────────────────────────────

export type GlobalTechnologyConfigValidationIssue = {
  key: GlobalTechnologyKey;
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type GlobalTechnologyConfigValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: GlobalTechnologyConfigValidationIssue[];
  config_count: number;
  active_count: number;
  partial_count: number;
  roadmap_count: number;
  locked_count: number;
  employee_runtime_coverage: number; // 0–100 — % of employee-required techs in config
  checked_at: string;
};
