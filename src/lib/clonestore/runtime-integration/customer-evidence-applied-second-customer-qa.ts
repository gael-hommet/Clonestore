// src/lib/clonestore/runtime-integration/customer-evidence-applied-second-customer-qa.ts
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données. Aucun import
// Pierre. Evidence application planning gate — aucune preuve inventée ni auto-appliquée, public
// launch reste bloqué.

export type CeaQaStepId =
  | "types_exist"
  | "module_exists"
  | "ui_copy_exists"
  | "build_report_defined"
  | "application_matrix_defined"
  | "applied_categories_defined"
  | "unapplied_categories_defined"
  | "go_live_contribution_defined"
  | "continuation_plan_defined"
  | "second_customer_prep_defined"
  | "selection_criteria_defined"
  | "multi_customer_base_defined"
  | "comparison_plan_defined"
  | "safety_gate_defined"
  | "application_rules_defined"
  | "operator_checklist_defined"
  | "second_customer_runbook_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_7_4"
  | "application_status_ready_to_apply"
  | "ready_to_apply_true"
  | "evidence_applied_false"
  | "real_evidence_available_false"
  | "go_live_contribution_applied_false"
  | "first_customer_success_declared_false"
  | "second_customer_selected_false"
  | "second_customer_started_false"
  | "second_customer_completed_false"
  | "multi_customer_evidence_ready_false"
  | "public_launch_ready_false"
  | "scale_80k_proven_false"
  | "stripe_live_verified_false"
  | "supabase_prod_rls_verified_false"
  | "domain_email_verified_false"
  | "runtime_execution_active_false"
  | "real_email_sent_false"
  | "official_document_generated_false"
  | "go_live_proofs_modified_false"
  | "env_modified_false"
  | "ai_call_performed_false"
  | "matrix_categories"
  | "matrix_not_applied"
  | "matrix_applied_false"
  | "applied_categories_empty"
  | "unapplied_categories_non_empty"
  | "contribution_currently_eligible_false"
  | "contribution_auto_update_false"
  | "continuation_request_more_evidence"
  | "second_customer_prep_ready_false"
  | "selection_simple_client"
  | "selection_s1_s2"
  | "multi_customer_count_zero"
  | "multi_customer_base_not_ready"
  | "comparison_plan_non_empty"
  | "safety_gate_blocked"
  | "safety_gate_first_not_enough"
  | "safety_gate_second_not_enough"
  | "safety_gate_requires_external"
  | "application_rules_no_auto"
  | "operator_no_public_launch"
  | "second_customer_runbook_can_start_false"
  | "no_active_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_cea_title"
  | "ui_application_controlee"
  | "ui_no_apply_without_real"
  | "ui_not_public"
  | "ui_no_active_apply_evidence"
  | "ui_no_active_modify_go_live"
  | "ui_no_active_start_customer2"
  | "no_fetch_in_modules"
  | "no_stripe_import"
  | "no_supabase_import"
  | "no_openai_anthropic_import"
  | "no_pierre_engine_import"
  | "next_phase_second_customer";

export type CeaQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type CeaQaStepSeverity = "blocking" | "warning" | "info";

export type CeaQaStep = {
  id: CeaQaStepId;
  label: string;
  severity: CeaQaStepSeverity;
  status: CeaQaStepStatus;
};

export type CeaQaChecklist = {
  steps: CeaQaStep[];
  total: number;
  blocking_count: number;
  phase: "7.4";
  generated_at: string;
};

export type CeaQaVerdict = "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type CeaQaSummary = {
  verdict: CeaQaVerdict;
  blocking_steps: CeaQaStepId[];
  passed_steps: CeaQaStepId[];
  pending_steps: CeaQaStepId[];
  message: string;
  evidence_application_gate_only: true;
};

function s(id: CeaQaStepId, label: string, severity: CeaQaStepSeverity): CeaQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildCustomerEvidenceAppliedSecondCustomerQaChecklist(): CeaQaChecklist {
  const b = (id: CeaQaStepId, label: string) => s(id, label, "blocking");
  const steps: CeaQaStep[] = [
    b("types_exist", "Types présents"),
    b("module_exists", "Module présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_report_defined", "buildCustomerEvidenceAppliedSecondCustomerReport défini"),
    b("application_matrix_defined", "buildReviewedEvidenceApplicationMatrix défini"),
    b("applied_categories_defined", "buildAppliedEvidenceCategories défini"),
    b("unapplied_categories_defined", "buildUnappliedEvidenceCategories défini"),
    b("go_live_contribution_defined", "buildGoLiveContributionMatrix défini"),
    b("continuation_plan_defined", "buildFirstCustomerContinuationPlan défini"),
    b("second_customer_prep_defined", "buildSecondCustomerPreparationMatrix défini"),
    b("selection_criteria_defined", "buildSecondCustomerSelectionCriteria défini"),
    b("multi_customer_base_defined", "buildMultiCustomerEvidenceBase défini"),
    b("comparison_plan_defined", "buildCustomer1VsCustomer2ComparisonPlan défini"),
    b("safety_gate_defined", "buildPublicLaunchSafetyGate défini"),
    b("application_rules_defined", "buildEvidenceApplicationRules défini"),
    b("operator_checklist_defined", "buildOperatorApplyChecklist défini"),
    b("second_customer_runbook_defined", "buildSecondCustomerRunbook défini"),
    b("summarize_defined", "summarizeCustomerEvidenceAppliedSecondCustomerReport défini"),
    b("qa_defined", "buildCustomerEvidenceAppliedSecondCustomerQaChecklist défini"),
    b("phase_7_4", "Phase 7.4"),
    b("application_status_ready_to_apply", "application_status ready_to_apply_when_verified"),
    b("ready_to_apply_true", "ready_to_apply_customer_evidence_when_verified true"),
    b("evidence_applied_false", "evidence_applied false"),
    b("real_evidence_available_false", "real_evidence_available false"),
    b("go_live_contribution_applied_false", "go_live_contribution_applied false"),
    b("first_customer_success_declared_false", "first_customer_success_declared false"),
    b("second_customer_selected_false", "second_customer_selected false"),
    b("second_customer_started_false", "second_customer_started false"),
    b("second_customer_completed_false", "second_customer_completed false"),
    b("multi_customer_evidence_ready_false", "multi_customer_evidence_ready false"),
    b("public_launch_ready_false", "public_launch_ready false"),
    b("scale_80k_proven_false", "scale_80k_proven false"),
    b("stripe_live_verified_false", "stripe_live_verified false"),
    b("supabase_prod_rls_verified_false", "supabase_prod_rls_verified false"),
    b("domain_email_verified_false", "domain_email_verified false"),
    b("runtime_execution_active_false", "runtime_execution_active false"),
    b("real_email_sent_false", "real_email_sent false"),
    b("official_document_generated_false", "official_document_generated false"),
    b("go_live_proofs_modified_false", "go_live_proofs_modified false"),
    b("env_modified_false", "env_modified false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("matrix_categories", "Matrice : 9 catégories"),
    b("matrix_not_applied", "Matrice : application_decision not_applied"),
    b("matrix_applied_false", "Matrice : applied false"),
    b("applied_categories_empty", "Applied categories : vide"),
    b("unapplied_categories_non_empty", "Unapplied categories : non vide"),
    b("contribution_currently_eligible_false", "Contribution : currently_eligible false"),
    b("contribution_auto_update_false", "Contribution : auto_update_allowed false"),
    b("continuation_request_more_evidence", "Continuation : request_more_evidence"),
    b("second_customer_prep_ready_false", "Client 2 prep : ready false"),
    b("selection_simple_client", "Sélection : client simple"),
    b("selection_s1_s2", "Sélection : S1 ou S2"),
    b("multi_customer_count_zero", "Multi-client : count 0"),
    b("multi_customer_base_not_ready", "Multi-client : base non prête"),
    b("comparison_plan_non_empty", "Comparison plan : non vide"),
    b("safety_gate_blocked", "Safety gate : bloqué"),
    b("safety_gate_first_not_enough", "Safety gate : un client ne suffit pas"),
    b("safety_gate_second_not_enough", "Safety gate : deux clients ne suffisent pas seuls"),
    b("safety_gate_requires_external", "Safety gate : preuves externes/légal/support requises"),
    b("application_rules_no_auto", "Règles : aucune auto-application"),
    b("operator_no_public_launch", "Operator : ne pas déclarer public launch"),
    b("second_customer_runbook_can_start_false", "Runbook client 2 : can_start_now false"),
    b("no_active_route", "Aucune route serveur active"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_cea_title", "UI : « Pierre — Customer Evidence Applied »"),
    b("ui_application_controlee", "UI : « application contrôlée »"),
    b("ui_no_apply_without_real", "UI : « Aucune preuve n'est appliquée sans vérification réelle »"),
    b("ui_not_public", "UI : « ne suffisent pas à déclarer le lancement public »"),
    b("ui_no_active_apply_evidence", "Aucune action « Appliquer preuve »"),
    b("ui_no_active_modify_go_live", "Aucune action « Modifier go-live proofs »"),
    b("ui_no_active_start_customer2", "Aucune action « Démarrer client 2 »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_stripe_import", "Aucun import Stripe"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_openai_anthropic_import", "Aucun import OpenAI/Anthropic"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("next_phase_second_customer", "Prochaine phase Second Customer Controlled Run / Public Launch Review Prep", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "7.4",
    generated_at: new Date().toISOString(),
  };
}

export function buildCustomerEvidenceAppliedSecondCustomerQaVerdict(
  steps: CeaQaStep[]
): CeaQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: CeaQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: CeaQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    evidence_application_gate_only: true,
  };
  summary.message = summarizeCustomerEvidenceAppliedSecondCustomerQaVerdict(summary);
  return summary;
}

export function getCustomerEvidenceAppliedSecondCustomerBlockingSteps(): CeaQaStep[] {
  return buildCustomerEvidenceAppliedSecondCustomerQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeCustomerEvidenceAppliedSecondCustomerQaVerdict(
  summary: CeaQaSummary
): string {
  const lines = [
    `[QA PHASE 7.4 Customer Evidence Applied] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Evidence application gate — aucune preuve inventée ni auto-appliquée, public launch reste bloqué.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Application validée. Prêt pour Second Customer Controlled Run / Public Launch Review Prep.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Un ou deux clients ne suffisent pas au public launch · prochaine étape Second Customer Controlled Run.");
  return lines.join("\n");
}
