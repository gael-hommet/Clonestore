// src/lib/clonestore/runtime-integration/customer-evidence-applied-second-customer.ts
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer (pur)
//
// Planifie l'application contrôlée des preuves réelles relues (P7.3) et la préparation d'un
// deuxième client contrôlé. Lecture seule / planning par défaut : rien n'est appliqué, aucune
// preuve n'est inventée ni auto-appliquée, aucun go-live proof modifié. Un ou deux clients ne
// suffisent pas au public launch. Aucune exécution autonome, aucun email réel, aucun document
// officiel.

import type {
  ReviewedEvidenceApplicationItem,
  AppliedEvidenceCategory,
  UnappliedEvidenceCategory,
  GoLiveContributionRow,
  FirstCustomerContinuationPlan,
  SecondCustomerPreparationItem,
  MultiCustomerEvidenceBase,
  PublicLaunchSafetyGate,
  SecondCustomerRunbookStep,
  CustomerEvidenceAppliedSecondCustomerReport,
} from "./customer-evidence-applied-second-customer-types";

// ── 1. Reviewed evidence application matrix ────────────────────────────────────

function item(
  id: string,
  category: AppliedEvidenceCategory,
  label: string,
  required_for_application: boolean,
  source_from_p7_3: string,
  can_contribute_to_go_live_proofs: boolean
): ReviewedEvidenceApplicationItem {
  return {
    id,
    category,
    label,
    required_for_application,
    source_from_p7_3,
    application_decision: "not_applied",
    reason_not_applied: "no_verified_real_evidence_yet",
    can_contribute_to_go_live_proofs,
    applied: false,
    verified: false,
  };
}

export function buildReviewedEvidenceApplicationMatrix(): ReviewedEvidenceApplicationItem[] {
  return [
    item("ra_identity", "customer_identity", "Identité client réel", true, "P7.3 er_identity", false),
    item("ra_contract", "contract_cgv", "Contrat / CGV signés", true, "P7.3 er_contract", true),
    item("ra_payment", "payment_or_activation", "Paiement ou activation contrôlée", true, "P7.3 er_payment", true),
    item("ra_setup", "setup", "Setup complété", true, "P7.3 er_setup", false),
    item("ra_output", "first_output", "Premier livrable", true, "P7.3 er_output", true),
    item("ra_human_validation", "human_validation", "Validation humaine", true, "P7.3 er_human_validation", true),
    item("ra_feedback", "feedback", "Feedback client", true, "P7.3 er_feedback", false),
    item("ra_incident", "incident_log", "Incidents / limites", false, "P7.3 er_incident", false),
    item("ra_decision", "post_run_decision", "Décision post-run", true, "P7.3 er_decision", false),
  ];
}

// ── 2. Applied evidence categories (vide par défaut) ──────────────────────────

export function buildAppliedEvidenceCategories(): string[] {
  // Aucune preuve appliquée : aucune preuve réelle vérifiée disponible.
  return [];
}

// ── 3. Unapplied evidence categories (toutes, avec raisons) ───────────────────

function unapplied(id: string, category: AppliedEvidenceCategory): UnappliedEvidenceCategory {
  return {
    id,
    category,
    reasons: ["no_verified_real_evidence_yet", "manual_review_required", "cannot_auto_apply"],
  };
}

export function buildUnappliedEvidenceCategories(): UnappliedEvidenceCategory[] {
  return [
    unapplied("ua_identity", "customer_identity"),
    unapplied("ua_contract", "contract_cgv"),
    unapplied("ua_payment", "payment_or_activation"),
    unapplied("ua_setup", "setup"),
    unapplied("ua_output", "first_output"),
    unapplied("ua_human_validation", "human_validation"),
    unapplied("ua_feedback", "feedback"),
    unapplied("ua_incident", "incident_log"),
    unapplied("ua_decision", "post_run_decision"),
  ];
}

// ── 4. Go-live contribution matrix ─────────────────────────────────────────────

function contribution(
  contribution_id: string,
  label: string,
  required_evidence: string,
  eligible_if_verified: boolean
): GoLiveContributionRow {
  return {
    contribution_id,
    label,
    required_evidence,
    eligible_if_verified,
    currently_eligible: false,
    applied_to_go_live_proofs: false,
    auto_update_allowed: false,
  };
}

export function buildGoLiveContributionMatrix(): GoLiveContributionRow[] {
  return [
    contribution("gl_identity", "first_customer_identity", "Identité client réelle vérifiée", true),
    contribution("gl_contract", "signed_contract", "Contrat / CGV signés vérifiés", true),
    contribution("gl_activation", "real_activation", "Activation réelle vérifiée", true),
    contribution("gl_first_value", "first_value", "Premier livrable vérifié", true),
    contribution("gl_human_validation", "human_validation", "Validation humaine vérifiée", true),
    contribution("gl_feedback", "feedback", "Feedback client vérifié", true),
    contribution("gl_incident", "incident_review", "Revue des incidents vérifiée", true),
  ];
}

// ── 5. First customer continuation plan ────────────────────────────────────────

export function buildFirstCustomerContinuationPlan(): FirstCustomerContinuationPlan {
  return {
    recommended_decision: "request_more_evidence",
    options: [
      "continue_controlled",
      "pause_and_fix",
      "request_more_evidence",
      "refund_or_cancel",
      "convert_to_reference_later",
      "prepare_case_study_later",
    ],
    rationale:
      "Par défaut, demander plus d'evidence : tant que les preuves réelles du client 1 ne sont pas vérifiées et relues, aucune application ni déclaration de succès n'est possible.",
  };
}

// ── 6. Second customer preparation matrix ──────────────────────────────────────

function prep(id: string, label: string, required: boolean, evidence_needed: string, reason: string): SecondCustomerPreparationItem {
  return { id, label, required, ready: false, evidence_needed, reason };
}

export function buildSecondCustomerPreparationMatrix(): SecondCustomerPreparationItem[] {
  return [
    prep("sc_different_sector", "choose_different_sector_or_size", false, "Profil client 2 défini", "Diversifier l'evidence multi-client."),
    prep("sc_same_scenario", "choose_same_scenario_if_successful", false, "Scénario client 1 réussi", "Confirmer la reproductibilité."),
    prep("sc_safer_scenario", "choose_safer_scenario_if_p7_3_partial", false, "Verdict P7.3 partiel", "Réduire le risque si client 1 partiel."),
    prep("sc_avoid_sensitive", "avoid_sensitive_legal_case", true, "Évaluation risque juridique", "Éviter les cas sensibles pour client 2."),
    prep("sc_verify_contract", "verify_contract_before_activation", true, "Contrat / CGV signés", "Contrat vérifié avant activation."),
    prep("sc_runtime_disabled", "keep_runtime_disabled", true, "Politique produit (invariant)", "Aucun runtime autonome."),
    prep("sc_email_disabled", "keep_email_real_disabled", true, "Politique produit (invariant)", "Aucun email réel."),
    prep("sc_collect_from_start", "collect_evidence_from_start", true, "Plan d'evidence client 2", "Collecter l'evidence dès le début."),
    prep("sc_compare", "compare_to_customer_1", true, "Comparatif client 1 / client 2", "Construire une evidence base multi-client."),
  ];
}

// ── 7. Second customer selection criteria ──────────────────────────────────────

export function buildSecondCustomerSelectionCriteria(): string[] {
  return [
    "Client simple.",
    "Besoin RH net.",
    "Décideur accessible.",
    "Accepte les limites.",
    "Accepte un run contrôlé.",
    "Accepte un feedback rapide.",
    "Cas S1 ou S2 recommandé.",
    "Risque juridique faible.",
    "Pas besoin d'email live.",
    "Pas besoin de paie officielle.",
    "Pas d'intégration complexe.",
  ];
}

// ── 8. Multi-customer evidence base ────────────────────────────────────────────

export function buildMultiCustomerEvidenceBase(): MultiCustomerEvidenceBase {
  return {
    customer_count_required_before_public_launch: 2,
    recommendation: "2 ou 3 clients vérifiés recommandés avant toute revue de lancement public.",
    current_verified_customer_count: 0,
    evidence_base_ready: false,
    categories_to_compare: [
      "time_saved",
      "output_quality",
      "setup_friction",
      "limit_clarity",
      "legal_safety",
      "technical_reliability",
      "willingness_to_continue",
    ],
  };
}

// ── 9. Customer 1 vs customer 2 comparison plan ────────────────────────────────

export function buildCustomer1VsCustomer2ComparisonPlan(): string[] {
  return [
    "Scénario utilisé.",
    "Temps de setup.",
    "Temps jusqu'à la première valeur.",
    "Qualité du livrable.",
    "Validation humaine.",
    "Feedback.",
    "Incidents.",
    "Limites comprises.",
    "Volonté de continuer.",
  ];
}

// ── 10. Public launch safety gate ──────────────────────────────────────────────

export function buildPublicLaunchSafetyGate(): PublicLaunchSafetyGate {
  return {
    public_launch_ready: false,
    first_customer_success_not_enough: true,
    second_customer_success_not_enough_alone: true,
    requires_external_proofs: true,
    requires_legal_review: true,
    requires_support_readiness: true,
    requires_multiple_customer_evidence: true,
    final_decision: "blocked",
  };
}

// ── 11. Evidence application rules ─────────────────────────────────────────────

export function buildEvidenceApplicationRules(): string[] {
  return [
    "Preuve réelle seulement.",
    "Preuve vérifiée seulement.",
    "Aucune auto-application.",
    "Opérateur humain obligatoire.",
    "Go-live proof update manuel.",
    "Jamais de public launch depuis un seul client.",
    "Données sensibles masquées.",
    "Rollback si preuve invalide.",
  ];
}

// ── 12. Operator apply checklist ───────────────────────────────────────────────

export function buildOperatorApplyChecklist(): string[] {
  return [
    "Relire P7.3.",
    "Vérifier les preuves réelles.",
    "Décider les catégories applicables.",
    "Préparer le client 2.",
    "Documenter les limites.",
    "Ne pas update automatiquement.",
    "Ne pas déclarer public launch.",
    "Ne pas déclarer scale.",
  ];
}

// ── 13. Second customer runbook ────────────────────────────────────────────────

function step(order: number, id: string, label: string): SecondCustomerRunbookStep {
  return { id, order, label, verified: false, can_start_now: false };
}

export function buildSecondCustomerRunbook(): SecondCustomerRunbookStep[] {
  return [
    step(1, "scr_candidate", "Choisir le candidat"),
    step(2, "scr_criteria", "Valider les critères"),
    step(3, "scr_contract", "Signer contrat / CGV"),
    step(4, "scr_scenario", "Choisir le scénario"),
    step(5, "scr_setup", "Setup accompagné"),
    step(6, "scr_mission", "Mission contrôlée"),
    step(7, "scr_output", "Livrable"),
    step(8, "scr_validation", "Validation"),
    step(9, "scr_feedback", "Feedback"),
    step(10, "scr_compare", "Comparaison client 1"),
    step(11, "scr_decision", "Décision post-client 2"),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildCustomerEvidenceAppliedSecondCustomerReport(
  options?: { now?: string }
): CustomerEvidenceAppliedSecondCustomerReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.4",
    title: "Pierre — Customer Evidence Applied / application contrôlée des preuves + préparation client 2",
    generated_at: now,
    application_status: "ready_to_apply_when_verified",
    reviewed_evidence_application_matrix: buildReviewedEvidenceApplicationMatrix(),
    applied_evidence_categories: buildAppliedEvidenceCategories(),
    unapplied_evidence_categories: buildUnappliedEvidenceCategories(),
    go_live_contribution_matrix: buildGoLiveContributionMatrix(),
    first_customer_continuation_plan: buildFirstCustomerContinuationPlan(),
    second_customer_preparation_matrix: buildSecondCustomerPreparationMatrix(),
    second_customer_selection_criteria: buildSecondCustomerSelectionCriteria(),
    multi_customer_evidence_base: buildMultiCustomerEvidenceBase(),
    customer_1_vs_customer_2_comparison_plan: buildCustomer1VsCustomer2ComparisonPlan(),
    public_launch_safety_gate: buildPublicLaunchSafetyGate(),
    evidence_application_rules: buildEvidenceApplicationRules(),
    operator_apply_checklist: buildOperatorApplyChecklist(),
    second_customer_runbook: buildSecondCustomerRunbook(),
    final_verdict:
      "Gate d'application des preuves prêt mais rien n'est appliqué : aucune preuve réelle vérifiée disponible, aucune preuve inventée ni auto-appliquée. Client 2 préparé mais non démarré. Un ou deux clients ne suffisent pas à déclarer le lancement public. Public launch reste BLOCKED, go-live proofs non modifiés. Prochaine étape : Second Customer Controlled Run / Public Launch Review Prep.",
    recommended_next_phase:
      "SECOND CUSTOMER CONTROLLED RUN / PUBLIC LAUNCH REVIEW PREP — exécuter un deuxième client contrôlé avec preuves et préparer la revue de lancement public.",
    ready_to_apply_customer_evidence_when_verified: true,
    evidence_applied: false,
    real_evidence_available: false,
    go_live_contribution_applied: false,
    first_customer_success_declared: false,
    second_customer_selected: false,
    second_customer_started: false,
    second_customer_completed: false,
    multi_customer_evidence_ready: false,
    public_launch_ready: false,
    scale_80k_proven: false,
    stripe_live_verified: false,
    supabase_prod_rls_verified: false,
    domain_email_verified: false,
    runtime_execution_active: false,
    real_email_sent: false,
    official_document_generated: false,
    go_live_proofs_modified: false,
    env_modified: false,
    ai_call_performed: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeCustomerEvidenceAppliedSecondCustomerReport(
  report: CustomerEvidenceAppliedSecondCustomerReport
): string {
  return [
    `[Customer Evidence Applied — PHASE 7.4] statut ${report.application_status}`,
    `  Matrice application : ${report.reviewed_evidence_application_matrix.length} · contributions go-live : ${report.go_live_contribution_matrix.length} · runbook client 2 : ${report.second_customer_runbook.length} étapes`,
    `  ${report.final_verdict}`,
    `  Aucune preuve appliquée sans vérification réelle · go-live proofs non modifiés · client 2 non démarré.`,
    `  Un ou deux clients ne suffisent pas au public launch · public launch BLOCKED · scale 80k non prouvé.`,
    `  Prochaine phase : Second Customer Controlled Run / Public Launch Review Prep.`,
  ].join("\n");
}
