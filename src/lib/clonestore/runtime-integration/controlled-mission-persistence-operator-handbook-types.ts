// src/lib/clonestore/runtime-integration/controlled-mission-persistence-operator-handbook-types.ts
// PHASE 5.9 — Controlled Mission Persistence Documentation & Operator Handbook — Types
//
// DESIGN-ONLY / DOCUMENTATION. Transforme P5.1 → P5.8 en handbook opérateur humain.
// N'ACTIVE RIEN. Aucune route. Aucun GET/POST serveur. Aucun SQL appliqué. Aucune
// exécution. Aucun moteur Pierre. Aucune IA. Aucun appel réseau. localStorage reste
// la seule source active.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ControlledMissionPersistenceHandbookPhase = "5.9";

export type ControlledMissionPersistenceHandbookStatus =
  | "design_only"
  | "documentation_ready"
  | "operator_ready"
  | "blocked";

export type ControlledMissionPersistenceOperatorWorkflow = {
  id: string;
  title: string;
  objective: string;
  steps: string[];
  expected_result: string;
  forbidden_actions: string[];
  escalation: string;
  // Invariant littéral.
  no_execution_confirmed: true;
};

export type ControlledMissionPersistencePlaybook = {
  id: string;
  title: string;
  trigger: string;
  diagnosis_steps: string[];
  safe_actions: string[];
  forbidden_actions: string[];
  rollback_steps: string[];
  evidence_required: string[];
  // Invariant littéral.
  no_execution_confirmed: true;
};

export type ControlledMissionPersistenceGlossaryItem = {
  term: string;
  definition: string;
  warning: string;
};

export type ControlledMissionPersistenceDecisionMatrixItem = {
  situation: string;
  allowed_decision: string;
  forbidden_decision: string;
  reason: string;
};

export type ControlledMissionPersistenceEvidenceChecklistItem = {
  id: string;
  label: string;
  expected: string;
  manual_capture_required: true;
};

export type ControlledMissionPersistenceCommandReferenceItem = {
  command: string;
  expected: string;
  phase: string;
};

export type ControlledMissionPersistenceHandbookInvariant = {
  id: string;
  label: string;
  expected: string;
  holds: true;
};

export type ControlledMissionPersistenceOperatorHandbook = {
  phase: ControlledMissionPersistenceHandbookPhase;
  title: string;
  generated_at: string;
  handbook_status: ControlledMissionPersistenceHandbookStatus;
  audience: string[];
  scope: string[];
  current_state_summary: string[];
  active_capabilities: string[];
  inactive_capabilities: string[];
  forbidden_actions: string[];
  glossary: ControlledMissionPersistenceGlossaryItem[];
  operating_principles: string[];
  operator_workflows: ControlledMissionPersistenceOperatorWorkflow[];
  verification_playbooks: ControlledMissionPersistencePlaybook[];
  incident_playbooks: ControlledMissionPersistencePlaybook[];
  rollback_playbook: ControlledMissionPersistencePlaybook;
  evidence_checklist: ControlledMissionPersistenceEvidenceChecklistItem[];
  command_reference: ControlledMissionPersistenceCommandReferenceItem[];
  decision_matrix: ControlledMissionPersistenceDecisionMatrixItem[];
  next_steps: string[];
  invariants: ControlledMissionPersistenceHandbookInvariant[];
  // ── Invariants littéraux (JAMAIS true sauf documentation_ready) ────────────
  documentation_ready: true;
  activation_performed: false;
  server_persistence_active: false;
  server_restore_active: false;
  runtime_execution_active: false;
  pierre_runtime_active: false;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  server_get_performed: false;
  server_post_performed: false;
  server_write_performed: false;
  server_restore_performed: false;
  real_mission_created: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
};
