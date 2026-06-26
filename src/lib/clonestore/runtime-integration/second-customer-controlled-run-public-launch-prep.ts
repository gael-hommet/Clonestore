// src/lib/clonestore/runtime-integration/second-customer-controlled-run-public-launch-prep.ts
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep (pur)
//
// Runbook du deuxième client contrôlé + préparation de la future revue de lancement public.
// Lecture seule / planning par défaut : le client 2 est préparé mais NON démarré, aucune preuve
// n'est inventée ni collectée, la comparaison multi-client reste à prouver, le lancement public
// reste bloqué. go-live proofs non modifiés. Aucun runtime, aucun email réel, aucun document
// officiel.

import type {
  SecondCustomerQualificationItem,
  SecondCustomerActivationStep,
  SecondCustomerSetupItem,
  SecondCustomerScenario,
  SecondCustomerRiskLevel,
  SecondCustomerEvidenceItem,
  CustomerComparisonAxis,
  ReproducibilityScore,
  ReproducibilityDimension,
  MultiCustomerEvidenceReadiness,
  PublicLaunchReviewPrep,
  PublicLaunchReviewInput,
  SecondCustomerRollbackStep,
  SecondCustomerControlledRunPublicLaunchPrepReport,
} from "./second-customer-controlled-run-public-launch-prep-types";

// ── 1. Second customer qualification matrix ────────────────────────────────────

function qualif(id: string, label: string, required: boolean, evidence_needed: string): SecondCustomerQualificationItem {
  return { id, label, required, evidence_needed, verified: false };
}

export function buildSecondCustomerQualificationMatrix(): SecondCustomerQualificationItem[] {
  return [
    qualif("q2_simple", "Client simple", true, "Profil client connu"),
    qualif("q2_need_clear", "Besoin RH clair", true, "Cas d'usage RH explicite"),
    qualif("q2_decision_maker", "Décideur accessible", true, "Interlocuteur décideur identifié"),
    qualif("q2_accepts_limits", "Accepte les limites", true, "Limites comprises et acceptées"),
    qualif("q2_accepts_controlled", "Accepte un run contrôlé", true, "Accord client écrit"),
    qualif("q2_accepts_feedback", "Accepte un feedback", false, "Disponibilité feedback"),
    qualif("q2_s1_s2", "Cas S1 ou S2 recommandé", true, "Scénario sélectionné"),
    qualif("q2_low_legal_risk", "Risque juridique faible", true, "Évaluation risque documentée"),
    qualif("q2_no_official_payroll", "Pas de paie officielle", true, "Confirmation client"),
    qualif("q2_no_live_email", "Pas d'email live", true, "Confirmation client"),
    qualif("q2_no_complex_integration", "Pas d'intégration complexe", true, "Périmètre technique simple"),
    qualif("q2_different_profile", "Profil légèrement différent du client 1 si possible", false, "Comparatif profils"),
  ];
}

// ── 2. Pre-sale conditions ────────────────────────────────────────────────────

export function buildSecondCustomerPreSaleConditions(): string[] {
  return [
    "Expliquer que le client 2 reste un run contrôlé.",
    "Aucune promesse de lancement public.",
    "Aucune promesse de runtime autonome.",
    "Aucune promesse d'email live.",
    "Aucune promesse de paie officielle.",
    "Contrat / CGV signés.",
    "Critères de succès définis.",
    "Comparaison avec le client 1 prévue.",
    "Evidence collectée dès le départ.",
  ];
}

// ── 3. Activation runbook ─────────────────────────────────────────────────────

function step(order: number, id: string, label: string, owner: string, expected_output: string, evidence_required: string): SecondCustomerActivationStep {
  return { id, order, label, owner, expected_output, evidence_required, verified: false, can_start_now: false };
}

export function buildSecondCustomerActivationRunbook(): SecondCustomerActivationStep[] {
  return [
    step(1, "a2_select", "Sélectionner le client", "operator", "Client 2 candidat retenu", "Notes qualification"),
    step(2, "a2_qualify", "Qualifier", "operator", "Qualification cochée", "Matrice qualification"),
    step(3, "a2_present_limits", "Présenter les limites", "operator", "Limites comprises", "Accord client"),
    step(4, "a2_sign_contract", "Signer le contrat", "legal_commercial_reviewer", "Contrat signé avec limites", "Contrat / CGV signés"),
    step(5, "a2_grant_access", "Activer l'accès contrôlé", "operator", "Accès actif", "Capture activation"),
    step(6, "a2_setup", "Compléter le setup", "operator", "Empreinte entreprise saisie", "Capture setup"),
    step(7, "a2_choose_scenario", "Choisir le scénario", "hr_approver", "Scénario RH choisi (S1/S2)", "Capture scénario"),
    step(8, "a2_run_mission", "Lancer une mission contrôlée", "operator", "Mission contrôlée locale créée", "Trace mission"),
    step(9, "a2_output", "Produire le livrable", "operator", "Livrable brouillon préparé", "Livrable produit"),
    step(10, "a2_human_validate", "Validation humaine", "hr_approver", "Validation humaine consignée", "Validation humaine"),
    step(11, "a2_collect_evidence", "Collecter l'evidence", "operator", "Dossier evidence client 2", "Evidence collectée"),
    step(12, "a2_feedback", "Recueillir le feedback", "operator", "Feedback client 2 capturé", "Feedback client"),
    step(13, "a2_compare", "Comparer au client 1", "operator", "Comparatif client 1 / client 2", "Matrice comparaison"),
    step(14, "a2_reproducibility", "Évaluer la reproductibilité", "operator", "Score reproductibilité", "Évaluation reproductibilité"),
    step(15, "a2_prep_review", "Préparer la revue public launch", "operator", "Inputs revue rassemblés", "Dossier revue public launch"),
  ];
}

// ── 4. Setup runbook ──────────────────────────────────────────────────────────

function setupItem(id: string, label: string, required: boolean): SecondCustomerSetupItem {
  return { id, label, required, captured: false };
}

export function buildSecondCustomerSetupRunbook(): SecondCustomerSetupItem[] {
  return [
    setupItem("s2_company", "Entreprise", true),
    setupItem("s2_rh_context", "Contexte RH", true),
    setupItem("s2_employees", "Salariés minimum", true),
    setupItem("s2_sites", "Sites", false),
    setupItem("s2_rules", "Règles", true),
    setupItem("s2_approvers", "Approbateurs", true),
    setupItem("s2_limits", "Limites", true),
    setupItem("s2_scenario", "Scénario", true),
    setupItem("s2_missing", "Données manquantes", false),
    setupItem("s2_differences", "Différences avec le client 1", false),
  ];
}

// ── 5. Scenario matrix (S1 → S5) ───────────────────────────────────────────────

function scenario(
  scenario_id: string,
  label: string,
  recommended_for_second_customer: boolean,
  risk_level: SecondCustomerRiskLevel,
  expected_first_output: string
): SecondCustomerScenario {
  return {
    scenario_id,
    label,
    recommended_for_second_customer,
    risk_level,
    expected_first_output,
    human_validation_required: true,
    runtime_execution_allowed: false,
    real_email_allowed: false,
    official_document_allowed: false,
  };
}

export function buildSecondCustomerScenarioMatrix(): SecondCustomerScenario[] {
  return [
    scenario("S1", "Embauche / onboarding RH", true, "low", "Fiche de poste + critères + checklist (brouillons)."),
    scenario("S2", "Absence / organisation équipe", true, "low", "Plan + messages managers (brouillons)."),
    scenario("S3", "Pré-paie / variables", false, "medium", "Variables + anomalies (aucune DSN/bulletin)."),
    scenario("S4", "Multi-site / coordination", false, "medium", "Plan d'organisation (aucune affectation imposée)."),
    scenario("S5", "Cas sensible / recadrage", false, "high", "Trame factuelle + risques (non recommandé pour client 2)."),
  ];
}

// ── 6. Evidence plan ───────────────────────────────────────────────────────────

function evidence(id: string, label: string, required: boolean, verification_method: string): SecondCustomerEvidenceItem {
  return { id, label, required, collected: false, verification_method };
}

export function buildSecondCustomerEvidencePlan(): SecondCustomerEvidenceItem[] {
  return [
    evidence("e2_qualification", "Qualification", true, "Relecture opérateur"),
    evidence("e2_contract", "Contrat", true, "Relecture légal/commercial"),
    evidence("e2_activation", "Activation", true, "Capture datée"),
    evidence("e2_setup", "Setup", true, "Capture setup"),
    evidence("e2_scenario", "Scénario", true, "Capture scénario"),
    evidence("e2_mission", "Mission", true, "Trace mission (lecture seule)"),
    evidence("e2_output", "Livrable", true, "Livrable + relecture"),
    evidence("e2_human_validation", "Validation humaine", true, "Relecture validation"),
    evidence("e2_feedback", "Feedback", true, "Compte rendu daté"),
    evidence("e2_incident", "Incidents", false, "Relecture technique"),
    evidence("e2_comparison", "Comparaison client 1", true, "Matrice comparaison"),
    evidence("e2_reproducibility", "Reproductibilité", true, "Évaluation reproductibilité"),
    evidence("e2_decision", "Décision post-run", true, "Note de décision"),
  ];
}

// ── 7. Customer 1 vs customer 2 comparison matrix ──────────────────────────────

function axis(id: string, label: string): CustomerComparisonAxis {
  return { id, label, customer_1_value: null, customer_2_value: null, comparison_status: "not_compared", conclusion: null };
}

export function buildCustomer1VsCustomer2ComparisonMatrix(): CustomerComparisonAxis[] {
  return [
    axis("c_sector", "Secteur / taille"),
    axis("c_scenario", "Scénario"),
    axis("c_setup_time", "Temps de setup"),
    axis("c_first_value_time", "Temps jusqu'à la première valeur"),
    axis("c_output_quality", "Qualité du livrable"),
    axis("c_human_validation", "Validation humaine"),
    axis("c_errors", "Erreurs"),
    axis("c_limits_understood", "Limites comprises"),
    axis("c_satisfaction", "Satisfaction"),
    axis("c_willingness", "Volonté de continuer"),
    axis("c_support", "Support requis"),
    axis("c_operator_cost", "Coût opérateur"),
  ];
}

// ── 8. Reproducibility assessment ──────────────────────────────────────────────

function score(
  id: string,
  dimension: ReproducibilityDimension,
  label: string,
  threshold_for_multi_customer_confidence: number,
  threshold_for_public_launch_contribution: number
): ReproducibilityScore {
  return { id, dimension, label, current_score: 0, verified: false, threshold_for_multi_customer_confidence, threshold_for_public_launch_contribution };
}

export function buildReproducibilityAssessment(): ReproducibilityScore[] {
  return [
    score("r_setup", "setup_reproducibility", "Reproductibilité du setup", 75, 90),
    score("r_output", "output_reproducibility", "Reproductibilité du livrable", 75, 90),
    score("r_guardrail", "guardrail_reproducibility", "Reproductibilité des garde-fous", 85, 95),
    score("r_customer_value", "customer_value_reproducibility", "Reproductibilité de la valeur client", 70, 85),
    score("r_operator_load", "operator_load_reproducibility", "Reproductibilité de la charge opérateur", 70, 85),
    score("r_technical", "technical_reliability_reproducibility", "Reproductibilité de la fiabilité technique", 80, 95),
  ];
}

// ── 9. Multi-customer evidence readiness ───────────────────────────────────────

export function buildMultiCustomerEvidenceReadiness(): MultiCustomerEvidenceReadiness {
  return {
    verified_customer_count: 0,
    required_customer_count: 2,
    recommended_customer_count: 3,
    evidence_ready: false,
    comparison_complete: false,
    reproducibility_verified: false,
  };
}

// ── 10. Public launch review prep ──────────────────────────────────────────────

export function buildPublicLaunchReviewPrep(): PublicLaunchReviewPrep {
  return {
    required_inputs: [
      "Stripe live proof",
      "Supabase prod/RLS proof",
      "domain/email proof",
      "legal review",
      "support readiness",
      "monitoring",
      "customer evidence",
      "multi-customer comparison",
      "incident register",
      "rollback readiness",
      "public copy review",
      "pricing/checkout proof",
    ],
    review_ready: false,
    all_inputs_verified: false,
    final_public_launch_decision: "blocked",
  };
}

// ── 11. Public launch blocker matrix ───────────────────────────────────────────

export function buildPublicLaunchBlockerMatrix(): string[] {
  return [
    "Stripe live non vérifié.",
    "Supabase prod / RLS non vérifié.",
    "Domaine / email non vérifié.",
    "Revue légale non finale.",
    "Support readiness non prouvée.",
    "Monitoring prod non prouvé.",
    "Evidence client 1 / client 2 non vérifiée.",
    "Evidence multi-client non prête.",
    "Scale 80k non prouvé.",
  ];
}

// ── 12. Public launch review inputs ────────────────────────────────────────────

function input(id: string, label: string, required: boolean, blocking_if_missing: boolean): PublicLaunchReviewInput {
  return { id, label, required, verified: false, evidence_link: null, blocking_if_missing };
}

export function buildPublicLaunchReviewInputs(): PublicLaunchReviewInput[] {
  return [
    input("i_stripe", "Stripe live proof", true, true),
    input("i_supabase", "Supabase prod/RLS proof", true, true),
    input("i_domain", "domain/email proof", true, true),
    input("i_legal", "legal review", true, true),
    input("i_support", "support readiness", true, true),
    input("i_monitoring", "monitoring", true, true),
    input("i_customer_evidence", "customer evidence", true, true),
    input("i_multi_comparison", "multi-customer comparison", true, true),
    input("i_incident", "incident register", true, false),
    input("i_rollback", "rollback readiness", true, false),
    input("i_public_copy", "public copy review", true, false),
    input("i_pricing", "pricing/checkout proof", true, true),
  ];
}

// ── 13. Operator checklist ─────────────────────────────────────────────────────

export function buildSecondCustomerOperatorChecklist(): string[] {
  return [
    "Relire P7.4.",
    "Qualifier le client 2.",
    "Contractualiser.",
    "Accompagner le setup.",
    "Collecter l'evidence.",
    "Comparer au client 1.",
    "Évaluer la reproductibilité.",
    "Préparer la revue public launch.",
    "Ne pas déclarer public launch.",
    "Ne pas modifier les go-live proofs automatiquement.",
  ];
}

// ── 14. Rollback plan ──────────────────────────────────────────────────────────

function rollback(id: string, stepLabel: string, description: string): SecondCustomerRollbackStep {
  return { id, step: stepLabel, description };
}

export function buildSecondCustomerRollbackPlan(): SecondCustomerRollbackStep[] {
  return [
    rollback("rb2_suspend", "Suspendre le client 2", "Couper l'accès contrôlé du client 2 si une condition no-go est rencontrée."),
    rollback("rb2_demo_only", "Revenir en demo-only", "Repasser le client 2 en mode demo uniquement."),
    rollback("rb2_refund", "Rembourser si nécessaire", "Annuler / rembourser un paiement contrôlé si requis."),
    rollback("rb2_document", "Documenter l'incident", "Consigner ce qui a échoué, sans déclarer de succès."),
    rollback("rb2_no_success", "Ne pas déclarer réussite", "Aucune déclaration de réussite tant que l'evidence n'est pas réelle."),
    rollback("rb2_no_go_live_update", "Ne pas modifier les go-live proofs", "Aucune mise à jour des go-live proofs en cas d'échec."),
    rollback("rb2_single_customer", "Revenir à un seul client contrôlé", "Repli sur le client 1 contrôlé si le client 2 échoue."),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildSecondCustomerControlledRunPublicLaunchPrepReport(
  options?: { now?: string }
): SecondCustomerControlledRunPublicLaunchPrepReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.5",
    title: "Pierre — Second Customer Controlled Run / préparation de la revue de lancement public",
    generated_at: now,
    run_status: "ready_to_prepare_second_customer",
    second_customer_qualification_matrix: buildSecondCustomerQualificationMatrix(),
    second_customer_pre_sale_conditions: buildSecondCustomerPreSaleConditions(),
    second_customer_activation_runbook: buildSecondCustomerActivationRunbook(),
    second_customer_setup_runbook: buildSecondCustomerSetupRunbook(),
    second_customer_scenario_matrix: buildSecondCustomerScenarioMatrix(),
    second_customer_evidence_plan: buildSecondCustomerEvidencePlan(),
    customer_1_vs_customer_2_comparison_matrix: buildCustomer1VsCustomer2ComparisonMatrix(),
    reproducibility_assessment: buildReproducibilityAssessment(),
    multi_customer_evidence_readiness: buildMultiCustomerEvidenceReadiness(),
    public_launch_review_prep: buildPublicLaunchReviewPrep(),
    public_launch_blocker_matrix: buildPublicLaunchBlockerMatrix(),
    public_launch_review_inputs: buildPublicLaunchReviewInputs(),
    operator_checklist: buildSecondCustomerOperatorChecklist(),
    rollback_plan: buildSecondCustomerRollbackPlan(),
    final_verdict:
      "Runbook du deuxième client contrôlé + préparation de la revue de lancement public prêts. Client 2 préparé mais NON démarré, aucune preuve inventée ni collectée, comparaison multi-client à prouver, reproductibilité non déclarée. Public launch reste BLOCKED, go-live proofs non modifiés. Prochaine étape : Public Launch Final Review Gate.",
    recommended_next_phase:
      "PUBLIC LAUNCH FINAL REVIEW GATE — revue finale de lancement public à partir des preuves multi-client réelles et des preuves externes.",
    ready_to_prepare_second_customer: true,
    second_customer_selected: false,
    second_customer_started: false,
    second_customer_completed: false,
    second_customer_evidence_collected: false,
    customer_comparison_completed: false,
    reproducibility_verified: false,
    multi_customer_evidence_ready: false,
    public_launch_review_ready: false,
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

export function summarizeSecondCustomerControlledRunPublicLaunchPrepReport(
  report: SecondCustomerControlledRunPublicLaunchPrepReport
): string {
  return [
    `[Second Customer Run — PHASE 7.5] statut ${report.run_status}`,
    `  Qualification : ${report.second_customer_qualification_matrix.length} · runbook : ${report.second_customer_activation_runbook.length} étapes · comparaison : ${report.customer_1_vs_customer_2_comparison_matrix.length} axes · inputs revue : ${report.public_launch_review_inputs.length}`,
    `  ${report.final_verdict}`,
    `  Client 2 préparé mais NON démarré · comparaison multi-client à prouver · aucune preuve inventée.`,
    `  Public launch reste BLOCKED · scale 80k non prouvé · go-live proofs non modifiés.`,
    `  Prochaine phase : Public Launch Final Review Gate.`,
  ].join("\n");
}
