// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-types.ts
// PHASE 4.11 — Controlled Mission Human Validation Workflow Design — Types
//
// DESIGN-ONLY. Conception du workflow de validation HUMAINE des candidates de
// ControlledMission avant toute vraie mission. Aucune route POST. Aucun write.
// Aucune mission réelle. Aucune exécution. Aucun moteur Pierre.
//
// INVARIANT CENTRAL : "approved_preview" ne crée AUCUNE vraie mission et n'exécute
// RIEN. approval_applied reste false en P4.11.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionHumanValidationPhase = "4.11";

export type RuntimeControlledMissionHumanValidationMode =
  | "design_only"
  | "preview_only"
  | "future_governed_runtime";

export type RuntimeControlledMissionHumanValidationStatus =
  | "not_started"
  | "awaiting_validator"
  | "awaiting_second_validator"
  | "changes_requested"
  | "approved_preview"
  | "rejected"
  | "blocked"
  | "expired"
  | "cancelled";

export type RuntimeControlledMissionHumanValidationDecision =
  | "approve_preview"
  | "request_changes"
  | "reject"
  | "block"
  | "escalate"
  | "no_decision";

export type RuntimeControlledMissionHumanValidationRiskLevel =
  | "low" | "medium" | "high" | "sensitive" | "blocked";

export type RuntimeControlledMissionHumanValidationSensitivity =
  | "low" | "medium" | "high" | "sensitive_hr" | "legal_sensitive" | "blocked";

export type RuntimeControlledMissionHumanValidationActorRole =
  | "requester"
  | "validator"
  | "second_validator"
  | "hr_manager"
  | "legal_reviewer"
  | "admin"
  | "cloneguard"
  | "clonetrace";

export type RuntimeControlledMissionHumanValidationGateId =
  | "human_validator_required"
  | "second_validator_required"
  | "cloneguard_required"
  | "clonetrace_required"
  | "tenant_scope_required"
  | "risk_review_required"
  | "sensitive_hr_review_required"
  | "legal_review_required"
  | "missing_context_review_required"
  | "no_execution_required"
  | "no_real_mission_required"
  | "promotion_not_applied_required"
  | "audit_trace_required";

export type RuntimeControlledMissionHumanValidationGateStatus =
  | "pending" | "passed" | "failed" | "not_required";

export type RuntimeControlledMissionHumanValidationGateSeverity =
  | "blocking" | "warning" | "info";

// ── Composants ────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionHumanValidator = {
  role: RuntimeControlledMissionHumanValidationActorRole;
  required: boolean;
  reason: string;
  assigned_id: string | null;
};

export type RuntimeControlledMissionHumanValidationGate = {
  id: RuntimeControlledMissionHumanValidationGateId;
  label: string;
  description: string;
  required: boolean;
  status: RuntimeControlledMissionHumanValidationGateStatus;
  severity: RuntimeControlledMissionHumanValidationGateSeverity;
  reason?: string;
};

export type RuntimeControlledMissionHumanValidationRequirement = {
  requirement_id: string;
  label: string;
  reason: string;
  sensitivity: RuntimeControlledMissionHumanValidationSensitivity;
  required_role: RuntimeControlledMissionHumanValidationActorRole;
  blocks_real_mission: boolean;
};

export type RuntimeControlledMissionHumanValidationDecisionRecord = {
  decision: RuntimeControlledMissionHumanValidationDecision;
  actor_role: RuntimeControlledMissionHumanValidationActorRole;
  actor_id: string | null;
  note: string;
  decided_at: string;
  // Invariants : une décision n'applique RIEN et n'exécute RIEN.
  preview_only: true;
  approval_applied: false;
  execution_started: false;
};

export type RuntimeControlledMissionHumanValidationTracePreview = {
  trace_id: string;
  clonetrace_required: true;
  server_write_enabled: false;
  events: string[];
  final_event: "execution_not_started";
};

export type RuntimeControlledMissionHumanValidationWorkflow = {
  workflow_id: string;
  candidate_id: string;
  promotion_id: string;
  draft_id: string;
  status: RuntimeControlledMissionHumanValidationStatus;
  mode: RuntimeControlledMissionHumanValidationMode;
  risk_level: RuntimeControlledMissionHumanValidationRiskLevel;
  sensitivity: RuntimeControlledMissionHumanValidationSensitivity;
  required_validators: RuntimeControlledMissionHumanValidator[];
  gates: RuntimeControlledMissionHumanValidationGate[];
  requirements: RuntimeControlledMissionHumanValidationRequirement[];
  decisions: RuntimeControlledMissionHumanValidationDecisionRecord[];
  trace_preview: RuntimeControlledMissionHumanValidationTracePreview;
  // ── Flags de gouvernance ──────────────────────────────────────────────────
  human_validation_required: true;
  second_validation_required: boolean;
  approved_preview: boolean;
  // ── Invariants littéraux (toujours false / true) ──────────────────────────
  approval_applied: false;
  promotion_applied: false;
  controlled_mission_created: false;
  mission_created: false;
  execution_enabled: false;
  execution_started: false;
  db_write_performed: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
  scale_80k_not_proven: true;
  read_only: true;
  preview_only: true;
  created_at: string;
  updated_at: string;
};

// ── Issues / recommendations / actions ────────────────────────────────────────

export type RuntimeControlledMissionHumanValidationIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeControlledMissionHumanValidationRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeControlledMissionHumanValidationAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};
