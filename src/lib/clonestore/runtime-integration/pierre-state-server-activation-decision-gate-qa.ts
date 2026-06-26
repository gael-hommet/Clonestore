// src/lib/clonestore/runtime-integration/pierre-state-server-activation-decision-gate-qa.ts
// PHASE 6.3 — Pierre State/Server Activation Decision Gate — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Decision gate — ne déclenche rien, n'active rien.

export type PierreDecisionGateQaStepId =
  | "types_exist"
  | "gate_module_exists"
  | "ui_copy_exists"
  | "build_gate_defined"
  | "strategy_items_defined"
  | "activation_conditions_defined"
  | "no_go_defined"
  | "approvals_defined"
  | "risk_matrix_defined"
  | "rollback_defined"
  | "audit_trace_defined"
  | "dependency_map_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_6_3"
  | "ready_for_p6_4_true"
  | "recommended_strategy_local_first"
  | "server_persistence_activated_false"
  | "runtime_execution_activated_false"
  | "sql_applied_false"
  | "server_flag_enabled_false"
  | "route_created_false"
  | "server_get_created_false"
  | "server_post_created_false"
  | "email_sent_false"
  | "official_document_generated_false"
  | "ai_call_performed_false"
  | "pierre_fully_sellable_declared_false"
  | "public_launch_validated_false"
  | "scale_80k_proven_false"
  | "first_sale_allow_with_limits"
  | "public_launch_block_or_future"
  | "runtime_future_or_block"
  | "server_persistence_future"
  | "strategy_items_complete"
  | "activation_conditions_present"
  | "no_go_present"
  | "approvals_present"
  | "sensitive_categories_no_self_approve"
  | "risk_matrix_present"
  | "rollback_present"
  | "audit_trace_present"
  | "p6_dependency_p64_p66"
  | "no_active_route"
  | "no_execute_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_decision_gate_pierre"
  | "ui_no_activation"
  | "ui_sale_vs_launch"
  | "ui_runtime_inactive"
  | "ui_no_active_apply_sql"
  | "ui_no_active_activate_server"
  | "ui_no_active_execute_runtime"
  | "no_fetch_in_modules"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_activation_performed"
  | "next_phase_p6_4";

export type PierreDecisionGateQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type PierreDecisionGateQaStepSeverity = "blocking" | "warning" | "info";

export type PierreDecisionGateQaStep = {
  id: PierreDecisionGateQaStepId;
  label: string;
  severity: PierreDecisionGateQaStepSeverity;
  status: PierreDecisionGateQaStepStatus;
};

export type PierreDecisionGateQaChecklist = {
  steps: PierreDecisionGateQaStep[];
  total: number;
  blocking_count: number;
  phase: "6.3";
  generated_at: string;
};

export type PierreDecisionGateQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type PierreDecisionGateQaSummary = {
  verdict: PierreDecisionGateQaVerdict;
  blocking_steps: PierreDecisionGateQaStepId[];
  passed_steps: PierreDecisionGateQaStepId[];
  pending_steps: PierreDecisionGateQaStepId[];
  message: string;
  decision_gate_only: true;
};

function s(
  id: PierreDecisionGateQaStepId,
  label: string,
  severity: PierreDecisionGateQaStepSeverity
): PierreDecisionGateQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildPierreStateServerActivationDecisionGateQaChecklist(): PierreDecisionGateQaChecklist {
  const b = (id: PierreDecisionGateQaStepId, label: string) => s(id, label, "blocking");
  const steps: PierreDecisionGateQaStep[] = [
    b("types_exist", "Types gate présents"),
    b("gate_module_exists", "Module gate présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_gate_defined", "buildPierreStateServerActivationDecisionGate défini"),
    b("strategy_items_defined", "buildPierreDecisionGateStrategyItems défini"),
    b("activation_conditions_defined", "buildPierreDecisionGateActivationConditions défini"),
    b("no_go_defined", "buildPierreDecisionGateNoGoConditions défini"),
    b("approvals_defined", "buildPierreDecisionGateApprovals défini"),
    b("risk_matrix_defined", "buildPierreDecisionGateRiskMatrix défini"),
    b("rollback_defined", "buildPierreDecisionGateRollbackStrategy défini"),
    b("audit_trace_defined", "buildPierreDecisionGateAuditTraceRequirements défini"),
    b("dependency_map_defined", "buildPierreDecisionGateDependencyMap défini"),
    b("summarize_defined", "summarizePierreStateServerActivationDecisionGate défini"),
    b("qa_defined", "buildPierreStateServerActivationDecisionGateQaChecklist défini"),
    b("phase_6_3", "Phase 6.3"),
    b("ready_for_p6_4_true", "ready_for_p6_4 true"),
    b("recommended_strategy_local_first", "recommended_strategy local_first_controlled_sale"),
    b("server_persistence_activated_false", "server_persistence_activated false"),
    b("runtime_execution_activated_false", "runtime_execution_activated false"),
    b("sql_applied_false", "sql_applied false"),
    b("server_flag_enabled_false", "server_flag_enabled false"),
    b("route_created_false", "route_created false"),
    b("server_get_created_false", "server_get_created false"),
    b("server_post_created_false", "server_post_created false"),
    b("email_sent_false", "email_sent false"),
    b("official_document_generated_false", "official_document_generated false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("pierre_fully_sellable_declared_false", "pierre_fully_sellable_declared false"),
    b("public_launch_validated_false", "public_launch_validated false"),
    b("scale_80k_proven_false", "scale_80k_proven false"),
    b("first_sale_allow_with_limits", "Première vente allow_with_limits"),
    b("public_launch_block_or_future", "Public launch block/future"),
    b("runtime_future_or_block", "Runtime future/block"),
    b("server_persistence_future", "Server persistence future"),
    b("strategy_items_complete", "Strategy items complets"),
    b("activation_conditions_present", "Activation conditions présentes"),
    b("no_go_present", "No-go présents"),
    b("approvals_present", "Approvals présents"),
    b("sensitive_categories_no_self_approve", "Catégories sensibles : can_be_self_approved false"),
    b("risk_matrix_present", "Risk matrix présent"),
    b("rollback_present", "Rollback présent"),
    b("audit_trace_present", "Audit trace requirements présents"),
    b("p6_dependency_p64_p66", "P6 dependency map P6.4 → P6.6"),
    b("no_active_route", "Aucune route controlled-missions active"),
    b("no_execute_route", "Aucune route execute"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_decision_gate_pierre", "UI : « Decision Gate Pierre »"),
    b("ui_no_activation", "UI : « Aucune activation »"),
    b("ui_sale_vs_launch", "UI : « Première vente contrôlée ≠ lancement public »"),
    b("ui_runtime_inactive", "UI : « runtime autonome reste inactif »"),
    b("ui_no_active_apply_sql", "Aucune action « Appliquer SQL »"),
    b("ui_no_active_activate_server", "Aucune action « Activer serveur »"),
    b("ui_no_active_execute_runtime", "Aucune action « Exécuter runtime »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    b("no_activation_performed", "Aucune activation effectuée"),
    s("next_phase_p6_4", "Prochaine phase P6.4", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "6.3",
    generated_at: new Date().toISOString(),
  };
}

export function buildPierreStateServerActivationDecisionGateQaVerdict(
  steps: PierreDecisionGateQaStep[]
): PierreDecisionGateQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: PierreDecisionGateQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: PierreDecisionGateQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    decision_gate_only: true,
  };
  summary.message = summarizePierreStateServerActivationDecisionGateQaVerdict(summary);
  return summary;
}

export function getPierreStateServerActivationDecisionGateBlockingSteps(): PierreDecisionGateQaStep[] {
  return buildPierreStateServerActivationDecisionGateQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizePierreStateServerActivationDecisionGateQaVerdict(
  summary: PierreDecisionGateQaSummary
): string {
  const lines = [
    `[QA PHASE 6.3 Pierre Decision Gate] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Decision gate — aucune activation, aucune route, aucun SQL appliqué, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Décision validée. Prêt pour P6.4.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Première vente contrôlée ≠ lancement public · prochaine étape P6.4.");
  return lines.join("\n");
}
