// src/lib/clonestore/runtime-integration/pierre-sellable-gate-final-types.ts
// PHASE 6.6 — Pierre Sellable Gate 100% / Final Controlled Sellability Verdict — Types
//
// FINAL CONTROLLED SELLABILITY VERDICT. Répond honnêtement : Pierre est-il vendable
// maintenant, à qui, sous quelles limites, avec quelles preuves, et qu'est-ce qui reste
// bloquant avant lancement public ? Distingue STRICTEMENT trois niveaux : (1) premier
// client contrôlé, (2) lancement public, (3) grande échelle (80k).
//
// P6.6 = verdict de vendabilité contrôlée. P6.6 ≠ production go-live ≠ public launch proof
// ≠ live customer proof. Aucun paiement live. Aucune exécution. Aucune preuve inventée.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreSellableGatePhase = "6.6";

export type PierreSellableGateStatus =
  | "controlled_sellability_ready"
  | "blocked"
  | "public_launch_blocked";

export type PierreSellabilityLevel =
  | "not_sellable"
  | "demo_sellable"
  | "controlled_first_customer_sellable"
  | "public_launch_sellable"
  | "scale_sellable";

export type PierrePhaseMatrixStatus = "validated" | "partial" | "blocked";

export type PierreP6PhaseMatrixRow = {
  id: string;
  phase: string;
  label: string;
  status: PierrePhaseMatrixStatus;
  contribution: string;
};

export type PierreSellabilityVerdict =
  | "READY_WITH_LIMITS"
  | "BLOCKED"
  | "NOT_PROVEN";

export type PierreSellabilityVerdictTier =
  | "controlled_first_customer"
  | "public_launch"
  | "scale_80k";

export type PierreSellabilityVerdictRow = {
  id: string;
  tier: PierreSellabilityVerdictTier;
  label: string;
  verdict: PierreSellabilityVerdict;
  conditions: string[];
  blockers: string[];
};

export type PierreEvidenceSummaryItem = {
  id: string;
  phase: string;
  label: string;
  evidence: string;
};

export type PierreRiskSeverity = "high" | "medium" | "low";

export type PierreRiskMatrixRow = {
  id: string;
  risk: string;
  severity: PierreRiskSeverity;
  mitigation: string;
};

export type PierreOperationalPlaybookStep = {
  id: string;
  step: string;
  description: string;
  no_runtime: true;
  no_email: true;
  no_public_claim: true;
};

export type PierreOperatorChecklistItem = {
  id: string;
  label: string;
  required: boolean;
};

export type PierreSellableGateFinalReport = {
  phase: PierreSellableGatePhase;
  title: string;
  generated_at: string;
  gate_status: PierreSellableGateStatus;
  final_sellability_level: PierreSellabilityLevel;
  controlled_first_sale_ready: boolean;
  first_customer_sellable_with_limits: boolean;
  public_launch_ready: false;
  scale_ready: false;
  evidence_summary: PierreEvidenceSummaryItem[];
  p6_phase_matrix: PierreP6PhaseMatrixRow[];
  sellability_verdict_matrix: PierreSellabilityVerdictRow[];
  controlled_sale_conditions: string[];
  public_launch_blockers: string[];
  scale_blockers: string[];
  customer_promise_allowed: string[];
  customer_promise_forbidden: string[];
  operational_playbook: PierreOperationalPlaybookStep[];
  internal_operator_checklist: PierreOperatorChecklistItem[];
  risk_matrix: PierreRiskMatrixRow[];
  phase_6_closure_statement: string;
  final_decision: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_external_go_live_proofs: true;
  ready_for_first_controlled_customer: true;
  pierre_fully_sellable_public_launch: false;
  stripe_live_payment_proven: false;
  supabase_prod_verified: false;
  domain_email_prod_verified: false;
  runtime_execution_active: false;
  server_persistence_active: false;
  real_email_sent: false;
  official_document_generated: false;
  ai_call_performed: false;
  sql_applied: false;
  env_modified: false;
  public_launch_validated: false;
  scale_80k_proven: false;
};
