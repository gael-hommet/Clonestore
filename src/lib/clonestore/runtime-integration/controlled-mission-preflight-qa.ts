// src/lib/clonestore/runtime-integration/controlled-mission-preflight-qa.ts
// PHASE 5.3 — Controlled Mission Preflight — QA Checklist
//
// Module PUR. Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

export type ControlledMissionPreflightQaStepId =
  | "preflight_types_exist"
  | "preflight_module_exists"
  | "preflight_ui_copy_exists"
  | "checks_builder_defined"
  | "readiness_score_defined"
  | "run_preflight_defined"
  | "eligibility_defined"
  | "score_deterministic"
  | "approved_required_for_ready"
  | "not_reviewed_blocked"
  | "changes_requested_blocked"
  | "blocked_local_blocked"
  | "blocked_by_guard_blocked"
  | "missing_information_blocked"
  | "archived_not_preflightable"
  | "mission_not_found_safe"
  | "ready_means_future_candidate_only"
  | "ready_keeps_runtime_disabled"
  | "ready_keeps_server_disabled"
  | "ready_no_real_mission"
  | "ready_no_pierre"
  | "ready_no_ai"
  | "ready_no_email_document"
  | "double_preflight_idempotent"
  | "localstorage_corrupted_safe"
  | "localstorage_unavailable_safe"
  | "checks_local_only"
  | "checks_execution_disabled"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_fetch_in_preflight"
  | "no_pierre_engine_import"
  | "no_preflight_route_created"
  | "no_execute_route_created"
  | "ui_no_execute_action"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionPreflightQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionPreflightQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionPreflightQaStep = {
  id: ControlledMissionPreflightQaStepId;
  label: string;
  severity: ControlledMissionPreflightQaStepSeverity;
  status: ControlledMissionPreflightQaStepStatus;
};

export type ControlledMissionPreflightQaChecklist = {
  steps: ControlledMissionPreflightQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.3";
  generated_at: string;
};

export type ControlledMissionPreflightQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionPreflightQaSummary = {
  verdict: ControlledMissionPreflightQaVerdict;
  blocking_steps: ControlledMissionPreflightQaStepId[];
  passed_steps: ControlledMissionPreflightQaStepId[];
  pending_steps: ControlledMissionPreflightQaStepId[];
  message: string;
  preflight_local_only: true;
};

function s(
  id: ControlledMissionPreflightQaStepId,
  label: string,
  severity: ControlledMissionPreflightQaStepSeverity
): ControlledMissionPreflightQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionPreflightQaChecklist(): ControlledMissionPreflightQaChecklist {
  const steps: ControlledMissionPreflightQaStep[] = [
    s("preflight_types_exist", "Types preflight présents", "blocking"),
    s("preflight_module_exists", "Module preflight présent", "blocking"),
    s("preflight_ui_copy_exists", "Module UI copy preflight présent", "blocking"),
    s("checks_builder_defined", "buildControlledMissionPreflightChecks défini", "blocking"),
    s("readiness_score_defined", "computeControlledMissionReadinessScore défini", "blocking"),
    s("run_preflight_defined", "runLocalControlledMissionPreflight défini", "blocking"),
    s("eligibility_defined", "validateControlledMissionPreflightEligibility défini", "blocking"),
    s("score_deterministic", "Score déterministe", "blocking"),
    s("approved_required_for_ready", "Approbation locale requise pour ready", "blocking"),
    s("not_reviewed_blocked", "Non reviewée → blocked_by_missing_review", "blocking"),
    s("changes_requested_blocked", "changes_requested → blocked_by_manual_decision", "blocking"),
    s("blocked_local_blocked", "blocked_local → blocked_by_manual_decision", "blocking"),
    s("blocked_by_guard_blocked", "blocked_by_guard → blocked_by_guard", "blocking"),
    s("missing_information_blocked", "missing information → blocked_by_missing_information", "blocking"),
    s("archived_not_preflightable", "Archivée → preflight impossible", "blocking"),
    s("mission_not_found_safe", "Mission introuvable → erreur propre", "blocking"),
    s("ready_means_future_candidate_only", "ready = candidate future uniquement", "blocking"),
    s("ready_keeps_runtime_disabled", "ready garde runtime disabled", "blocking"),
    s("ready_keeps_server_disabled", "ready garde serveur disabled", "blocking"),
    s("ready_no_real_mission", "ready ne crée aucune mission réelle", "blocking"),
    s("ready_no_pierre", "ready ne déclenche aucun Pierre", "blocking"),
    s("ready_no_ai", "ready ne déclenche aucune IA", "blocking"),
    s("ready_no_email_document", "ready ne déclenche aucun email/document", "blocking"),
    s("double_preflight_idempotent", "Double preflight idempotent", "blocking"),
    s("localstorage_corrupted_safe", "localStorage corrompu → fallback sûr", "blocking"),
    s("localstorage_unavailable_safe", "localStorage indisponible → échec propre", "blocking"),
    s("checks_local_only", "Checks local_only true", "blocking"),
    s("checks_execution_disabled", "Checks execution_enabled false", "blocking"),
    s("no_db_write", "Aucun write DB", "blocking"),
    s("no_api_post", "Aucun POST", "blocking"),
    s("no_supabase_import", "Aucun import base de données", "blocking"),
    s("no_fetch_in_preflight", "Aucun appel réseau dans preflight", "blocking"),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking"),
    s("no_preflight_route_created", "Aucune route preflight serveur créée", "blocking"),
    s("no_execute_route_created", "Aucune route execute créée", "blocking"),
    s("ui_no_execute_action", "Aucune action Exécuter / Lancer / Envoyer", "blocking"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.3",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionPreflightQaVerdict(
  steps: ControlledMissionPreflightQaStep[]
): ControlledMissionPreflightQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionPreflightQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionPreflightQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    preflight_local_only: true,
  };
  summary.message = summarizeControlledMissionPreflightQaVerdict(summary);
  return summary;
}

export function getControlledMissionPreflightBlockingSteps(): ControlledMissionPreflightQaStep[] {
  return buildControlledMissionPreflightQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionPreflightQaVerdict(
  summary: ControlledMissionPreflightQaSummary
): string {
  const lines = [
    `[QA PHASE 5.3 Controlled Mission Preflight] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Preflight local uniquement — « ready » = candidate future, jamais exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Readiness gate locale validée.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Mission non exécutée · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
