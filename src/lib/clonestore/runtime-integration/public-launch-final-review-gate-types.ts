// src/lib/clonestore/runtime-integration/public-launch-final-review-gate-types.ts
// PHASE 7.6 — Public Launch Final Review Gate / Final Phase 7 Verdict — Types
//
// FINAL REVIEW / DECISION GATE en lecture seule. Agrège P7.1 → P7.5, distingue préparation
// interne et preuve externe RÉELLE, et produit le verdict final HONNÊTE de lancement public.
// Aucune preuve inventée. « Code prêt » n'est jamais « production prouvée ». Public launch reste
// BLOCKED sauf preuves réelles. Ferme officiellement la Phase 7 INTERNE et oriente vers
// l'exécution réelle des preuves externes — pas vers un nouveau gate read-only.
//
// P7.6 = final review / decision gate. P7.6 ≠ public launch ≠ production activation ≠ preuve
// externe ≠ scale proof.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PublicLaunchFinalReviewPhase = "7.6";

export type PublicLaunchReviewStatus =
  | "ready_for_final_review"
  | "blocked_missing_external_proofs"
  | "conditional_go"
  | "public_launch_go"
  | "blocked";

export type Phase7CompletionRow = {
  phase_id: string;
  label: string;
  internal_gate_ready: boolean;
  real_world_proof_complete: false;
  status: string;
  notes: string;
};

// ── Product sellability verdict (A / B / C / D) ────────────────────────────────

export type FinalControlledFirstCustomerVerdict = {
  verdict: "READY_WITH_LIMITS";
  sellable: true;
  public_claim_allowed: "true_with_limits";
};

export type FinalControlledSecondCustomerVerdict = {
  verdict: "PREPARATION_READY";
  sellable: "conditional";
  customer_not_started: true;
};

export type FinalPublicLaunchVerdict = {
  verdict: "BLOCKED";
  sellable_publicly: false;
};

export type FinalScale80kVerdict = {
  verdict: "NOT_PROVEN";
  scale_ready: false;
};

export type FinalProductSellabilityVerdict = {
  controlled_first_customer: FinalControlledFirstCustomerVerdict;
  controlled_second_customer: FinalControlledSecondCustomerVerdict;
  public_launch: FinalPublicLaunchVerdict;
  scale_80k: FinalScale80kVerdict;
};

// ── Final matrices ─────────────────────────────────────────────────────────────

export type ExternalProofFinalItem = {
  id: string;
  label: string;
  required: boolean;
  verified: false;
  evidence_link: null;
  blocking_public_launch: true;
  source_phase: string;
  manual_verification_required: true;
};

export type CustomerEvidenceFinalItem = {
  id: string;
  label: string;
  verified: false;
  evidence_available: false;
  blocks_public_launch: boolean;
  notes: string;
};

export type LegalCommercialFinalItem = {
  id: string;
  label: string;
  verified: false;
  manual_review_required: true;
  blocking_public_launch: boolean;
};

export type TechnicalOperationsFinalItem = {
  id: string;
  label: string;
  verified: false;
  evidence_link: null;
  blocking_public_launch: boolean;
  owner: string;
};

export type PublicLaunchScorecardDimension =
  | "product_readiness"
  | "legal_readiness"
  | "payment_readiness"
  | "infrastructure_readiness"
  | "identity_email_readiness"
  | "customer_evidence_readiness"
  | "support_readiness"
  | "monitoring_readiness"
  | "security_readiness"
  | "scale_readiness";

export type PublicLaunchScorecardItem = {
  id: string;
  dimension: PublicLaunchScorecardDimension;
  label: string;
  current_score: 0;
  max_score: 100;
  verified: false;
  required_threshold: number;
  blocking_if_below_threshold: boolean;
};

export type ImmediateOperationalAction = {
  order: number;
  id: string;
  action: string;
};

export type FinalPublicLaunchDecision = {
  decision: "BLOCKED";
  public_launch_ready: false;
  reason: "missing_real_external_and_customer_evidence";
  controlled_first_customer_allowed: true;
  public_marketing_launch_allowed: false;
  mass_prospecting_with_public_activation_allowed: false;
  manual_controlled_sales_allowed: true;
  requires_human_final_approval: true;
};

export type Phase7ClosureVerdict = {
  phase_7_internal_work_complete: true;
  phase_7_external_execution_complete: false;
  phase_7_status: "INTERNAL_GATES_COMPLETE_EXTERNAL_PROOFS_MISSING";
  no_more_read_only_gate_required_before_real_execution: true;
  next_step_must_be_real_external_proof_execution: true;
};

export type PublicLaunchFinalReviewGateReport = {
  phase: PublicLaunchFinalReviewPhase;
  title: string;
  generated_at: string;
  review_status: PublicLaunchReviewStatus;
  phase_7_completion_matrix: Phase7CompletionRow[];
  product_sellability_verdict: FinalProductSellabilityVerdict;
  external_proof_final_matrix: ExternalProofFinalItem[];
  customer_evidence_final_matrix: CustomerEvidenceFinalItem[];
  legal_commercial_final_matrix: LegalCommercialFinalItem[];
  technical_operations_final_matrix: TechnicalOperationsFinalItem[];
  public_launch_scorecard: PublicLaunchScorecardItem[];
  blocking_conditions: string[];
  conditional_go_requirements: string[];
  allowed_product_claims: string[];
  forbidden_product_claims: string[];
  immediate_operational_actions: ImmediateOperationalAction[];
  rollback_requirements: string[];
  final_public_launch_decision: FinalPublicLaunchDecision;
  phase_7_closure_verdict: Phase7ClosureVerdict;
  final_verdict: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  phase_7_internal_gate_complete: true;
  ready_for_external_proof_execution: true;
  controlled_first_customer_sellable: true;
  controlled_second_customer_preparation_ready: true;
  public_launch_review_completed: true;
  public_launch_ready: false;
  external_proofs_complete: false;
  customer_evidence_complete: false;
  multi_customer_evidence_ready: false;
  reproducibility_verified: false;
  stripe_live_verified: false;
  supabase_prod_rls_verified: false;
  domain_email_verified: false;
  legal_final_review_verified: false;
  support_readiness_verified: false;
  production_monitoring_verified: false;
  real_payment_verified: false;
  first_customer_completed_verified: false;
  second_customer_completed_verified: false;
  scale_80k_proven: false;
  runtime_execution_active: false;
  real_email_sent: false;
  official_document_generated: false;
  go_live_proofs_modified: false;
  env_modified: false;
  ai_call_performed: false;
};
