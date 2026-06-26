// src/lib/clonestore/runtime-integration/pierre-real-workflow-completion-pack-types.ts
// PHASE 6.2 — Pierre Real Workflow Completion Pack / 5 Sellable HR Scenarios — Types
//
// DESIGN / PROOF PACK. Décrit 5 scénarios RH vendables contrôlés. NE FAIT PAS semblant
// d'exécuter. N'ACTIVE RIEN. Aucune route. Aucun SQL appliqué. Aucune exécution
// autonome. Aucun email réel. Aucun document officiel réel. Aucun appel réseau / IA.
// Les actions sensibles restent bloquées ou soumises à validation humaine.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreWorkflowPackPhase = "6.2";

export type PierreWorkflowPackStatus =
  | "workflow_pack_ready"
  | "scenarios_ready_for_demo"
  | "blocked";

export type PierreWorkflowTaskType =
  | "analysis"
  | "draft"
  | "checklist"
  | "communication_draft"
  | "risk_review"
  | "deliverable_prep"
  | "validation_request";

export type PierreWorkflowTaskStatus =
  | "ready_for_demo"
  | "blocked_until_human_validation"
  | "local_only"
  | "future_runtime";

export type PierreWorkflowTask = {
  id: string;
  label: string;
  type: PierreWorkflowTaskType;
  status: PierreWorkflowTaskStatus;
  approval_required: boolean;
  can_be_demoed: boolean;
  can_be_executed_now: boolean;
  why: string;
};

export type PierreWorkflowExecutionStatus =
  | "simulated_controlled"
  | "local_only"
  | "blocked_until_human_validation"
  | "future_runtime";

export type PierreWorkflowHrDomain =
  | "recrutement_onboarding"
  | "absence_organisation"
  | "pre_paie_variables"
  | "multi_site_coordination"
  | "cas_sensible_recadrage";

export type PierreWorkflowCloneGuardDecision =
  | "allow_plan_only"
  | "require_human_validation"
  | "block";

export type PierreWorkflowScenario = {
  id: string;
  title: string;
  hr_domain: PierreWorkflowHrDomain;
  customer_request: string;
  pierre_understanding: string;
  mission_title: string;
  mission_summary: string;
  tasks: PierreWorkflowTask[];
  required_inputs: string[];
  missing_information: string[];
  human_validations: string[];
  sensitive_actions: string[];
  blocked_actions: string[];
  allowed_outputs: string[];
  forbidden_outputs: string[];
  expected_deliverables: string[];
  trace_events: string[];
  legal_guardrails: string[];
  cloneguard_decision: PierreWorkflowCloneGuardDecision;
  sellable_value: string;
  demo_script: string[];
  success_criteria: string[];
  first_sale_proof_status: "demo_ready" | "first_sale_candidate" | "blocked";
  execution_status: PierreWorkflowExecutionStatus;
  // Invariant littéral.
  no_autonomous_execution_confirmed: true;
};

export type PierreWorkflowSellableProofSummary = {
  scenarios_exist: boolean;
  client_understandable: boolean;
  proves_hr_value: boolean;
  avoids_false_promises: boolean;
  demoable: boolean;
  scenarios_ready_for_demo: boolean;
  first_sale_candidate: boolean;
  public_launch_ready: false;
  pierre_fully_sellable_declared: false;
  remaining_blocking_before_public_launch: string[];
};

export type PierreWorkflowHumanValidationRow = {
  scenario_id: string;
  scenario_title: string;
  allowed_without_validation: string[];
  requires_validation: string[];
  forbidden: string[];
  reason: string;
};

export type PierreWorkflowLegalRisk = {
  id: string;
  risk: string;
  severity: "critical" | "high" | "medium";
  handling: string;
};

export type PierreWorkflowTraceabilityRow = {
  scenario_id: string;
  events: string[];
  no_autonomous_execution_confirmed: true;
};

export type PierreWorkflowDemoReadinessRow = {
  scenario_id: string;
  demo_ready: boolean;
  needs_human_validation: boolean;
  blocks_sensitive: boolean;
};

export type PierreRealWorkflowCompletionPack = {
  phase: PierreWorkflowPackPhase;
  title: string;
  generated_at: string;
  pack_status: PierreWorkflowPackStatus;
  scenario_count: 5;
  scenarios: PierreWorkflowScenario[];
  scenario_matrix: { id: string; title: string; hr_domain: PierreWorkflowHrDomain; first_sale_proof_status: string }[];
  sellable_proof_summary: PierreWorkflowSellableProofSummary;
  human_validation_matrix: PierreWorkflowHumanValidationRow[];
  legal_risk_matrix: PierreWorkflowLegalRisk[];
  traceability_matrix: PierreWorkflowTraceabilityRow[];
  demo_readiness_matrix: PierreWorkflowDemoReadinessRow[];
  first_sale_readiness: string[];
  remaining_gaps: string[];
  recommended_next_phase: string;
  final_verdict: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_p6_3: true;
  pierre_fully_sellable_declared: false;
  public_launch_validated: false;
  scale_80k_proven: false;
  server_persistence_active: false;
  runtime_execution_active: false;
  ai_call_performed: false;
  email_sent: false;
  official_document_generated: false;
};
