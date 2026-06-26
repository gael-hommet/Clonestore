// src/lib/clonestore/runtime-integration/second-customer-controlled-run-public-launch-prep-qa.ts
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données. Aucun import
// Pierre. Runbook / planning gate — client 2 préparé mais non démarré, aucune preuve inventée,
// public launch reste bloqué.

export type Sc2QaStepId =
  | "types_exist"
  | "module_exists"
  | "ui_copy_exists"
  | "build_report_defined"
  | "qualification_defined"
  | "pre_sale_defined"
  | "activation_runbook_defined"
  | "setup_runbook_defined"
  | "scenario_matrix_defined"
  | "evidence_plan_defined"
  | "comparison_matrix_defined"
  | "reproducibility_defined"
  | "multi_customer_readiness_defined"
  | "public_launch_review_prep_defined"
  | "blocker_matrix_defined"
  | "review_inputs_defined"
  | "operator_checklist_defined"
  | "rollback_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_7_5"
  | "run_status_ready_to_prepare"
  | "ready_to_prepare_second_customer_true"
  | "second_customer_selected_false"
  | "second_customer_started_false"
  | "second_customer_completed_false"
  | "second_customer_evidence_collected_false"
  | "customer_comparison_completed_false"
  | "reproducibility_verified_false"
  | "multi_customer_evidence_ready_false"
  | "public_launch_review_ready_false"
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
  | "qualification_simple_client"
  | "qualification_controlled_run"
  | "qualification_no_official_payroll"
  | "pre_sale_no_public_launch"
  | "activation_ordered"
  | "activation_contract"
  | "activation_setup"
  | "activation_mission"
  | "activation_comparison"
  | "activation_steps_verified_false"
  | "activation_steps_cannot_start_now"
  | "setup_company"
  | "setup_differences_customer_1"
  | "scenarios_s1_s5"
  | "scenarios_s1_s2_recommended"
  | "scenarios_s5_not_recommended"
  | "scenario_human_validation_true"
  | "scenario_runtime_false"
  | "evidence_collected_false"
  | "comparison_values_null"
  | "comparison_status_not_compared"
  | "reproducibility_scores_zero"
  | "multi_customer_count_zero"
  | "multi_customer_not_ready"
  | "public_launch_review_not_ready"
  | "public_launch_decision_blocked"
  | "blocker_matrix_complete"
  | "review_inputs_verified_false"
  | "operator_no_public_launch"
  | "rollback_present"
  | "no_active_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_sc2_title"
  | "ui_run_controle"
  | "ui_not_started"
  | "ui_not_public"
  | "ui_no_active_start_customer2"
  | "ui_no_active_declare_reproducibility"
  | "ui_no_active_declare_public"
  | "no_fetch_in_modules"
  | "no_stripe_import"
  | "no_supabase_import"
  | "no_openai_anthropic_import"
  | "no_pierre_engine_import"
  | "next_phase_public_launch_review";

export type Sc2QaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type Sc2QaStepSeverity = "blocking" | "warning" | "info";

export type Sc2QaStep = {
  id: Sc2QaStepId;
  label: string;
  severity: Sc2QaStepSeverity;
  status: Sc2QaStepStatus;
};

export type Sc2QaChecklist = {
  steps: Sc2QaStep[];
  total: number;
  blocking_count: number;
  phase: "7.5";
  generated_at: string;
};

export type Sc2QaVerdict = "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type Sc2QaSummary = {
  verdict: Sc2QaVerdict;
  blocking_steps: Sc2QaStepId[];
  passed_steps: Sc2QaStepId[];
  pending_steps: Sc2QaStepId[];
  message: string;
  second_customer_runbook_only: true;
};

function s(id: Sc2QaStepId, label: string, severity: Sc2QaStepSeverity): Sc2QaStep {
  return { id, label, severity, status: "pending" };
}

export function buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist(): Sc2QaChecklist {
  const b = (id: Sc2QaStepId, label: string) => s(id, label, "blocking");
  const steps: Sc2QaStep[] = [
    b("types_exist", "Types présents"),
    b("module_exists", "Module présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_report_defined", "buildSecondCustomerControlledRunPublicLaunchPrepReport défini"),
    b("qualification_defined", "buildSecondCustomerQualificationMatrix défini"),
    b("pre_sale_defined", "buildSecondCustomerPreSaleConditions défini"),
    b("activation_runbook_defined", "buildSecondCustomerActivationRunbook défini"),
    b("setup_runbook_defined", "buildSecondCustomerSetupRunbook défini"),
    b("scenario_matrix_defined", "buildSecondCustomerScenarioMatrix défini"),
    b("evidence_plan_defined", "buildSecondCustomerEvidencePlan défini"),
    b("comparison_matrix_defined", "buildCustomer1VsCustomer2ComparisonMatrix défini"),
    b("reproducibility_defined", "buildReproducibilityAssessment défini"),
    b("multi_customer_readiness_defined", "buildMultiCustomerEvidenceReadiness défini"),
    b("public_launch_review_prep_defined", "buildPublicLaunchReviewPrep défini"),
    b("blocker_matrix_defined", "buildPublicLaunchBlockerMatrix défini"),
    b("review_inputs_defined", "buildPublicLaunchReviewInputs défini"),
    b("operator_checklist_defined", "buildSecondCustomerOperatorChecklist défini"),
    b("rollback_defined", "buildSecondCustomerRollbackPlan défini"),
    b("summarize_defined", "summarizeSecondCustomerControlledRunPublicLaunchPrepReport défini"),
    b("qa_defined", "buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist défini"),
    b("phase_7_5", "Phase 7.5"),
    b("run_status_ready_to_prepare", "run_status ready_to_prepare_second_customer"),
    b("ready_to_prepare_second_customer_true", "ready_to_prepare_second_customer true"),
    b("second_customer_selected_false", "second_customer_selected false"),
    b("second_customer_started_false", "second_customer_started false"),
    b("second_customer_completed_false", "second_customer_completed false"),
    b("second_customer_evidence_collected_false", "second_customer_evidence_collected false"),
    b("customer_comparison_completed_false", "customer_comparison_completed false"),
    b("reproducibility_verified_false", "reproducibility_verified false"),
    b("multi_customer_evidence_ready_false", "multi_customer_evidence_ready false"),
    b("public_launch_review_ready_false", "public_launch_review_ready false"),
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
    b("qualification_simple_client", "Qualification : client simple"),
    b("qualification_controlled_run", "Qualification : accepte run contrôlé"),
    b("qualification_no_official_payroll", "Qualification : pas de paie officielle"),
    b("pre_sale_no_public_launch", "Pre-sale : aucune promesse public launch"),
    b("activation_ordered", "Activation : étapes ordonnées"),
    b("activation_contract", "Activation : contrat"),
    b("activation_setup", "Activation : setup"),
    b("activation_mission", "Activation : mission"),
    b("activation_comparison", "Activation : comparaison"),
    b("activation_steps_verified_false", "Activation : steps verified false"),
    b("activation_steps_cannot_start_now", "Activation : can_start_now false"),
    b("setup_company", "Setup : entreprise"),
    b("setup_differences_customer_1", "Setup : différences avec client 1"),
    b("scenarios_s1_s5", "Scénarios : S1 → S5"),
    b("scenarios_s1_s2_recommended", "Scénarios : S1/S2 recommandés"),
    b("scenarios_s5_not_recommended", "Scénarios : S5 non recommandé"),
    b("scenario_human_validation_true", "Scénarios : human_validation_required true"),
    b("scenario_runtime_false", "Scénarios : runtime_execution_allowed false"),
    b("evidence_collected_false", "Evidence : collected false"),
    b("comparison_values_null", "Comparaison : valeurs null"),
    b("comparison_status_not_compared", "Comparaison : status not_compared"),
    b("reproducibility_scores_zero", "Reproductibilité : scores 0"),
    b("multi_customer_count_zero", "Multi-client : count 0"),
    b("multi_customer_not_ready", "Multi-client : non prête"),
    b("public_launch_review_not_ready", "Public launch review : non prête"),
    b("public_launch_decision_blocked", "Public launch : bloqué"),
    b("blocker_matrix_complete", "Blocker matrix : complète"),
    b("review_inputs_verified_false", "Review inputs : verified false"),
    b("operator_no_public_launch", "Operator : ne pas déclarer public launch"),
    b("rollback_present", "Rollback présent"),
    b("no_active_route", "Aucune route serveur active"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_sc2_title", "UI : « Pierre — Second Customer Controlled Run »"),
    b("ui_run_controle", "UI : « run contrôlé »"),
    b("ui_not_started", "UI : « il ne le démarre pas »"),
    b("ui_not_public", "UI : « lancement public reste bloqué »"),
    b("ui_no_active_start_customer2", "Aucune action « Démarrer client 2 »"),
    b("ui_no_active_declare_reproducibility", "Aucune action « Déclarer reproductibilité »"),
    b("ui_no_active_declare_public", "Aucune action « Déclarer public launch »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_stripe_import", "Aucun import Stripe"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_openai_anthropic_import", "Aucun import OpenAI/Anthropic"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("next_phase_public_launch_review", "Prochaine phase Public Launch Final Review Gate", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "7.5",
    generated_at: new Date().toISOString(),
  };
}

export function buildSecondCustomerControlledRunPublicLaunchPrepQaVerdict(
  steps: Sc2QaStep[]
): Sc2QaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: Sc2QaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: Sc2QaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    second_customer_runbook_only: true,
  };
  summary.message = summarizeSecondCustomerControlledRunPublicLaunchPrepQaVerdict(summary);
  return summary;
}

export function getSecondCustomerControlledRunPublicLaunchPrepBlockingSteps(): Sc2QaStep[] {
  return buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeSecondCustomerControlledRunPublicLaunchPrepQaVerdict(
  summary: Sc2QaSummary
): string {
  const lines = [
    `[QA PHASE 7.5 Second Customer Run] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Runbook client 2 — client 2 non démarré, comparaison multi-client à prouver, public launch bloqué.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Runbook validé. Prêt pour Public Launch Final Review Gate.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Client 2 préparé mais non démarré · prochaine étape Public Launch Final Review Gate.");
  return lines.join("\n");
}
