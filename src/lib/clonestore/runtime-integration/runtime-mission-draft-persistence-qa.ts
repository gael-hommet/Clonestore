// src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-qa.ts
// PHASE 4.4 — Runtime Mission Draft Persistence Design — QA Module
//
// Module pur. Pas de Supabase, pas d'API, pas de write, pas d'import Pierre.

export type RuntimeMissionDraftPersistenceQaStepId =
  | "sql_draft_exists"
  | "table_name_defined"
  | "rls_design_defined"
  | "select_insert_update_policies_defined"
  | "no_delete_policy"
  | "safety_flags_constraints_defined"
  | "indexes_defined"
  | "persistence_types_exist"
  | "persistence_flags_exist"
  | "persistence_design_exists"
  | "persistence_health_exists"
  | "localstorage_design_exists"
  | "script_check_exists"
  | "feature_flag_default_false"
  | "no_env_auto_change"
  | "no_sql_auto_apply"
  | "no_supabase_import"
  | "no_db_write"
  | "no_api_post"
  | "no_mission_created"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionDraftPersistenceQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type RuntimeMissionDraftPersistenceQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimeMissionDraftPersistenceQaStep = {
  id: RuntimeMissionDraftPersistenceQaStepId;
  label: string;
  severity: RuntimeMissionDraftPersistenceQaStepSeverity;
  status: RuntimeMissionDraftPersistenceQaStepStatus;
  expected_result: string;
};

export type RuntimeMissionDraftPersistenceQaChecklist = {
  steps: RuntimeMissionDraftPersistenceQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "4.4";
};

export type RuntimeMissionDraftPersistenceQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type RuntimeMissionDraftPersistenceQaSummary = {
  verdict: RuntimeMissionDraftPersistenceQaVerdict;
  blocking_steps: RuntimeMissionDraftPersistenceQaStepId[];
  passed_steps: RuntimeMissionDraftPersistenceQaStepId[];
  pending_steps: RuntimeMissionDraftPersistenceQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

export function buildRuntimeMissionDraftPersistenceQaChecklist(): RuntimeMissionDraftPersistenceQaChecklist {
  const mk = (
    id: RuntimeMissionDraftPersistenceQaStepId,
    label: string,
    severity: RuntimeMissionDraftPersistenceQaStepSeverity,
    expected_result: string
  ): RuntimeMissionDraftPersistenceQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: RuntimeMissionDraftPersistenceQaStep[] = [
    mk("sql_draft_exists", "SQL draft présent", "blocking", "PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql présent."),
    mk("table_name_defined", "Table définie", "blocking", "clonestore_runtime_mission_drafts."),
    mk("rls_design_defined", "RLS design défini", "blocking", "enable row level security."),
    mk("select_insert_update_policies_defined", "Policies select/insert/update", "blocking", "3 policies own."),
    mk("no_delete_policy", "Aucune policy DELETE", "blocking", "Pas de DELETE policy."),
    mk("safety_flags_constraints_defined", "Contraintes safety_flags", "blocking", "CHECK no_execution."),
    mk("indexes_defined", "Index définis", "warning", "user_id/company_id/draft_id/updated_at."),
    mk("persistence_types_exist", "Types persistence présents", "blocking", "persistence-types.ts."),
    mk("persistence_flags_exist", "Flags présents", "blocking", "persistence-flags.ts."),
    mk("persistence_design_exists", "Design présent", "blocking", "persistence-design.ts."),
    mk("persistence_health_exists", "Health présent", "blocking", "persistence-health.ts."),
    mk("localstorage_design_exists", "LocalStorage design présent", "blocking", "localstorage-design.ts."),
    mk("script_check_exists", "Script check présent", "blocking", "check-runtime-mission-draft-persistence-design.mjs."),
    mk("feature_flag_default_false", "Flag default false", "blocking", "default false."),
    mk("no_env_auto_change", "Aucune modif .env.local auto", "blocking", ".env.local non modifié."),
    mk("no_sql_auto_apply", "Aucun SQL appliqué auto", "blocking", "SQL non appliqué par le code."),
    mk("no_supabase_import", "Aucun import Supabase", "blocking", "Pas de @supabase/supabase-js."),
    mk("no_db_write", "Aucun write DB", "blocking", "db_write_performed false."),
    mk("no_api_post", "Aucune route POST de persistance", "blocking", "Aucune route créée."),
    mk("no_mission_created", "Aucune mission créée", "blocking", "Aucune mission en base."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking", "Pas de @/lib/pierre."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS", "blocking", "Aucune exécution."),
    mk("no_clonevoice_activation", "Aucune activation CloneVoice", "blocking", "CloneVoice non actif."),
    mk("scale_80k_not_proven_visible", "Scale 80k non prouvé visible", "info", "scale_80k_not_proven."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "4.4",
  };
}

export function buildRuntimeMissionDraftPersistenceQaVerdict(
  steps: RuntimeMissionDraftPersistenceQaStep[]
): RuntimeMissionDraftPersistenceQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionDraftPersistenceQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: RuntimeMissionDraftPersistenceQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeMissionDraftPersistenceQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionDraftPersistenceBlockingSteps(): RuntimeMissionDraftPersistenceQaStep[] {
  return buildRuntimeMissionDraftPersistenceQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionDraftPersistenceQaVerdict(
  summary: RuntimeMissionDraftPersistenceQaSummary
): string {
  return [
    `[QA PHASE 4.4 Persistence Design] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to activate : ${summary.safe_to_activate}`,
    `  Design only — SQL non appliqué, flag default false. Scale 80k non prouvé. Lancement public externe : non validé.`,
  ].join("\n");
}
