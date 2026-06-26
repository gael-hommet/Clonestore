// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-manual-activation-types.ts
// PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA — Types
//
// DESIGN-ONLY / QA MANUELLE. Décrit la checklist d'activation MANUELLE FUTURE de
// la persistance serveur gouvernée (P5.4). N'ACTIVE RIEN. N'applique pas le SQL.
// N'active pas le flag. Ne crée pas de route. N'écrit pas en base. N'exécute rien.
// Aucun appel réseau. Aucun moteur Pierre. Aucune IA. Aucun email/document.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ControlledMissionServerPersistenceManualActivationPhase = "5.5";

export type ControlledMissionServerPersistenceManualActivationStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "needs_manual_review"
  | "not_applicable";

export type ControlledMissionServerPersistenceManualActivationStepSeverity =
  | "blocking"
  | "warning"
  | "info";

export type ControlledMissionServerPersistenceManualActivationCategory =
  | "design_p54"
  | "sql_manual_review"
  | "feature_flag"
  | "routes"
  | "no_execution_invariants"
  | "manual_evidence";

export type ControlledMissionServerPersistenceManualActivationStep = {
  id: string;
  category: ControlledMissionServerPersistenceManualActivationCategory;
  label: string;
  description: string;
  expected_evidence: string;
  status: ControlledMissionServerPersistenceManualActivationStepStatus;
  severity: ControlledMissionServerPersistenceManualActivationStepSeverity;
  // Invariants littéraux.
  manual_only: true;
  execution_enabled: false;
};

export type ControlledMissionServerPersistenceManualActivationVerdict =
  | "ready"
  | "passed"
  | "blocked"
  | "needs_review"
  | "pending";

export type ControlledMissionServerPersistenceManualActivationEvaluation = {
  verdict: ControlledMissionServerPersistenceManualActivationVerdict;
  total: number;
  passed_count: number;
  pending_count: number;
  blocking_failed_count: number;
  blocking_steps: string[];
  message: string;
  // Invariants littéraux.
  activation_not_performed: true;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  server_write_performed: false;
  runtime_execution_performed: false;
};

export type ControlledMissionServerPersistenceManualActivationQa = {
  phase: ControlledMissionServerPersistenceManualActivationPhase;
  title: string;
  generated_at: string;
  target_table: string;
  sql_draft_path: string;
  feature_flag_key: string;
  feature_flag_default: false;
  future_endpoint: string;
  current_status: string;
  overall_verdict: ControlledMissionServerPersistenceManualActivationVerdict;
  steps: ControlledMissionServerPersistenceManualActivationStep[];
  blocking_steps: string[];
  warnings: string[];
  required_manual_evidence: string[];
  // ── Invariants littéraux (JAMAIS true en P5.5) ─────────────────────────────
  activation_not_performed: true;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  server_write_performed: false;
  runtime_execution_performed: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
};

// ── Runbook ───────────────────────────────────────────────────────────────────

export type ControlledMissionServerPersistenceManualActivationRunbookSection = {
  heading: string;
  items: string[];
};

export type ControlledMissionServerPersistenceManualActivationRunbook = {
  title: string;
  phase: ControlledMissionServerPersistenceManualActivationPhase;
  prerequisites: string[];
  sections: ControlledMissionServerPersistenceManualActivationRunbookSection[];
  decision_options: string[];
  do_not_apply_reminders: string[];
  // Invariants littéraux.
  activation_not_performed: true;
  sql_applied: false;
};

// ── Evidence template ─────────────────────────────────────────────────────────

export type ControlledMissionServerPersistenceManualActivationEvidenceSection = {
  heading: string;
  items: string[];
};

export type ControlledMissionServerPersistenceManualActivationEvidenceTemplate = {
  title: string;
  phase: ControlledMissionServerPersistenceManualActivationPhase;
  sections: ControlledMissionServerPersistenceManualActivationEvidenceSection[];
  decision_options: string[];
  reminders: string[];
};
