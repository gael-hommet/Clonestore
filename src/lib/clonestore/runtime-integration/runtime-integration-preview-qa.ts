// src/lib/clonestore/runtime-integration/runtime-integration-preview-qa.ts
// PHASE 4.2 — Runtime API Simulation / Command Center Preview — QA Module
//
// Module pur. Pas de Supabase, pas de DB, pas d'import Pierre, pas de fetch.

export type RuntimeIntegrationPreviewQaStepId =
  | "api_contract_exists"
  | "simulation_route_exists"
  | "route_get_capabilities"
  | "route_post_simulation_only"
  | "route_no_db_write"
  | "route_no_supabase_import"
  | "route_no_pierre_engine_import"
  | "route_no_openai_call"
  | "route_no_cloneos_execution"
  | "api_client_exists"
  | "api_client_only_calls_simulation_endpoint"
  | "preview_model_exists"
  | "profile_messages_preview_visible"
  | "preview_requires_click"
  | "no_auto_simulation_on_mount"
  | "badges_readonly_visible"
  | "badges_no_execution_visible"
  | "scale_80k_not_proven_visible"
  | "cloneguard_visible"
  | "clonetrace_visible"
  | "public_launch_external_not_validated";

export type RuntimeIntegrationPreviewQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type RuntimeIntegrationPreviewQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimeIntegrationPreviewQaStep = {
  id: RuntimeIntegrationPreviewQaStepId;
  label: string;
  severity: RuntimeIntegrationPreviewQaStepSeverity;
  status: RuntimeIntegrationPreviewQaStepStatus;
  expected_result: string;
};

export type RuntimeIntegrationPreviewQaChecklist = {
  steps: RuntimeIntegrationPreviewQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "4.2";
};

export type RuntimeIntegrationPreviewQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type RuntimeIntegrationPreviewQaSummary = {
  verdict: RuntimeIntegrationPreviewQaVerdict;
  blocking_steps: RuntimeIntegrationPreviewQaStepId[];
  passed_steps: RuntimeIntegrationPreviewQaStepId[];
  pending_steps: RuntimeIntegrationPreviewQaStepId[];
  message: string;
  safe_to_advance: boolean;
};

export function buildRuntimeIntegrationPreviewQaChecklist(): RuntimeIntegrationPreviewQaChecklist {
  const mk = (
    id: RuntimeIntegrationPreviewQaStepId,
    label: string,
    severity: RuntimeIntegrationPreviewQaStepSeverity,
    expected_result: string
  ): RuntimeIntegrationPreviewQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: RuntimeIntegrationPreviewQaStep[] = [
    mk("api_contract_exists", "API contract présent", "blocking", "api-contract présent."),
    mk("simulation_route_exists", "Route simulate présente", "blocking", "route.ts présent."),
    mk("route_get_capabilities", "GET retourne capabilities", "blocking", "GET capabilities + examples."),
    mk("route_post_simulation_only", "POST simulation-only", "blocking", "POST sans effet de bord."),
    mk("route_no_db_write", "Route sans write DB", "blocking", "Aucune écriture DB."),
    mk("route_no_supabase_import", "Route sans import Supabase", "blocking", "Pas de @supabase/supabase-js."),
    mk("route_no_pierre_engine_import", "Route sans import Pierre", "blocking", "Pas de @/lib/pierre."),
    mk("route_no_openai_call", "Route sans appel OpenAI", "blocking", "Pas d'appel IA."),
    mk("route_no_cloneos_execution", "Route sans exécution CloneOS", "blocking", "Aucune exécution CloneOS."),
    mk("api_client_exists", "API client présent", "blocking", "api-client présent."),
    mk("api_client_only_calls_simulation_endpoint", "Client appelle seulement /simulate", "blocking", "Endpoint unique."),
    mk("preview_model_exists", "Preview model présent", "blocking", "preview-model présent."),
    mk("profile_messages_preview_visible", "Preview visible dans /profile/messages", "blocking", "Panneau Command Center Preview."),
    mk("preview_requires_click", "Simulation au clic uniquement", "blocking", "Pas de simulation auto."),
    mk("no_auto_simulation_on_mount", "Aucune simulation au mount", "blocking", "Pas de POST au montage."),
    mk("badges_readonly_visible", "Badge Lecture seule visible", "warning", "Badge 'Lecture seule'."),
    mk("badges_no_execution_visible", "Badge Aucune mission créée visible", "warning", "Badge 'Aucune mission créée'."),
    mk("scale_80k_not_proven_visible", "Scale 80k non prouvé visible", "info", "Badge 'Scale 80k non prouvé'."),
    mk("cloneguard_visible", "CloneGuard visible", "blocking", "Section CloneGuard affichée."),
    mk("clonetrace_visible", "CloneTrace visible", "blocking", "Section CloneTrace affichée."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim de lancement public externe."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "4.2",
  };
}

export function buildRuntimeIntegrationPreviewQaVerdict(
  steps: RuntimeIntegrationPreviewQaStep[]
): RuntimeIntegrationPreviewQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeIntegrationPreviewQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: RuntimeIntegrationPreviewQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_advance: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeIntegrationPreviewQaVerdict(summary);
  return summary;
}

export function getRuntimeIntegrationPreviewBlockingSteps(): RuntimeIntegrationPreviewQaStep[] {
  return buildRuntimeIntegrationPreviewQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeIntegrationPreviewQaVerdict(
  summary: RuntimeIntegrationPreviewQaSummary
): string {
  return [
    `[QA PHASE 4.2 Runtime Preview] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to advance : ${summary.safe_to_advance}`,
    `  Simulation-only. Scale 80k non prouvé. Lancement public externe : non validé.`,
  ].join("\n");
}
