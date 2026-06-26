// src/lib/clonestore/runtime-integration/runtime-controlled-mission-persistence-qa.ts
// PHASE 4.10 — Controlled Mission Governed Persistence Design — QA
//
// Module PUR. Checklist QA du design de persistance gouvernée.
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.
// Aucune exécution. Aucune mission réelle. promotion_applied false.

export type RuntimeControlledMissionPersistenceQaStepId =
  | "sql_draft_exists"
  | "table_name_defined"
  | "rls_design_defined"
  | "select_insert_update_policies_defined"
  | "no_delete_policy"
  | "no_execution_constraints_defined"
  | "human_validation_constraints_defined"
  | "preview_only_constraints_defined"
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
  | "no_real_mission_created"
  | "promotion_not_applied"
  | "human_validation_required"
  | "cloneguard_preserved"
  | "clonetrace_preserved"
  | "idempotency_preserved"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "no_openai_call"
  | "no_email_or_document"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeControlledMissionPersistenceQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeControlledMissionPersistenceQaStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeControlledMissionPersistenceQaStep = {
  id: RuntimeControlledMissionPersistenceQaStepId;
  label: string;
  description: string;
  severity: RuntimeControlledMissionPersistenceQaStepSeverity;
  status: RuntimeControlledMissionPersistenceQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimeControlledMissionPersistenceQaChecklist = {
  steps: RuntimeControlledMissionPersistenceQaStep[];
  total: number;
  blocking_count: number;
  phase: "4.10";
  generated_at: string;
};

export type RuntimeControlledMissionPersistenceQaVerdict =
  | "ready"
  | "blocked"
  | "passed"
  | "needs_review"
  | "pending";

export type RuntimeControlledMissionPersistenceQaSummary = {
  verdict: RuntimeControlledMissionPersistenceQaVerdict;
  blocking_steps: RuntimeControlledMissionPersistenceQaStepId[];
  passed_steps: RuntimeControlledMissionPersistenceQaStepId[];
  pending_steps: RuntimeControlledMissionPersistenceQaStepId[];
  message: string;
  design_only: true;
};

// ── Builder ───────────────────────────────────────────────────────────────────

type Step = RuntimeControlledMissionPersistenceQaStep;

function s(
  id: RuntimeControlledMissionPersistenceQaStepId,
  label: string,
  description: string,
  severity: RuntimeControlledMissionPersistenceQaStepSeverity,
  how_to_verify: string,
  expected_result: string
): Step {
  return { id, label, description, severity, status: "pending", how_to_verify, expected_result };
}

export function buildRuntimeControlledMissionPersistenceQaChecklist(): RuntimeControlledMissionPersistenceQaChecklist {
  const steps: Step[] = [
    s("sql_draft_exists", "SQL draft présent", "PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql existe.", "blocking", "Vérifier le fichier SQL.", "SQL draft présent (non appliqué)."),
    s("table_name_defined", "Table définie", "Table clonestore_controlled_mission_candidates déclarée.", "blocking", "Lire le SQL.", "Table candidate déclarée."),
    s("rls_design_defined", "RLS conçue", "enable row level security présent.", "blocking", "Lire le SQL.", "RLS activée."),
    s("select_insert_update_policies_defined", "Policies SELECT/INSERT/UPDATE", "Policies own rows conçues.", "blocking", "Lire le SQL.", "3 policies own rows."),
    s("no_delete_policy", "Aucune policy DELETE", "Pas de policy DELETE (préservation).", "blocking", "Vérifier le SQL.", "Aucune policy DELETE."),
    s("no_execution_constraints_defined", "Contraintes no-execution", "CHECK safety_flags + governed (execution false).", "blocking", "Lire le SQL.", "Contraintes no-execution présentes."),
    s("human_validation_constraints_defined", "Contraintes validation humaine", "human_validation_required = true imposé.", "blocking", "Lire le SQL.", "human_validation_required true imposé."),
    s("preview_only_constraints_defined", "Contraintes preview_only/read_only", "preview_only = true et read_only = true imposés.", "blocking", "Lire le SQL.", "preview_only/read_only true imposés."),
    s("indexes_defined", "Index définis", "Index user_id/company_id/candidate_id/promotion_id/updated_at.", "warning", "Lire le SQL.", "Index principaux présents."),
    s("persistence_types_exist", "Types présents", "runtime-controlled-mission-persistence-types.ts existe.", "blocking", "Vérifier le fichier.", "Types présents."),
    s("persistence_flags_exist", "Flags présents", "runtime-controlled-mission-persistence-flags.ts existe.", "blocking", "Vérifier le fichier.", "Flags présents."),
    s("persistence_design_exists", "Design présent", "runtime-controlled-mission-persistence-design.ts existe.", "blocking", "Vérifier le fichier.", "Record mapper présent."),
    s("persistence_health_exists", "Health présent", "runtime-controlled-mission-persistence-health.ts existe.", "blocking", "Vérifier le fichier.", "Health/readiness présent."),
    s("localstorage_design_exists", "LocalStorage design présent", "runtime-controlled-mission-localstorage-design.ts existe.", "blocking", "Vérifier le fichier.", "LocalStorage design présent."),
    s("script_check_exists", "Script read-only présent", "check-runtime-controlled-mission-persistence-design.mjs existe.", "blocking", "Vérifier le script.", "Script read-only présent."),
    s("feature_flag_default_false", "Flag default false", "NEXT_PUBLIC_..._ENABLED default false.", "blocking", "Vérifier le flag.", "Flag default false."),
    s("no_env_auto_change", "Aucune modif .env.local auto", "Aucune modification automatique de .env.local.", "blocking", "Vérifier l'absence de modif env.", "Aucune modif .env.local."),
    s("no_sql_auto_apply", "Aucun SQL auto-appliqué", "Le SQL n'est jamais appliqué automatiquement.", "blocking", "Vérifier l'absence d'application SQL.", "SQL non appliqué auto."),
    s("no_supabase_import", "Aucun import base de données", "Les modules P4.10 n'importent pas de base de données.", "blocking", "Vérifier les imports.", "Aucun import base de données."),
    s("no_db_write", "Aucun write DB", "db_write_performed false partout.", "blocking", "Vérifier le design.", "Aucun write DB."),
    s("no_api_post", "Aucun POST", "Aucune route POST de persistance créée.", "blocking", "Vérifier l'absence de route POST.", "Aucun POST de persistance."),
    s("no_real_mission_created", "Aucune mission réelle", "Aucune mission réelle créée en base.", "blocking", "Vérifier le design.", "Aucune mission réelle."),
    s("promotion_not_applied", "Promotion non appliquée", "promotion_applied false.", "blocking", "Vérifier le design.", "promotion_applied false."),
    s("human_validation_required", "Validation humaine requise", "human_validation_required true.", "blocking", "Vérifier le design.", "human_validation_required true."),
    s("cloneguard_preserved", "CloneGuard préservé", "guard_snapshot conservé dans le candidate.", "warning", "Vérifier le payload.", "CloneGuard préservé."),
    s("clonetrace_preserved", "CloneTrace préservé", "trace_snapshot conservé dans le candidate.", "warning", "Vérifier le payload.", "CloneTrace préservé."),
    s("idempotency_preserved", "Idempotency préservée", "idempotency_snapshot conservé.", "warning", "Vérifier le payload.", "Idempotency préservée."),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "Aucun import du dossier moteur Pierre.", "blocking", "Vérifier les imports.", "Aucun import moteur Pierre."),
    s("no_cloneos_execution", "Aucune exécution CloneOS", "Aucune exécution déclenchée.", "blocking", "Vérifier l'absence d'exécution.", "Aucune exécution CloneOS."),
    s("no_clonevoice_activation", "Aucune activation CloneVoice", "CloneVoice non actif.", "blocking", "Vérifier clonevoice_active.", "CloneVoice non actif."),
    s("no_openai_call", "Aucun appel IA", "Aucun appel OpenAI/Anthropic.", "blocking", "Vérifier les modules.", "Aucun appel IA."),
    s("no_email_or_document", "Aucun email/document", "email_sent/document_generated false.", "blocking", "Vérifier les flags.", "Aucun email/document."),
    s("scale_80k_not_proven_visible", "Scale 80k non prouvé", "scale_80k_not_proven true.", "info", "Vérifier les snapshots scale.", "Scale 80k non prouvé."),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "P4.10 ne valide pas le lancement public externe.", "info", "Vérifier la doc et les flags.", "Lancement public externe non validé."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "4.10",
    generated_at: new Date().toISOString(),
  };
}

export function buildRuntimeControlledMissionPersistenceQaVerdict(
  steps: RuntimeControlledMissionPersistenceQaStep[]
): RuntimeControlledMissionPersistenceQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: RuntimeControlledMissionPersistenceQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: RuntimeControlledMissionPersistenceQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    design_only: true,
  };
  summary.message = summarizeRuntimeControlledMissionPersistenceQaVerdict(summary);
  return summary;
}

export function getRuntimeControlledMissionPersistenceBlockingSteps(): RuntimeControlledMissionPersistenceQaStep[] {
  return buildRuntimeControlledMissionPersistenceQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeRuntimeControlledMissionPersistenceQaVerdict(
  summary: RuntimeControlledMissionPersistenceQaSummary
): string {
  const lines = [
    `[QA PHASE 4.10 Controlled Mission Governed Persistence Design] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Design only — SQL non appliqué, flag default false, aucun write, promotion_applied false.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Design de persistance gouvernée validé.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  human_validation_required true · CloneGuard/CloneTrace préservés · Scale 80k non prouvé · Lancement public externe non validé.");
  return lines.join("\n");
}
