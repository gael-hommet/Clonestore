// src/lib/clonestore/runtime-integration/first-customer-evidence-review-types.ts
// PHASE 7.3 — First Customer Evidence Review / Real Evidence Audit Before Public Launch Decision
// — Types
//
// REVIEW GATE en lecture seule. Prépare l'audit des preuves RÉELLES du premier client : décider
// si le run est un succès, ce qui peut être marqué comme preuve externe, et éviter de transformer
// un simple test client en faux feu vert public launch. Aucune preuve n'est inventée. Aucune
// preuve ne peut être auto-validée par ce module. Public launch reste BLOCKED sauf preuves
// complètes. go-live proofs restent manuels.
//
// P7.3 = review gate. P7.3 ≠ client réel exécuté ≠ public launch ≠ preuve live automatique.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type FirstCustomerEvidencePhase = "7.3";

export type EvidenceReviewStatus =
  | "ready_to_review_when_evidence_exists"
  | "evidence_missing"
  | "evidence_partial"
  | "evidence_complete"
  | "blocked";

export type EvidenceCategory =
  | "customer_identity"
  | "contract_cgv"
  | "payment_or_controlled_activation"
  | "access_activation"
  | "setup_completion"
  | "scenario_selection"
  | "controlled_mission_creation"
  | "first_output_delivery"
  | "human_validation"
  | "customer_feedback"
  | "incident_log"
  | "post_run_decision";

export type EvidenceItemStatus = "missing" | "partial" | "verified";

export type EvidenceReviewItem = {
  id: string;
  category: EvidenceCategory;
  label: string;
  required: boolean;
  expected_evidence: string;
  verification_method: string;
  status: "missing";
  verified: false;
  blocks_success_if_missing: boolean;
  can_update_go_live_proof_if_verified: boolean;
};

export type EvidenceQualityDimension =
  | "completeness"
  | "verifiability"
  | "customer_value"
  | "legal_safety"
  | "technical_reliability"
  | "commercial_confidence";

export type EvidenceQualityScore = {
  id: string;
  dimension: EvidenceQualityDimension;
  label: string;
  current_score: 0;
  max_score: 100;
  threshold_for_success: number;
  threshold_for_public_launch_contribution: number;
  verified: false;
};

export type PublicLaunchDecisionGate = {
  public_launch_ready: false;
  one_customer_success_is_not_public_launch: true;
  requires_stripe_live_proof: true;
  requires_supabase_prod_rls_proof: true;
  requires_domain_email_proof: true;
  requires_legal_review: true;
  requires_support_process: true;
  requires_multiple_customer_runs: "recommended";
  final_public_launch_decision: "blocked";
};

export type GoLiveProofUpdateRecommendation = {
  update_recommended: false;
  update_allowed_only_after_manual_review: true;
  can_update_customer_evidence_section_if_complete: false;
  can_update_public_launch_status: false;
  requires_human_operator: true;
  requires_evidence_links: true;
  never_auto_update: true;
};

export type CustomerContinuationDecision =
  | "continue_controlled"
  | "pause_and_fix"
  | "refund_or_cancel"
  | "request_more_evidence"
  | "prepare_second_customer"
  | "escalate_legal_review";

export type CustomerContinuationRecommendation = {
  recommended: "request_more_evidence";
  options: CustomerContinuationDecision[];
  rationale: string;
};

export type PostRunDecisionRow = {
  id: string;
  scenario: string;
  condition: string;
  action: string;
  public_launch_ready: false;
  note: string;
};

export type FirstCustomerEvidenceReviewReport = {
  phase: FirstCustomerEvidencePhase;
  title: string;
  generated_at: string;
  review_status: EvidenceReviewStatus;
  evidence_review_matrix: EvidenceReviewItem[];
  required_evidence_categories: string[];
  verification_rules: string[];
  success_criteria: string[];
  failure_criteria: string[];
  partial_success_criteria: string[];
  evidence_quality_scores: EvidenceQualityScore[];
  public_launch_decision_gate: PublicLaunchDecisionGate;
  go_live_proof_update_recommendation: GoLiveProofUpdateRecommendation;
  customer_continuation_recommendation: CustomerContinuationRecommendation;
  operator_review_checklist: string[];
  legal_commercial_review_checklist: string[];
  technical_review_checklist: string[];
  post_run_decision_matrix: PostRunDecisionRow[];
  final_verdict: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_to_review_first_customer_evidence: true;
  first_customer_evidence_review_completed: false;
  real_customer_verified: false;
  real_payment_verified: false;
  contract_signed_verified: false;
  setup_completed_verified: false;
  first_value_delivered_verified: false;
  feedback_collected_verified: false;
  evidence_complete_verified: false;
  go_live_proof_update_allowed: false;
  public_launch_ready: false;
  scale_80k_proven: false;
  runtime_execution_active: false;
  real_email_sent: false;
  official_document_generated: false;
  go_live_proofs_modified: false;
  env_modified: false;
  ai_call_performed: false;
};
