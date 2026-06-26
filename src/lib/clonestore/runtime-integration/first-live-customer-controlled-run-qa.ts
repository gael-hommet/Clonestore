// src/lib/clonestore/runtime-integration/first-live-customer-controlled-run-qa.ts
// PHASE 7.2 — First Live Customer Controlled Run — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données. Aucun import
// Pierre. Runbook / evidence gate — aucune preuve client inventée, public launch reste bloqué.

export type FlcQaStepId =
  | "types_exist"
  | "module_exists"
  | "ui_copy_exists"
  | "build_report_defined"
  | "qualification_defined"
  | "pre_sale_defined"
  | "legal_limits_defined"
  | "activation_runbook_defined"
  | "setup_runbook_defined"
  | "first_mission_defined"
  | "evidence_plan_defined"
  | "feedback_plan_defined"
  | "operator_responsibilities_defined"
  | "no_go_defined"
  | "rollback_defined"
  | "public_launch_impact_defined"
  | "go_live_policy_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_7_2"
  | "run_status_ready_to_prepare"
  | "ready_to_prepare_first_live_customer_true"
  | "first_live_customer_completed_false"
  | "real_customer_selected_false"
  | "real_payment_verified_false"
  | "contract_signed_verified_false"
  | "setup_completed_verified_false"
  | "first_value_delivered_verified_false"
  | "feedback_collected_verified_false"
  | "stripe_live_verified_false"
  | "supabase_prod_rls_verified_false"
  | "domain_email_verified_false"
  | "runtime_execution_active_false"
  | "real_email_sent_false"
  | "official_document_generated_false"
  | "public_launch_ready_false"
  | "scale_80k_proven_false"
  | "go_live_proofs_modified_false"
  | "env_modified_false"
  | "ai_call_performed_false"
  | "qualification_pme_simple"
  | "qualification_controlled_activation"
  | "qualification_no_official_payroll"
  | "pre_sale_limits"
  | "pre_sale_no_public_launch"
  | "legal_human_validation"
  | "legal_payroll_excluded"
  | "activation_ordered_steps"
  | "activation_contract"
  | "activation_setup"
  | "activation_first_mission"
  | "activation_evidence"
  | "activation_steps_verified_false"
  | "setup_company"
  | "setup_approvers"
  | "first_mission_s1_s5"
  | "first_mission_s1_or_s2_recommended"
  | "scenario_human_validation_true"
  | "scenario_runtime_false"
  | "scenario_email_false"
  | "evidence_contract"
  | "evidence_setup"
  | "evidence_first_output"
  | "evidence_feedback"
  | "evidence_collected_false"
  | "feedback_questions_present"
  | "no_go_autonomy"
  | "no_go_payroll"
  | "no_go_email_live"
  | "no_go_no_contract"
  | "rollback_suspend_access"
  | "rollback_demo_only"
  | "rollback_no_go_live_update"
  | "public_launch_impact_false"
  | "go_live_policy_manual_only"
  | "no_active_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_flc_title"
  | "ui_run_controle"
  | "ui_not_public"
  | "ui_no_invented"
  | "ui_no_active_mark_customer"
  | "ui_no_active_declare_payment"
  | "ui_no_active_modify_go_live"
  | "no_fetch_in_modules"
  | "no_stripe_import"
  | "no_supabase_import"
  | "no_openai_anthropic_import"
  | "no_pierre_engine_import"
  | "next_phase_evidence_review";

export type FlcQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type FlcQaStepSeverity = "blocking" | "warning" | "info";

export type FlcQaStep = {
  id: FlcQaStepId;
  label: string;
  severity: FlcQaStepSeverity;
  status: FlcQaStepStatus;
};

export type FlcQaChecklist = {
  steps: FlcQaStep[];
  total: number;
  blocking_count: number;
  phase: "7.2";
  generated_at: string;
};

export type FlcQaVerdict = "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type FlcQaSummary = {
  verdict: FlcQaVerdict;
  blocking_steps: FlcQaStepId[];
  passed_steps: FlcQaStepId[];
  pending_steps: FlcQaStepId[];
  message: string;
  first_live_customer_runbook_only: true;
};

function s(id: FlcQaStepId, label: string, severity: FlcQaStepSeverity): FlcQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildFirstLiveCustomerControlledRunQaChecklist(): FlcQaChecklist {
  const b = (id: FlcQaStepId, label: string) => s(id, label, "blocking");
  const steps: FlcQaStep[] = [
    b("types_exist", "Types présents"),
    b("module_exists", "Module présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_report_defined", "buildFirstLiveCustomerControlledRunReport défini"),
    b("qualification_defined", "buildCustomerQualificationMatrix défini"),
    b("pre_sale_defined", "buildPreSaleConditions défini"),
    b("legal_limits_defined", "buildLegalAndCommercialLimits défini"),
    b("activation_runbook_defined", "buildActivationRunbook défini"),
    b("setup_runbook_defined", "buildSetupRunbook défini"),
    b("first_mission_defined", "buildFirstMissionRunbook défini"),
    b("evidence_plan_defined", "buildEvidenceCollectionPlan défini"),
    b("feedback_plan_defined", "buildCustomerFeedbackPlan défini"),
    b("operator_responsibilities_defined", "buildOperatorResponsibilities défini"),
    b("no_go_defined", "buildNoGoConditions défini"),
    b("rollback_defined", "buildFirstCustomerRollbackPlan défini"),
    b("public_launch_impact_defined", "buildPublicLaunchImpact défini"),
    b("go_live_policy_defined", "buildGoLiveProofUpdatesPolicy défini"),
    b("summarize_defined", "summarizeFirstLiveCustomerControlledRunReport défini"),
    b("qa_defined", "buildFirstLiveCustomerControlledRunQaChecklist défini"),
    b("phase_7_2", "Phase 7.2"),
    b("run_status_ready_to_prepare", "run_status ready_to_prepare_first_customer"),
    b("ready_to_prepare_first_live_customer_true", "ready_to_prepare_first_live_customer true"),
    b("first_live_customer_completed_false", "first_live_customer_completed false"),
    b("real_customer_selected_false", "real_customer_selected false"),
    b("real_payment_verified_false", "real_payment_verified false"),
    b("contract_signed_verified_false", "contract_signed_verified false"),
    b("setup_completed_verified_false", "setup_completed_verified false"),
    b("first_value_delivered_verified_false", "first_value_delivered_verified false"),
    b("feedback_collected_verified_false", "feedback_collected_verified false"),
    b("stripe_live_verified_false", "stripe_live_verified false"),
    b("supabase_prod_rls_verified_false", "supabase_prod_rls_verified false"),
    b("domain_email_verified_false", "domain_email_verified false"),
    b("runtime_execution_active_false", "runtime_execution_active false"),
    b("real_email_sent_false", "real_email_sent false"),
    b("official_document_generated_false", "official_document_generated false"),
    b("public_launch_ready_false", "public_launch_ready false"),
    b("scale_80k_proven_false", "scale_80k_proven false"),
    b("go_live_proofs_modified_false", "go_live_proofs_modified false"),
    b("env_modified_false", "env_modified false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("qualification_pme_simple", "Qualification : PME simple"),
    b("qualification_controlled_activation", "Qualification : accepte activation contrôlée"),
    b("qualification_no_official_payroll", "Qualification : pas de paie officielle"),
    b("pre_sale_limits", "Pre-sale : explication des limites"),
    b("pre_sale_no_public_launch", "Pre-sale : aucune promesse public launch"),
    b("legal_human_validation", "Legal : validation humaine"),
    b("legal_payroll_excluded", "Legal : paie officielle exclue"),
    b("activation_ordered_steps", "Activation : étapes ordonnées"),
    b("activation_contract", "Activation : contrat / CGV"),
    b("activation_setup", "Activation : setup"),
    b("activation_first_mission", "Activation : première mission"),
    b("activation_evidence", "Activation : evidence"),
    b("activation_steps_verified_false", "Activation : steps verified false"),
    b("setup_company", "Setup : entreprise"),
    b("setup_approvers", "Setup : approbateurs"),
    b("first_mission_s1_s5", "First mission : S1 → S5"),
    b("first_mission_s1_or_s2_recommended", "First mission : S1 ou S2 recommandé"),
    b("scenario_human_validation_true", "Scénarios : human_validation_required true"),
    b("scenario_runtime_false", "Scénarios : runtime_execution_allowed false"),
    b("scenario_email_false", "Scénarios : real_email_allowed false"),
    b("evidence_contract", "Evidence : contrat"),
    b("evidence_setup", "Evidence : setup complété"),
    b("evidence_first_output", "Evidence : premier livrable"),
    b("evidence_feedback", "Evidence : feedback"),
    b("evidence_collected_false", "Evidence : collected false"),
    b("feedback_questions_present", "Feedback : questions présentes"),
    b("no_go_autonomy", "No-go : autonomie totale"),
    b("no_go_payroll", "No-go : paie officielle"),
    b("no_go_email_live", "No-go : email live"),
    b("no_go_no_contract", "No-go : contrat non signé"),
    b("rollback_suspend_access", "Rollback : suspendre accès"),
    b("rollback_demo_only", "Rollback : demo-only"),
    b("rollback_no_go_live_update", "Rollback : pas d'update go-live proof"),
    b("public_launch_impact_false", "Public launch impact : reste false"),
    b("go_live_policy_manual_only", "Go-live policy : manuel uniquement"),
    b("no_active_route", "Aucune route serveur active"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_flc_title", "UI : « Pierre — First Live Customer Run »"),
    b("ui_run_controle", "UI : « run contrôlé »"),
    b("ui_not_public", "UI : « ne déclare pas le lancement public »"),
    b("ui_no_invented", "UI : « Aucune preuve client n'est inventée »"),
    b("ui_no_active_mark_customer", "Aucune action « Marquer client réel validé »"),
    b("ui_no_active_declare_payment", "Aucune action « Déclarer paiement vérifié »"),
    b("ui_no_active_modify_go_live", "Aucune action « Modifier go-live proofs »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_stripe_import", "Aucun import Stripe"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_openai_anthropic_import", "Aucun import OpenAI/Anthropic"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("next_phase_evidence_review", "Prochaine phase First Customer Evidence Review", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "7.2",
    generated_at: new Date().toISOString(),
  };
}

export function buildFirstLiveCustomerControlledRunQaVerdict(
  steps: FlcQaStep[]
): FlcQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: FlcQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: FlcQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    first_live_customer_runbook_only: true,
  };
  summary.message = summarizeFirstLiveCustomerControlledRunQaVerdict(summary);
  return summary;
}

export function getFirstLiveCustomerControlledRunBlockingSteps(): FlcQaStep[] {
  return buildFirstLiveCustomerControlledRunQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeFirstLiveCustomerControlledRunQaVerdict(
  summary: FlcQaSummary
): string {
  const lines = [
    `[QA PHASE 7.2 First Live Customer Run] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Runbook premier client — aucune preuve client inventée, public launch reste bloqué.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Runbook validé. Prêt pour First Customer Evidence Review.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Premier client préparé mais non inventé · prochaine étape First Customer Evidence Review.");
  return lines.join("\n");
}
