// src/lib/clonestore/runtime-integration/controlled-mission-preflight-types.ts
// PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / Preflight — Types
//
// Preflight LOCAL de readiness. Vérifie si une Controlled Mission approuvée
// localement SERAIT candidate à une future exécution gouvernée. Ne lance RIEN.
// « ready » signifie « candidate pour future exécution gouvernée », JAMAIS
// « mission lancée ». localStorage-first uniquement. Aucun runtime, aucun serveur,
// aucun Pierre, aucune IA, aucun email/document.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type LocalControlledMissionPreflightStatus =
  | "not_started"
  | "ready_for_preflight"
  | "preflight_running_local"
  | "ready_for_future_governed_execution"
  | "blocked_by_missing_review"
  | "blocked_by_guard"
  | "blocked_by_missing_information"
  | "blocked_by_manual_decision"
  | "blocked_by_runtime_requirements"
  | "archived_local";

export type LocalControlledMissionReadinessLevel =
  | "not_ready"
  | "needs_review"
  | "locally_ready"
  | "future_execution_candidate";

export type LocalControlledMissionPreflightCheckId =
  | "mission_exists"
  | "mission_not_archived"
  | "local_review_exists"
  | "local_review_approved"
  | "no_changes_requested"
  | "not_blocked_locally"
  | "not_blocked_by_guard"
  | "required_information_present"
  | "employee_identified"
  | "steps_present"
  | "human_validation_understood"
  | "runtime_execution_still_disabled"
  | "server_persistence_still_disabled"
  | "pierre_not_called"
  | "ai_not_called"
  | "email_not_sent"
  | "document_not_generated"
  | "clonevoice_not_active"
  | "future_governed_execution_requires_new_phase"
  | "scale_not_proven";

export type LocalControlledMissionPreflightCheckStatus = "pass" | "warning" | "fail";

export type LocalControlledMissionPreflightCheck = {
  id: LocalControlledMissionPreflightCheckId;
  label: string;
  status: LocalControlledMissionPreflightCheckStatus;
  detail: string;
  blocking: boolean;
  // Invariants littéraux.
  local_only: true;
  execution_enabled: false;
};

export type LocalControlledMissionRuntimeRequirementsSnapshot = {
  stateless_runtime_required: true;
  idempotency_required: true;
  rate_limit_required: true;
  queue_required: true;
  tenant_isolation_required: true;
  runtime_execution: "disabled";
  future_phase_required: true;
};

export type LocalControlledMissionGuardRequirementsSnapshot = {
  cloneguard_required: true;
  clonetrace_required: true;
  human_validation_required: true;
  decision: string;
};

export type LocalControlledMissionHumanValidationSnapshot = {
  review_status: string;
  validation_score: number;
  approved_local: boolean;
  reviewer_role: string;
};

export type LocalControlledMissionPreflightState = {
  preflight_status: LocalControlledMissionPreflightStatus;
  readiness_score: number;
  readiness_level: LocalControlledMissionReadinessLevel;
  checked_at: string | null;
  checks: LocalControlledMissionPreflightCheck[];
  blocking_reasons: string[];
  warnings: string[];
  required_next_steps: string[];
  runtime_requirements_snapshot: LocalControlledMissionRuntimeRequirementsSnapshot;
  guard_requirements_snapshot: LocalControlledMissionGuardRequirementsSnapshot;
  human_validation_snapshot: LocalControlledMissionHumanValidationSnapshot;
  // Invariants littéraux.
  local_only: true;
  no_execution_performed: true;
  runtime_execution_after_preflight: "disabled";
  server_persistence_after_preflight: "disabled";
};

export type LocalControlledMissionPreflightResultStatus =
  | "ready_for_future_governed_execution"
  | "blocked_by_missing_review"
  | "blocked_by_manual_decision"
  | "blocked_by_guard"
  | "blocked_by_missing_information"
  | "blocked_by_runtime_requirements"
  | "not_found"
  | "not_allowed"
  | "local_save_failed";

export type LocalControlledMissionPreflightResult = {
  ok: boolean;
  status: LocalControlledMissionPreflightResultStatus;
  mission_id: string;
  preflight_state: LocalControlledMissionPreflightState | null;
  reason: string | null;
  warnings: string[];
  // ── Invariants littéraux ──────────────────────────────────────────────────
  runtime_execution_performed: false;
  server_persistence_performed: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  applied_at: string;
};
