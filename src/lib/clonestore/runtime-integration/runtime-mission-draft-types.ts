// src/lib/clonestore/runtime-integration/runtime-mission-draft-types.ts
// PHASE 4.3 — Runtime Mission Draft Creation Contract / No-Execution Mission Draft — Types
//
// Brouillon de mission LOCAL / IN-MEMORY. Aucune mission créée en base.
// Aucune exécution. Aucun moteur Pierre. Aucun appel IA. Aucun write DB.
//
// INVARIANTS ABSOLUS (champs littéralement false) :
//   read_only true · plan_only true · execution_enabled false · db_write_enabled false
//   api_execution_enabled false · pierre_engine_called false · ai_call_performed false
//   email_sent false · message_sent false · document_generated false
//   clonevoice_active false · public_launch_external_validated false

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftPhase = "4.3";

export type RuntimeMissionDraftMode = "in_memory_preview";

export type RuntimeMissionDraftStatus =
  | "draft"
  | "ready_for_review"
  | "awaiting_validation"
  | "blocked"
  | "simulated_only";

export type RuntimeMissionDraftSource =
  | "runtime_simulation"
  | "command_center_preview";

export type RuntimeMissionDraftKind =
  | "pierre_mission_draft"
  | "unsupported_domain_draft"
  | "blocked_draft";

export type RuntimeMissionDraftRiskLevel =
  | "low" | "medium" | "high" | "sensitive" | "blocked";

export type RuntimeMissionDraftValidationMode =
  | "none"
  | "human_review_recommended"
  | "human_validation_required"
  | "blocked";

export type RuntimeMissionDraftEmployeeKey = string;

export type RuntimeMissionDraftTenantScope = {
  user_id: string | null;
  company_id: string | null;
  isolation: "strict";
};

// ── Step ──────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftStep = {
  draft_step_id: string;
  label: string;
  description: string;
  source_plan_step_id: string;
  function_key?: string;
  capability_key?: string;
  risk_level: RuntimeMissionDraftRiskLevel;
  validation_mode: RuntimeMissionDraftValidationMode;
  requires_human_validation: boolean;
  status: RuntimeMissionDraftStatus;
  plan_only: true;
  execution_enabled: false;
  read_only: true;
};

// ── Validation requirement ────────────────────────────────────────────────────

export type RuntimeMissionDraftValidationRequirement = {
  requirement_id: string;
  label: string;
  reason: string;
  risk_level: RuntimeMissionDraftRiskLevel;
  required_approver_role: string;
  blocks_execution: boolean;
};

// ── Snapshots (gouvernance / scale, recopiés depuis le plan) ──────────────────

export type RuntimeMissionDraftGuardSnapshot = {
  decision: "allow_plan_only" | "require_human_validation" | "block";
  risk_level: RuntimeMissionDraftRiskLevel;
  reasons: string[];
  sensitive_topics: string[];
  cloneguard_required: true;
  human_validation_required: boolean;
  bypass_allowed: false;
};

export type RuntimeMissionDraftTraceSnapshot = {
  trace_id: string;
  clonetrace_required: true;
  server_write_enabled: false;
  contains_personal_data: boolean;
  events: string[];
  final_event: "execution_not_started";
};

export type RuntimeMissionDraftScaleSnapshot = {
  stateless_runtime_required: true;
  tenant_scoped_by: "user_id_and_company_id";
  idempotency_key_required: true;
  rate_limit_required: true;
  load_test_required: true;
  scale_80k_not_proven: true;
};

export type RuntimeMissionDraftQueueSnapshot = {
  queue_name: string;
  priority: "normal" | "high";
  retry_count_recommended: number;
  dead_letter_on_failure: true;
};

export type RuntimeMissionDraftCostSnapshot = {
  orchestration_model_tier: "cheap_or_standard";
  premium_model_only_for: string;
  avoid_premium_model_for: string;
  token_budget_required: true;
};

export type RuntimeMissionDraftIdempotencySnapshot = {
  idempotency_key: string;
  derived_from: string;
  required: true;
};

// ── Issues / recommendations / actions ────────────────────────────────────────

export type RuntimeMissionDraftIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeMissionDraftRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeMissionDraftAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

// ── Mission Draft ─────────────────────────────────────────────────────────────

export type RuntimeMissionDraft = {
  draft_id: string;
  kind: RuntimeMissionDraftKind;
  source: RuntimeMissionDraftSource;
  status: RuntimeMissionDraftStatus;
  title: string;
  objective: string;
  summary: string;
  employee_key: RuntimeMissionDraftEmployeeKey | null;
  command_id: string;
  intent_id: string;
  route_id: string;
  plan_id: string;
  company_id?: string;
  user_id?: string;
  domain: string;
  risk_level: RuntimeMissionDraftRiskLevel;
  validation_mode: RuntimeMissionDraftValidationMode;
  steps: RuntimeMissionDraftStep[];
  validation_requirements: RuntimeMissionDraftValidationRequirement[];
  missing_context: string[];
  blocked_reasons: string[];
  guard_snapshot: RuntimeMissionDraftGuardSnapshot;
  trace_snapshot: RuntimeMissionDraftTraceSnapshot;
  scale_snapshot: RuntimeMissionDraftScaleSnapshot;
  queue_snapshot: RuntimeMissionDraftQueueSnapshot;
  cost_snapshot: RuntimeMissionDraftCostSnapshot;
  idempotency: RuntimeMissionDraftIdempotencySnapshot;
  recommendations: RuntimeMissionDraftRecommendation[];
  issues: RuntimeMissionDraftIssue[];
  actions: RuntimeMissionDraftAction[];
  created_at: string;
  updated_at: string;
  // ── Safety flags (littéralement false) ──────────────────────────────────────
  read_only: true;
  plan_only: true;
  execution_enabled: false;
  db_write_enabled: false;
  api_execution_enabled: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
};

export type RuntimeMissionDraftReadResult = {
  mode: RuntimeMissionDraftMode;
  draft: RuntimeMissionDraft;
  read_only: true;
  execution_enabled: false;
};
