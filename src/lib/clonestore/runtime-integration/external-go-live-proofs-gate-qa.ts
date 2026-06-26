// src/lib/clonestore/runtime-integration/external-go-live-proofs-gate-qa.ts
// PHASE 7.1 — External Go-Live Proofs Gate — QA Checklist
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données. Aucun import
// Pierre. Gate de preuves externes — aucune preuve inventée, public launch reste bloqué sans
// preuve réelle.

export type ExternalGoLiveQaStepId =
  | "types_exist"
  | "module_exists"
  | "ui_copy_exists"
  | "build_report_defined"
  | "stripe_matrix_defined"
  | "supabase_matrix_defined"
  | "domain_email_matrix_defined"
  | "first_live_customer_matrix_defined"
  | "evidence_required_defined"
  | "evidence_collected_defined"
  | "blockers_defined"
  | "manual_steps_defined"
  | "rollback_plan_defined"
  | "summarize_defined"
  | "qa_defined"
  | "phase_7_1"
  | "ready_for_first_live_customer_controlled_run_true"
  | "external_go_live_proofs_ready_false"
  | "public_launch_ready_false"
  | "stripe_live_verified_false"
  | "supabase_prod_rls_verified_false"
  | "domain_email_verified_false"
  | "first_live_customer_verified_false"
  | "scale_80k_proven_false"
  | "real_payment_performed_false"
  | "real_email_sent_false"
  | "runtime_execution_active_false"
  | "env_modified_false"
  | "go_live_proofs_modified_false"
  | "ai_call_performed_false"
  | "proof_status_manual_proof_required"
  | "public_launch_verdict_blocked"
  | "first_live_customer_conditional"
  | "evidence_collected_empty"
  | "classification_a_documented"
  | "classification_b_manual"
  | "classification_d_blocking"
  | "stripe_live_transaction_blocking"
  | "supabase_rls_blocking"
  | "domain_spf_dkim_dmarc_blocking"
  | "first_customer_e2e_blocking"
  | "manual_steps_human_action"
  | "manual_steps_no_auto_apply"
  | "rollback_plan_present"
  | "go_live_proofs_reference_readonly"
  | "no_active_route"
  | "sql_do_not_apply"
  | "flag_default_false"
  | "ui_external_golive_title"
  | "ui_readiness_vs_preuve"
  | "ui_public_blocked"
  | "ui_no_invented"
  | "ui_no_active_declare_public"
  | "ui_no_active_stripe_live"
  | "ui_no_active_send_email"
  | "no_fetch_in_modules"
  | "no_stripe_import"
  | "no_supabase_import"
  | "no_openai_anthropic_import"
  | "no_pierre_engine_import"
  | "next_phase_first_live_customer";

export type ExternalGoLiveQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type ExternalGoLiveQaStepSeverity = "blocking" | "warning" | "info";

export type ExternalGoLiveQaStep = {
  id: ExternalGoLiveQaStepId;
  label: string;
  severity: ExternalGoLiveQaStepSeverity;
  status: ExternalGoLiveQaStepStatus;
};

export type ExternalGoLiveQaChecklist = {
  steps: ExternalGoLiveQaStep[];
  total: number;
  blocking_count: number;
  phase: "7.1";
  generated_at: string;
};

export type ExternalGoLiveQaVerdict =
  | "ready" | "blocked" | "passed" | "needs_review" | "pending";

export type ExternalGoLiveQaSummary = {
  verdict: ExternalGoLiveQaVerdict;
  blocking_steps: ExternalGoLiveQaStepId[];
  passed_steps: ExternalGoLiveQaStepId[];
  pending_steps: ExternalGoLiveQaStepId[];
  message: string;
  external_proof_gate_only: true;
};

function s(
  id: ExternalGoLiveQaStepId,
  label: string,
  severity: ExternalGoLiveQaStepSeverity
): ExternalGoLiveQaStep {
  return { id, label, severity, status: "pending" };
}

export function buildExternalGoLiveProofsQaChecklist(): ExternalGoLiveQaChecklist {
  const b = (id: ExternalGoLiveQaStepId, label: string) => s(id, label, "blocking");
  const steps: ExternalGoLiveQaStep[] = [
    b("types_exist", "Types présents"),
    b("module_exists", "Module présent"),
    b("ui_copy_exists", "Module UI copy présent"),
    b("build_report_defined", "buildExternalGoLiveProofsReport défini"),
    b("stripe_matrix_defined", "buildStripeLiveMatrix défini"),
    b("supabase_matrix_defined", "buildSupabaseProdRlsMatrix défini"),
    b("domain_email_matrix_defined", "buildDomainEmailMatrix défini"),
    b("first_live_customer_matrix_defined", "buildFirstLiveCustomerMatrix défini"),
    b("evidence_required_defined", "buildExternalEvidenceRequired défini"),
    b("evidence_collected_defined", "buildExternalEvidenceCollected défini"),
    b("blockers_defined", "buildExternalBlockers défini"),
    b("manual_steps_defined", "buildExternalManualSteps défini"),
    b("rollback_plan_defined", "buildExternalRollbackPlan défini"),
    b("summarize_defined", "summarizeExternalGoLiveProofsReport défini"),
    b("qa_defined", "buildExternalGoLiveProofsQaChecklist défini"),
    b("phase_7_1", "Phase 7.1"),
    b("ready_for_first_live_customer_controlled_run_true", "ready_for_first_live_customer_controlled_run true"),
    b("external_go_live_proofs_ready_false", "external_go_live_proofs_ready false"),
    b("public_launch_ready_false", "public_launch_ready false"),
    b("stripe_live_verified_false", "stripe_live_verified false"),
    b("supabase_prod_rls_verified_false", "supabase_prod_rls_verified false"),
    b("domain_email_verified_false", "domain_email_verified false"),
    b("first_live_customer_verified_false", "first_live_customer_verified false"),
    b("scale_80k_proven_false", "scale_80k_proven false"),
    b("real_payment_performed_false", "real_payment_performed false"),
    b("real_email_sent_false", "real_email_sent false"),
    b("runtime_execution_active_false", "runtime_execution_active false"),
    b("env_modified_false", "env_modified false"),
    b("go_live_proofs_modified_false", "go_live_proofs_modified false"),
    b("ai_call_performed_false", "ai_call_performed false"),
    b("proof_status_manual_proof_required", "proof_status manual_proof_required"),
    b("public_launch_verdict_blocked", "public_launch_verdict BLOCKED"),
    b("first_live_customer_conditional", "first_live_customer_ready conditional"),
    b("evidence_collected_empty", "evidence_collected vide (aucune preuve inventée)"),
    b("classification_a_documented", "Classification A : readiness_documented"),
    b("classification_b_manual", "Classification B : manual_proof_required"),
    b("classification_d_blocking", "Classification D : blocking_public_launch"),
    b("stripe_live_transaction_blocking", "Stripe : transaction live bloquante"),
    b("supabase_rls_blocking", "Supabase : RLS prod bloquant"),
    b("domain_spf_dkim_dmarc_blocking", "Domaine : SPF/DKIM/DMARC bloquant"),
    b("first_customer_e2e_blocking", "Premier client : paiement E2E live bloquant"),
    b("manual_steps_human_action", "Manual steps : requires_human_action"),
    b("manual_steps_no_auto_apply", "Manual steps : auto_applied false"),
    b("rollback_plan_present", "Rollback plan présent"),
    b("go_live_proofs_reference_readonly", "go-live proofs référencés en lecture seule"),
    b("no_active_route", "Aucune route serveur active"),
    b("sql_do_not_apply", "SQL P5.4 DO NOT APPLY"),
    b("flag_default_false", "Flag serveur default false"),
    b("ui_external_golive_title", "UI : « Go-Live — Preuves externes »"),
    b("ui_readiness_vs_preuve", "UI : « readiness vs preuve réelle »"),
    b("ui_public_blocked", "UI : « public launch reste bloqué »"),
    b("ui_no_invented", "UI : « aucune preuve inventée »"),
    b("ui_no_active_declare_public", "Aucune action « Déclarer public launch »"),
    b("ui_no_active_stripe_live", "Aucune action « Activer Stripe live »"),
    b("ui_no_active_send_email", "Aucune action « Envoyer email réel »"),
    b("no_fetch_in_modules", "Aucun appel réseau dans les modules"),
    b("no_stripe_import", "Aucun import Stripe"),
    b("no_supabase_import", "Aucun import base de données"),
    b("no_openai_anthropic_import", "Aucun import OpenAI/Anthropic"),
    b("no_pierre_engine_import", "Aucun import moteur Pierre"),
    s("next_phase_first_live_customer", "Prochaine phase First Live Customer Controlled Run", "info"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((x) => x.severity === "blocking").length,
    phase: "7.1",
    generated_at: new Date().toISOString(),
  };
}

export function buildExternalGoLiveProofsQaVerdict(
  steps: ExternalGoLiveQaStep[]
): ExternalGoLiveQaSummary {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "skipped");

  let verdict: ExternalGoLiveQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: ExternalGoLiveQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((x) => x.id),
    passed_steps: passed.map((x) => x.id),
    pending_steps: pending.map((x) => x.id),
    message: "",
    external_proof_gate_only: true,
  };
  summary.message = summarizeExternalGoLiveProofsQaVerdict(summary);
  return summary;
}

export function getExternalGoLiveProofsBlockingSteps(): ExternalGoLiveQaStep[] {
  return buildExternalGoLiveProofsQaChecklist().steps.filter((x) => x.severity === "blocking");
}

export function summarizeExternalGoLiveProofsQaVerdict(
  summary: ExternalGoLiveQaSummary
): string {
  const lines = [
    `[QA PHASE 7.1 External Go-Live Proofs] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Gate de preuves externes — aucune preuve inventée, public launch reste bloqué sans preuve réelle.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Gate validé. Prêt pour First Live Customer Controlled Run.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Public launch BLOCKED sans preuve réelle · prochaine étape First Live Customer Controlled Run.");
  return lines.join("\n");
}
