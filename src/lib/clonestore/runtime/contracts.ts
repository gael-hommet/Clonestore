// CloneStore Runtime — Contracts (Bloc 19)
// Pure module: no Supabase, no Next, no async, no side effects.
// Runtime evaluation types for all AI employees — platform-level, not Pierre-specific.

import type {
  TechnologySlug,
  TechnologyAutonomyLevel,
  TechnologyRiskMode,
} from "../technologies/contracts";

// ── Runtime decision ─────────────────────────────────────────────────────────
// Ordered from least to most restrictive.

export type CloneRuntimeDecision =
  | "allowed"
  | "allowed_with_observation"
  | "requires_review"
  | "requires_validation"
  | "blocked_by_technology"
  | "blocked_by_policy";

// ── Per-technology capability status for a given employee ────────────────────

export type CloneRuntimeCapability = {
  technology_slug: TechnologySlug;
  enabled: boolean;
  autonomy_level: TechnologyAutonomyLevel;
  risk_mode: TechnologyRiskMode;
  // True only when technology is enabled AND autonomy >= supervised
  can_auto_execute: boolean;
  // True when clonetrace is active and this technology is enabled
  requires_observation: boolean;
  // True when clonereview is active and this technology is enabled
  requires_review: boolean;
};

// ── Runtime context (built from registry for a specific employee) ────────────
// Thin, flat snapshot of what the runtime engine resolved for an employee.

export type CloneRuntimeContext = {
  employee_slug: string;
  built_at: string;
  // Technologies confirmed active for this employee
  active_technologies: TechnologySlug[];
  // Resolved from cloneguard setting
  guard_mode: TechnologyRiskMode;
  // Resolved from clonetrust setting
  autonomy_level: TechnologyAutonomyLevel;
  // Individual technology flags
  trace_enabled: boolean;
  review_enabled: boolean;
  continuity_enabled: boolean;
  chat_enabled: boolean;
  learn_enabled: boolean;
  signals_enabled: boolean;
  voice_enabled: boolean;
  brief_enabled: boolean;
};

// ── Action evaluation result ─────────────────────────────────────────────────

export type CloneRuntimeActionEvaluation = {
  action_type: string;
  decision: CloneRuntimeDecision;
  // Which technology drove this decision (null = policy rule, not a technology)
  technology_source: TechnologySlug | null;
  requires_observation: boolean;
  requires_review: boolean;
  requires_human_validation: boolean;
  can_auto_execute: boolean;
  explanation: string;
  evaluated_at: string;
};

// ── Governance summary (for snapshot) ───────────────────────────────────────

export type CloneRuntimeGovernance = {
  global_autonomy: TechnologyAutonomyLevel;
  global_risk_mode: TechnologyRiskMode;
  // healthy = all core tech enabled, no locks
  // degraded = strict/autonomous tech present or warnings
  // locked = any core tech misconfigured or risk_mode=locked
  governance_health: "healthy" | "degraded" | "locked";
};

// ── Full runtime snapshot (for dashboard and mission enrichment) ─────────────

export type CloneRuntimeSnapshot = {
  employee_slug: string;
  built_at: string;
  active_technology_count: number;
  context: CloneRuntimeContext;
  governance: CloneRuntimeGovernance;
  capabilities: CloneRuntimeCapability[];
  summary: string;
};

// ── Action input (for POST /api/clonestore/runtime evaluation) ───────────────

export type CloneRuntimeActionInput = {
  action_type: string;
  task_type?: string | null;
  risk_level?: string | null;
  approval_required?: boolean | null;
  contains_sensitive_keywords?: boolean | null;
};

// ── Storage source traceability ──────────────────────────────────────────────

export type CloneRuntimeStorageSource =
  | "platform_table"
  | "legacy_json"
  | "defaults"
  | "unavailable";
