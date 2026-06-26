// src/lib/clonestore/runtime-integration/pierre-sellable-completion-master-audit-types.ts
// PHASE 6.1 — Pierre Sellable Completion Master Audit — Types
//
// AUDIT-ONLY. Cartographie froide et honnête de ce qui manque pour rendre Pierre
// vendable à 100%. NE DÉCLARE PAS Pierre vendable. N'ACTIVE RIEN. Aucune route.
// Aucun SQL appliqué. Aucune exécution. Aucun appel réseau / IA / paiement. Aucun
// moteur Pierre appelé. localStorage reste la seule source active de la chaîne P5.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreSellableAuditPhase = "6.1";

export type PierreSellableAuditStatus =
  | "audit_ready"
  | "sellable_gap_identified"
  | "blocked"
  | "ready_for_p6_2";

export type PierreSellableLevel =
  | "not_sellable"
  | "partially_sellable"
  | "internally_demo_sellable"
  | "first_customer_candidate"
  | "fully_sellable";

// Classification froide de chaque élément audité.
export type PierreSellableAuditClassification =
  | "DONE_SELLABLE"
  | "DONE_BUT_LOCAL_ONLY"
  | "READY_BUT_INACTIVE"
  | "PARTIAL"
  | "BLOCKING_BEFORE_SALE"
  | "BLOCKING_BEFORE_PUBLIC_LAUNCH"
  | "FUTURE_NOT_REQUIRED_FOR_FIRST_SALE"
  | "UNKNOWN_NEEDS_AUDIT";

export type PierreSellableAuditSection = {
  id: string;
  title: string;
  status: PierreSellableAuditClassification;
  score: number;
  summary: string;
  findings: string[];
  blockers: string[];
  required_actions: string[];
  sellable_impact: string;
};

export type PierreSellableAuditSeverity = "critical" | "high" | "medium" | "low";
export type PierreSellableAuditRequiredBefore = "first_sale" | "public_launch" | "scale" | "future";

export type PierreSellableAuditGap = {
  id: string;
  area: string;
  current_state: string;
  required_state: string;
  severity: PierreSellableAuditSeverity;
  required_before: PierreSellableAuditRequiredBefore;
  owner_phase: string;
  forbidden_shortcut: string;
};

export type PierreSellableAuditBlocker = {
  id: string;
  label: string;
  severity: PierreSellableAuditSeverity;
  required_before: PierreSellableAuditRequiredBefore;
  why: string;
  owner_phase: string;
};

export type PierreSellableAuditEvidenceItem = {
  id: string;
  label: string;
  expected: string;
};

export type PierreSellableAuditTechnologyStatus =
  | "active"
  | "active_local"
  | "ready_inactive"
  | "partial"
  | "roadmap"
  | "not_active";

export type PierreSellableAuditTechnologyDependency = {
  technology: string;
  role: string;
  status: PierreSellableAuditTechnologyStatus;
  required_for_first_sale: boolean;
};

export type PierreSellableAuditJourneyStatus =
  | "works"
  | "works_local"
  | "partial"
  | "not_proven"
  | "missing";

export type PierreSellableAuditJourneyStep = {
  id: string;
  step: string;
  status: PierreSellableAuditJourneyStatus;
  sellable_impact: string;
};

export type PierreSellableAuditRisk = {
  id: string;
  label: string;
  severity: PierreSellableAuditSeverity;
  mitigation: string;
};

export type PierreSellableAuditP6SequenceItem = {
  id: string;
  title: string;
  why: string;
  expected_output: string;
  optional: boolean;
};

export type PierreSellableAuditCapability = {
  id: string;
  capability: string;
  status: PierreSellableAuditClassification;
};

export type PierreSellableAuditSellableDefinition = {
  is_sellable_when: string[];
  not_public_launch_complete_until: string[];
};

export type PierreSellableCompletionMasterAuditReport = {
  phase: PierreSellableAuditPhase;
  title: string;
  generated_at: string;
  audit_status: PierreSellableAuditStatus;
  overall_sellable_score: number;
  sellable_level: PierreSellableLevel;
  sections: PierreSellableAuditSection[];
  gap_matrix: PierreSellableAuditGap[];
  blocker_matrix: PierreSellableAuditBlocker[];
  evidence_matrix: PierreSellableAuditEvidenceItem[];
  sellable_definition: PierreSellableAuditSellableDefinition;
  not_sellable_yet_reasons: string[];
  first_sale_minimum_requirements: string[];
  public_launch_minimum_requirements: string[];
  pierre_capability_map: PierreSellableAuditCapability[];
  technology_dependency_map: PierreSellableAuditTechnologyDependency[];
  customer_journey_map: PierreSellableAuditJourneyStep[];
  risk_matrix: PierreSellableAuditRisk[];
  recommended_p6_sequence: PierreSellableAuditP6SequenceItem[];
  final_verdict: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_p6_2: true;
  pierre_sellable_declared: false;
  public_launch_validated: false;
  scale_80k_proven: false;
  server_persistence_active: false;
  runtime_execution_active: false;
  pierre_runtime_active: false;
  sql_applied: false;
  env_modified: false;
  route_created: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
};
