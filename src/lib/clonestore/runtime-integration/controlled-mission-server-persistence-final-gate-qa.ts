// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-final-gate-qa.ts
// PHASE 5.7 — Controlled Mission Server Persistence Final Gate — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Final gate design-only — n'active rien.

export type ControlledMissionFinalGateQaStepId =
  | "types_exist"
  | "final_gate_module_exists"
  | "ui_copy_exists"
  | "sections_defined"
  | "score_defined"
  | "verdict_defined"
  | "evidence_defined"
  | "command_matrix_defined"
  | "invariants_defined"
  | "report_defined"
  | "summarize_defined"
  | "sections_a_to_h_present"
  | "score_deterministic"
  | "score_within_0_100"
  | "verdict_never_production_ready"
  | "verdict_never_execution_ready"
  | "completed_blocks_p51_p56"
  | "global_no_execution_section_passed"
  | "launch_scale_section_warning"
  | "phase_closure_true"
  | "server_persistence_active_false"
  | "server_restore_active_false"
  | "runtime_execution_active_false"
  | "pierre_runtime_active_false"
  | "sql_applied_false"
  | "env_modified_false"
  | "route_created_false"
  | "server_get_performed_false"
  | "server_write_performed_false"
  | "real_mission_created_false"
  | "ai_call_performed_false"
  | "email_sent_false"
  | "document_generated_false"
  | "clonevoice_active_false"
  | "command_matrix_has_phase5_7"
  | "no_active_route"
  | "no_restore_get_route"
  | "no_execute_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_final_gate_design_only"
  | "ui_no_activation"
  | "ui_no_active_apply_sql"
  | "ui_no_active_execute"
  | "no_fetch_in_modules"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionFinalGateQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionFinalGateQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionFinalGateQaStep = {
  id: ControlledMissionFinalGateQaStepId;
  label: string;
  severity: ControlledMissionFinalGateQaStepSeverity;
  status: ControlledMissionFinalGateQaStepStatus;
};

export type ControlledMissionFinalGateQaChecklist = {
  steps: ControlledMissionFinalGateQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.7";
  generated_at: string;
};

export type ControlledMissionFinalGateQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionFinalGateQaSummary = {
  verdict: ControlledMissionFinalGateQaVerdict;
  blocking_steps: ControlledMissionFinalGateQaStepId[];
  passed_steps: ControlledMissionFinalGateQaStepId[];
  pending_steps: ControlledMissionFinalGateQaStepId[];
  message: string;
  final_gate_design_only: true;
};

function s(
  id: ControlledMissionFinalGateQaStepId,
  label: string,
  severity: ControlledMissionFinalGateQaStepSeverity
): ControlledMissionFinalGateQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionServerPersistenceFinalGateQaChecklist(): ControlledMissionFinalGateQaChecklist {
  const steps: ControlledMissionFinalGateQaStep[] = [
    s("types_exist", "Types final gate présents", "blocking"),
    s("final_gate_module_exists", "Module final gate présent", "blocking"),
    s("ui_copy_exists", "Module UI copy présent", "blocking"),
    s("sections_defined", "buildControlledMissionServerPersistenceFinalGateSections défini", "blocking"),
    s("score_defined", "computeControlledMissionServerPersistenceFinalGateScore défini", "blocking"),
    s("verdict_defined", "evaluateControlledMissionServerPersistenceFinalGateVerdict défini", "blocking"),
    s("evidence_defined", "buildControlledMissionServerPersistenceFinalGateEvidence défini", "blocking"),
    s("command_matrix_defined", "buildControlledMissionServerPersistenceFinalGateCommandMatrix défini", "blocking"),
    s("invariants_defined", "buildControlledMissionServerPersistenceFinalGateInvariants défini", "blocking"),
    s("report_defined", "buildControlledMissionServerPersistenceFinalGateReport défini", "blocking"),
    s("summarize_defined", "summarizeControlledMissionServerPersistenceFinalGate défini", "blocking"),
    s("sections_a_to_h_present", "Sections A→H présentes", "blocking"),
    s("score_deterministic", "Score déterministe", "blocking"),
    s("score_within_0_100", "Score entre 0 et 100", "blocking"),
    s("verdict_never_production_ready", "Verdict jamais production ready", "blocking"),
    s("verdict_never_execution_ready", "Verdict jamais execution ready", "blocking"),
    s("completed_blocks_p51_p56", "completed_blocks P5.1→P5.6", "blocking"),
    s("global_no_execution_section_passed", "Section no-execution passed", "blocking"),
    s("launch_scale_section_warning", "Section launch/scale warning", "blocking"),
    s("phase_closure_true", "phase_closure true", "blocking"),
    s("server_persistence_active_false", "server_persistence_active false", "blocking"),
    s("server_restore_active_false", "server_restore_active false", "blocking"),
    s("runtime_execution_active_false", "runtime_execution_active false", "blocking"),
    s("pierre_runtime_active_false", "pierre_runtime_active false", "blocking"),
    s("sql_applied_false", "sql_applied false", "blocking"),
    s("env_modified_false", "env_modified false", "blocking"),
    s("route_created_false", "route_created false", "blocking"),
    s("server_get_performed_false", "server_get_performed false", "blocking"),
    s("server_write_performed_false", "server_write_performed false", "blocking"),
    s("real_mission_created_false", "real_mission_created false", "blocking"),
    s("ai_call_performed_false", "ai_call_performed false", "blocking"),
    s("email_sent_false", "email_sent false", "blocking"),
    s("document_generated_false", "document_generated false", "blocking"),
    s("clonevoice_active_false", "clonevoice_active false", "blocking"),
    s("command_matrix_has_phase5_7", "Command matrix contient test:phase5-7", "blocking"),
    s("no_active_route", "Aucune route controlled-missions active", "blocking"),
    s("no_restore_get_route", "Aucune route restore GET", "blocking"),
    s("no_execute_route", "Aucune route execute", "blocking"),
    s("sql_do_not_apply", "SQL P5.4 DO NOT APPLY", "blocking"),
    s("flag_default_false", "Flag serveur default false", "blocking"),
    s("ui_final_gate_design_only", "UI : « Final Gate design-only »", "blocking"),
    s("ui_no_activation", "UI : « Aucune activation »", "blocking"),
    s("ui_no_active_apply_sql", "Aucune action « Appliquer SQL »", "blocking"),
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
    phase: "5.7",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionServerPersistenceFinalGateQaVerdict(
  steps: ControlledMissionFinalGateQaStep[]
): ControlledMissionFinalGateQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionFinalGateQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionFinalGateQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    final_gate_design_only: true,
  };
  summary.message = summarizeControlledMissionServerPersistenceFinalGateQaVerdict(summary);
  return summary;
}

export function getControlledMissionServerPersistenceFinalGateBlockingSteps(): ControlledMissionFinalGateQaStep[] {
  return buildControlledMissionServerPersistenceFinalGateQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionServerPersistenceFinalGateQaVerdict(
  summary: ControlledMissionFinalGateQaSummary
): string {
  const lines = [
    `[QA PHASE 5.7 Controlled Mission Final Gate] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Final Gate design-only — aucune activation, aucune production, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Fermeture P5 validée (toujours design-only).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Persistance serveur inactive · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
