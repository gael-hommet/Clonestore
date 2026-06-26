// src/lib/clonestore/runtime-integration/second-customer-controlled-run-public-launch-prep-types.ts
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep — Types
//
// RUNBOOK / PLANNING GATE en lecture seule. Prépare l'exécution d'un DEUXIÈME client contrôlé,
// la comparaison client 1 / client 2, la base de preuves multi-client, et la future revue de
// lancement public — sans exécuter le client 2, sans inventer de preuve, sans déclarer public
// launch. La comparaison multi-client reste à prouver, le lancement public reste bloqué.
//
// P7.5 = second customer controlled run planning + public launch review preparation.
// P7.5 ≠ second customer executed ≠ public launch ≠ multi-customer evidence complete ≠ prod.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type SecondCustomerPhase = "7.5";

export type SecondCustomerRunStatus =
  | "ready_to_prepare_second_customer"
  | "second_customer_selected"
  | "second_customer_in_progress"
  | "second_customer_completed"
  | "blocked";

export type SecondCustomerRiskLevel = "low" | "medium" | "high";

export type SecondCustomerQualificationItem = {
  id: string;
  label: string;
  required: boolean;
  evidence_needed: string;
  verified: false;
};

export type SecondCustomerActivationStep = {
  id: string;
  order: number;
  label: string;
  owner: string;
  expected_output: string;
  evidence_required: string;
  verified: false;
  can_start_now: false;
};

export type SecondCustomerSetupItem = {
  id: string;
  label: string;
  required: boolean;
  captured: false;
};

export type SecondCustomerScenario = {
  scenario_id: string;
  label: string;
  recommended_for_second_customer: boolean;
  risk_level: SecondCustomerRiskLevel;
  expected_first_output: string;
  human_validation_required: true;
  runtime_execution_allowed: false;
  real_email_allowed: false;
  official_document_allowed: false;
};

export type SecondCustomerEvidenceItem = {
  id: string;
  label: string;
  required: boolean;
  collected: false;
  verification_method: string;
};

export type CustomerComparisonAxis = {
  id: string;
  label: string;
  customer_1_value: null;
  customer_2_value: null;
  comparison_status: "not_compared";
  conclusion: null;
};

export type ReproducibilityDimension =
  | "setup_reproducibility"
  | "output_reproducibility"
  | "guardrail_reproducibility"
  | "customer_value_reproducibility"
  | "operator_load_reproducibility"
  | "technical_reliability_reproducibility";

export type ReproducibilityScore = {
  id: string;
  dimension: ReproducibilityDimension;
  label: string;
  current_score: 0;
  verified: false;
  threshold_for_multi_customer_confidence: number;
  threshold_for_public_launch_contribution: number;
};

export type MultiCustomerEvidenceReadiness = {
  verified_customer_count: 0;
  required_customer_count: number;
  recommended_customer_count: number;
  evidence_ready: false;
  comparison_complete: false;
  reproducibility_verified: false;
};

export type PublicLaunchReviewPrep = {
  required_inputs: string[];
  review_ready: false;
  all_inputs_verified: false;
  final_public_launch_decision: "blocked";
};

export type PublicLaunchReviewInput = {
  id: string;
  label: string;
  required: boolean;
  verified: false;
  evidence_link: null;
  blocking_if_missing: boolean;
};

export type SecondCustomerRollbackStep = {
  id: string;
  step: string;
  description: string;
};

export type SecondCustomerControlledRunPublicLaunchPrepReport = {
  phase: SecondCustomerPhase;
  title: string;
  generated_at: string;
  run_status: SecondCustomerRunStatus;
  second_customer_qualification_matrix: SecondCustomerQualificationItem[];
  second_customer_pre_sale_conditions: string[];
  second_customer_activation_runbook: SecondCustomerActivationStep[];
  second_customer_setup_runbook: SecondCustomerSetupItem[];
  second_customer_scenario_matrix: SecondCustomerScenario[];
  second_customer_evidence_plan: SecondCustomerEvidenceItem[];
  customer_1_vs_customer_2_comparison_matrix: CustomerComparisonAxis[];
  reproducibility_assessment: ReproducibilityScore[];
  multi_customer_evidence_readiness: MultiCustomerEvidenceReadiness;
  public_launch_review_prep: PublicLaunchReviewPrep;
  public_launch_blocker_matrix: string[];
  public_launch_review_inputs: PublicLaunchReviewInput[];
  operator_checklist: string[];
  rollback_plan: SecondCustomerRollbackStep[];
  final_verdict: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_to_prepare_second_customer: true;
  second_customer_selected: false;
  second_customer_started: false;
  second_customer_completed: false;
  second_customer_evidence_collected: false;
  customer_comparison_completed: false;
  reproducibility_verified: false;
  multi_customer_evidence_ready: false;
  public_launch_review_ready: false;
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
