// src/lib/clonestore/runtime-integration/pierre-customer-activation-e2e-final.ts
// PHASE 6.5 — Pierre Customer Activation E2E Final / First Paid Customer Proof Path (pur)
//
// Décrit le parcours client de bout en bout pour une PREMIÈRE VENTE CONTRÔLÉE, sans rien
// activer en live. Aucun paiement live. Aucun appel Stripe live / Supabase prod. Aucun
// runtime. Aucun email réel. Aucun document officiel. Aucun appel IA. Première vente
// contrôlée ≠ public launch.

import type {
  PierreCustomerJourneyStep,
  PierreActivationPathItem,
  PierreActivationPathStatus,
  PierreFirstValuePath,
  PierreAccessControlRow,
  PierreCustomerState,
  PierreOnboardingHandoff,
  PierreScenarioEntryPoint,
  PierreFirstMissionFlowStep,
  PierreActivationEvidenceItem,
  PierreCustomerActivationE2EFinalReport,
} from "./pierre-customer-activation-e2e-final-types";

// ── Customer journey steps (A → J) ────────────────────────────────────────────

function journey(
  id: string,
  letter: string,
  label: string,
  route: string,
  customer_understanding: string
): PierreCustomerJourneyStep {
  return { id, letter, label, route, customer_understanding, no_autonomous_execution_confirmed: true };
}

export function buildPierreCustomerJourneySteps(): PierreCustomerJourneyStep[] {
  return [
    journey("cj_discover", "A", "Discover Pierre", "/agents/pierre", "Le client découvre Pierre à 449€/mois et comprend que Pierre est un employé IA RH, pas un simple outil IA."),
    journey("cj_demo", "B", "Demo Pierre", "/demo/pierre", "Le client voit les 5 scénarios RH et comprend les limites et les validations humaines."),
    journey("cj_checkout", "C", "Checkout", "/checkout", "Prix Pierre 449€/mois ; CGV/confidentialité visibles ; Stripe live non prouvé dans cette phase."),
    journey("cj_success", "D", "Payment success", "/paiement/success", "CTA « Configurer Pierre » ; état d'activation à vérifier."),
    journey("cj_signup", "E", "Signup / account", "/signup", "Le client crée un compte et accède à son profil."),
    journey("cj_profile", "F", "Profile agents", "/profile/agents", "Pierre est visible ; l'access gate reste cohérent."),
    journey("cj_setup", "G", "Setup Pierre", "/agents/pierre/setup", "Onboarding / empreinte entreprise : approbateurs, règles, contexte."),
    journey("cj_use", "H", "Use Pierre", "/agents/pierre/use", "Cockpit accessible si accès actif ; NoAccessGate sinon."),
    journey("cj_first_mission", "I", "First controlled mission", "/profile/messages", "Scénario RH sélectionné → mission locale contrôlée ; aucune exécution autonome ; validation humaine."),
    journey("cj_first_output", "J", "First useful output", "/profile/messages", "Livrables brouillons / checklist / plan RH ; trace visible ; limites visibles."),
  ];
}

// ── Activation path matrix ────────────────────────────────────────────────────

function pathItem(
  id: string,
  route: string,
  expected_state: string,
  customer_visible_goal: string,
  proof_required: string,
  status: PierreActivationPathStatus,
  blocking_before_first_sale: boolean,
  blocking_before_public_launch: boolean
): PierreActivationPathItem {
  return { id, route, expected_state, customer_visible_goal, proof_required, status, blocking_before_first_sale, blocking_before_public_launch };
}

export function buildPierreActivationPathMatrix(): PierreActivationPathItem[] {
  return [
    pathItem("ap_discover", "/agents/pierre", "Page publique chargée", "Comprendre l'offre Pierre", "Copie publique alignée", "ready", false, false),
    pathItem("ap_demo", "/demo/pierre", "Demo affichée", "Voir les 5 scénarios RH", "Demo contrôlée", "ready", false, false),
    pathItem("ap_checkout", "/checkout", "Checkout affiché (449€/mois)", "Payer / activer", "Stripe live prouvé", "needs_live_proof", false, true),
    pathItem("ap_success", "/paiement/success", "Succès paiement", "Configurer Pierre", "Stripe live + webhook prouvés", "needs_live_proof", false, true),
    pathItem("ap_signup", "/signup", "Compte créé", "Accéder au profil", "Auth Supabase", "ready", false, false),
    pathItem("ap_profile", "/profile/agents", "Pierre visible", "Accéder à Pierre", "Access gate cohérent", "ready", false, false),
    pathItem("ap_setup", "/agents/pierre/setup", "Setup / empreinte", "Configurer le contexte RH", "Empreinte locale", "ready_local", false, false),
    pathItem("ap_use", "/agents/pierre/use", "Cockpit accessible", "Utiliser Pierre", "Access active", "ready_local", false, false),
    pathItem("ap_first_mission", "/profile/messages", "Mission locale contrôlée", "Lancer une première mission", "Chaîne P5 locale", "ready_local", false, false),
    pathItem("ap_first_output", "/profile/messages", "Premier livrable préparé", "Obtenir un premier résultat utile", "Brouillons + trace", "ready_local", false, false),
  ];
}

// ── First value path ──────────────────────────────────────────────────────────

export function buildPierreFirstValuePath(): PierreFirstValuePath {
  return {
    steps: [
      "Le client voit la demo Pierre.",
      "Le client achète ou est activé en controlled sale.",
      "Succès → Configurer Pierre.",
      "Setup → empreinte entreprise minimum.",
      "Use Pierre → choisir un scénario RH.",
      "Pierre prépare une mission contrôlée.",
      "Le client voit tâches, validations, livrables, trace.",
      "Aucune exécution autonome.",
      "Le client comprend la valeur immédiate.",
    ],
    expected_time_to_value: "Quelques minutes (parcours contrôlé).",
    proof_artifacts: [
      "Captures du parcours (demo → setup → use).",
      "Mission locale contrôlée créée.",
      "Brouillons / checklist / plan RH préparés.",
      "Trace CloneTrace visible.",
    ],
    customer_success_criteria: [
      "Le client comprend ce qu'il achète.",
      "Le client obtient un premier livrable RH utile.",
      "Les actions sensibles sont signalées / bloquées.",
    ],
    failure_modes: [
      "Empreinte entreprise incomplète.",
      "Access gate incohérent.",
      "Attente d'autonomie complète non prouvée.",
    ],
    fallback_steps: [
      "Compléter l'empreinte entreprise.",
      "Repasser par la demo contrôlée.",
      "Rappeler les limites honnêtes de Pierre.",
    ],
    no_autonomous_execution: true,
  };
}

// ── Access control matrix ─────────────────────────────────────────────────────

function access(
  customer_state: PierreCustomerState,
  can_access_profile_agents: boolean,
  can_access_setup: boolean,
  can_access_use: boolean,
  can_start_controlled_mission: boolean,
  reason: string
): PierreAccessControlRow {
  return {
    customer_state,
    can_access_profile_agents,
    can_access_setup,
    can_access_use,
    can_start_controlled_mission,
    can_execute_runtime: false,
    can_send_email: false,
    reason,
  };
}

export function buildPierreAccessControlMatrix(): PierreAccessControlRow[] {
  return [
    access("unpaid", true, false, false, false, "Demo / pas d'accès Use ; achat requis."),
    access("paid_active", true, true, true, true, "Accès setup/use ; mission locale contrôlée autorisée."),
    access("trialing", true, true, true, true, "Actif si la politique repo l'autorise (statuts d'approbation)."),
    access("cancelled", true, false, false, false, "NoAccessGate ; accès Use coupé."),
    access("expired", true, false, false, false, "NoAccessGate ; accès Use coupé."),
    access("internal_demo", true, false, false, false, "Demo uniquement."),
    access("first_controlled_sale_customer", true, true, true, true, "Setup/use/mission locale contrôlée autorisés ; aucune exécution runtime."),
  ];
}

// ── Onboarding → Pierre handoff ───────────────────────────────────────────────

export function buildPierreOnboardingHandoff(): PierreOnboardingHandoff {
  return {
    enterprise_name_field: "Nom de l'entreprise (empreinte).",
    rh_context: "Contexte RH : taille, sites, conventions, sensibilités.",
    employee_data_minimal: ["Effectif minimal", "Sites", "Managers"],
    approvers: ["Approbateur RH", "Approbateur légal (si sensible)"],
    rules: ["Validation humaine des actions sensibles", "Pas de paie officielle", "Pas de sanction automatique"],
    risk_settings: ["Niveau de prudence RH", "Domaines sensibles"],
    scenario_preferences: ["Scénarios prioritaires (S1 → S5)"],
    missing_fields: ["Approbateurs à confirmer", "Sites à compléter"],
    handoff_to_pierre_setup: "/agents/pierre/setup",
    handoff_to_pierre_use: "/agents/pierre/use",
    no_server_persistence_confirmed: true,
  };
}

// ── Scenario entry points (S1 → S5) ───────────────────────────────────────────

function entry(
  id: string,
  scenario: string,
  trigger_label: string,
  expected_output: string
): PierreScenarioEntryPoint {
  return { id, scenario, route_surface: "/profile/messages", trigger_label, expected_output, human_validation_needed: true, no_autonomous_execution_confirmed: true };
}

export function buildPierreScenarioEntryPoints(): PierreScenarioEntryPoint[] {
  return [
    entry("S1", "Embauche / onboarding RH", "Préparer un recrutement", "Fiche de poste + critères + checklist (brouillons)."),
    entry("S2", "Absence / organisation équipe", "Organiser la journée", "Plan + messages managers (brouillons)."),
    entry("S3", "Pré-paie / variables", "Préparer la pré-paie", "Variables + anomalies (aucune DSN/bulletin)."),
    entry("S4", "Multi-site / coordination", "Préparer un plan multi-site", "Plan d'organisation (aucune affectation imposée)."),
    entry("S5", "Cas sensible / recadrage", "Préparer un recadrage prudent", "Trame factuelle + risques (aucune sanction)."),
  ];
}

// ── First mission controlled flow ─────────────────────────────────────────────

function flowStep(id: string, step: string, description: string): PierreFirstMissionFlowStep {
  return { id, step, description, can_execute_runtime: false, real_action: false, email: false, document_official: false };
}

export function buildPierreFirstMissionControlledFlow(): PierreFirstMissionFlowStep[] {
  return [
    flowStep("fm_select", "select scenario", "Le client choisit un scénario RH (S1 → S5)."),
    flowStep("fm_prefill", "prefill prompt", "La demande est pré-remplie depuis le scénario."),
    flowStep("fm_create_draft", "create local controlled mission draft", "Création d'une mission contrôlée LOCALE (localStorage)."),
    flowStep("fm_review", "review", "Revue locale de la mission."),
    flowStep("fm_approve", "approve local", "Approbation locale (jamais une exécution)."),
    flowStep("fm_preflight", "preflight", "Preflight local : readiness, jamais exécution."),
    flowStep("fm_prepare_output", "prepare output", "Préparation des livrables brouillons."),
    flowStep("fm_trace", "trace", "Trace CloneTrace des actions préparées."),
    flowStep("fm_stop", "stop before execution", "Arrêt avant toute exécution ; aucune action réelle."),
  ];
}

// ── Traceability / human validation / limits / evidence ───────────────────────

export function buildPierreActivationTraceabilityRequirements(): string[] {
  return [
    "customer_journey_started",
    "demo_viewed",
    "checkout_path_viewed",
    "payment_success_path_viewed",
    "setup_started",
    "enterprise_footprint_captured",
    "pierre_access_checked",
    "scenario_selected",
    "controlled_mission_draft_created",
    "human_validation_required",
    "output_prepared",
    "no_runtime_execution_confirmed",
    "first_value_reached",
    "public_launch_not_validated",
  ];
}

export function buildPierreActivationHumanValidationRequirements(): string[] {
  return [
    "Recruitment contract / promise (validation humaine).",
    "Absence sanction / payroll (validation humaine).",
    "Pre-payroll DSN / payslip (validation humaine ; jamais généré).",
    "Multi-site forced assignment (validation humaine).",
    "Sensitive HR disciplinary action (validation humaine exclusive).",
    "Email send (validation humaine).",
    "Official document (validation humaine).",
  ];
}

export function buildPierreActivationCustomerVisibleLimits(): string[] {
  return [
    "Pierre prépare, l'humain valide.",
    "Aucun email n'est envoyé sans validation.",
    "Les documents officiels restent soumis à validation humaine.",
    "La pré-paie n'est pas une paie officielle.",
    "Les actions sensibles sont bloquées ou escaladées.",
    "Cette première activation ne vaut pas lancement public.",
  ];
}

export function buildPierreActivationEvidenceChecklist(): PierreActivationEvidenceItem[] {
  const ev = (id: string, label: string, expected: string): PierreActivationEvidenceItem => ({ id, label, expected });
  return [
    ev("ev_discover_demo", "Découverte + demo", "Captures /agents/pierre + /demo/pierre"),
    ev("ev_checkout", "Checkout (controlled)", "Capture /checkout 449€/mois ; Stripe live non prouvé"),
    ev("ev_setup", "Setup / empreinte", "Empreinte entreprise minimale capturée"),
    ev("ev_first_mission", "Première mission contrôlée", "Mission locale créée + revue + preflight"),
    ev("ev_first_value", "Premier livrable", "Brouillons + trace visibles"),
    ev("ev_no_execution", "No-execution", "Aucune exécution / email / document officiel"),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildPierreCustomerActivationE2EFinalReport(
  options?: { now?: string }
): PierreCustomerActivationE2EFinalReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "6.5",
    title: "Pierre — Activation client E2E / first paid customer proof path (parcours contrôlé)",
    generated_at: now,
    activation_status: "first_paid_customer_path_ready",
    customer_journey_steps: buildPierreCustomerJourneySteps(),
    activation_path_matrix: buildPierreActivationPathMatrix(),
    proof_path: [
      "Découverte → demo → checkout (controlled) → success → compte → profil → setup → use → mission contrôlée → premier livrable.",
      "Chaque étape est lisible et testable.",
      "Aucune exécution autonome, aucun paiement live, aucun email réel.",
    ],
    first_value_path: buildPierreFirstValuePath(),
    access_control_matrix: buildPierreAccessControlMatrix(),
    onboarding_to_pierre_handoff: buildPierreOnboardingHandoff(),
    scenario_entry_points: buildPierreScenarioEntryPoints(),
    first_mission_controlled_flow: buildPierreFirstMissionControlledFlow(),
    traceability_requirements: buildPierreActivationTraceabilityRequirements(),
    human_validation_requirements: buildPierreActivationHumanValidationRequirements(),
    customer_visible_limits: buildPierreActivationCustomerVisibleLimits(),
    first_paid_customer_evidence_checklist: buildPierreActivationEvidenceChecklist(),
    public_launch_blockers: [
      "Stripe live non prouvé.",
      "Supabase prod / RLS non prouvés.",
      "Domaine / email prod non prouvés.",
      "Copie publique légale/commerciale à relire.",
      "scale 80k non prouvé.",
    ],
    remaining_gaps: [
      "Preuves live (Stripe/Supabase/domaine) pour public launch.",
      "Verdict vendable final (P6.6).",
    ],
    recommended_next_phase: "PHASE 6.6 — Pierre Sellable Gate 100% / Final Controlled Sellability Verdict.",
    final_verdict:
      "Parcours client E2E prêt pour une première vente contrôlée et démontrable. Aucun paiement live, aucune exécution autonome. Pierre non déclaré fully sellable, public launch non validé. Prochaine étape : P6.6.",
    ready_for_p6_6: true,
    first_paid_customer_path_ready: true,
    first_paid_customer_e2e_proven_live: false,
    stripe_live_payment_performed: false,
    supabase_prod_verified: false,
    runtime_execution_active: false,
    server_persistence_active: false,
    real_email_sent: false,
    official_document_generated: false,
    ai_call_performed: false,
    env_modified: false,
    sql_applied: false,
    pierre_fully_sellable_declared: false,
    public_launch_validated: false,
    scale_80k_proven: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePierreCustomerActivationE2EFinalReport(
  report: PierreCustomerActivationE2EFinalReport
): string {
  return [
    `[Pierre Activation E2E — PHASE 6.5] statut ${report.activation_status}`,
    `  Étapes parcours : ${report.customer_journey_steps.length} · scénarios : ${report.scenario_entry_points.length} · flow mission : ${report.first_mission_controlled_flow.length}`,
    `  ${report.final_verdict}`,
    `  Aucun paiement live · aucune exécution autonome · aucun email réel · aucun document officiel.`,
    `  Première vente contrôlée ≠ public launch · Pierre NON fully sellable · scale 80k NON prouvé.`,
    `  Prochaine étape : P6.6 — Pierre Sellable Gate 100%.`,
  ].join("\n");
}
