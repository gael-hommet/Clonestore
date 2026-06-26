// TECH-02 — Employee Runtime Contract
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Source of truth for the common contract all CloneStore AI employees must implement.
//
// ── ARCHITECTURE RULE ────────────────────────────────────────────────────────
// Technologies are NOT employees. Technologies are global system layers:
//   CloneOS, CloneADN, CloneGuard, CloneTrace, CloneVoice, CloneChat,
//   ClonePolicy, CloneContinuum, CloneTrust, CloneReview, CloneSignals,
//   CloneLearn, CloneBrief.
//
// Employees are business roles that PLUG INTO these global technologies:
//   Pierre (HR), Emma (Support), Lucas (Finance), Sophie (Legal), ...
//
// The EmployeeRuntimeContract is the plug-in adapter.
// It declares what each employee needs, how it uses each technology,
// what it can do, and what it is strictly forbidden from doing.
// ─────────────────────────────────────────────────────────────────────────────

import type { TechnologySlug } from "../technologies/contracts";

// ── Primitive identity types ──────────────────────────────────────────────────

export type EmployeeSlug = string;

export type EmployeeDomain =
  | "hr"
  | "support"
  | "finance"
  | "legal"
  | "sales"
  | "ops"
  | "marketing"
  | "data"
  | "custom";

export type EmployeeStatus =
  | "active"
  | "beta"
  | "roadmap"
  | "disabled"
  | "deprecated";

export type EmployeeLaunchStage =
  | "launch_candidate"  // V1 ready — product functional, external blockers pending
  | "beta_access"       // Limited beta rollout
  | "internal_only"     // Internal testing only
  | "roadmap"           // Planned, not yet built
  | "concept";          // Exploratory concept

export type EmployeeCapability = string;
// Examples: "employee_file", "hr_documents", "recruitment_ops", "onboarding"

export type EmployeeMissionType = string;
// Examples: "contract_preparation", "onboarding_coordination", "absence_case_management"

export type EmployeeTaskType = string;
// Examples: "draft_document", "send_email_draft", "validate_employee_data", "update_employee_file"

export type EmployeeArtifactType = string;
// Examples: "contract_pdf", "amendment_letter_pdf", "onboarding_checklist", "absence_report"

export type EmployeeChannel =
  | "chat"
  | "email"
  | "voice"
  | "api"
  | "webhook"
  | "cockpit";

export type EmployeeRiskDomain = string;
// Examples (Pierre): "recruitment_ops", "contract", "payroll_prep", "sensitive_case"

// ── Valid technology slugs — runtime mirror of TechnologySlug ─────────────────
// Used by the validator to check unknown/typo slugs at runtime.
// Must stay in sync with contracts.ts TechnologySlug.

export const VALID_EMPLOYEE_TECHNOLOGY_SLUGS = new Set<TechnologySlug>([
  "cloneos",
  "cloneadn",
  "cloneguard",
  "clonetrace",
  "clonecontinuum",
  "clonetrust",
  "clonereview",
  "clonesignals",
  "clonelearn",
  "clonevoice",
  "clonechat",
  "clonebrief",
]);

// ── Technology requirement ────────────────────────────────────────────────────
// Declares which global technologies this employee needs and why.
// Does NOT redefine the technology — only configures the plug-in.

export type EmployeeTechnologyRequirement = {
  slug: TechnologySlug;
  required: boolean;        // true = hard requirement (blocks safe operation if absent)
  rationale: string;        // why this technology is needed
  minimum_readiness: number; // minimum readiness score (0–100) for safe operation
};

// ── Guard profile — how the employee uses CloneGuard ─────────────────────────

export type EmployeeGuardProfile = {
  risk_domains: EmployeeRiskDomain[];
  blocks_on_black_risk: boolean;
  requires_human_approval_on_red: boolean;
  allows_autonomous_on_green: boolean;
  policy_pipeline_enabled: boolean;  // ClonePolicy embedded in CloneGuard pipeline
  trust_pipeline_enabled: boolean;   // CloneTrust embedded in CloneGuard pipeline
};

// ── Policy pack reference — domain-specific rules ────────────────────────────

export type EmployeePolicyPackRef = {
  pack_id: string;
  version: string;
  domain: EmployeeDomain;
  rules_count: number;
  custom_rules_allowed: boolean;
};

// ── Trust profile — autonomy calibration ─────────────────────────────────────

export type EmployeeTrustProfile = {
  base_autonomy_level: "off" | "suggest_only" | "supervised" | "semi_autonomous";
  max_autonomy_level: "off" | "suggest_only" | "supervised" | "semi_autonomous" | "autonomous";
  trust_escalation_enabled: boolean;
  human_override_always_available: boolean;
};

// ── Trace profile — how the employee writes to CloneTrace ────────────────────

export type EmployeeTraceProfile = {
  writes_to_global_trace: boolean;
  trace_event_types: string[];
  audit_level: "minimal" | "standard" | "full";
  export_available: boolean;
};

// ── ADN usage profile — how the employee reads CloneADN ──────────────────────

export type EmployeeADNUsageProfile = {
  reads_enterprise_memory: boolean;
  reads_tone_preferences: boolean;
  reads_communication_rules: boolean;
  reads_validation_circuits: boolean;
  writes_to_adn: boolean;
};

// ── Review profile — quality control configuration ───────────────────────────

export type EmployeeReviewProfile = {
  enabled: boolean;
  review_before_send: boolean;
  review_before_document_generation: boolean;
  minimum_score: number; // 0–100
};

// ── Signals profile — event and trigger configuration ────────────────────────

export type EmployeeSignalsProfile = {
  enabled: boolean;
  signal_types: string[];
  proactive_alerts: boolean;
};

// ── Brief profile — summary and briefing configuration ───────────────────────

export type EmployeeBriefProfile = {
  enabled: boolean;
  morning_brief: boolean;
  evening_brief: boolean;
  mission_summary: boolean;
};

// ── Permission set ────────────────────────────────────────────────────────────
// Explicit declaration of what an employee can and cannot do.
//
// CRITICAL: The following fields MUST ALWAYS BE FALSE for all employees.
// They encode fundamental architectural constraints. The validator enforces this.
//   - can_make_legal_decision:          AI employees are not lawyers.
//   - can_run_payroll_officially:       Official payroll requires certified software + human.
//   - can_terminate_employee_autonomously: Termination requires human decision and legal compliance.
//   - can_sign_contracts:               Signatures require human authorization.

export type EmployeePermissionSet = {
  can_prepare_documents: boolean;
  can_send_email_draft: boolean;
  can_send_email_live: "never" | "governed" | "requires_policy" | "supervised";
  can_read_employee_data: boolean;
  can_generate_pdf: boolean;
  /** MUST BE FALSE — validator enforces. AI employees cannot make legal decisions. */
  can_make_legal_decision: boolean;
  /** MUST BE FALSE — validator enforces. Official payroll execution is human-only. */
  can_run_payroll_officially: boolean;
  /** MUST BE FALSE — validator enforces. Employee termination requires human decision. */
  can_terminate_employee_autonomously: boolean;
  /** MUST BE FALSE — validator enforces. Contract signing requires human authorization. */
  can_sign_contracts: boolean;
  requires_human_validation_for: string[];
};

// ── Unavailable reason ────────────────────────────────────────────────────────

export type EmployeeUnavailableReason = {
  code: string;
  description: string;
  external: boolean; // true = external blocker (legal, RLS, Stripe) — outside employee scope
};

// ── Launch readiness ──────────────────────────────────────────────────────────
// product_runtime_ready: set by the employee contract (is the engine functional?).
// public_launch_ready:   ALWAYS FALSE here — controlled by Go-Live gate (GO-LIVE 01–10).

export type EmployeeLaunchReadiness = {
  product_runtime_ready: boolean;
  /**
   * ALWAYS false in the employee contract.
   * Public launch readiness is controlled exclusively by the external Go-Live gate
   * (GO-LIVE 01 → GO-LIVE 10). It is never the employee's decision to launch publicly.
   */
  public_launch_ready: boolean;
  demo_ready: boolean;
  onboarding_ready: boolean;
  internal_blockers: string[];
  external_blockers: string[]; // legal, RLS, Stripe — outside employee contract scope
};

// ── Employee Runtime Contract ─────────────────────────────────────────────────
// The single source of truth for what a CloneStore AI employee is and can do.

export type EmployeeRuntimeContract = {
  // ── Identity ────────────────────────────────────────────────────────────────
  employee_id: string;
  slug: EmployeeSlug;
  display_name: string;
  short_name: string;
  domain: EmployeeDomain;
  status: EmployeeStatus;
  launch_stage: EmployeeLaunchStage;
  description: string;
  public_positioning: string;
  internal_purpose: string;

  // ── Business capabilities (domain pack) ─────────────────────────────────────
  capabilities: EmployeeCapability[];
  mission_types: EmployeeMissionType[];
  task_types: EmployeeTaskType[];
  artifact_types: EmployeeArtifactType[];
  channels: EmployeeChannel[];

  // ── Technology plug-in (global layers) ──────────────────────────────────────
  required_technologies: EmployeeTechnologyRequirement[];
  guard_profile: EmployeeGuardProfile;
  policy_pack: EmployeePolicyPackRef;
  trust_profile: EmployeeTrustProfile;
  trace_profile: EmployeeTraceProfile;
  adn_usage_profile: EmployeeADNUsageProfile;
  review_profile: EmployeeReviewProfile;
  signals_profile: EmployeeSignalsProfile;
  brief_profile: EmployeeBriefProfile;

  // ── Governance ───────────────────────────────────────────────────────────────
  permissions: EmployeePermissionSet;
  unavailable_reasons: EmployeeUnavailableReason[];
  launch_readiness: EmployeeLaunchReadiness;

  // ── Metadata ─────────────────────────────────────────────────────────────────
  created_at: string;
  updated_at: string;
};
