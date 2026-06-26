// src/lib/clonestore/runtime-integration/pierre-state-server-activation-decision-gate-types.ts
// PHASE 6.3 — Pierre State/Server Activation Decision Gate — Types
//
// DECISION GATE — pas une activation. Décide la stratégie d'état/serveur/runtime pour
// une première vente contrôlée, SANS rien activer. N'applique pas le SQL. N'active pas
// le flag. Ne crée pas de route. Ne déclenche pas le runtime. Aucun email réel. Aucun
// document officiel. Aucun appel réseau / IA. Ne déclare pas Pierre fully sellable.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type PierreDecisionGatePhase = "6.3";

export type PierreDecisionGateStatus =
  | "decision_ready"
  | "blocked"
  | "ready_for_p6_4";

export type PierreDecisionGateStrategy =
  | "local_first_controlled_sale"
  | "governed_server_persistence_before_sale"
  | "runtime_activation_before_sale"
  | "public_launch_requires_server";

export type PierreStateStrategyAppliesTo = "first_sale" | "public_launch" | "runtime" | "scale";
export type PierreStateStrategyDecision = "allow" | "allow_with_limits" | "block" | "future";

export type PierreStateStrategyItem = {
  id: string;
  title: string;
  applies_to: PierreStateStrategyAppliesTo;
  decision: PierreStateStrategyDecision;
  reason: string;
  required_conditions: string[];
  forbidden_shortcuts: string[];
};

export type PierreDecisionGateApproval = {
  category: string;
  required_approver: string;
  approval_level: "operator" | "hr_manager" | "legal" | "governance" | "founder";
  can_be_self_approved: boolean;
  evidence_required: string[];
  forbidden_without_approval: string[];
};

export type PierreDecisionGateRisk = {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium";
  mitigation: string;
};

export type PierreDecisionGateDependencyItem = {
  id: string;
  title: string;
  why: string;
  optional: boolean;
};

export type PierreStateServerActivationDecisionGate = {
  phase: PierreDecisionGatePhase;
  title: string;
  generated_at: string;
  gate_status: PierreDecisionGateStatus;
  recommended_strategy: PierreDecisionGateStrategy;
  decision_summary: string;
  first_sale_state_strategy: PierreStateStrategyItem;
  public_launch_state_strategy: PierreStateStrategyItem;
  runtime_strategy: PierreStateStrategyItem;
  server_persistence_strategy: PierreStateStrategyItem;
  state_strategy_items: PierreStateStrategyItem[];
  activation_conditions: string[];
  no_go_conditions: string[];
  approval_requirements: PierreDecisionGateApproval[];
  risk_matrix: PierreDecisionGateRisk[];
  rollback_strategy: string[];
  audit_trace_requirements: string[];
  p6_dependency_map: PierreDecisionGateDependencyItem[];
  next_phase_recommendation: string;
  final_verdict: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  ready_for_p6_4: true;
  server_persistence_activated: false;
  runtime_execution_activated: false;
  sql_applied: false;
  server_flag_enabled: false;
  route_created: false;
  server_get_created: false;
  server_post_created: false;
  email_sent: false;
  official_document_generated: false;
  ai_call_performed: false;
  pierre_fully_sellable_declared: false;
  public_launch_validated: false;
  scale_80k_proven: false;
};
