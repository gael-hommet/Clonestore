// src/lib/clonestore/runtime-integration/controlled-mission-persistence-transition-plan-types.ts
// PHASE 5.8 — Controlled Mission Persistence Transition Plan — Types
//
// DESIGN-ONLY. Modélise la transition FUTURE entre l'état localStorage-only et une
// future persistance serveur activable manuellement. N'ACTIVE RIEN. Aucune route.
// Aucun GET/POST serveur. Aucun SQL appliqué. Aucune exécution. Aucun moteur Pierre.
// Aucune IA. Aucun appel réseau. localStorage reste la seule source active.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ControlledMissionPersistenceTransitionPhaseTag = "5.8";

export type ControlledMissionPersistenceTransitionStatus =
  | "design_only"
  | "local_only_current"
  | "ready_for_future_manual_sql_apply"
  | "blocked_until_manual_activation"
  | "next_phase_candidate";

export type ControlledMissionPersistenceTransitionReadinessLevel =
  | "incomplete"
  | "design_ready"
  | "manually_review_ready"
  | "next_phase_candidate";

export type ControlledMissionPersistenceTransitionPhaseStatus =
  | "future"
  | "blocked"
  | "ready_for_manual_review"
  | "design_ready";

export type ControlledMissionPersistenceTransitionPhase = {
  id: string;
  label: string;
  objective: string;
  status: ControlledMissionPersistenceTransitionPhaseStatus;
  prerequisites: string[];
  actions: string[];
  forbidden_actions: string[];
  expected_evidence: string;
  // Invariants littéraux.
  no_execution_confirmed: true;
  activation_performed: false;
};

export type ControlledMissionPersistenceTransitionMilestoneStatus = "future";

export type ControlledMissionPersistenceTransitionMilestone = {
  id: string;
  label: string;
  target: string;
  owner: string;
  status: ControlledMissionPersistenceTransitionMilestoneStatus;
  success_criteria: string[];
  rollback_criteria: string[];
};

export type ControlledMissionPersistenceTransitionRiskSeverity = "low" | "medium" | "high";

export type ControlledMissionPersistenceTransitionRisk = {
  id: string;
  label: string;
  severity: ControlledMissionPersistenceTransitionRiskSeverity;
  mitigation: string;
};

export type ControlledMissionPersistenceRollbackPlan = {
  steps: string[];
  runtime_never_triggered: true;
};

export type ControlledMissionPersistenceDataConsistencyPolicy = {
  items: string[];
  local_source_wins_until_server_activated: true;
  no_silent_overwrite: true;
};

export type ControlledMissionPersistenceNoExecutionPolicy = {
  items: string[];
  persistence_is_not_execution: true;
  restore_is_not_execution: true;
  sync_is_not_execution: true;
};

export type ControlledMissionPersistenceTransitionEvidenceItem = {
  id: string;
  label: string;
  expected: string;
  manual_capture_required: true;
};

export type ControlledMissionPersistenceTransitionPlan = {
  phase: ControlledMissionPersistenceTransitionPhaseTag;
  title: string;
  generated_at: string;
  transition_status: ControlledMissionPersistenceTransitionStatus;
  current_source: "localStorage";
  future_source: "server_persistence";
  target_table: string;
  sql_draft_path: string;
  flag_key: string;
  flag_default: false;
  future_endpoints: string[];
  phases: ControlledMissionPersistenceTransitionPhase[];
  milestones: ControlledMissionPersistenceTransitionMilestone[];
  blockers: string[];
  risks: ControlledMissionPersistenceTransitionRisk[];
  rollback_plan: ControlledMissionPersistenceRollbackPlan;
  migration_policy: string[];
  data_consistency_policy: ControlledMissionPersistenceDataConsistencyPolicy;
  no_execution_policy: ControlledMissionPersistenceNoExecutionPolicy;
  required_next_steps: string[];
  evidence: ControlledMissionPersistenceTransitionEvidenceItem[];
  readiness_score: number;
  readiness_level: ControlledMissionPersistenceTransitionReadinessLevel;
  // ── Invariants littéraux (JAMAIS true en P5.8) ─────────────────────────────
  transition_active: false;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  server_get_performed: false;
  server_post_performed: false;
  server_write_performed: false;
  server_restore_performed: false;
  runtime_execution_performed: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
};
