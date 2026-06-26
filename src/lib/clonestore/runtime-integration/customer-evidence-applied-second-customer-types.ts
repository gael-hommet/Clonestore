// src/lib/clonestore/runtime-integration/customer-evidence-applied-second-customer-types.ts
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer — Types
//
// EVIDENCE APPLICATION PLANNING GATE en lecture seule. Prépare l'application contrôlée des
// preuves RÉELLES relues (P7.3) ET la préparation d'un deuxième client contrôlé — sans inventer
// de preuve, sans modifier automatiquement les go-live proofs, sans déclarer public launch.
// Un ou deux clients ne suffisent pas à déclarer le lancement public.
//
// P7.4 = evidence application planning gate. P7.4 ≠ preuves réelles disponibles ≠ public launch
// ≠ deuxième client exécuté ≠ go-live proofs update automatique.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type CustomerEvidenceAppliedPhase = "7.4";

export type EvidenceApplicationStatus =
  | "ready_to_apply_when_verified"
  | "evidence_missing"
  | "evidence_partial"
  | "evidence_applied"
  | "blocked";

export type AppliedEvidenceCategory =
  | "customer_identity"
  | "contract_cgv"
  | "payment_or_activation"
  | "setup"
  | "first_output"
  | "human_validation"
  | "feedback"
  | "incident_log"
  | "post_run_decision";

export type ReviewedEvidenceApplicationItem = {
  id: string;
  category: AppliedEvidenceCategory;
  label: string;
  required_for_application: boolean;
  source_from_p7_3: string;
  application_decision: "not_applied";
  reason_not_applied: "no_verified_real_evidence_yet";
  can_contribute_to_go_live_proofs: boolean;
  applied: false;
  verified: false;
};

export type UnappliedEvidenceCategory = {
  id: string;
  category: AppliedEvidenceCategory;
  reasons: string[];
};

export type GoLiveContributionRow = {
  contribution_id: string;
  label: string;
  required_evidence: string;
  eligible_if_verified: boolean;
  currently_eligible: false;
  applied_to_go_live_proofs: false;
  auto_update_allowed: false;
};

export type FirstCustomerContinuationDecision =
  | "continue_controlled"
  | "pause_and_fix"
  | "request_more_evidence"
  | "refund_or_cancel"
  | "convert_to_reference_later"
  | "prepare_case_study_later";

export type FirstCustomerContinuationPlan = {
  recommended_decision: "request_more_evidence";
  options: FirstCustomerContinuationDecision[];
  rationale: string;
};

export type SecondCustomerPreparationItem = {
  id: string;
  label: string;
  required: boolean;
  ready: false;
  evidence_needed: string;
  reason: string;
};

export type MultiCustomerEvidenceBase = {
  customer_count_required_before_public_launch: number;
  recommendation: string;
  current_verified_customer_count: 0;
  evidence_base_ready: false;
  categories_to_compare: string[];
};

export type PublicLaunchSafetyGate = {
  public_launch_ready: false;
  first_customer_success_not_enough: true;
  second_customer_success_not_enough_alone: true;
  requires_external_proofs: true;
  requires_legal_review: true;
  requires_support_readiness: true;
  requires_multiple_customer_evidence: true;
  final_decision: "blocked";
};

export type SecondCustomerRunbookStep = {
  id: string;
  order: number;
  label: string;
  verified: false;
  can_start_now: false;
};

export type CustomerEvidenceAppliedSecondCustomerReport = {
  phase: CustomerEvidenceAppliedPhase;
  title: string;
  generated_at: string;
  application_status: EvidenceApplicationStatus;
  reviewed_evidence_application_matrix: ReviewedEvidenceApplicationItem[];
  applied_evidence_categories: string[];
  unapplied_evidence_categories: UnappliedEvidenceCategory[];
  go_live_contribution_matrix: GoLiveContributionRow[];
  first_customer_continuation_plan: FirstCustomerContinuationPlan;
  second_customer_preparation_matrix: SecondCustomerPreparationItem[];
  second_customer_selection_criteria: string[];
  multi_customer_evidence_base: MultiCustomerEvidenceBase;
  customer_1_vs_customer_2_comparison_plan: string[];
  public_launch_safety_gate: PublicLaunchSafetyGate;
  evidence_application_rules: string[];
  operator_apply_checklist: string[];
  second_customer_runbook: SecondCustomerRunbookStep[];
  final_verdict: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_to_apply_customer_evidence_when_verified: true;
  evidence_applied: false;
  real_evidence_available: false;
  go_live_contribution_applied: false;
  first_customer_success_declared: false;
  second_customer_selected: false;
  second_customer_started: false;
  second_customer_completed: false;
  multi_customer_evidence_ready: false;
  public_launch_ready: false;
  scale_80k_proven: false;
  stripe_live_verified: false;
  supabase_prod_rls_verified: false;
  domain_email_verified: false;
  runtime_execution_active: false;
  real_email_sent: false;
  official_document_generated: false;
  go_live_proofs_modified: false;
  env_modified: false;
  ai_call_performed: false;
};
