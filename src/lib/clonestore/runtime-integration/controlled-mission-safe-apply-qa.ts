// src/lib/clonestore/runtime-integration/controlled-mission-safe-apply-qa.ts
// PHASE 5.1 — Controlled Mission Safe Apply — QA Checklist
//
// Module PUR. Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

export type ControlledMissionSafeApplyQaStepId =
  | "safe_apply_types_exist"
  | "safe_apply_module_exists"
  | "local_storage_module_exists"
  | "ui_copy_module_exists"
  | "build_from_preview_defined"
  | "validate_input_defined"
  | "sanitize_payload_defined"
  | "create_local_mission_defined"
  | "idempotent_no_duplicate"
  | "localstorage_corrupted_safe"
  | "localstorage_unavailable_safe"
  | "xss_sanitized"
  | "execution_status_not_executable"
  | "server_persistence_disabled"
  | "runtime_execution_disabled"
  | "no_real_mission_created"
  | "no_pierre_engine_import"
  | "no_supabase_import"
  | "no_fetch_in_safe_apply"
  | "no_execute_route_created"
  | "archive_local_works"
  | "list_local_works"
  | "ui_microcopy_local_only"
  | "ui_no_execute_action"
  | "human_validation_required"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionSafeApplyQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionSafeApplyQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionSafeApplyQaStep = {
  id: ControlledMissionSafeApplyQaStepId;
  label: string;
  severity: ControlledMissionSafeApplyQaStepSeverity;
  status: ControlledMissionSafeApplyQaStepStatus;
};

export type ControlledMissionSafeApplyQaChecklist = {
  steps: ControlledMissionSafeApplyQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.1";
  generated_at: string;
};

export type ControlledMissionSafeApplyQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionSafeApplyQaSummary = {
  verdict: ControlledMissionSafeApplyQaVerdict;
  blocking_steps: ControlledMissionSafeApplyQaStepId[];
  passed_steps: ControlledMissionSafeApplyQaStepId[];
  pending_steps: ControlledMissionSafeApplyQaStepId[];
  message: string;
  localstorage_first_only: true;
};

function s(
  id: ControlledMissionSafeApplyQaStepId,
  label: string,
  severity: ControlledMissionSafeApplyQaStepSeverity
): ControlledMissionSafeApplyQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionSafeApplyQaChecklist(): ControlledMissionSafeApplyQaChecklist {
  const steps: ControlledMissionSafeApplyQaStep[] = [
    s("safe_apply_types_exist", "Types safe apply présents", "blocking"),
    s("safe_apply_module_exists", "Module safe apply présent", "blocking"),
    s("local_storage_module_exists", "Module localStorage présent", "blocking"),
    s("ui_copy_module_exists", "Module UI copy présent", "blocking"),
    s("build_from_preview_defined", "buildControlledMissionFromPromotionPreview défini", "blocking"),
    s("validate_input_defined", "validateControlledMissionSafeApplyInput défini", "blocking"),
    s("sanitize_payload_defined", "sanitizeControlledMissionPayload défini", "blocking"),
    s("create_local_mission_defined", "createLocalControlledMission défini", "blocking"),
    s("idempotent_no_duplicate", "Idempotence (pas de doublon)", "blocking"),
    s("localstorage_corrupted_safe", "localStorage corrompu → fallback sûr", "blocking"),
    s("localstorage_unavailable_safe", "localStorage indisponible → échec propre", "blocking"),
    s("xss_sanitized", "XSS / HTML / script sanitizé", "blocking"),
    s("execution_status_not_executable", "execution_status non-exécutable", "blocking"),
    s("server_persistence_disabled", "server_persistence disabled", "blocking"),
    s("runtime_execution_disabled", "runtime_execution disabled", "blocking"),
    s("no_real_mission_created", "Aucune mission réelle créée", "blocking"),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking"),
    s("no_supabase_import", "Aucun import base de données", "blocking"),
    s("no_fetch_in_safe_apply", "Aucun fetch dans safe apply", "blocking"),
    s("no_execute_route_created", "Aucune route execute créée", "blocking"),
    s("archive_local_works", "Archive locale fonctionne", "warning"),
    s("list_local_works", "Liste/restore local fonctionne", "warning"),
    s("ui_microcopy_local_only", "Microcopy « Local uniquement · Aucune exécution »", "blocking"),
    s("ui_no_execute_action", "Aucune action « Exécuter / Lancer / Envoyer »", "blocking"),
    s("human_validation_required", "Validation humaine requise", "blocking"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.1",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionSafeApplyQaVerdict(
  steps: ControlledMissionSafeApplyQaStep[]
): ControlledMissionSafeApplyQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionSafeApplyQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionSafeApplyQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    localstorage_first_only: true,
  };
  summary.message = summarizeControlledMissionSafeApplyQaVerdict(summary);
  return summary;
}

export function getControlledMissionSafeApplyBlockingSteps(): ControlledMissionSafeApplyQaStep[] {
  return buildControlledMissionSafeApplyQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionSafeApplyQaVerdict(
  summary: ControlledMissionSafeApplyQaSummary
): string {
  const lines = [
    `[QA PHASE 5.1 Controlled Mission Safe Apply] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  localStorage-first uniquement — mission préparée, non exécutée, non persistée serveur.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Safe apply local validé.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Aucune mission réelle · Aucune exécution · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
