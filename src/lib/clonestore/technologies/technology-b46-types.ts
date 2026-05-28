// B46 — CloneStore Technologies Configuration Polish — Types
// Pure: no Supabase, no Next, no async, no side effects. No throw.

// ── The 6 visible technologies targeted by B46 ────────────────────────────────

export type CloneStoreTechnologyId =
  | "cloneos"
  | "cloneadn"
  | "cloneguard"
  | "clonetrace"
  | "clonevoice"
  | "clonechat";

export const B46_TECHNOLOGY_IDS: CloneStoreTechnologyId[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice", "clonechat",
];

export const B46_LAUNCH_CRITICAL: CloneStoreTechnologyId[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace",
];

export const B46_PIERRE_REQUIRED: CloneStoreTechnologyId[] = [
  "cloneos", "cloneguard", "clonetrace",
];

// ── Status / Mode / Visibility types ─────────────────────────────────────────

export type B46TechnologyStatus =
  | "disabled"
  | "draft"
  | "needs_configuration"
  | "ready"
  | "active"
  | "degraded"
  | "blocked"
  | "archived";

export type B46TechnologyRuntimeMode =
  | "mock"
  | "dry_run"
  | "sandbox"
  | "production"
  | "disabled";

export type B46TechnologyVisibility =
  | "visible_to_customer"
  | "internal_only"
  | "hidden_until_ready";

export type B46TechnologyCapabilityId =
  | "mission_orchestration"
  | "memory_context"
  | "risk_validation"
  | "traceability"
  | "voice_input"
  | "chat_interface"
  | "email_runtime"
  | "document_generation"
  | "workflow_continuity"
  | "audit"
  | "diagnostics";

// ── Guardrails ────────────────────────────────────────────────────────────────

export type B46TechnologyGuardrails = {
  requires_paid_customer: boolean;
  requires_human_validation: boolean;
  requires_security_guard: boolean;
  requires_audit: boolean;
  requires_cost_shield: boolean;
  blocks_sensitive_actions: boolean;
  blocks_unverified_channels: boolean;
  no_public_demo_live: boolean;
  no_unpaid_live: boolean;
  allowed_runtime_modes: B46TechnologyRuntimeMode[];
  locked: boolean;
};

// ── Readiness ─────────────────────────────────────────────────────────────────

export type B46TechnologyReadiness = {
  score: number;              // 0–100
  ready: boolean;
  active_safe: boolean;
  missing_required: string[];
  warnings: string[];
  blockers: string[];
  dependencies_ok: boolean;
  last_checked_at: string;
};

// ── Dependency ────────────────────────────────────────────────────────────────

export type B46TechnologyDependency = {
  technology_id: CloneStoreTechnologyId;
  required: boolean;
  status: "ok" | "degraded" | "missing";
  reason: string;
};

// ── Display ───────────────────────────────────────────────────────────────────

export type B46TechnologyDisplay = {
  name: string;
  short_label: string;
  description: string;
  customer_description: string;
  icon_key: string;
  accent: string;
  order: number;
};

// ── Technology item (snapshot unit) ──────────────────────────────────────────

export type B46TechnologyItem = {
  id: CloneStoreTechnologyId;
  display: B46TechnologyDisplay;
  status: B46TechnologyStatus;
  runtime_mode: B46TechnologyRuntimeMode;
  visibility: B46TechnologyVisibility;
  enabled: boolean;
  locked: boolean;
  capabilities: B46TechnologyCapabilityId[];
  guardrails: B46TechnologyGuardrails;
  readiness: B46TechnologyReadiness;
  launch_critical: boolean;
  pierre_required: boolean;
  dependencies: B46TechnologyDependency[];
};

// ── Readiness context ─────────────────────────────────────────────────────────

export type B46ReadinessContext = {
  b38_closed: boolean;
  b39_closed: boolean;
  b40_closed: boolean;
  b41_closed: boolean;
  b42_closed: boolean;
  b43_closed: boolean;
  b44_closed: boolean;
  b45_closed: boolean;
  empreinte_ready: boolean;
  document_style_ready: boolean;
  security_ready: boolean;
  observability_ready: boolean;
  email_runtime_mode: string;
  ai_runtime_mode: string;
};

// ── Snapshot ──────────────────────────────────────────────────────────────────

export type PierreTechnologyStatus = {
  cloneos_active: boolean;
  cloneadn_active: boolean;
  cloneguard_active: boolean;
  clonetrace_active: boolean;
  clonevoice_available: boolean;
  clonechat_limited: boolean;
  safe_to_run_pierre: boolean;
  blocked_features: string[];
};

export type GlobalTechnologiesReadiness = {
  score: number;
  ready: boolean;
  launch_critical_ok: boolean;
  warnings: string[];
  blockers: string[];
};

export type TechnologiesSnapshot = {
  tenant: {
    user_id: string;
    generated_at: string;
  };
  technologies: B46TechnologyItem[];
  global_readiness: GlobalTechnologiesReadiness;
  pierre_technology_status: PierreTechnologyStatus;
  warnings: string[];
  blockers: string[];
  next_actions: string[];
  generated_at: string;
};

// ── Verdict ───────────────────────────────────────────────────────────────────

export type GlobalTechnologiesVerdict = {
  status: "validated_with_followups" | "blocked";
  score: number;
  safe_to_continue_to_b47: boolean;
  ready_for_launch_after_b48: boolean;
  critical_technologies_ready: boolean;
  degraded_technologies: CloneStoreTechnologyId[];
  blockers: string[];
  followups: string[];
};

// ── Permissions ───────────────────────────────────────────────────────────────

export type TechnologyAccessLevel =
  | "anonymous"
  | "logged_unpaid"
  | "trial"
  | "paid_customer"
  | "internal_admin";
