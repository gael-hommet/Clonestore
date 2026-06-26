// src/lib/clonestore/runtime-integration/controlled-mission-persistence-transition-plan-qa.ts
// PHASE 5.8 — Controlled Mission Persistence Transition Plan — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Plan de transition design-only — n'active rien.

export type ControlledMissionTransitionQaStepId =
  | "types_exist"
  | "plan_module_exists"
  | "ui_copy_exists"
  | "build_plan_defined"
  | "phases_defined"
  | "milestones_defined"
  | "risks_defined"
  | "rollback_defined"
  | "data_consistency_defined"
  | "no_execution_policy_defined"
  | "score_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phases_t1_to_t8_present"
  | "score_deterministic"
  | "score_within_0_100"
  | "transition_active_false"
  | "sql_applied_false"
  | "env_modified_false"
  | "route_created_false"
  | "server_get_performed_false"
  | "server_post_performed_false"
  | "server_write_performed_false"
  | "server_restore_performed_false"
  | "runtime_execution_performed_false"
  | "real_mission_created_false"
  | "pierre_engine_called_false"
  | "ai_call_performed_false"
  | "email_sent_false"
  | "document_generated_false"
  | "clonevoice_active_false"
  | "current_source_localstorage"
  | "future_source_server"
  | "each_phase_activation_false"
  | "each_phase_no_execution_confirmed"
  | "forbidden_actions_not_empty"
  | "rollback_disable_flag"
  | "rollback_localstorage_only"
  | "data_consistency_idempotency"
  | "data_consistency_no_silent_overwrite"
  | "no_execution_persistence_not_execution"
  | "no_execution_restore_not_execution"
  | "no_execution_sync_not_execution"
  | "no_active_route"
  | "no_restore_get_route"
  | "no_post_route"
  | "no_execute_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_transition_design_only"
  | "ui_no_activation"
  | "ui_no_get_post_server"
  | "ui_no_active_apply_sql"
  | "ui_no_active_activate_flag"
  | "ui_no_active_execute"
  | "no_fetch_in_modules"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionTransitionQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionTransitionQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionTransitionQaStep = {
  id: ControlledMissionTransitionQaStepId;
  label: string;
  severity: ControlledMissionTransitionQaStepSeverity;
  status: ControlledMissionTransitionQaStepStatus;
};

export type ControlledMissionTransitionQaChecklist = {
  steps: ControlledMissionTransitionQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.8";
  generated_at: string;
};

export type ControlledMissionTransitionQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionTransitionQaSummary = {
  verdict: ControlledMissionTransitionQaVerdict;
  blocking_steps: ControlledMissionTransitionQaStepId[];
  passed_steps: ControlledMissionTransitionQaStepId[];
  pending_steps: ControlledMissionTransitionQaStepId[];
  message: string;
  transition_plan_design_only: true;
};

function s(
  id: ControlledMissionTransitionQaStepId,
  label: string,
  severity: ControlledMissionTransitionQaStepSeverity
): ControlledMissionTransitionQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionPersistenceTransitionPlanQaChecklist(): ControlledMissionTransitionQaChecklist {
  const steps: ControlledMissionTransitionQaStep[] = [
    s("types_exist", "Types transition présents", "blocking"),
    s("plan_module_exists", "Module plan présent", "blocking"),
    s("ui_copy_exists", "Module UI copy présent", "blocking"),
    s("build_plan_defined", "buildControlledMissionPersistenceTransitionPlan défini", "blocking"),
    s("phases_defined", "buildControlledMissionPersistenceTransitionPhases défini", "blocking"),
    s("milestones_defined", "buildControlledMissionPersistenceTransitionMilestones défini", "blocking"),
    s("risks_defined", "buildControlledMissionPersistenceTransitionRisks défini", "blocking"),
    s("rollback_defined", "buildControlledMissionPersistenceRollbackPlan défini", "blocking"),
    s("data_consistency_defined", "buildControlledMissionPersistenceDataConsistencyPolicy défini", "blocking"),
    s("no_execution_policy_defined", "buildControlledMissionPersistenceNoExecutionPolicy défini", "blocking"),
    s("score_defined", "computeControlledMissionPersistenceTransitionScore défini", "blocking"),
    s("summarize_defined", "summarizeControlledMissionPersistenceTransitionPlan défini", "blocking"),
    s("qa_defined", "buildControlledMissionPersistenceTransitionPlanQaChecklist défini", "blocking"),
    s("phases_t1_to_t8_present", "Phases T1 → T8 présentes", "blocking"),
    s("score_deterministic", "Score déterministe", "blocking"),
    s("score_within_0_100", "Score entre 0 et 100", "blocking"),
    s("transition_active_false", "transition_active false", "blocking"),
    s("sql_applied_false", "sql_applied false", "blocking"),
    s("env_modified_false", "env_modified false", "blocking"),
    s("route_created_false", "route_created false", "blocking"),
    s("server_get_performed_false", "server_get_performed false", "blocking"),
    s("server_post_performed_false", "server_post_performed false", "blocking"),
    s("server_write_performed_false", "server_write_performed false", "blocking"),
    s("server_restore_performed_false", "server_restore_performed false", "blocking"),
    s("runtime_execution_performed_false", "runtime_execution_performed false", "blocking"),
    s("real_mission_created_false", "real_mission_created false", "blocking"),
    s("pierre_engine_called_false", "pierre_engine_called false", "blocking"),
    s("ai_call_performed_false", "ai_call_performed false", "blocking"),
    s("email_sent_false", "email_sent false", "blocking"),
    s("document_generated_false", "document_generated false", "blocking"),
    s("clonevoice_active_false", "clonevoice_active false", "blocking"),
    s("current_source_localstorage", "current_source localStorage", "blocking"),
    s("future_source_server", "future_source server_persistence", "blocking"),
    s("each_phase_activation_false", "Chaque phase activation_performed false", "blocking"),
    s("each_phase_no_execution_confirmed", "Chaque phase no_execution_confirmed true", "blocking"),
    s("forbidden_actions_not_empty", "forbidden_actions non vides", "blocking"),
    s("rollback_disable_flag", "Rollback : disable flag", "blocking"),
    s("rollback_localstorage_only", "Rollback : localStorage-only", "blocking"),
    s("data_consistency_idempotency", "Data consistency : idempotency", "blocking"),
    s("data_consistency_no_silent_overwrite", "Data consistency : no silent overwrite", "blocking"),
    s("no_execution_persistence_not_execution", "No-execution : persistence ≠ execution", "blocking"),
    s("no_execution_restore_not_execution", "No-execution : restore ≠ execution", "blocking"),
    s("no_execution_sync_not_execution", "No-execution : sync ≠ execution", "blocking"),
    s("no_active_route", "Aucune route controlled-missions active", "blocking"),
    s("no_restore_get_route", "Aucune route restore GET", "blocking"),
    s("no_post_route", "Aucune route POST active", "blocking"),
    s("no_execute_route", "Aucune route execute", "blocking"),
    s("sql_do_not_apply", "SQL P5.4 DO NOT APPLY", "blocking"),
    s("flag_default_false", "Flag serveur default false", "blocking"),
    s("ui_transition_design_only", "UI : « Plan de transition design-only »", "blocking"),
    s("ui_no_activation", "UI : « Aucune activation »", "blocking"),
    s("ui_no_get_post_server", "UI : « Aucun GET/POST serveur »", "blocking"),
    s("ui_no_active_apply_sql", "Aucune action « Appliquer SQL »", "blocking"),
    s("ui_no_active_activate_flag", "Aucune action « Activer flag »", "blocking"),
    s("ui_no_active_execute", "Aucune action « Exécuter » active", "blocking"),
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
    phase: "5.8",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionPersistenceTransitionPlanQaVerdict(
  steps: ControlledMissionTransitionQaStep[]
): ControlledMissionTransitionQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionTransitionQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionTransitionQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    transition_plan_design_only: true,
  };
  summary.message = summarizeControlledMissionPersistenceTransitionPlanQaVerdict(summary);
  return summary;
}

export function getControlledMissionPersistenceTransitionPlanBlockingSteps(): ControlledMissionTransitionQaStep[] {
  return buildControlledMissionPersistenceTransitionPlanQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionPersistenceTransitionPlanQaVerdict(
  summary: ControlledMissionTransitionQaSummary
): string {
  const lines = [
    `[QA PHASE 5.8 Controlled Mission Transition Plan] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Plan de transition design-only — aucune activation, aucune route, aucun GET/POST serveur, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Plan de transition validé (toujours design-only).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  persistence ≠ execution · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
