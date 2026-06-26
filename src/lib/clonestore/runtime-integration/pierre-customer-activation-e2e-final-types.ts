// src/lib/clonestore/runtime-integration/pierre-customer-activation-e2e-final-types.ts
// PHASE 6.5 — Pierre Customer Activation E2E Final / First Paid Customer Proof Path — Types
//
// PROOF PATH. Décrit le parcours client complet (découverte → première valeur) pour une
// PREMIÈRE VENTE CONTRÔLÉE, sans rien activer en live. Aucun paiement live. Aucun appel
// Stripe live. Aucun Supabase prod. Aucun runtime. Aucun email réel. Aucun document
// officiel. Aucun appel IA. Première vente contrôlée ≠ public launch ≠ Stripe live réel.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreActivationPhase = "6.5";

export type PierreActivationStatus =
  | "e2e_path_ready"
  | "first_paid_customer_path_ready"
  | "blocked";

export type PierreCustomerJourneyStep = {
  id: string;
  letter: string;
  label: string;
  route: string;
  customer_understanding: string;
  no_autonomous_execution_confirmed: true;
};

export type PierreActivationPathStatus =
  | "ready"
  | "ready_local"
  | "design_ready"
  | "needs_live_proof"
  | "blocked";

export type PierreActivationPathItem = {
  id: string;
  route: string;
  expected_state: string;
  customer_visible_goal: string;
  proof_required: string;
  status: PierreActivationPathStatus;
  blocking_before_first_sale: boolean;
  blocking_before_public_launch: boolean;
};

export type PierreFirstValuePath = {
  steps: string[];
  expected_time_to_value: string;
  proof_artifacts: string[];
  customer_success_criteria: string[];
  failure_modes: string[];
  fallback_steps: string[];
  no_autonomous_execution: true;
};

export type PierreCustomerState =
  | "unpaid"
  | "paid_active"
  | "trialing"
  | "cancelled"
  | "expired"
  | "internal_demo"
  | "first_controlled_sale_customer";

export type PierreAccessControlRow = {
  customer_state: PierreCustomerState;
  can_access_profile_agents: boolean;
  can_access_setup: boolean;
  can_access_use: boolean;
  can_start_controlled_mission: boolean;
  can_execute_runtime: false;
  can_send_email: false;
  reason: string;
};

export type PierreOnboardingHandoff = {
  enterprise_name_field: string;
  rh_context: string;
  employee_data_minimal: string[];
  approvers: string[];
  rules: string[];
  risk_settings: string[];
  scenario_preferences: string[];
  missing_fields: string[];
  handoff_to_pierre_setup: string;
  handoff_to_pierre_use: string;
  no_server_persistence_confirmed: true;
};

export type PierreScenarioEntryPoint = {
  id: string;
  scenario: string;
  route_surface: string;
  trigger_label: string;
  expected_output: string;
  human_validation_needed: boolean;
  no_autonomous_execution_confirmed: true;
};

export type PierreFirstMissionFlowStep = {
  id: string;
  step: string;
  description: string;
  can_execute_runtime: false;
  real_action: false;
  email: false;
  document_official: false;
};

export type PierreActivationEvidenceItem = {
  id: string;
  label: string;
  expected: string;
};

export type PierreCustomerActivationE2EFinalReport = {
  phase: PierreActivationPhase;
  title: string;
  generated_at: string;
  activation_status: PierreActivationStatus;
  customer_journey_steps: PierreCustomerJourneyStep[];
  activation_path_matrix: PierreActivationPathItem[];
  proof_path: string[];
  first_value_path: PierreFirstValuePath;
  access_control_matrix: PierreAccessControlRow[];
  onboarding_to_pierre_handoff: PierreOnboardingHandoff;
  scenario_entry_points: PierreScenarioEntryPoint[];
  first_mission_controlled_flow: PierreFirstMissionFlowStep[];
  traceability_requirements: string[];
  human_validation_requirements: string[];
  customer_visible_limits: string[];
  first_paid_customer_evidence_checklist: PierreActivationEvidenceItem[];
  public_launch_blockers: string[];
  remaining_gaps: string[];
  recommended_next_phase: string;
  final_verdict: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_p6_6: true;
  first_paid_customer_path_ready: true;
  first_paid_customer_e2e_proven_live: false;
  stripe_live_payment_performed: false;
  supabase_prod_verified: false;
  runtime_execution_active: false;
  server_persistence_active: false;
  real_email_sent: false;
  official_document_generated: false;
  ai_call_performed: false;
  env_modified: false;
  sql_applied: false;
  pierre_fully_sellable_declared: false;
  public_launch_validated: false;
  scale_80k_proven: false;
};
