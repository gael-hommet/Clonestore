// src/lib/clonestore/runtime-integration/first-live-customer-controlled-run.ts
// PHASE 7.2 — First Live Customer Controlled Run (pur)
//
// Runbook / evidence gate du premier vrai client Pierre. Lecture seule / planning par défaut :
// rien n'est validé, aucun client/paiement/capture/log/feedback n'est inventé. Public launch
// reste BLOCKED. go-live proofs restent manuels et vérifiables. Aucune exécution autonome,
// aucun email réel, aucun document officiel sans validation.

import type {
  CustomerQualificationItem,
  ActivationRunbookStep,
  SetupRunbookItem,
  FirstMissionScenario,
  FirstCustomerRiskLevel,
  EvidenceCollectionItem,
  OperatorResponsibility,
  RollbackStep,
  PublicLaunchImpact,
  GoLiveProofUpdatesPolicy,
  FirstLiveCustomerControlledRunReport,
} from "./first-live-customer-controlled-run-types";

// ── 1. Customer qualification matrix ──────────────────────────────────────────

function qualif(id: string, label: string, required: boolean, evidence_needed: string): CustomerQualificationItem {
  return { id, label, required, evidence_needed, verified: false };
}

export function buildCustomerQualificationMatrix(): CustomerQualificationItem[] {
  return [
    qualif("q_pme_simple", "PME simple", true, "Taille / structure connue (notes opérateur)"),
    qualif("q_need_clear", "Besoin RH clair", true, "Cas d'usage RH explicite"),
    qualif("q_accepts_controlled", "Accepte une activation contrôlée", true, "Accord client écrit"),
    qualif("q_accepts_limits", "Accepte les limites", true, "Limites comprises et acceptées"),
    qualif("q_no_official_payroll", "Pas besoin de paie officielle", true, "Confirmation client"),
    qualif("q_no_live_email", "Pas besoin d'email live immédiat", true, "Confirmation client"),
    qualif("q_no_complex_integration", "Pas besoin d'intégration complexe", true, "Périmètre technique simple"),
    qualif("q_decision_maker", "Décideur accessible", true, "Interlocuteur décideur identifié"),
    qualif("q_fast_feedback", "Feedback rapide possible", false, "Disponibilité client"),
    qualif("q_low_legal_risk", "Risque juridique faible à moyen", true, "Évaluation risque documentée"),
  ];
}

// ── 2. Pre-sale conditions ────────────────────────────────────────────────────

export function buildPreSaleConditions(): string[] {
  return [
    "Expliquer Pierre comme employé IA RH contrôlé.",
    "Expliquer les limites.",
    "Aucune promesse de lancement public.",
    "Aucune promesse de runtime autonome.",
    "Aucune promesse d'email live.",
    "Aucune promesse de paie officielle.",
    "Choisir un des 5 scénarios P6.2.",
    "Définir les success criteria.",
    "Définir l'interlocuteur client.",
    "Définir l'approbateur humain.",
    "Définir le canal support.",
  ];
}

// ── 3. Legal & commercial limits ──────────────────────────────────────────────

export function buildLegalAndCommercialLimits(): string[] {
  return [
    "Les CGV / le contrat doivent inclure les limites.",
    "Actions sensibles validées humainement.",
    "Paie officielle exclue.",
    "Licenciement / sanction exclus.",
    "Emails réels exclus sauf future preuve domaine/email.",
    "Première activation contrôlée.",
    "Aucun SLA de lancement public.",
    "Aucune promesse de scale.",
  ];
}

// ── 4. Activation runbook ─────────────────────────────────────────────────────

function step(order: number, id: string, label: string, owner: string, expected_output: string, evidence_required: string): ActivationRunbookStep {
  return { id, order, label, owner, expected_output, evidence_required, can_be_marked_done_now: false, verified: false };
}

export function buildActivationRunbook(): ActivationRunbookStep[] {
  return [
    step(1, "ar_select", "Sélectionner le client", "operator", "Client candidat retenu", "Notes qualification"),
    step(2, "ar_qualify", "Valider la qualification", "operator", "Qualification cochée", "Matrice qualification"),
    step(3, "ar_present_limits", "Présenter les limites", "operator", "Limites comprises", "Accord client"),
    step(4, "ar_sign_contract", "Signer contrat / CGV", "legal_commercial_reviewer", "Contrat signé avec limites", "Contrat / CGV signés"),
    step(5, "ar_grant_access", "Activer l'accès contrôlé", "operator", "Accès actif", "Capture activation"),
    step(6, "ar_verify_access", "Vérifier l'accès profile/agents", "operator", "Pierre visible et accessible", "Capture profile/agents"),
    step(7, "ar_send_setup", "Envoyer vers le setup", "operator", "Client orienté setup", "Capture setup"),
    step(8, "ar_accompany_setup", "Accompagner le setup", "operator", "Empreinte entreprise saisie", "Capture setup complété"),
    step(9, "ar_choose_scenario", "Choisir le scénario", "hr_approver", "Scénario RH choisi (S1→S5)", "Capture scénario"),
    step(10, "ar_run_mission", "Lancer une mission contrôlée", "operator", "Mission contrôlée locale créée", "Trace mission"),
    step(11, "ar_first_output", "Produire le premier livrable", "operator", "Livrable brouillon préparé", "Livrable produit"),
    step(12, "ar_human_validate", "Valider humainement", "hr_approver", "Validation humaine consignée", "Validation humaine"),
    step(13, "ar_collect_evidence", "Collecter l'evidence", "operator", "Dossier evidence rempli", "Evidence collectée"),
    step(14, "ar_feedback", "Recueillir le feedback", "operator", "Feedback client capturé", "Feedback client"),
    step(15, "ar_decide_next", "Décider la suite : continuer controlled / bloquer / préparer go-live proof", "operator", "Décision documentée", "Décision post-run"),
  ];
}

// ── 5. Setup runbook ──────────────────────────────────────────────────────────

function setupItem(id: string, label: string, required: boolean): SetupRunbookItem {
  return { id, label, required, captured: false };
}

export function buildSetupRunbook(): SetupRunbookItem[] {
  return [
    setupItem("su_company", "Entreprise", true),
    setupItem("su_rh_context", "Contexte RH", true),
    setupItem("su_sites", "Sites", false),
    setupItem("su_employees", "Salariés minimum", true),
    setupItem("su_rules", "Règles", true),
    setupItem("su_approvers", "Approbateurs", true),
    setupItem("su_limits", "Limites", true),
    setupItem("su_priority_scenario", "Scénario prioritaire", true),
    setupItem("su_missing_info", "Informations manquantes", false),
  ];
}

// ── 6. First mission runbook (S1 → S5) ─────────────────────────────────────────

function scenario(
  scenario_id: string,
  label: string,
  recommended_for_first_customer: boolean,
  risk_level: FirstCustomerRiskLevel,
  expected_first_output: string
): FirstMissionScenario {
  return {
    scenario_id,
    label,
    recommended_for_first_customer,
    risk_level,
    expected_first_output,
    human_validation_required: true,
    runtime_execution_allowed: false,
    real_email_allowed: false,
    official_document_allowed: false,
  };
}

export function buildFirstMissionRunbook(): FirstMissionScenario[] {
  return [
    scenario("S1", "Embauche / onboarding RH", true, "low", "Fiche de poste + critères + checklist (brouillons)."),
    scenario("S2", "Absence / organisation équipe", true, "low", "Plan + messages managers (brouillons)."),
    scenario("S3", "Pré-paie / variables", false, "medium", "Variables + anomalies (aucune DSN/bulletin)."),
    scenario("S4", "Multi-site / coordination", false, "medium", "Plan d'organisation (aucune affectation imposée)."),
    scenario("S5", "Cas sensible / recadrage", false, "high", "Trame factuelle + risques (aucune sanction)."),
  ];
}

// ── 7. Evidence collection plan ───────────────────────────────────────────────

function evidence(id: string, label: string, required: boolean, storage_location_hint: string): EvidenceCollectionItem {
  return { id, label, required, collected: false, storage_location_hint };
}

export function buildEvidenceCollectionPlan(): EvidenceCollectionItem[] {
  return [
    evidence("ev_qualification", "Capture qualification client", true, "Dossier evidence client"),
    evidence("ev_contract", "Contrat / CGV", true, "Dossier contrats"),
    evidence("ev_access", "Capture accès activé", true, "Dossier evidence client"),
    evidence("ev_setup", "Capture setup complété", true, "Dossier evidence client"),
    evidence("ev_scenario", "Capture scénario choisi", true, "Dossier evidence client"),
    evidence("ev_mission_trace", "Trace mission", true, "Trace CloneTrace (lecture seule)"),
    evidence("ev_output", "Livrable produit", true, "Dossier livrables"),
    evidence("ev_human_validation", "Validation humaine", true, "Dossier evidence client"),
    evidence("ev_feedback", "Feedback client", true, "Dossier feedback"),
    evidence("ev_error_logs", "Logs erreurs", false, "Dossier logs"),
    evidence("ev_post_decision", "Décision post-run", true, "Dossier décisions"),
  ];
}

// ── 8. Customer feedback plan ─────────────────────────────────────────────────

export function buildCustomerFeedbackPlan(): string[] {
  return [
    "Pierre vous a-t-il fait gagner du temps ?",
    "Le livrable est-il utile ?",
    "Les limites étaient-elles claires ?",
    "Le setup était-il compréhensible ?",
    "Quel scénario vous paraît le plus vendable ?",
    "Que faut-il améliorer avant le client 2 ?",
    "Seriez-vous prêt à continuer après ce run contrôlé ?",
  ];
}

// ── 9. Operator responsibilities ──────────────────────────────────────────────

function role(id: string, roleName: string, responsibilities: string[]): OperatorResponsibility {
  return { id, role: roleName, responsibilities };
}

export function buildOperatorResponsibilities(): OperatorResponsibility[] {
  return [
    role("op_founder", "Founder / operator", ["Pilote le run contrôlé", "Active l'accès", "Collecte l'evidence"]),
    role("op_customer", "Client decision maker", ["Comprend et accepte les limites", "Décide de continuer ou non"]),
    role("op_hr_approver", "HR approver", ["Valide humainement les actions sensibles", "Choisit le scénario"]),
    role("op_tech_observer", "Technical observer", ["Observe l'accès et la mission", "Note les erreurs"]),
    role("op_legal_reviewer", "Legal / commercial reviewer", ["Valide le contrat / CGV avec limites", "Vérifie l'absence de promesse interdite"]),
  ];
}

// ── 10. No-go conditions ──────────────────────────────────────────────────────

export function buildNoGoConditions(): string[] {
  return [
    "Le client demande une autonomie totale.",
    "Le client exige la paie officielle.",
    "Le client exige l'email live immédiat.",
    "Le client refuse la validation humaine.",
    "Le client demande une action juridique sensible.",
    "Contrat / CGV non signé.",
    "Accès non fonctionnel.",
    "Setup incomplet.",
    "Premier livrable non validé.",
    "Evidence non collectée.",
  ];
}

// ── 11. Rollback plan ─────────────────────────────────────────────────────────

function rollback(id: string, stepLabel: string, description: string): RollbackStep {
  return { id, step: stepLabel, description };
}

export function buildFirstCustomerRollbackPlan(): RollbackStep[] {
  return [
    rollback("rb_suspend", "Suspendre l'accès", "Couper l'accès contrôlé si une condition no-go est rencontrée."),
    rollback("rb_demo_only", "Revenir en demo-only", "Repasser le client en mode demo uniquement."),
    rollback("rb_refund", "Ne pas encaisser / rembourser si nécessaire", "Annuler / rembourser un paiement contrôlé si requis."),
    rollback("rb_document", "Documenter l'incident", "Consigner ce qui a échoué, sans déclarer de succès."),
    rollback("rb_delete_test", "Supprimer les données test si demandé", "Effacer les données test à la demande du client."),
    rollback("rb_no_success", "Ne pas déclarer success", "Aucune déclaration de réussite tant que l'evidence n'est pas réelle."),
    rollback("rb_no_go_live_update", "Ne pas update go-live proof", "Aucune mise à jour des go-live proofs en cas d'échec."),
  ];
}

// ── 12. Public launch impact ──────────────────────────────────────────────────

export function buildPublicLaunchImpact(): PublicLaunchImpact {
  return {
    public_launch_ready_after_run: false,
    first_live_customer_can_improve_evidence: true,
    public_launch_only_after_external_proofs: true,
    one_customer_is_not_scale_proof: true,
    notes: [
      "public_launch_ready reste false.",
      "Un premier client réel peut améliorer l'evidence.",
      "Public launch seulement après preuves Stripe / Supabase / domaine / légal / support.",
      "Un client réussi ≠ preuve de scale.",
    ],
  };
}

// ── 13. Go-live proof updates policy ───────────────────────────────────────────

export function buildGoLiveProofUpdatesPolicy(): GoLiveProofUpdatesPolicy {
  return {
    manual_only: true,
    only_after_real_proof: true,
    never_via_this_module: true,
    must_be_dated: true,
    must_be_verifiable: true,
    rollback_noted_on_failure: true,
    notes: [
      "Mettre à jour les go-live proofs uniquement manuellement.",
      "Seulement après une preuve réelle.",
      "Jamais via ce module.",
      "La preuve doit être datée.",
      "La preuve doit être vérifiable.",
      "Le rollback est noté en cas d'échec.",
    ],
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildFirstLiveCustomerControlledRunReport(
  options?: { now?: string }
): FirstLiveCustomerControlledRunReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "7.2",
    title: "Pierre — First Live Customer Controlled Run / premier client réel sous contrôle",
    generated_at: now,
    run_status: "ready_to_prepare_first_customer",
    first_customer_readiness:
      "Prêt à préparer le premier client réel (runbook + evidence plan). Aucun client réel sélectionné, aucune preuve collectée.",
    customer_qualification_matrix: buildCustomerQualificationMatrix(),
    pre_sale_conditions: buildPreSaleConditions(),
    legal_and_commercial_limits: buildLegalAndCommercialLimits(),
    activation_runbook: buildActivationRunbook(),
    setup_runbook: buildSetupRunbook(),
    first_mission_runbook: buildFirstMissionRunbook(),
    evidence_collection_plan: buildEvidenceCollectionPlan(),
    customer_feedback_plan: buildCustomerFeedbackPlan(),
    operator_responsibilities: buildOperatorResponsibilities(),
    no_go_conditions: buildNoGoConditions(),
    rollback_plan: buildFirstCustomerRollbackPlan(),
    public_launch_impact: buildPublicLaunchImpact(),
    go_live_proof_updates_policy: buildGoLiveProofUpdatesPolicy(),
    final_verdict:
      "Runbook du premier client réel prêt. Premier client préparé mais NON inventé : aucun client/paiement/capture/log/feedback réel. Public launch reste BLOCKED, go-live proofs non modifiés. Prochaine étape : First Customer Evidence Review.",
    recommended_next_phase:
      "FIRST CUSTOMER EVIDENCE REVIEW — revoir les preuves réelles du premier client avant toute décision de lancement public.",
    ready_to_prepare_first_live_customer: true,
    first_live_customer_completed: false,
    real_customer_selected: false,
    real_payment_verified: false,
    contract_signed_verified: false,
    setup_completed_verified: false,
    first_value_delivered_verified: false,
    feedback_collected_verified: false,
    stripe_live_verified: false,
    supabase_prod_rls_verified: false,
    domain_email_verified: false,
    runtime_execution_active: false,
    real_email_sent: false,
    official_document_generated: false,
    public_launch_ready: false,
    scale_80k_proven: false,
    go_live_proofs_modified: false,
    env_modified: false,
    ai_call_performed: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeFirstLiveCustomerControlledRunReport(
  report: FirstLiveCustomerControlledRunReport
): string {
  return [
    `[First Live Customer Run — PHASE 7.2] statut ${report.run_status}`,
    `  Qualification : ${report.customer_qualification_matrix.length} · runbook : ${report.activation_runbook.length} étapes · scénarios : ${report.first_mission_runbook.length} · evidence : ${report.evidence_collection_plan.length}`,
    `  ${report.final_verdict}`,
    `  Premier client préparé mais NON inventé · aucune preuve client inventée · go-live proofs non modifiés.`,
    `  Public launch reste BLOCKED · scale 80k non prouvé.`,
    `  Prochaine phase : First Customer Evidence Review.`,
  ].join("\n");
}
