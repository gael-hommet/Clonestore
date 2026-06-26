// src/lib/clonestore/runtime-integration/controlled-mission-local-review-types.ts
// PHASE 5.2 — Controlled Mission Local Review & Manual Validation — Types
//
// Couche de RELECTURE et VALIDATION HUMAINE LOCALE des Controlled Missions (P5.1).
// localStorage-first uniquement. Même approuvée, la mission n'est PAS exécutée :
// l'approbation locale signifie seulement « revue humaine terminée / prête pour
// phase ultérieure ». Aucun runtime, aucun serveur, aucun Pierre, aucune IA.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type LocalControlledMissionReviewStatus =
  | "not_reviewed"
  | "in_review"
  | "approved_local"
  | "changes_requested"
  | "blocked_local"
  | "archived_local";

export type LocalControlledMissionReviewerRole =
  | "reviewer" | "hr_manager" | "legal_reviewer" | "admin" | "self";

export type LocalControlledMissionReviewDecision =
  | "start_review"
  | "approve_local"
  | "request_changes"
  | "block_local"
  | "archive_local";

export type LocalControlledMissionReviewChecklistItemId =
  | "objective_clear"
  | "employee_identified"
  | "data_sufficient"
  | "risk_acceptable"
  | "human_validation_understood"
  | "no_unvalidated_sensitive_action"
  | "steps_reviewed"
  | "expected_result_clear"
  | "no_auto_execution_expected";

export type LocalControlledMissionReviewChecklistItem = {
  id: LocalControlledMissionReviewChecklistItemId;
  label: string;
  checked: boolean;
  required: boolean;
};

export type LocalControlledMissionReviewTimelineEvent =
  | "review_started"
  | "local_approved"
  | "changes_requested"
  | "local_blocked"
  | "archived_local";

export type LocalControlledMissionReviewTimelineItem = {
  id: string;
  event: LocalControlledMissionReviewTimelineEvent;
  label: string;
  detail: string;
  created_at: string;
  reviewer_role: LocalControlledMissionReviewerRole;
  // Invariants littéraux.
  local_only: true;
  execution_enabled: false;
};

export type LocalControlledMissionReviewState = {
  review_status: LocalControlledMissionReviewStatus;
  reviewer_role: LocalControlledMissionReviewerRole;
  reviewer_note: string;
  reviewed_at: string | null;
  decision_reason: string;
  required_changes: string[];
  checklist: LocalControlledMissionReviewChecklistItem[];
  validation_score: number;
  timeline: LocalControlledMissionReviewTimelineItem[];
  // Invariants littéraux.
  local_approval_only: true;
  runtime_execution_after_approval: "disabled";
  server_persistence_after_approval: "disabled";
};

export type LocalControlledMissionReviewDecisionInput = {
  decision: LocalControlledMissionReviewDecision;
  reviewer_role?: LocalControlledMissionReviewerRole;
  reviewer_note?: string;
  required_changes?: string[];
  reason?: string;
};

export type LocalControlledMissionReviewResultStatus =
  | "review_started"
  | "approved_local"
  | "already_approved"
  | "changes_requested"
  | "blocked_local"
  | "archived_local"
  | "not_found"
  | "not_allowed"
  | "invalid_input"
  | "local_save_failed";

export type LocalControlledMissionReviewResult = {
  ok: boolean;
  status: LocalControlledMissionReviewResultStatus;
  mission_id: string;
  review_state: LocalControlledMissionReviewState | null;
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
