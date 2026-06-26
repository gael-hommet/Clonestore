// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-final-gate-types.ts
// PHASE 5.7 — Controlled Mission Server Persistence Readiness Final Gate — Types
//
// DESIGN-ONLY / FINAL GATE. Ferme proprement le bloc P5.1 → P5.6. N'ACTIVE RIEN.
// Aucune persistance serveur. Aucune restauration serveur. Aucune route. Aucun SQL
// appliqué. Aucune exécution. Aucun moteur Pierre. Aucune IA. Aucun email/document.
// Aucun appel réseau. localStorage reste la seule source active.
//
// P5.7 ne dit JAMAIS « production ready » ni « execution ready ». Au mieux :
// « ready for next design phase / future controlled activation work ».
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ControlledMissionServerPersistenceFinalGatePhase = "5.7";

export type ControlledMissionServerPersistenceFinalGateVerdict =
  | "go_for_next_design_phase"
  | "blocked"
  | "needs_review";

export type ControlledMissionServerPersistenceFinalGateReadinessLevel =
  | "incomplete"
  | "design_ready"
  | "manually_review_ready"
  | "next_phase_candidate";

export type ControlledMissionServerPersistenceFinalGateCheckStatus =
  | "passed"
  | "warning"
  | "failed"
  | "pending";

export type ControlledMissionServerPersistenceFinalGateCheckSeverity =
  | "blocking"
  | "warning"
  | "info";

export type ControlledMissionServerPersistenceFinalGateCheck = {
  id: string;
  label: string;
  status: ControlledMissionServerPersistenceFinalGateCheckStatus;
  severity: ControlledMissionServerPersistenceFinalGateCheckSeverity;
  detail: string;
  source_phase: string;
  // Invariant littéral.
  no_execution_confirmed: true;
};

export type ControlledMissionServerPersistenceFinalGateSectionStatus =
  | "passed"
  | "warning"
  | "failed"
  | "pending";

export type ControlledMissionServerPersistenceFinalGateSection = {
  id: string;
  title: string;
  status: ControlledMissionServerPersistenceFinalGateSectionStatus;
  score: number;
  summary: string;
  checks: ControlledMissionServerPersistenceFinalGateCheck[];
  blocking: boolean;
};

export type ControlledMissionServerPersistenceFinalGateCommandStatus =
  | "pending"
  | "passed"
  | "failed";

export type ControlledMissionServerPersistenceFinalGateCommand = {
  command: string;
  expected: string;
  required: true;
  status: ControlledMissionServerPersistenceFinalGateCommandStatus;
  phase: string;
};

export type ControlledMissionServerPersistenceFinalGateEvidenceItem = {
  id: string;
  label: string;
  expected: string;
  manual_capture_required: true;
};

export type ControlledMissionServerPersistenceFinalGateInvariant = {
  id: string;
  label: string;
  expected: string;
  holds: true;
};

export type ControlledMissionServerPersistenceFinalGateReport = {
  phase: ControlledMissionServerPersistenceFinalGatePhase;
  title: string;
  generated_at: string;
  overall_verdict: ControlledMissionServerPersistenceFinalGateVerdict;
  readiness_score: number;
  readiness_level: ControlledMissionServerPersistenceFinalGateReadinessLevel;
  completed_blocks: string[];
  blocking_items: string[];
  warnings: string[];
  required_next_steps: string[];
  evidence: ControlledMissionServerPersistenceFinalGateEvidenceItem[];
  invariants: ControlledMissionServerPersistenceFinalGateInvariant[];
  sections: ControlledMissionServerPersistenceFinalGateSection[];
  command_matrix: ControlledMissionServerPersistenceFinalGateCommand[];
  // ── Invariants littéraux (JAMAIS true sauf phase_closure) ──────────────────
  phase_closure: true;
  server_persistence_active: false;
  server_restore_active: false;
  runtime_execution_active: false;
  pierre_runtime_active: false;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  server_get_performed: false;
  server_write_performed: false;
  real_mission_created: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
};
