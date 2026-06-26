// src/lib/clonestore/runtime-integration/public-launch-final-review-gate.ts
// PHASE 7.6 — Public Launch Final Review Gate / Final Phase 7 Verdict (pur)
//
// Agrège P7.1 → P7.5 et produit le verdict final HONNÊTE de lancement public. Lecture seule /
// décision par défaut : les gates internes sont prêts, les preuves externes ne le sont pas.
// Aucune preuve inventée ; un fichier présent ne vaut pas une revue juridique ou une preuve de
// production. Public launch reste BLOCKED. Phase 7 interne fermée ; la prochaine étape doit
// produire des preuves réelles, pas un nouveau gate read-only.

import type {
  Phase7CompletionRow,
  FinalProductSellabilityVerdict,
  ExternalProofFinalItem,
  CustomerEvidenceFinalItem,
  LegalCommercialFinalItem,
  TechnicalOperationsFinalItem,
  PublicLaunchScorecardItem,
  PublicLaunchScorecardDimension,
  ImmediateOperationalAction,
  FinalPublicLaunchDecision,
  Phase7ClosureVerdict,
  PublicLaunchFinalReviewGateReport,
} from "./public-launch-final-review-gate-types";

// ── 1. Phase 7 completion matrix ───────────────────────────────────────────────

function phaseRow(phase_id: string, label: string, internal_gate_ready: boolean, status: string, notes: string): Phase7CompletionRow {
  return { phase_id, label, internal_gate_ready, real_world_proof_complete: false, status, notes };
}

export function buildPhase7CompletionMatrix(): Phase7CompletionRow[] {
  return [
    phaseRow("P7.1", "External proof gate", true, "internal_gate_ready", "Preuves externes documentées, non exécutées."),
    phaseRow("P7.2", "First customer runbook", true, "internal_gate_ready", "Runbook premier client prêt, non exécuté."),
    phaseRow("P7.3", "Evidence review gate", true, "internal_gate_ready", "Audit de preuves prêt, aucune preuve réelle."),
    phaseRow("P7.4", "Evidence application planning", true, "internal_gate_ready", "Application des preuves prête, rien appliqué."),
    phaseRow("P7.5", "Second customer / public launch prep", true, "internal_gate_ready", "Runbook client 2 prêt, non démarré."),
    phaseRow("P7.6", "Final review", true, "internal_gate_ready", "Verdict final agrégé ; gate interne complet."),
  ];
}

// ── 2. Product sellability verdict (A / B / C / D) ─────────────────────────────

export function buildFinalProductSellabilityVerdict(): FinalProductSellabilityVerdict {
  return {
    controlled_first_customer: {
      verdict: "READY_WITH_LIMITS",
      sellable: true,
      public_claim_allowed: "true_with_limits",
    },
    controlled_second_customer: {
      verdict: "PREPARATION_READY",
      sellable: "conditional",
      customer_not_started: true,
    },
    public_launch: {
      verdict: "BLOCKED",
      sellable_publicly: false,
    },
    scale_80k: {
      verdict: "NOT_PROVEN",
      scale_ready: false,
    },
  };
}

// ── 3. External proof final matrix ─────────────────────────────────────────────

function ext(id: string, label: string): ExternalProofFinalItem {
  return {
    id,
    label,
    required: true,
    verified: false,
    evidence_link: null,
    blocking_public_launch: true,
    source_phase: "7.1",
    manual_verification_required: true,
  };
}

export function buildExternalProofFinalMatrix(): ExternalProofFinalItem[] {
  return [
    ext("ext_stripe_payment", "Stripe live payment"),
    ext("ext_stripe_webhook", "Stripe webhook live"),
    ext("ext_checkout_success", "checkout/success production"),
    ext("ext_supabase_availability", "Supabase production availability"),
    ext("ext_supabase_rls", "Supabase RLS production proof"),
    ext("ext_tenant_isolation", "tenant isolation production proof"),
    ext("ext_domain_dns", "domain/DNS verification"),
    ext("ext_email_identity", "production email identity"),
    ext("ext_email_delivery", "production email delivery"),
    ext("ext_monitoring", "monitoring/alerts production"),
    ext("ext_rollback", "rollback production"),
    ext("ext_support", "support process"),
  ];
}

// ── 4. Customer evidence final matrix ──────────────────────────────────────────

function cust(id: string, label: string, blocks_public_launch: boolean, notes: string): CustomerEvidenceFinalItem {
  return { id, label, verified: false, evidence_available: false, blocks_public_launch, notes };
}

export function buildCustomerEvidenceFinalMatrix(): CustomerEvidenceFinalItem[] {
  return [
    cust("cef_first_identity", "first customer identity", true, "Aucun client réel vérifié."),
    cust("cef_first_contract", "first contract/CGV", true, "Aucun contrat réel vérifié."),
    cust("cef_first_payment", "first payment/activation", true, "Aucun paiement/activation réel vérifié."),
    cust("cef_first_setup", "first setup", true, "Aucun setup réel vérifié."),
    cust("cef_first_mission", "first controlled mission", true, "Aucune mission réelle vérifiée."),
    cust("cef_first_output", "first useful output", true, "Aucun livrable réel vérifié."),
    cust("cef_first_validation", "first human validation", true, "Aucune validation humaine réelle vérifiée."),
    cust("cef_first_feedback", "first feedback", false, "Aucun feedback réel vérifié."),
    cust("cef_first_incident", "first incident review", false, "Aucune revue d'incident réelle."),
    cust("cef_second_identity", "second customer identity", false, "Aucun deuxième client réel."),
    cust("cef_second_run", "second customer run", false, "Aucun run client 2 réel."),
    cust("cef_comparison", "customer 1 vs 2 comparison", true, "Comparaison multi-client non effectuée."),
    cust("cef_reproducibility", "reproducibility assessment", true, "Reproductibilité non prouvée."),
  ];
}

// ── 5. Legal / commercial final matrix ─────────────────────────────────────────

function legal(id: string, label: string, blocking_public_launch: boolean): LegalCommercialFinalItem {
  return { id, label, verified: false, manual_review_required: true, blocking_public_launch };
}

export function buildLegalCommercialFinalMatrix(): LegalCommercialFinalItem[] {
  return [
    legal("lc_cgu", "CGU reviewed", true),
    legal("lc_cgv", "CGV reviewed", true),
    legal("lc_privacy", "privacy policy reviewed", true),
    legal("lc_dpa", "DPA reviewed", true),
    legal("lc_legal_entity", "legal entity fields completed", true),
    legal("lc_hr_guardrails", "human review of sensitive HR guardrails", true),
    legal("lc_commercial_claims", "commercial claims approved", true),
    legal("lc_refund", "refund/cancellation process", false),
    legal("lc_support_commitments", "customer support commitments", false),
    legal("lc_liability", "limitation of liability reviewed", true),
  ];
}

// ── 6. Technical / operations final matrix ─────────────────────────────────────

function tech(id: string, label: string, blocking_public_launch: boolean, owner: string): TechnicalOperationsFinalItem {
  return { id, label, verified: false, evidence_link: null, blocking_public_launch, owner };
}

export function buildTechnicalOperationsFinalMatrix(): TechnicalOperationsFinalItem[] {
  return [
    tech("to_prod_stable", "production environment stable", true, "ops"),
    tech("to_prod_secrets", "production secrets configured", true, "ops"),
    tech("to_backup", "backup/restore verified", true, "ops"),
    tech("to_incident", "incident response ready", true, "ops"),
    tech("to_monitoring", "monitoring ready", true, "ops"),
    tech("to_logs_redaction", "logs/redaction verified", true, "security"),
    tech("to_rate_limiting", "rate limiting verified", true, "ops"),
    tech("to_cost_budgets", "cost budgets verified", false, "ops"),
    tech("to_model_router", "model router verified", false, "engineering"),
    tech("to_support_escalation", "support escalation ready", false, "support"),
    tech("to_rollback_tested", "production rollback tested", true, "ops"),
    tech("to_data_deletion", "customer data deletion process verified", true, "security"),
  ];
}

// ── 7. Public launch scorecard ─────────────────────────────────────────────────

function score(
  id: string,
  dimension: PublicLaunchScorecardDimension,
  label: string,
  required_threshold: number,
  blocking_if_below_threshold: boolean
): PublicLaunchScorecardItem {
  return { id, dimension, label, current_score: 0, max_score: 100, verified: false, required_threshold, blocking_if_below_threshold };
}

export function buildPublicLaunchScorecard(): PublicLaunchScorecardItem[] {
  return [
    score("sc_product", "product_readiness", "Product readiness", 80, true),
    score("sc_legal", "legal_readiness", "Legal readiness", 90, true),
    score("sc_payment", "payment_readiness", "Payment readiness", 90, true),
    score("sc_infra", "infrastructure_readiness", "Infrastructure readiness", 90, true),
    score("sc_identity", "identity_email_readiness", "Identity/email readiness", 85, true),
    score("sc_customer_evidence", "customer_evidence_readiness", "Customer evidence readiness", 80, true),
    score("sc_support", "support_readiness", "Support readiness", 80, true),
    score("sc_monitoring", "monitoring_readiness", "Monitoring readiness", 85, true),
    score("sc_security", "security_readiness", "Security readiness", 90, true),
    score("sc_scale", "scale_readiness", "Scale readiness", 80, false),
  ];
}

// ── 8. Blocking conditions ─────────────────────────────────────────────────────

export function buildBlockingConditions(): string[] {
  return [
    "Stripe live non vérifié.",
    "Supabase prod / RLS non vérifié.",
    "Domaine / email non vérifié.",
    "Revue juridique finale non vérifiée.",
    "Support production non vérifié.",
    "Monitoring production non vérifié.",
    "Aucune preuve premier client réel.",
    "Aucun deuxième client réel.",
    "Comparaison multi-client absente.",
    "Reproductibilité non prouvée.",
    "Scale 80k non prouvé.",
  ];
}

// ── 9. Conditional go requirements ─────────────────────────────────────────────

export function buildConditionalGoRequirements(): string[] {
  return [
    "Stripe live payment + webhook prouvés.",
    "Supabase prod / RLS + isolation tenant prouvées.",
    "Domaine / email prouvés.",
    "Revue juridique humaine finale.",
    "Support + monitoring + rollback prouvés.",
    "Premier client contrôlé terminé avec evidence.",
    "Deuxième client ou evidence multi-client suffisante.",
    "Aucun blocker critique.",
    "Go-live proofs mis à jour manuellement.",
    "Revue humaine finale signée.",
  ];
}

// ── 10. Allowed product claims ─────────────────────────────────────────────────

export function buildAllowedProductClaims(): string[] {
  return [
    "Pierre est disponible pour un premier client contrôlé avec limites.",
    "Pierre dispose d'un parcours d'activation préparé.",
    "Pierre produit des brouillons RH sous validation humaine.",
    "Le lancement public n'est pas encore validé.",
    "L'exécution autonome et les actions sensibles restent désactivées.",
  ];
}

// ── 11. Forbidden product claims ───────────────────────────────────────────────

export function buildForbiddenProductClaims(): string[] {
  return [
    "Public launch ready.",
    "100 % autonome.",
    "Paie officielle automatisée.",
    "Emails réels autonomes.",
    "Production prouvée.",
    "Scale 80 000 clients prouvé.",
    "Deux clients validés.",
    "Stripe live vérifié.",
    "Supabase production vérifié.",
    "Conforme juridiquement (sans revue humaine réelle).",
    "Aucune intervention humaine nécessaire.",
  ];
}

// ── 12. Immediate operational actions ──────────────────────────────────────────

function action(order: number, id: string, actionLabel: string): ImmediateOperationalAction {
  return { order, id, action: actionLabel };
}

export function buildImmediateOperationalActions(): ImmediateOperationalAction[] {
  return [
    action(1, "act_legal", "Finaliser l'identité légale et la revue juridique humaine."),
    action(2, "act_stripe_config", "Configurer Stripe live côté serveur."),
    action(3, "act_stripe_payment", "Réaliser un paiement live contrôlé."),
    action(4, "act_webhook_checkout", "Vérifier les webhooks et le checkout production."),
    action(5, "act_supabase", "Vérifier Supabase production / RLS / isolation tenant."),
    action(6, "act_domain_email", "Vérifier domaine / DNS / email production."),
    action(7, "act_monitoring_rollback", "Vérifier monitoring, alertes et rollback."),
    action(8, "act_select_customer", "Sélectionner le premier client réel."),
    action(9, "act_run_p7_2", "Exécuter P7.2 avec evidence."),
    action(10, "act_review_p7_3", "Revoir l'evidence via P7.3."),
    action(11, "act_apply_evidence", "Appliquer manuellement les preuves autorisées."),
    action(12, "act_second_customer", "Exécuter éventuellement le client 2."),
    action(13, "act_return_final_review", "Revenir au final review gate avec preuves réelles."),
  ];
}

// ── 13. Rollback requirements ──────────────────────────────────────────────────

export function buildRollbackRequirements(): string[] {
  return [
    "Possibilité de repasser en demo-only.",
    "Suspendre les paiements.",
    "Suspendre les nouvelles inscriptions.",
    "Suspendre les emails.",
    "Suspendre l'accès client.",
    "Conserver les logs d'incident.",
    "Informer les clients concernés.",
    "Rembourser si nécessaire.",
    "Restaurer les données si applicable.",
    "Revenir au verdict public launch blocked.",
  ];
}

// ── 14. Final public launch decision ───────────────────────────────────────────

export function buildFinalPublicLaunchDecision(): FinalPublicLaunchDecision {
  return {
    decision: "BLOCKED",
    public_launch_ready: false,
    reason: "missing_real_external_and_customer_evidence",
    controlled_first_customer_allowed: true,
    public_marketing_launch_allowed: false,
    mass_prospecting_with_public_activation_allowed: false,
    manual_controlled_sales_allowed: true,
    requires_human_final_approval: true,
  };
}

// ── 15. Phase 7 closure verdict ────────────────────────────────────────────────

export function buildPhase7ClosureVerdict(): Phase7ClosureVerdict {
  return {
    phase_7_internal_work_complete: true,
    phase_7_external_execution_complete: false,
    phase_7_status: "INTERNAL_GATES_COMPLETE_EXTERNAL_PROOFS_MISSING",
    no_more_read_only_gate_required_before_real_execution: true,
    next_step_must_be_real_external_proof_execution: true,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildPublicLaunchFinalReviewGateReport(
  options?: { now?: string }
): PublicLaunchFinalReviewGateReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.6",
    title: "Pierre — Public Launch Final Review Gate / verdict final Phase 7",
    generated_at: now,
    review_status: "blocked_missing_external_proofs",
    phase_7_completion_matrix: buildPhase7CompletionMatrix(),
    product_sellability_verdict: buildFinalProductSellabilityVerdict(),
    external_proof_final_matrix: buildExternalProofFinalMatrix(),
    customer_evidence_final_matrix: buildCustomerEvidenceFinalMatrix(),
    legal_commercial_final_matrix: buildLegalCommercialFinalMatrix(),
    technical_operations_final_matrix: buildTechnicalOperationsFinalMatrix(),
    public_launch_scorecard: buildPublicLaunchScorecard(),
    blocking_conditions: buildBlockingConditions(),
    conditional_go_requirements: buildConditionalGoRequirements(),
    allowed_product_claims: buildAllowedProductClaims(),
    forbidden_product_claims: buildForbiddenProductClaims(),
    immediate_operational_actions: buildImmediateOperationalActions(),
    rollback_requirements: buildRollbackRequirements(),
    final_public_launch_decision: buildFinalPublicLaunchDecision(),
    phase_7_closure_verdict: buildPhase7ClosureVerdict(),
    final_verdict:
      "Gates internes Phase 7 (P7.1 → P7.5) complets et agrégés. Les preuves externes réelles ne sont PAS exécutées. Pierre reste vendable uniquement en premier client contrôlé avec limites ; client 2 préparé mais non démarré ; lancement public BLOCKED ; scale 80k NON prouvé. Phase 7 interne fermée. La prochaine étape doit produire des preuves réelles, pas un nouveau gate read-only.",
    recommended_next_phase:
      "REAL EXTERNAL PROOF EXECUTION / CONTROLLED PRODUCTION ACTIVATION — exécuter les preuves externes réelles (Stripe live, Supabase prod/RLS, domaine/email, légal, support, premier client réel) puis revenir au final review gate avec preuves réelles.",
    phase_7_internal_gate_complete: true,
    ready_for_external_proof_execution: true,
    controlled_first_customer_sellable: true,
    controlled_second_customer_preparation_ready: true,
    public_launch_review_completed: true,
    public_launch_ready: false,
    external_proofs_complete: false,
    customer_evidence_complete: false,
    multi_customer_evidence_ready: false,
    reproducibility_verified: false,
    stripe_live_verified: false,
    supabase_prod_rls_verified: false,
    domain_email_verified: false,
    legal_final_review_verified: false,
    support_readiness_verified: false,
    production_monitoring_verified: false,
    real_payment_verified: false,
    first_customer_completed_verified: false,
    second_customer_completed_verified: false,
    scale_80k_proven: false,
    runtime_execution_active: false,
    real_email_sent: false,
    official_document_generated: false,
    go_live_proofs_modified: false,
    env_modified: false,
    ai_call_performed: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePublicLaunchFinalReviewGateReport(
  report: PublicLaunchFinalReviewGateReport
): string {
  return [
    `[Public Launch Final Review — PHASE 7.6] statut ${report.review_status} · décision ${report.final_public_launch_decision.decision}`,
    `  Phase 7 : ${report.phase_7_completion_matrix.length} gates internes complets · preuves externes : ${report.external_proof_final_matrix.length} non vérifiées · scorecard : ${report.public_launch_scorecard.length}`,
    `  ${report.final_verdict}`,
    `  Premier client contrôlé : READY_WITH_LIMITS · client 2 : PREPARATION_READY · public launch : BLOCKED · scale 80k : NOT_PROVEN.`,
    `  Phase 7 interne fermée · aucun autre gate read-only nécessaire · aucune preuve inventée.`,
    `  Prochaine étape obligatoire : Real External Proof Execution / Controlled Production Activation.`,
  ].join("\n");
}
