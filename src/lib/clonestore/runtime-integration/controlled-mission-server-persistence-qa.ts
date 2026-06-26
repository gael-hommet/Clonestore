// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-qa.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — QA Checklist
//
// Module PUR. Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.

export type ControlledMissionServerPersistenceQaStepId =
  | "types_exist"
  | "contract_module_exists"
  | "sql_draft_module_exists"
  | "policy_module_exists"
  | "api_contract_module_exists"
  | "ui_copy_exists"
  | "build_server_draft_defined"
  | "eligibility_defined"
  | "readiness_defined"
  | "policy_snapshot_defined"
  | "trace_snapshot_defined"
  | "sql_draft_defined"
  | "rls_policy_draft_defined"
  | "feature_flag_contract_defined"
  | "summarize_defined"
  | "approved_preflight_ready_to_server_ready"
  | "not_reviewed_blocked_missing_review"
  | "approved_without_preflight_blocked_missing_preflight"
  | "preflight_blocked_status_coherent"
  | "execution_enabled_false"
  | "runtime_execution_enabled_false"
  | "pierre_engine_enabled_false"
  | "ai_execution_enabled_false"
  | "email_sending_enabled_false"
  | "document_generation_enabled_false"
  | "clonevoice_enabled_false"
  | "runtime_status_disabled"
  | "execution_status_safe"
  | "flag_default_false"
  | "env_true_no_route_no_execution"
  | "sql_design_draft_only"
  | "sql_do_not_apply"
  | "sql_rls_enable"
  | "sql_constraints_false"
  | "api_contract_disabled_design_only"
  | "no_active_controlled_missions_route"
  | "no_execute_route"
  | "no_fetch_in_modules"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "ui_design_only_copy"
  | "ui_no_save_server_action"
  | "ui_no_create_server_mission"
  | "scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type ControlledMissionServerPersistenceQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ControlledMissionServerPersistenceQaStepSeverity = "blocking" | "warning" | "info";

export type ControlledMissionServerPersistenceQaStep = {
  id: ControlledMissionServerPersistenceQaStepId;
  label: string;
  severity: ControlledMissionServerPersistenceQaStepSeverity;
  status: ControlledMissionServerPersistenceQaStepStatus;
};

export type ControlledMissionServerPersistenceQaChecklist = {
  steps: ControlledMissionServerPersistenceQaStep[];
  total: number;
  blocking_count: number;
  phase: "5.4";
  generated_at: string;
};

export type ControlledMissionServerPersistenceQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ControlledMissionServerPersistenceQaSummary = {
  verdict: ControlledMissionServerPersistenceQaVerdict;
  blocking_steps: ControlledMissionServerPersistenceQaStepId[];
  passed_steps: ControlledMissionServerPersistenceQaStepId[];
  pending_steps: ControlledMissionServerPersistenceQaStepId[];
  message: string;
  server_persistence_design_only: true;
};

function s(
  id: ControlledMissionServerPersistenceQaStepId,
  label: string,
  severity: ControlledMissionServerPersistenceQaStepSeverity
): ControlledMissionServerPersistenceQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildControlledMissionServerPersistenceQaChecklist(): ControlledMissionServerPersistenceQaChecklist {
  const steps: ControlledMissionServerPersistenceQaStep[] = [
    s("types_exist", "Types persistance serveur présents", "blocking"),
    s("contract_module_exists", "Module contract présent", "blocking"),
    s("sql_draft_module_exists", "Module SQL draft présent", "blocking"),
    s("policy_module_exists", "Module policy/flag présent", "blocking"),
    s("api_contract_module_exists", "Module API contract présent", "blocking"),
    s("ui_copy_exists", "Module UI copy présent", "blocking"),
    s("build_server_draft_defined", "buildGovernedControlledMissionServerDraft défini", "blocking"),
    s("eligibility_defined", "validateGovernedControlledMissionServerDraftEligibility défini", "blocking"),
    s("readiness_defined", "buildControlledMissionServerPersistenceReadiness défini", "blocking"),
    s("policy_snapshot_defined", "buildControlledMissionServerPersistencePolicySnapshot défini", "blocking"),
    s("trace_snapshot_defined", "buildControlledMissionServerPersistenceTraceSnapshot défini", "blocking"),
    s("sql_draft_defined", "buildControlledMissionServerPersistenceSqlDraft défini", "blocking"),
    s("rls_policy_draft_defined", "buildControlledMissionServerPersistenceRlsPolicyDraft défini", "blocking"),
    s("feature_flag_contract_defined", "buildControlledMissionServerPersistenceFeatureFlagContract défini", "blocking"),
    s("summarize_defined", "summarizeControlledMissionServerPersistenceDraft défini", "blocking"),
    s("approved_preflight_ready_to_server_ready", "approved + preflight ready → ready_for_future_server_persistence", "blocking"),
    s("not_reviewed_blocked_missing_review", "non reviewée → blocked_missing_review", "blocking"),
    s("approved_without_preflight_blocked_missing_preflight", "approved sans preflight → blocked_missing_preflight", "blocking"),
    s("preflight_blocked_status_coherent", "preflight bloqué → statut bloqué cohérent", "blocking"),
    s("execution_enabled_false", "execution_enabled false", "blocking"),
    s("runtime_execution_enabled_false", "runtime_execution_enabled false", "blocking"),
    s("pierre_engine_enabled_false", "pierre_engine_enabled false", "blocking"),
    s("ai_execution_enabled_false", "ai_execution_enabled false", "blocking"),
    s("email_sending_enabled_false", "email_sending_enabled false", "blocking"),
    s("document_generation_enabled_false", "document_generation_enabled false", "blocking"),
    s("clonevoice_enabled_false", "clonevoice_enabled false", "blocking"),
    s("runtime_status_disabled", "runtime_status disabled", "blocking"),
    s("execution_status_safe", "execution_status sûr (not_executable/server_draft_only)", "blocking"),
    s("flag_default_false", "flag serveur default false", "blocking"),
    s("env_true_no_route_no_execution", "env true ne crée ni route ni exécution", "blocking"),
    s("sql_design_draft_only", "SQL contient DESIGN DRAFT ONLY", "blocking"),
    s("sql_do_not_apply", "SQL contient DO NOT APPLY", "blocking"),
    s("sql_rls_enable", "SQL contient enable row level security", "blocking"),
    s("sql_constraints_false", "SQL contient CHECK *_enabled = false", "blocking"),
    s("api_contract_disabled_design_only", "API contract disabled_design_only", "blocking"),
    s("no_active_controlled_missions_route", "Aucune route controlled-missions active", "blocking"),
    s("no_execute_route", "Aucune route execute", "blocking"),
    s("no_fetch_in_modules", "Aucun appel réseau dans les modules", "blocking"),
    s("no_supabase_import", "Aucun import base de données dans les modules", "blocking"),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking"),
    s("ui_design_only_copy", "UI contient le copy design-only", "blocking"),
    s("ui_no_save_server_action", "Aucune action Sauvegarder serveur", "blocking"),
    s("ui_no_create_server_mission", "Aucune action Créer mission serveur", "blocking"),
    s("scale_80k_not_proven", "Scale 80k non prouvé", "info"),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "5.4",
    generated_at: new Date().toISOString(),
  };
}

export function buildControlledMissionServerPersistenceQaVerdict(
  steps: ControlledMissionServerPersistenceQaStep[]
): ControlledMissionServerPersistenceQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ControlledMissionServerPersistenceQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ControlledMissionServerPersistenceQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    server_persistence_design_only: true,
  };
  summary.message = summarizeControlledMissionServerPersistenceQaVerdict(summary);
  return summary;
}

export function getControlledMissionServerPersistenceBlockingSteps(): ControlledMissionServerPersistenceQaStep[] {
  return buildControlledMissionServerPersistenceQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeControlledMissionServerPersistenceQaVerdict(
  summary: ControlledMissionServerPersistenceQaSummary
): string {
  const lines = [
    `[QA PHASE 5.4 Controlled Mission Server Persistence] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Design serveur uniquement — aucune persistance, aucune exécution, aucune donnée envoyée.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Design de persistance serveur validé.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Mission locale non exécutée · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}
