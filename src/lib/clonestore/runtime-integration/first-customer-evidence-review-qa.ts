// src/lib/clonestore/runtime-integration/first-customer-evidence-review-qa.ts
// PHASE 7.3 — First Customer Evidence Review — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données. Aucun import
// Pierre. Review gate — aucune preuve inventée ni auto-validée, public launch reste bloqué.

export type FcerQaStepId =
  | "types_exist"
  | "module_exists"
  | "ui_copy_exists"
  | "build_report_defined"
  | "matrix_defined"
  | "required_categories_defined"
  | "verification_rules_defined"
  | "success_criteria_defined"
  | "failure_criteria_defined"
  | "partial_criteria_defined"
  | "quality_scores_defined"
  | "public_launch_gate_defined"
  | "go_live_recommendation_defined"
  | "continuation_recommendation_defined"
  | "operator_checklist_defined"
  | "legal_checklist_defined"
  | "technical_checklist_defined"
  | "decision_matrix_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_7_3"
  | "review_status_ready_to_review"
  | "ready_to_review_first_customer_evidence_true"
  | "first_customer_evidence_review_completed_false"
  | "real_customer_verified_false"
  | "real_payment_verified_false"
  | "contract_signed_verified_false"
  | "setup_completed_verified_false"
  | "first_value_delivered_verified_false"
  | "feedback_collected_verified_false"
  | "evidence_complete_verified_false"
  | "go_live_proof_update_allowed_false"
  | "public_launch_ready_false"
  | "scale_80k_proven_false"
  | "runtime_execution_active_false"
  | "real_email_sent_false"
  | "official_document_generated_false"
  | "go_live_proofs_modified_false"
  | "env_modified_false"
  | "ai_call_performed_false"
  | "matrix_12_categories"
  | "matrix_status_missing"
  | "matrix_verified_false"
  | "required_real_customer"
  | "required_contract"
  | "required_first_output"
  | "rules_dated_proof"
  | "rules_verifiable_proof"
  | "rules_no_auto_validation"
  | "success_real_customer"
  | "success_human_validation"
  | "failure_absent_contract"
  | "failure_unverifiable_evidence"
  | "partial_non_empty"
  | "quality_scores_zero"
  | "launch_gate_blocked"
  | "launch_gate_one_customer_not_enough"
  | "launch_gate_requires_external"
  | "go_live_recommendation_false"
  | "go_live_recommendation_manual_only"
  | "continuation_request_more_evidence"
  | "decision_matrix_a_e"
  | "decision_matrix_public_false"
  | "no_active_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_fcer_title"
  | "ui_real_only"
  | "ui_no_auto_validation"
  | "ui_not_public"
  | "ui_no_active_mark_evidence"
  | "ui_no_active_declare_public"
  | "ui_no_active_modify_go_live"
  | "no_fetch_in_modules"
  | "no_stripe_import"
  | "no_supabase_import"
  | "no_openai_anthropic_import"
  | "no_pierre_engine_import"
  | "next_phase_evidence_applied";

export type FcerQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type FcerQaStepSeverity = "blocking" | "warning" | "info";

export type FcerQaStep = {
  id: FcerQaStepId;
  label: string;
  severity: FcerQaStepSeverity;
  status: FcerQaStepStatus;
};

export type FcerQaChecklist = {
  steps: FcerQaStep[];
  total: number;
  blocking_count: number;
  phase: "7.3";
  generated_at: string;
};

export type FcerQaVerdict = "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type FcerQaSummary = {
  verdict: FcerQaVerdict;
  blocking_steps: FcerQaStepId[];
  passed_steps: FcerQaStepId[];
  pending_steps: FcerQaStepId[];
  message: string;
  evidence_review_gate_only: true;
};

function s(id: FcerQaStepId, label: string, severity: FcerQaStepSeverity): FcerQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildFirstCustomerEvidenceReviewQaChecklist(): FcerQaChecklist {
  const b = (id: FcerQaStepId, label: string) => s(id, label, "blocking");
  const steps: FcerQaStep[] = [
    b("types_exist", "Types présents"),
    b("module_exists", "Module présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_report_defined", "buildFirstCustomerEvidenceReviewReport défini"),
    b("matrix_defined", "buildEvidenceReviewMatrix défini"),
    b("required_categories_defined", "buildRequiredEvidenceCategories défini"),
    b("verification_rules_defined", "buildVerificationRules défini"),
    b("success_criteria_defined", "buildSuccessCriteria défini"),
    b("failure_criteria_defined", "buildFailureCriteria défini"),
    b("partial_criteria_defined", "buildPartialSuccessCriteria défini"),
    b("quality_scores_defined", "buildEvidenceQualityScores défini"),
    b("public_launch_gate_defined", "buildPublicLaunchDecisionGate défini"),
    b("go_live_recommendation_defined", "buildGoLiveProofUpdateRecommendation défini"),
    b("continuation_recommendation_defined", "buildCustomerContinuationRecommendation défini"),
    b("operator_checklist_defined", "buildOperatorReviewChecklist défini"),
    b("legal_checklist_defined", "buildLegalCommercialReviewChecklist défini"),
    b("technical_checklist_defined", "buildTechnicalReviewChecklist défini"),
    b("decision_matrix_defined", "buildPostRunDecisionMatrix défini"),
    b("summarize_defined", "summarizeFirstCustomerEvidenceReviewReport défini"),
    b("qa_defined", "buildFirstCustomerEvidenceReviewQaChecklist défini"),
    b("phase_7_3", "Phase 7.3"),
    b("review_status_ready_to_review", "review_status ready_to_review_when_evidence_exists"),
    b("ready_to_review_first_customer_evidence_true", "ready_to_review_first_customer_evidence true"),
    b("first_customer_evidence_review_completed_false", "first_customer_evidence_review_completed false"),
    b("real_customer_verified_false", "real_customer_verified false"),
    b("real_payment_verified_false", "real_payment_verified false"),
    b("contract_signed_verified_false", "contract_signed_verified false"),
    b("setup_completed_verified_false", "setup_completed_verified false"),
    b("first_value_delivered_verified_false", "first_value_delivered_verified false"),
    b("feedback_collected_verified_false", "feedback_collected_verified false"),
    b("evidence_complete_verified_false", "evidence_complete_verified false"),
    b("go_live_proof_update_allowed_false", "go_live_proof_update_allowed false"),
    b("public_launch_ready_false", "public_launch_ready false"),
    b("scale_80k_proven_false", "scale_80k_proven false"),
    b("runtime_execution_active_false", "runtime_execution_active false"),
    b("real_email_sent_false", "real_email_sent false"),
    b("official_document_generated_false", "official_document_generated false"),
    b("go_live_proofs_modified_false", "go_live_proofs_modified false"),
    b("env_modified_false", "env_modified false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("matrix_12_categories", "Matrice : 12 catégories"),
    b("matrix_status_missing", "Matrice : status missing partout"),
    b("matrix_verified_false", "Matrice : verified false partout"),
    b("required_real_customer", "Required : client réel"),
    b("required_contract", "Required : contrat"),
    b("required_first_output", "Required : premier livrable"),
    b("rules_dated_proof", "Règles : preuve datée"),
    b("rules_verifiable_proof", "Règles : preuve vérifiable"),
    b("rules_no_auto_validation", "Règles : aucune auto-validation"),
    b("success_real_customer", "Success : client réel"),
    b("success_human_validation", "Success : validation humaine"),
    b("failure_absent_contract", "Failure : contrat absent"),
    b("failure_unverifiable_evidence", "Failure : evidence non vérifiable"),
    b("partial_non_empty", "Partial : non vide"),
    b("quality_scores_zero", "Scores qualité : 0"),
    b("launch_gate_blocked", "Public launch gate : bloqué"),
    b("launch_gate_one_customer_not_enough", "Public launch gate : un client ne suffit pas"),
    b("launch_gate_requires_external", "Public launch gate : preuves externes requises"),
    b("go_live_recommendation_false", "Go-live recommendation : update false"),
    b("go_live_recommendation_manual_only", "Go-live recommendation : manuel uniquement"),
    b("continuation_request_more_evidence", "Continuation : request_more_evidence"),
    b("decision_matrix_a_e", "Decision matrix : A → E"),
    b("decision_matrix_public_false", "Decision matrix : public launch false"),
    b("no_active_route", "Aucune route serveur active"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_fcer_title", "UI : « Pierre — First Customer Evidence Review »"),
    b("ui_real_only", "UI : « preuves réelles uniquement »"),
    b("ui_no_auto_validation", "UI : « ne valide aucune preuve sans élément réel »"),
    b("ui_not_public", "UI : « ne suffit pas à déclarer le lancement public »"),
    b("ui_no_active_mark_evidence", "Aucune action « Marquer evidence complete »"),
    b("ui_no_active_declare_public", "Aucune action « Déclarer public launch »"),
    b("ui_no_active_modify_go_live", "Aucune action « Modifier go-live proofs »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_stripe_import", "Aucun import Stripe"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_openai_anthropic_import", "Aucun import OpenAI/Anthropic"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("next_phase_evidence_applied", "Prochaine phase Customer Evidence Applied / Second Controlled Customer", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "7.3",
    generated_at: new Date().toISOString(),
  };
}

export function buildFirstCustomerEvidenceReviewQaVerdict(
  steps: FcerQaStep[]
): FcerQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: FcerQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: FcerQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    evidence_review_gate_only: true,
  };
  summary.message = summarizeFirstCustomerEvidenceReviewQaVerdict(summary);
  return summary;
}

export function getFirstCustomerEvidenceReviewBlockingSteps(): FcerQaStep[] {
  return buildFirstCustomerEvidenceReviewQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeFirstCustomerEvidenceReviewQaVerdict(
  summary: FcerQaSummary
): string {
  const lines = [
    `[QA PHASE 7.3 First Customer Evidence Review] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Review gate — aucune preuve inventée ni auto-validée, public launch reste bloqué.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Audit validé. Prêt pour Customer Evidence Applied / Second Controlled Customer.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Un premier client réussi ne suffit pas au public launch · prochaine étape Customer Evidence Applied.");
  return lines.join("\n");
}
