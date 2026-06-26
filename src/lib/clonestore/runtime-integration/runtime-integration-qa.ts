// src/lib/clonestore/runtime-integration/runtime-integration-qa.ts
// PHASE 4.1 — Runtime Operational Integration — QA Module
//
// Module pur. Pas de Supabase, pas d'API, pas de write, pas d'import Pierre.

export type RuntimeIntegrationQaStepId =
  | "runtime_types_exist"
  | "command_contract_exists"
  | "intent_router_exists"
  | "plan_builder_exists"
  | "guardrails_contract_exists"
  | "trace_contract_exists"
  | "scale_readiness_exists"
  | "orchestrator_simulation_exists"
  | "employee_registry_reused"
  | "pierre_route_plan_only"
  | "placeholders_not_routed_active"
  | "cloneguard_required"
  | "clonetrace_required"
  | "idempotency_contract_exists"
  | "queue_hints_exist"
  | "cost_hints_exist"
  | "tenant_isolation_hints_exist"
  | "scale_80k_not_claimed_as_proven"
  | "no_db_write"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "public_launch_external_not_validated";

export type RuntimeIntegrationQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type RuntimeIntegrationQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimeIntegrationQaStep = {
  id: RuntimeIntegrationQaStepId;
  label: string;
  severity: RuntimeIntegrationQaStepSeverity;
  status: RuntimeIntegrationQaStepStatus;
  expected_result: string;
};

export type RuntimeIntegrationQaChecklist = {
  steps: RuntimeIntegrationQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "4.1";
};

export type RuntimeIntegrationQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type RuntimeIntegrationQaSummary = {
  verdict: RuntimeIntegrationQaVerdict;
  blocking_steps: RuntimeIntegrationQaStepId[];
  passed_steps: RuntimeIntegrationQaStepId[];
  pending_steps: RuntimeIntegrationQaStepId[];
  message: string;
  safe_to_advance: boolean;
};

export function buildRuntimeIntegrationQaChecklist(): RuntimeIntegrationQaChecklist {
  const mk = (
    id: RuntimeIntegrationQaStepId,
    label: string,
    severity: RuntimeIntegrationQaStepSeverity,
    expected_result: string
  ): RuntimeIntegrationQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: RuntimeIntegrationQaStep[] = [
    mk("runtime_types_exist", "Types runtime présents", "blocking", "runtime-integration-types.ts présent."),
    mk("command_contract_exists", "Command contract présent", "blocking", "command-contract présent."),
    mk("intent_router_exists", "Intent router présent", "blocking", "intent-router présent."),
    mk("plan_builder_exists", "Plan builder présent", "blocking", "plan-builder présent."),
    mk("guardrails_contract_exists", "Guardrails contract présent", "blocking", "guardrails présent."),
    mk("trace_contract_exists", "Trace contract présent", "blocking", "trace-contract présent."),
    mk("scale_readiness_exists", "Scale readiness présent", "blocking", "scale-readiness présent."),
    mk("orchestrator_simulation_exists", "Orchestrator simulation présent", "blocking", "orchestrator présent."),
    mk("employee_registry_reused", "Employee registry réutilisé", "blocking", "Registry P3.20 réutilisé."),
    mk("pierre_route_plan_only", "Route Pierre plan-only", "blocking", "Pierre routé en plan-only."),
    mk("placeholders_not_routed_active", "Placeholders non routés actifs", "blocking", "Placeholders futurs non routés."),
    mk("cloneguard_required", "CloneGuard obligatoire", "blocking", "CloneGuard requis avant action sensible."),
    mk("clonetrace_required", "CloneTrace obligatoire", "blocking", "CloneTrace requis."),
    mk("idempotency_contract_exists", "Idempotency contract présent", "blocking", "Idempotency key requise."),
    mk("queue_hints_exist", "Queue hints présents", "warning", "Queue hints construits."),
    mk("cost_hints_exist", "Cost hints présents", "warning", "Cost hints construits."),
    mk("tenant_isolation_hints_exist", "Tenant isolation hints présents", "blocking", "Isolation stricte par tenant."),
    mk("scale_80k_not_claimed_as_proven", "Scale 80k non prouvé", "info", "scale_80k_not_proven true."),
    mk("no_db_write", "Aucun write DB", "blocking", "Aucune écriture en base."),
    mk("no_supabase_import", "Aucun import Supabase", "blocking", "Pas d'import @supabase/supabase-js."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking", "Pas d'import @/lib/pierre."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS", "blocking", "Aucune commande CloneOS exécutée."),
    mk("no_clonevoice_activation", "Aucune activation CloneVoice", "blocking", "CloneVoice non activé."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim de lancement public externe."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "4.1",
  };
}

export function buildRuntimeIntegrationQaVerdict(
  steps: RuntimeIntegrationQaStep[]
): RuntimeIntegrationQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeIntegrationQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: RuntimeIntegrationQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_advance: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeIntegrationQaVerdict(summary);
  return summary;
}

export function getRuntimeIntegrationBlockingSteps(): RuntimeIntegrationQaStep[] {
  return buildRuntimeIntegrationQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeIntegrationQaVerdict(summary: RuntimeIntegrationQaSummary): string {
  return [
    `[QA PHASE 4.1 Runtime Integration] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to advance : ${summary.safe_to_advance}`,
    `  Scale 80k : préparation scale, non prouvé. Lancement public externe : non validé.`,
  ].join("\n");
}
