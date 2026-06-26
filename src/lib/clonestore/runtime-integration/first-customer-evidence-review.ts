// src/lib/clonestore/runtime-integration/first-customer-evidence-review.ts
// PHASE 7.3 — First Customer Evidence Review (pur)
//
// Audit des preuves RÉELLES du premier client. Lecture seule / review par défaut : rien n'est
// vérifié, aucune preuve n'est inventée ni auto-validée. Un premier client réussi ne suffit pas
// à déclarer le lancement public. go-live proofs restent manuels. Aucune exécution autonome,
// aucun email réel, aucun document officiel.

import type {
  EvidenceReviewItem,
  EvidenceCategory,
  EvidenceQualityScore,
  EvidenceQualityDimension,
  PublicLaunchDecisionGate,
  GoLiveProofUpdateRecommendation,
  CustomerContinuationRecommendation,
  PostRunDecisionRow,
  FirstCustomerEvidenceReviewReport,
} from "./first-customer-evidence-review-types";

// ── 1. Evidence review matrix (12 catégories) ─────────────────────────────────

function item(
  id: string,
  category: EvidenceCategory,
  label: string,
  required: boolean,
  expected_evidence: string,
  verification_method: string,
  blocks_success_if_missing: boolean,
  can_update_go_live_proof_if_verified: boolean
): EvidenceReviewItem {
  return {
    id,
    category,
    label,
    required,
    expected_evidence,
    verification_method,
    status: "missing",
    verified: false,
    blocks_success_if_missing,
    can_update_go_live_proof_if_verified,
  };
}

export function buildEvidenceReviewMatrix(): EvidenceReviewItem[] {
  return [
    item("er_identity", "customer_identity", "Identité client réel", true, "Client réel identifié (entreprise, contact)", "Relecture opérateur + lien", true, false),
    item("er_contract", "contract_cgv", "Contrat / CGV signés", true, "Contrat / CGV avec limites signés", "Relecture légal/commercial", true, true),
    item("er_payment", "payment_or_controlled_activation", "Paiement ou activation contrôlée", true, "Paiement réel ou activation contrôlée prouvée", "Capture datée + référence", true, true),
    item("er_access", "access_activation", "Activation de l'accès", true, "Accès profile/agents actif", "Capture datée", true, false),
    item("er_setup", "setup_completion", "Setup complété", true, "Empreinte entreprise saisie", "Capture setup", true, false),
    item("er_scenario", "scenario_selection", "Scénario sélectionné", true, "Scénario RH (S1→S5) choisi", "Capture scénario", false, false),
    item("er_mission", "controlled_mission_creation", "Mission contrôlée créée", true, "Mission contrôlée locale créée", "Trace mission (lecture seule)", true, false),
    item("er_output", "first_output_delivery", "Premier livrable", true, "Livrable RH utile produit", "Livrable + relecture", true, true),
    item("er_human_validation", "human_validation", "Validation humaine", true, "Validation humaine consignée", "Relecture validation", true, true),
    item("er_feedback", "customer_feedback", "Feedback client", true, "Feedback réel exploitable", "Compte rendu daté", true, false),
    item("er_incident", "incident_log", "Incidents / limites documentés", false, "Incidents et limites consignés", "Relecture technique", false, false),
    item("er_decision", "post_run_decision", "Décision post-run", true, "Décision documentée (suite du run)", "Note de décision", false, false),
  ];
}

// ── 2. Required evidence categories (bloquantes) ──────────────────────────────

export function buildRequiredEvidenceCategories(): string[] {
  return [
    "Client réel identifié.",
    "Contrat / CGV avec limites.",
    "Activation réelle.",
    "Setup complété.",
    "Première mission.",
    "Premier livrable.",
    "Validation humaine.",
    "Feedback client.",
  ];
}

// ── 3. Verification rules ──────────────────────────────────────────────────────

export function buildVerificationRules(): string[] {
  return [
    "Preuve datée.",
    "Preuve vérifiable.",
    "Preuve liée à un vrai client.",
    "Preuve non simulée.",
    "Preuve sans donnée sensible exposée.",
    "Preuve relue par l'opérateur.",
    "Preuve relue par légal/commercial si contrat.",
    "Preuve technique relue si accès/setup/logs.",
    "Aucune preuve ne peut être auto-validée par ce module.",
  ];
}

// ── 4. Success criteria ────────────────────────────────────────────────────────

export function buildSuccessCriteria(): string[] {
  return [
    "Client réel vérifié.",
    "Contrat / CGV vérifiés.",
    "Activation réelle vérifiée.",
    "Setup vérifié.",
    "Premier livrable utile vérifié.",
    "Validation humaine vérifiée.",
    "Feedback positif ou exploitable.",
    "Aucune no-go condition critique.",
    "Preuves stockées.",
    "Limites comprises par le client.",
  ];
}

// ── 5. Failure criteria ────────────────────────────────────────────────────────

export function buildFailureCriteria(): string[] {
  return [
    "Client non réel ou non qualifié.",
    "Contrat / CGV absent.",
    "Paiement / activation non prouvé.",
    "Setup impossible.",
    "Livrable inutile.",
    "Validation humaine absente.",
    "Client confus sur les limites.",
    "Demande de public launch / autonomie totale / paie officielle / email live immédiat.",
    "Evidence absente ou non vérifiable.",
  ];
}

// ── 6. Partial success criteria ────────────────────────────────────────────────

export function buildPartialSuccessCriteria(): string[] {
  return [
    "Client réel + setup OK.",
    "Premier livrable produit.",
    "Mais feedback incomplet.",
    "Ou paiement / activation pas encore final.",
    "Ou preuve technique incomplète.",
    "Ou corrections nécessaires avant le client 2.",
  ];
}

// ── 7. Evidence quality scores ─────────────────────────────────────────────────

function score(
  id: string,
  dimension: EvidenceQualityDimension,
  label: string,
  threshold_for_success: number,
  threshold_for_public_launch_contribution: number
): EvidenceQualityScore {
  return {
    id,
    dimension,
    label,
    current_score: 0,
    max_score: 100,
    threshold_for_success,
    threshold_for_public_launch_contribution,
    verified: false,
  };
}

export function buildEvidenceQualityScores(): EvidenceQualityScore[] {
  return [
    score("qs_completeness", "completeness", "Complétude", 80, 95),
    score("qs_verifiability", "verifiability", "Vérifiabilité", 85, 95),
    score("qs_customer_value", "customer_value", "Valeur client", 70, 85),
    score("qs_legal_safety", "legal_safety", "Sécurité juridique", 85, 95),
    score("qs_technical_reliability", "technical_reliability", "Fiabilité technique", 80, 95),
    score("qs_commercial_confidence", "commercial_confidence", "Confiance commerciale", 70, 90),
  ];
}

// ── 8. Public launch decision gate ─────────────────────────────────────────────

export function buildPublicLaunchDecisionGate(): PublicLaunchDecisionGate {
  return {
    public_launch_ready: false,
    one_customer_success_is_not_public_launch: true,
    requires_stripe_live_proof: true,
    requires_supabase_prod_rls_proof: true,
    requires_domain_email_proof: true,
    requires_legal_review: true,
    requires_support_process: true,
    requires_multiple_customer_runs: "recommended",
    final_public_launch_decision: "blocked",
  };
}

// ── 9. Go-live proof update recommendation ─────────────────────────────────────

export function buildGoLiveProofUpdateRecommendation(): GoLiveProofUpdateRecommendation {
  return {
    update_recommended: false,
    update_allowed_only_after_manual_review: true,
    can_update_customer_evidence_section_if_complete: false,
    can_update_public_launch_status: false,
    requires_human_operator: true,
    requires_evidence_links: true,
    never_auto_update: true,
  };
}

// ── 10. Customer continuation recommendation ───────────────────────────────────

export function buildCustomerContinuationRecommendation(): CustomerContinuationRecommendation {
  return {
    recommended: "request_more_evidence",
    options: [
      "continue_controlled",
      "pause_and_fix",
      "refund_or_cancel",
      "request_more_evidence",
      "prepare_second_customer",
      "escalate_legal_review",
    ],
    rationale:
      "Par défaut, demander plus d'evidence : tant que les preuves réelles ne sont pas relues, aucune suite (success/public launch) ne peut être déclarée.",
  };
}

// ── 11. Operator review checklist ──────────────────────────────────────────────

export function buildOperatorReviewChecklist(): string[] {
  return [
    "Relire les preuves.",
    "Vérifier le client réel.",
    "Vérifier le contrat.",
    "Vérifier l'activation.",
    "Vérifier le setup.",
    "Vérifier le livrable.",
    "Vérifier le feedback.",
    "Vérifier les incidents.",
    "Vérifier que les limites sont comprises.",
    "Décider de la suite.",
  ];
}

// ── 12. Legal / commercial review checklist ────────────────────────────────────

export function buildLegalCommercialReviewChecklist(): string[] {
  return [
    "Contrat / CGV.",
    "Limites commerciales.",
    "Aucune promesse interdite.",
    "Pas de paie officielle.",
    "Pas de sanction / licenciement.",
    "RGPD / données client.",
    "Conditions de continuation.",
  ];
}

// ── 13. Technical review checklist ─────────────────────────────────────────────

export function buildTechnicalReviewChecklist(): string[] {
  return [
    "Accès.",
    "Logs.",
    "Erreurs.",
    "Setup.",
    "Performance.",
    "Sécurité.",
    "Aucune fuite de données.",
    "Pas de runtime non autorisé.",
    "Pas d'email réel non autorisé.",
  ];
}

// ── 14. Post-run decision matrix ───────────────────────────────────────────────

function decision(id: string, scenario: string, condition: string, action: string, note: string): PostRunDecisionRow {
  return { id, scenario, condition, action, public_launch_ready: false, note };
}

export function buildPostRunDecisionMatrix(): PostRunDecisionRow[] {
  return [
    decision("d_a", "A", "Evidence missing", "request_more_evidence", "Public launch reste false."),
    decision("d_b", "B", "Failure", "pause_and_fix / refund_or_cancel", "Public launch reste false."),
    decision("d_c", "C", "Partial success", "continue_controlled / fix_before_customer_2", "Public launch reste false."),
    decision("d_d", "D", "Strong controlled success", "continue_controlled + prepare second customer", "Public launch reste false."),
    decision("d_e", "E", "External proofs also complete", "prepare public launch review", "Public launch nécessite toujours une revue finale."),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildFirstCustomerEvidenceReviewReport(
  options?: { now?: string }
): FirstCustomerEvidenceReviewReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.3",
    title: "Pierre — First Customer Evidence Review / audit des preuves réelles avant décision de lancement public",
    generated_at: now,
    review_status: "ready_to_review_when_evidence_exists",
    evidence_review_matrix: buildEvidenceReviewMatrix(),
    required_evidence_categories: buildRequiredEvidenceCategories(),
    verification_rules: buildVerificationRules(),
    success_criteria: buildSuccessCriteria(),
    failure_criteria: buildFailureCriteria(),
    partial_success_criteria: buildPartialSuccessCriteria(),
    evidence_quality_scores: buildEvidenceQualityScores(),
    public_launch_decision_gate: buildPublicLaunchDecisionGate(),
    go_live_proof_update_recommendation: buildGoLiveProofUpdateRecommendation(),
    customer_continuation_recommendation: buildCustomerContinuationRecommendation(),
    operator_review_checklist: buildOperatorReviewChecklist(),
    legal_commercial_review_checklist: buildLegalCommercialReviewChecklist(),
    technical_review_checklist: buildTechnicalReviewChecklist(),
    post_run_decision_matrix: buildPostRunDecisionMatrix(),
    final_verdict:
      "Gate d'audit des preuves réelles prêt. Aucune preuve inventée ni auto-validée : tout est en attente d'éléments réels. Un premier client réussi ne suffit pas à déclarer le lancement public. Public launch reste BLOCKED, go-live proofs non modifiés. Prochaine étape : Customer Evidence Applied / Second Controlled Customer.",
    recommended_next_phase:
      "CUSTOMER EVIDENCE APPLIED / SECOND CONTROLLED CUSTOMER — appliquer les preuves réelles relues et préparer un deuxième client contrôlé.",
    ready_to_review_first_customer_evidence: true,
    first_customer_evidence_review_completed: false,
    real_customer_verified: false,
    real_payment_verified: false,
    contract_signed_verified: false,
    setup_completed_verified: false,
    first_value_delivered_verified: false,
    feedback_collected_verified: false,
    evidence_complete_verified: false,
    go_live_proof_update_allowed: false,
    public_launch_ready: false,
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

export function summarizeFirstCustomerEvidenceReviewReport(
  report: FirstCustomerEvidenceReviewReport
): string {
  return [
    `[First Customer Evidence Review — PHASE 7.3] statut ${report.review_status}`,
    `  Matrice : ${report.evidence_review_matrix.length} catégories · scores : ${report.evidence_quality_scores.length} · décisions : ${report.post_run_decision_matrix.length}`,
    `  ${report.final_verdict}`,
    `  Aucune preuve inventée ni auto-validée · go-live proofs non modifiés · public launch BLOCKED.`,
    `  Un premier client réussi ne suffit pas à déclarer le lancement public · scale 80k non prouvé.`,
    `  Prochaine phase : Customer Evidence Applied / Second Controlled Customer.`,
  ].join("\n");
}
