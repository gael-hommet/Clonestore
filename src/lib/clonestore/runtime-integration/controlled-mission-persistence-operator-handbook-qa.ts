// src/lib/clonestore/runtime-integration/controlled-mission-persistence-operator-handbook-qa.ts
// PHASE 5.9 — Controlled Mission Persistence Operator Handbook — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Handbook opérateur design-only — n'active rien.

export type ControlledMissionHandbookQaStepId =
  | "types_exist"
  | "handbook_module_exists"
  | "ui_copy_exists"
  | "build_handbook_defined"
  | "glossary_defined"
  | "workflows_defined"
  | "verification_playbooks_defined"
  | "incident_playbooks_defined"
  | "rollback_playbook_defined"
  | "evidence_checklist_defined"
  | "command_reference_defined"
  | "decision_matrix_defined"
  | "summarize_defined"
  | "qa_defined"
  | "documentation_ready_true"
  | "activation_performed_false"
  | "server_persistence_active_false"
  | "server_restore_active_false"
  | "runtime_execution_active_false"
  | "pierre_runtime_active_false"
  | "sql_applied_false"
  | "env_modified_false"
  | "route_created_false"
  | "server_get_performed_false"
  | "server_post_performed_false"
  | "server_write_performed_false"
  | "server_restore_performed_false"
  | "real_mission_created_false"
  | "ai_call_performed_false"
  | "email_sent_false"
  | "document_generated_false"
  | "clonevoice_active_false"
  | "current_state_localstorage"
  | "active_capabilities_create_local"
  | "inactive_capabilities_server_persistence"
  | "glossary_persistence_not_execution"
  | "glossary_restore_not_execution"
  | "glossary_sync_not_execution"
  | "glossary_rls"
  | "workflows_w1_to_w10"
  | "each_workflow_no_execution"
  | "each_workflow_forbidden_not_empty"
  | "verification_no_route"
  | "verification_no_get_post"
  | "verification_no_execution"
  | "incident_sql_applied"
  | "incident_flag_enabled"
  | "rollback_disable_flag"
  | "rollback_localstorage_only"
  | "evidence_sql_do_not_apply"
  | "evidence_flag_false"
  | "command_test_phase5_9"
  | "command_check_handbook"
  | "decision_preflight_forbidden_execute"
  | "decision_final_gate_forbidden_production"
  | "no_active_route"
  | "no_restore_get_route"
  | "no_post_route"
  | "no_execute_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_handbook_design_only"
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

export type ControlledMissionHandbookQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionHandbookQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionHandbookQaStep = {
  id: ControlledMissionHandbookQaStepId;
  label: string;
  severity: ControlledMissionHandbookQaStepSeverity;
  status: ControlledMissionHandbookQaStepStatus;
};

export type ControlledMissionHandbookQaChecklist = {
  steps: ControlledMissionHandbookQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.9";
  generated_at: string;
};

export type ControlledMissionHandbookQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionHandbookQaSummary = {
  verdict: ControlledMissionHandbookQaVerdict;
  blocking_steps: ControlledMissionHandbookQaStepId[];
  passed_steps: ControlledMissionHandbookQaStepId[];
  pending_steps: ControlledMissionHandbookQaStepId[];
  message: string;
  operator_handbook_design_only: true;
};

function s(
  id: ControlledMissionHandbookQaStepId,
  label: string,
  severity: ControlledMissionHandbookQaStepSeverity
): ControlledMissionHandbookQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionPersistenceOperatorHandbookQaChecklist(): ControlledMissionHandbookQaChecklist {
  const b = (id: ControlledMissionHandbookQaStepId, label: string) => s(id, label, "blocking");
  const steps: ControlledMissionHandbookQaStep[] = [
    b("types_exist", "Types handbook présents"),
    b("handbook_module_exists", "Module handbook présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_handbook_defined", "buildControlledMissionPersistenceOperatorHandbook défini"),
    b("glossary_defined", "buildControlledMissionPersistenceOperatorGlossary défini"),
    b("workflows_defined", "buildControlledMissionPersistenceOperatorWorkflows défini"),
    b("verification_playbooks_defined", "buildControlledMissionPersistenceVerificationPlaybooks défini"),
    b("incident_playbooks_defined", "buildControlledMissionPersistenceIncidentPlaybooks défini"),
    b("rollback_playbook_defined", "buildControlledMissionPersistenceRollbackPlaybook défini"),
    b("evidence_checklist_defined", "buildControlledMissionPersistenceEvidenceChecklist défini"),
    b("command_reference_defined", "buildControlledMissionPersistenceCommandReference défini"),
    b("decision_matrix_defined", "buildControlledMissionPersistenceDecisionMatrix défini"),
    b("summarize_defined", "summarizeControlledMissionPersistenceOperatorHandbook défini"),
    b("qa_defined", "buildControlledMissionPersistenceOperatorHandbookQaChecklist défini"),
    b("documentation_ready_true", "documentation_ready true"),
    b("activation_performed_false", "activation_performed false"),
    b("server_persistence_active_false", "server_persistence_active false"),
    b("server_restore_active_false", "server_restore_active false"),
    b("runtime_execution_active_false", "runtime_execution_active false"),
    b("pierre_runtime_active_false", "pierre_runtime_active false"),
    b("sql_applied_false", "sql_applied false"),
    b("env_modified_false", "env_modified false"),
    b("route_created_false", "route_created false"),
    b("server_get_performed_false", "server_get_performed false"),
    b("server_post_performed_false", "server_post_performed false"),
    b("server_write_performed_false", "server_write_performed false"),
    b("server_restore_performed_false", "server_restore_performed false"),
    b("real_mission_created_false", "real_mission_created false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("email_sent_false", "email_sent false"),
    b("document_generated_false", "document_generated false"),
    b("clonevoice_active_false", "clonevoice_active false"),
    b("current_state_localstorage", "Current state : localStorage source active"),
    b("active_capabilities_create_local", "Active : créer Controlled Mission locale"),
    b("inactive_capabilities_server_persistence", "Inactive : server persistence"),
    b("glossary_persistence_not_execution", "Glossaire : persistence ≠ execution"),
    b("glossary_restore_not_execution", "Glossaire : restore ≠ execution"),
    b("glossary_sync_not_execution", "Glossaire : sync ≠ execution"),
    b("glossary_rls", "Glossaire : RLS"),
    b("workflows_w1_to_w10", "Workflows W1 → W10"),
    b("each_workflow_no_execution", "Chaque workflow no_execution_confirmed"),
    b("each_workflow_forbidden_not_empty", "Chaque workflow forbidden_actions non vide"),
    b("verification_no_route", "Verification : no route"),
    b("verification_no_get_post", "Verification : no GET/POST"),
    b("verification_no_execution", "Verification : no execution"),
    b("incident_sql_applied", "Incident : SQL appliqué"),
    b("incident_flag_enabled", "Incident : flag activé"),
    b("rollback_disable_flag", "Rollback : disable flag"),
    b("rollback_localstorage_only", "Rollback : localStorage-only"),
    b("evidence_sql_do_not_apply", "Evidence : SQL DO NOT APPLY"),
    b("evidence_flag_false", "Evidence : flag false"),
    b("command_test_phase5_9", "Command : test:phase5-9"),
    b("command_check_handbook", "Command : check handbook"),
    b("decision_preflight_forbidden_execute", "Decision : preflight ready → forbidden execute"),
    b("decision_final_gate_forbidden_production", "Decision : final gate → forbidden production launch"),
    b("no_active_route", "Aucune route controlled-missions active"),
    b("no_restore_get_route", "Aucune route restore GET"),
    b("no_post_route", "Aucune route POST active"),
    b("no_execute_route", "Aucune route execute"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_handbook_design_only", "UI : « Handbook opérateur design-only »"),
    b("ui_no_activation", "UI : « Aucune activation »"),
    b("ui_no_get_post_server", "UI : « Aucun GET/POST serveur »"),
    b("ui_no_active_apply_sql", "Aucune action « Appliquer SQL »"),
    b("ui_no_active_activate_flag", "Aucune action « Activer flag »"),
    b("ui_no_active_execute", "Aucune action « Exécuter » active"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.9",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionPersistenceOperatorHandbookQaVerdict(
  steps: ControlledMissionHandbookQaStep[]
): ControlledMissionHandbookQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionHandbookQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionHandbookQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    operator_handbook_design_only: true,
  };
  summary.message = summarizeControlledMissionPersistenceOperatorHandbookQaVerdict(summary);
  return summary;
}

export function getControlledMissionPersistenceOperatorHandbookBlockingSteps(): ControlledMissionHandbookQaStep[] {
  return buildControlledMissionPersistenceOperatorHandbookQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionPersistenceOperatorHandbookQaVerdict(
  summary: ControlledMissionHandbookQaSummary
): string {
  const lines = [
    `[QA PHASE 5.9 Controlled Mission Operator Handbook] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Handbook opérateur design-only — aucune activation, aucune route, aucun GET/POST serveur, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Handbook opérateur validé (toujours design-only).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  persistence ≠ execution · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
