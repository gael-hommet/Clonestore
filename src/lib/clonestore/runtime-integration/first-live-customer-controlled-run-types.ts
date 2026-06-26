// src/lib/clonestore/runtime-integration/first-live-customer-controlled-run-types.ts
// PHASE 7.2 — First Live Customer Controlled Run / Sell · Activate · Accompany First Real
// Customer With Evidence — Types
//
// RUNBOOK / EVIDENCE GATE en lecture seule. Prépare la vente, l'activation, l'accompagnement
// et la documentation du PREMIER vrai client Pierre — sans déclarer public launch, sans mentir
// sur les preuves live, en collectant l'evidence réelle nécessaire. Aucune preuve client n'est
// inventée. Public launch reste BLOCKED. go-live proofs restent manuels et vérifiables.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type FirstLiveCustomerPhase = "7.2";

export type FirstLiveCustomerRunStatus =
  | "ready_to_prepare_first_customer"
  | "customer_selected"
  | "activation_in_progress"
  | "first_value_delivered"
  | "blocked";

export type FirstCustomerRiskLevel = "low" | "medium" | "high";

export type CustomerQualificationItem = {
  id: string;
  label: string;
  required: boolean;
  evidence_needed: string;
  verified: false;
};

export type ActivationRunbookStep = {
  id: string;
  order: number;
  label: string;
  owner: string;
  expected_output: string;
  evidence_required: string;
  can_be_marked_done_now: false;
  verified: false;
};

export type SetupRunbookItem = {
  id: string;
  label: string;
  required: boolean;
  captured: false;
};

export type FirstMissionScenario = {
  scenario_id: string;
  label: string;
  recommended_for_first_customer: boolean;
  risk_level: FirstCustomerRiskLevel;
  expected_first_output: string;
  human_validation_required: true;
  runtime_execution_allowed: false;
  real_email_allowed: false;
  official_document_allowed: false;
};

export type EvidenceCollectionItem = {
  id: string;
  label: string;
  required: boolean;
  collected: false;
  storage_location_hint: string;
};

export type OperatorResponsibility = {
  id: string;
  role: string;
  responsibilities: string[];
};

export type RollbackStep = {
  id: string;
  step: string;
  description: string;
};

export type PublicLaunchImpact = {
  public_launch_ready_after_run: false;
  first_live_customer_can_improve_evidence: true;
  public_launch_only_after_external_proofs: true;
  one_customer_is_not_scale_proof: true;
  notes: string[];
};

export type GoLiveProofUpdatesPolicy = {
  manual_only: true;
  only_after_real_proof: true;
  never_via_this_module: true;
  must_be_dated: true;
  must_be_verifiable: true;
  rollback_noted_on_failure: true;
  notes: string[];
};

export type FirstLiveCustomerControlledRunReport = {
  phase: FirstLiveCustomerPhase;
  title: string;
  generated_at: string;
  run_status: FirstLiveCustomerRunStatus;
  first_customer_readiness: string;
  customer_qualification_matrix: CustomerQualificationItem[];
  pre_sale_conditions: string[];
  legal_and_commercial_limits: string[];
  activation_runbook: ActivationRunbookStep[];
  setup_runbook: SetupRunbookItem[];
  first_mission_runbook: FirstMissionScenario[];
  evidence_collection_plan: EvidenceCollectionItem[];
  customer_feedback_plan: string[];
  operator_responsibilities: OperatorResponsibility[];
  no_go_conditions: string[];
  rollback_plan: RollbackStep[];
  public_launch_impact: PublicLaunchImpact;
  go_live_proof_updates_policy: GoLiveProofUpdatesPolicy;
  final_verdict: string;
  recommended_next_phase: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_to_prepare_first_live_customer: true;
  first_live_customer_completed: false;
  real_customer_selected: false;
  real_payment_verified: false;
  contract_signed_verified: false;
  setup_completed_verified: false;
  first_value_delivered_verified: false;
  feedback_collected_verified: false;
  stripe_live_verified: false;
  supabase_prod_rls_verified: false;
  domain_email_verified: false;
  runtime_execution_active: false;
  real_email_sent: false;
  official_document_generated: false;
  public_launch_ready: false;
  scale_80k_proven: false;
  go_live_proofs_modified: false;
  env_modified: false;
  ai_call_performed: false;
};
