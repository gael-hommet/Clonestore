// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-qa.ts
// PHASE 4.11 — Controlled Mission Human Validation Workflow Design — QA
//
// Module PUR. Checklist QA du design de workflow de validation humaine.
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.
// Aucune exécution. Aucune mission réelle. approval_applied false.

export type RuntimeControlledMissionHumanValidationQaStepId =
  | "human_validation_types_exist"
  | "human_validation_policy_exists"
  | "human_validation_gates_exist"
  | "human_validation_workflow_exists"
  | "human_validation_snapshot_exists"
  | "check_script_exists"
  | "workflow_statuses_defined"
  | "decisions_defined"
  | "validators_defined"
  | "sensitive_hr_classification_defined"
  | "legal_sensitive_classification_defined"
  | "second_validator_rule_defined"
  | "hr_manager_rule_defined"
  | "legal_reviewer_rule_defined"
  | "cloneguard_gate_required"
  | "clonetrace_gate_required"
  | "no_execution_gate_required"
  | "no_real_mission_gate_required"
  | "promotion_not_applied_gate_required"
  | "approval_preview_not_execution"
  | "approved_preview_does_not_create_mission"
  | "request_changes_status_defined"
  | "rejected_status_defined"
  | "blocked_status_defined"
  | "trace_preview_defined"
  | "snapshot_defined"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "no_openai_call"
  | "no_email_or_document"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeControlledMissionHumanValidationQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeControlledMissionHumanValidationQaStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeControlledMissionHumanValidationQaStep = {
  id: RuntimeControlledMissionHumanValidationQaStepId;
  label: string;
  description: string;
  severity: RuntimeControlledMissionHumanValidationQaStepSeverity;
  status: RuntimeControlledMissionHumanValidationQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimeControlledMissionHumanValidationQaChecklist = {
  steps: RuntimeControlledMissionHumanValidationQaStep[];
  total: number;
  blocking_count: number;
  phase: "4.11";
  generated_at: string;
};

export type RuntimeControlledMissionHumanValidationQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type RuntimeControlledMissionHumanValidationQaSummary = {
  verdict: RuntimeControlledMissionHumanValidationQaVerdict;
  blocking_steps: RuntimeControlledMissionHumanValidationQaStepId[];
  passed_steps: RuntimeControlledMissionHumanValidationQaStepId[];
  pending_steps: RuntimeControlledMissionHumanValidationQaStepId[];
  message: string;
  design_only: true;
};

// ── Builder ───────────────────────────────────────────────────────────────────

type Step = RuntimeControlledMissionHumanValidationQaStep;

function s(
  id: RuntimeControlledMissionHumanValidationQaStepId,
  label: string,
  description: string,
  severity: RuntimeControlledMissionHumanValidationQaStepSeverity,
  how_to_verify: string,
  expected_result: string
): Step {
  return { id, label, description, severity, status: "pending", how_to_verify, expected_result };
}

export function buildRuntimeControlledMissionHumanValidationQaChecklist(): RuntimeControlledMissionHumanValidationQaChecklist {
  const steps: Step[] = [
    s("human_validation_types_exist", "Types présents", "Le module de types existe.", "blocking", "Vérifier le fichier.", "Types présents."),
    s("human_validation_policy_exists", "Policy présente", "Le module policy existe.", "blocking", "Vérifier le fichier.", "Policy présente."),
    s("human_validation_gates_exist", "Gates présents", "Le module gates existe.", "blocking", "Vérifier le fichier.", "Gates présents."),
    s("human_validation_workflow_exists", "Workflow présent", "Le module workflow existe.", "blocking", "Vérifier le fichier.", "Workflow présent."),
    s("human_validation_snapshot_exists", "Snapshot présent", "Le module snapshot existe.", "blocking", "Vérifier le fichier.", "Snapshot présent."),
    s("check_script_exists", "Script read-only présent", "Le script check existe.", "blocking", "Vérifier le script.", "Script présent."),
    s("workflow_statuses_defined", "Statuts définis", "not_started → cancelled définis.", "blocking", "Vérifier les types.", "Statuts définis."),
    s("decisions_defined", "Décisions définies", "approve_preview/request_changes/reject/block/escalate.", "blocking", "Vérifier les types.", "Décisions définies."),
    s("validators_defined", "Validateurs définis", "validator/second_validator/hr_manager/legal_reviewer.", "blocking", "Vérifier les types.", "Validateurs définis."),
    s("sensitive_hr_classification_defined", "Classification RH sensible", "sensitive_hr classification définie.", "blocking", "Vérifier la policy.", "Classification RH sensible définie."),
    s("legal_sensitive_classification_defined", "Classification juridique", "legal_sensitive classification définie.", "blocking", "Vérifier la policy.", "Classification juridique définie."),
    s("second_validator_rule_defined", "Règle second validateur", "requiresRuntimeControlledMissionSecondValidator définie.", "blocking", "Vérifier la policy.", "Règle second validateur définie."),
    s("hr_manager_rule_defined", "Règle HR manager", "requiresRuntimeControlledMissionHrManager définie.", "blocking", "Vérifier la policy.", "Règle HR manager définie."),
    s("legal_reviewer_rule_defined", "Règle revue légale", "requiresRuntimeControlledMissionLegalReviewer définie.", "blocking", "Vérifier la policy.", "Règle revue légale définie."),
    s("cloneguard_gate_required", "Gate CloneGuard", "cloneguard_required gate obligatoire.", "blocking", "Vérifier les gates.", "CloneGuard gate obligatoire."),
    s("clonetrace_gate_required", "Gate CloneTrace", "clonetrace_required gate obligatoire.", "blocking", "Vérifier les gates.", "CloneTrace gate obligatoire."),
    s("no_execution_gate_required", "Gate no-execution", "no_execution_required gate obligatoire.", "blocking", "Vérifier les gates.", "No-execution gate obligatoire."),
    s("no_real_mission_gate_required", "Gate no-real-mission", "no_real_mission_required gate obligatoire.", "blocking", "Vérifier les gates.", "No-real-mission gate obligatoire."),
    s("promotion_not_applied_gate_required", "Gate promotion non appliquée", "promotion_not_applied_required gate obligatoire.", "blocking", "Vérifier les gates.", "Promotion-not-applied gate obligatoire."),
    s("approval_preview_not_execution", "Approbation ≠ exécution", "approval_preview n'exécute rien.", "blocking", "Vérifier le workflow.", "Aucune exécution sur approbation."),
    s("approved_preview_does_not_create_mission", "Approbation ≠ mission", "approved_preview ne crée aucune mission.", "blocking", "Vérifier le workflow.", "Aucune mission créée sur approbation."),
    s("request_changes_status_defined", "Statut changes_requested", "changes_requested défini.", "warning", "Vérifier les types.", "changes_requested défini."),
    s("rejected_status_defined", "Statut rejected", "rejected défini.", "warning", "Vérifier les types.", "rejected défini."),
    s("blocked_status_defined", "Statut blocked", "blocked défini.", "warning", "Vérifier les types.", "blocked défini."),
    s("trace_preview_defined", "Trace preview", "trace preview définie.", "warning", "Vérifier le workflow.", "Trace preview définie."),
    s("snapshot_defined", "Snapshot défini", "snapshot UI défini.", "warning", "Vérifier le snapshot.", "Snapshot défini."),
    s("no_db_write", "Aucun write DB", "Aucun write base de données.", "blocking", "Vérifier les modules.", "Aucun write DB."),
    s("no_api_post", "Aucun POST", "Aucune route POST approve/reject.", "blocking", "Vérifier l'absence de route POST.", "Aucun POST."),
    s("no_supabase_import", "Aucun import base de données", "Aucun import base de données.", "blocking", "Vérifier les imports.", "Aucun import base de données."),
    s("no_pierre_engine_import", "Aucun import moteur Pierre", "Aucun import du dossier moteur Pierre.", "blocking", "Vérifier les imports.", "Aucun import moteur Pierre."),
    s("no_cloneos_execution", "Aucune exécution CloneOS", "Aucune exécution déclenchée.", "blocking", "Vérifier l'absence d'exécution.", "Aucune exécution CloneOS."),
    s("no_clonevoice_activation", "Aucune activation CloneVoice", "CloneVoice non actif.", "blocking", "Vérifier clonevoice_active.", "CloneVoice non actif."),
    s("no_openai_call", "Aucun appel IA", "Aucun appel OpenAI/Anthropic.", "blocking", "Vérifier les modules.", "Aucun appel IA."),
    s("no_email_or_document", "Aucun email/document", "email_sent/document_generated false.", "blocking", "Vérifier les flags.", "Aucun email/document."),
    s("scale_80k_not_proven_visible", "Scale 80k non prouvé", "scale_80k_not_proven true.", "info", "Vérifier les snapshots scale.", "Scale 80k non prouvé."),
    s("public_launch_external_not_validated", "Lancement public externe non validé", "P4.11 ne valide pas le lancement public externe.", "info", "Vérifier la doc et les flags.", "Lancement public externe non validé."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "4.11",
    generated_at: new Date().toISOString(),
  };
}

export function buildRuntimeControlledMissionHumanValidationQaVerdict(
  steps: RuntimeControlledMissionHumanValidationQaStep[]
): RuntimeControlledMissionHumanValidationQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: RuntimeControlledMissionHumanValidationQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: RuntimeControlledMissionHumanValidationQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    design_only: true,
  };
  summary.message = summarizeRuntimeControlledMissionHumanValidationQaVerdict(summary);
  return summary;
}

export function getRuntimeControlledMissionHumanValidationBlockingSteps(): RuntimeControlledMissionHumanValidationQaStep[] {
  return buildRuntimeControlledMissionHumanValidationQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeRuntimeControlledMissionHumanValidationQaVerdict(
  summary: RuntimeControlledMissionHumanValidationQaSummary
): string {
  const lines = [
    `[QA PHASE 4.11 Controlled Mission Human Validation Workflow] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Design only — approbation en aperçu, aucune mission réelle, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Workflow de validation humaine validé (design).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Validation humaine requise · CloneGuard/CloneTrace obligatoires · Scale 80k non prouvé · Lancement public externe non validé.");
  return lines.join("\n");
}
