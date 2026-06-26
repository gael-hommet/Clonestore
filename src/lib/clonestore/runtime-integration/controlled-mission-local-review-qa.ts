// src/lib/clonestore/runtime-integration/controlled-mission-local-review-qa.ts
// PHASE 5.2 — Controlled Mission Local Review — QA Checklist
//
// Module PUR. Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

export type ControlledMissionReviewQaStepId =
  | "review_types_exist"
  | "review_module_exists"
  | "review_ui_copy_exists"
  | "checklist_builder_defined"
  | "start_review_defined"
  | "approve_local_defined"
  | "request_changes_defined"
  | "block_local_defined"
  | "archive_reviewed_defined"
  | "approval_local_only"
  | "approval_does_not_execute"
  | "approval_keeps_runtime_disabled"
  | "approval_keeps_server_disabled"
  | "approval_no_real_mission"
  | "idempotent_double_approve"
  | "mission_not_found_safe"
  | "archived_not_approvable"
  | "blocked_by_guard_not_approvable"
  | "localstorage_corrupted_safe"
  | "localstorage_unavailable_safe"
  | "notes_sanitized"
  | "review_timeline_local_only"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_fetch_in_review"
  | "no_pierre_engine_import"
  | "no_execute_route_created"
  | "ui_no_execute_action"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionReviewQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionReviewQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionReviewQaStep = {
  id: ControlledMissionReviewQaStepId;
  label: string;
  severity: ControlledMissionReviewQaStepSeverity;
  status: ControlledMissionReviewQaStepStatus;
};

export type ControlledMissionReviewQaChecklist = {
  steps: ControlledMissionReviewQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.2";
  generated_at: string;
};

export type ControlledMissionReviewQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionReviewQaSummary = {
  verdict: ControlledMissionReviewQaVerdict;
  blocking_steps: ControlledMissionReviewQaStepId[];
  passed_steps: ControlledMissionReviewQaStepId[];
  pending_steps: ControlledMissionReviewQaStepId[];
  message: string;
  local_review_only: true;
};

function s(
  id: ControlledMissionReviewQaStepId,
  label: string,
  severity: ControlledMissionReviewQaStepSeverity
): ControlledMissionReviewQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionReviewQaChecklist(): ControlledMissionReviewQaChecklist {
  const steps: ControlledMissionReviewQaStep[] = [
    s("review_types_exist", "Types review présents", "blocking"),
    s("review_module_exists", "Module review présent", "blocking"),
    s("review_ui_copy_exists", "Module UI copy review présent", "blocking"),
    s("checklist_builder_defined", "buildControlledMissionReviewChecklist défini", "blocking"),
    s("start_review_defined", "startLocalControlledMissionReview défini", "blocking"),
    s("approve_local_defined", "approveLocalControlledMission défini", "blocking"),
    s("request_changes_defined", "requestChangesForLocalControlledMission défini", "blocking"),
    s("block_local_defined", "blockLocalControlledMission défini", "blocking"),
    s("archive_reviewed_defined", "archiveReviewedLocalControlledMission défini", "blocking"),
    s("approval_local_only", "Approbation locale uniquement", "blocking"),
    s("approval_does_not_execute", "Approbation n'exécute rien", "blocking"),
    s("approval_keeps_runtime_disabled", "Approbation garde runtime disabled", "blocking"),
    s("approval_keeps_server_disabled", "Approbation garde serveur disabled", "blocking"),
    s("approval_no_real_mission", "Approbation ne crée aucune mission réelle", "blocking"),
    s("idempotent_double_approve", "Double approbation idempotente", "blocking"),
    s("mission_not_found_safe", "Mission introuvable → erreur propre", "blocking"),
    s("archived_not_approvable", "Mission archivée → approbation impossible", "blocking"),
    s("blocked_by_guard_not_approvable", "Mission bloquée CloneGuard → approbation impossible", "blocking"),
    s("localstorage_corrupted_safe", "localStorage corrompu → fallback sûr", "blocking"),
    s("localstorage_unavailable_safe", "localStorage indisponible → échec propre", "blocking"),
    s("notes_sanitized", "Notes / required_changes sanitizés", "blocking"),
    s("review_timeline_local_only", "Timeline locale (local_only true)", "warning"),
    s("no_db_write", "Aucun write DB", "blocking"),
    s("no_api_post", "Aucun POST", "blocking"),
    s("no_supabase_import", "Aucun import base de données", "blocking"),
    s("no_fetch_in_review", "Aucun appel réseau dans review", "blocking"),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking"),
    s("no_execute_route_created", "Aucune route execute créée", "blocking"),
    s("ui_no_execute_action", "Aucune action Exécuter / Lancer / Envoyer", "blocking"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.2",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionReviewQaVerdict(
  steps: ControlledMissionReviewQaStep[]
): ControlledMissionReviewQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionReviewQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionReviewQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    local_review_only: true,
  };
  summary.message = summarizeControlledMissionReviewQaVerdict(summary);
  return summary;
}

export function getControlledMissionReviewBlockingSteps(): ControlledMissionReviewQaStep[] {
  return buildControlledMissionReviewQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionReviewQaVerdict(
  summary: ControlledMissionReviewQaSummary
): string {
  const lines = [
    `[QA PHASE 5.2 Controlled Mission Local Review] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Review locale uniquement — approbation locale, aucune exécution, aucun serveur.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Couche de review locale validée.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Mission non exécutée · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
