// src/lib/clonestore/runtime-integration/controlled-mission-server-restore-qa.ts
// PHASE 5.6 — Controlled Mission Server Restore UI — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Restauration serveur design-only — n'active rien.

export type ControlledMissionServerRestoreQaStepId =
  | "types_exist"
  | "design_module_exists"
  | "ui_copy_exists"
  | "build_state_defined"
  | "display_cards_defined"
  | "timeline_defined"
  | "warnings_defined"
  | "next_steps_defined"
  | "summarize_defined"
  | "qa_defined"
  | "empty_local_clean_state"
  | "restored_count_zero"
  | "server_rows_loaded_zero"
  | "server_restore_available_false"
  | "server_get_performed_false"
  | "db_read_performed_false"
  | "server_write_performed_false"
  | "runtime_execution_performed_false"
  | "real_mission_created_false"
  | "pierre_engine_called_false"
  | "ai_call_performed_false"
  | "email_sent_false"
  | "document_generated_false"
  | "clonevoice_active_false"
  | "eligible_rows_when_ready"
  | "action_enabled_false_all"
  | "cards_server_disabled"
  | "timeline_sql_manual_review"
  | "timeline_route_get_future"
  | "timeline_still_no_execution"
  | "warnings_local_source"
  | "next_steps_future_phase"
  | "no_server_route"
  | "no_restore_get_route"
  | "no_execute_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_restore_not_active"
  | "ui_no_get_server"
  | "ui_local_only"
  | "ui_no_restore_action"
  | "no_fetch_in_modules"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionServerRestoreQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionServerRestoreQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionServerRestoreQaStep = {
  id: ControlledMissionServerRestoreQaStepId;
  label: string;
  severity: ControlledMissionServerRestoreQaStepSeverity;
  status: ControlledMissionServerRestoreQaStepStatus;
};

export type ControlledMissionServerRestoreQaChecklist = {
  steps: ControlledMissionServerRestoreQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.6";
  generated_at: string;
};

export type ControlledMissionServerRestoreQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionServerRestoreQaSummary = {
  verdict: ControlledMissionServerRestoreQaVerdict;
  blocking_steps: ControlledMissionServerRestoreQaStepId[];
  passed_steps: ControlledMissionServerRestoreQaStepId[];
  pending_steps: ControlledMissionServerRestoreQaStepId[];
  message: string;
  server_restore_design_only: true;
};

function s(
  id: ControlledMissionServerRestoreQaStepId,
  label: string,
  severity: ControlledMissionServerRestoreQaStepSeverity
): ControlledMissionServerRestoreQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionServerRestoreQaChecklist(): ControlledMissionServerRestoreQaChecklist {
  const steps: ControlledMissionServerRestoreQaStep[] = [
    s("types_exist", "Types restore présents", "blocking"),
    s("design_module_exists", "Module design restore présent", "blocking"),
    s("ui_copy_exists", "Module UI copy présent", "blocking"),
    s("build_state_defined", "buildControlledMissionServerRestoreDesignState défini", "blocking"),
    s("display_cards_defined", "buildControlledMissionServerRestoreDisplayCards défini", "blocking"),
    s("timeline_defined", "buildControlledMissionServerRestoreTimelinePreview défini", "blocking"),
    s("warnings_defined", "buildControlledMissionServerRestoreWarnings défini", "blocking"),
    s("next_steps_defined", "buildControlledMissionServerRestoreRequiredNextSteps défini", "blocking"),
    s("summarize_defined", "summarizeControlledMissionServerRestoreDesignState défini", "blocking"),
    s("qa_defined", "buildControlledMissionServerRestoreQaChecklist défini", "blocking"),
    s("empty_local_clean_state", "localMissions vide → state propre", "blocking"),
    s("restored_count_zero", "restored_count 0", "blocking"),
    s("server_rows_loaded_zero", "server_rows_loaded 0", "blocking"),
    s("server_restore_available_false", "server_restore_available false", "blocking"),
    s("server_get_performed_false", "server_get_performed false", "blocking"),
    s("db_read_performed_false", "db_read_performed false", "blocking"),
    s("server_write_performed_false", "server_write_performed false", "blocking"),
    s("runtime_execution_performed_false", "runtime_execution_performed false", "blocking"),
    s("real_mission_created_false", "real_mission_created false", "blocking"),
    s("pierre_engine_called_false", "pierre_engine_called false", "blocking"),
    s("ai_call_performed_false", "ai_call_performed false", "blocking"),
    s("email_sent_false", "email_sent false", "blocking"),
    s("document_generated_false", "document_generated false", "blocking"),
    s("clonevoice_active_false", "clonevoice_active false", "blocking"),
    s("eligible_rows_when_ready", "Missions ready → eligible_local_rows > 0", "blocking"),
    s("action_enabled_false_all", "action_enabled false sur toutes les cards", "blocking"),
    s("cards_server_disabled", "Display cards : serveur désactivé", "blocking"),
    s("timeline_sql_manual_review", "Timeline : SQL manual review", "blocking"),
    s("timeline_route_get_future", "Timeline : Route GET future", "blocking"),
    s("timeline_still_no_execution", "Timeline : Still no execution", "blocking"),
    s("warnings_local_source", "Warnings : source active localStorage", "blocking"),
    s("next_steps_future_phase", "Next steps : phase future", "blocking"),
    s("no_server_route", "Aucune route controlled-missions active", "blocking"),
    s("no_restore_get_route", "Aucune route restore GET", "blocking"),
    s("no_execute_route", "Aucune route execute", "blocking"),
    s("sql_do_not_apply", "SQL P5.4 DO NOT APPLY", "blocking"),
    s("flag_default_false", "Flag serveur default false", "blocking"),
    s("ui_restore_not_active", "UI : « Restauration serveur non active »", "blocking"),
    s("ui_no_get_server", "UI : « Aucun GET serveur »", "blocking"),
    s("ui_local_only", "UI : « Local uniquement »", "blocking"),
    s("ui_no_restore_action", "Aucune action « Restaurer depuis serveur »", "blocking"),
    s("no_fetch_in_modules", "Aucun appel réseau dans les modules", "blocking"),
    s("no_supabase_import", "Aucun import base de données", "blocking"),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.6",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionServerRestoreQaVerdict(
  steps: ControlledMissionServerRestoreQaStep[]
): ControlledMissionServerRestoreQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionServerRestoreQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionServerRestoreQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    server_restore_design_only: true,
  };
  summary.message = summarizeControlledMissionServerRestoreQaVerdict(summary);
  return summary;
}

export function getControlledMissionServerRestoreBlockingSteps(): ControlledMissionServerRestoreQaStep[] {
  return buildControlledMissionServerRestoreQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionServerRestoreQaVerdict(
  summary: ControlledMissionServerRestoreQaSummary
): string {
  const lines = [
    `[QA PHASE 5.6 Controlled Mission Server Restore UI] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Restauration serveur non active · Local uniquement · Aucun GET serveur.`,
  ];
  if (summary.verdict === "passed") lines.push("  → UI de restauration future validée (toujours non active).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Aucune exécution · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
