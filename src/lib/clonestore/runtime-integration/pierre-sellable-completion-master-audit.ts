// src/lib/clonestore/runtime-integration/pierre-sellable-completion-master-audit.ts
// PHASE 6.1 — Pierre Sellable Completion Master Audit (pur)
//
// AUDIT-ONLY. Produit la carte de route stricte et honnête vers Pierre 100% vendable.
// NE DÉCLARE PAS Pierre vendable. N'ACTIVE RIEN. Aucune route. Aucun SQL appliqué.
// Aucune exécution. Aucun appel réseau / IA / paiement. Aucun moteur Pierre appelé.
// localStorage reste la seule source active de la chaîne P5.

import type {
  PierreSellableAuditClassification,
  PierreSellableAuditSection,
  PierreSellableAuditGap,
  PierreSellableAuditBlocker,
  PierreSellableAuditEvidenceItem,
  PierreSellableAuditTechnologyDependency,
  PierreSellableAuditJourneyStep,
  PierreSellableAuditRisk,
  PierreSellableAuditP6SequenceItem,
  PierreSellableAuditCapability,
  PierreSellableAuditSellableDefinition,
  PierreSellableLevel,
  PierreSellableCompletionMasterAuditReport,
} from "./pierre-sellable-completion-master-audit-types";

// ── Score par classification ──────────────────────────────────────────────────

function classificationScore(c: PierreSellableAuditClassification): number {
  switch (c) {
    case "DONE_SELLABLE":
      return 100;
    case "FUTURE_NOT_REQUIRED_FOR_FIRST_SALE":
      return 80;
    case "DONE_BUT_LOCAL_ONLY":
      return 70;
    case "READY_BUT_INACTIVE":
      return 60;
    case "PARTIAL":
      return 50;
    case "BLOCKING_BEFORE_PUBLIC_LAUNCH":
      return 40;
    case "BLOCKING_BEFORE_SALE":
      return 20;
    case "UNKNOWN_NEEDS_AUDIT":
      return 10;
  }
}

// ── Sections (A → J) ──────────────────────────────────────────────────────────

function section(
  id: string,
  title: string,
  status: PierreSellableAuditClassification,
  summary: string,
  findings: string[],
  blockers: string[],
  required_actions: string[],
  sellable_impact: string
): PierreSellableAuditSection {
  return { id, title, status, score: classificationScore(status), summary, findings, blockers, required_actions, sellable_impact };
}

export function buildPierreSellableAuditSections(): PierreSellableAuditSection[] {
  return [
    section(
      "a_product_surface",
      "A. Pierre Product Surface",
      "PARTIAL",
      "Pages publiques / setup / use / demo existent ; clarté client à aligner sur la vérité produit.",
      ["src/app/agents/pierre (page/setup/use) présents", "demo/pierre présent", "Entrée /profile/messages présente"],
      ["Truth alignment copie publique vs capacités réelles à vérifier"],
      ["Aligner la copie publique sur les capacités réelles (P6.2A si nécessaire)"],
      "Bloque la confiance client si la copie promet plus que le réel."
    ),
    section(
      "b_core_hr_workflows",
      "B. Pierre Core HR Workflows",
      "PARTIAL",
      "Le moteur RH existe ; les 5 scénarios vendables doivent être complétés de bout en bout.",
      ["Moteur Pierre (continuity / employee file / mission control) présent", "Document/reply generation conçus"],
      ["5 scénarios RH vendables non prouvés de bout en bout"],
      ["Compléter 5 scénarios RH vendables (P6.2)"],
      "Coeur de la valeur vendable — doit être prouvé."
    ),
    section(
      "c_runtime_mission_chain",
      "C. Pierre Runtime / Mission Chain",
      "READY_BUT_INACTIVE",
      "Chaîne Controlled Mission locale (P5) prête ; persistance serveur et runtime execution inactives.",
      ["P5.1 → P5.10 validés", "Local review + preflight actifs", "Final gate / transition plan / handbook prêts"],
      ["server persistence inactive", "runtime execution inactive"],
      ["Décision d'activation gouvernée (P6.3)"],
      "N'empêche pas une première vente locale ; décision serveur à prendre."
    ),
    section(
      "d_enterprise_footprint",
      "D. Enterprise Footprint / CloneADN",
      "PARTIAL",
      "Empreinte entreprise / CloneADN présents ; consommation par Pierre setup/use à finaliser.",
      ["Modules empreinte entreprise présents", "Onboarding entreprise présent", "CloneADN mémoire entreprise présent"],
      ["Consommation footprint par Pierre setup/use partielle"],
      ["Finaliser la lecture footprint par Pierre (P6.2/P6.4)"],
      "Conditionne la pertinence des réponses RH par entreprise."
    ),
    section(
      "e_guard_trace_legal",
      "E. CloneGuard / CloneTrace / Legal Boundaries",
      "PARTIAL",
      "Gouvernance forte (refus / validation / trace) ; copie légale publique à relire.",
      ["CloneGuard actions sensibles bloquées/validées", "CloneTrace audit immuable", "Limites RH/légales présentes"],
      ["Copie légale publique non relue (avant public launch)"],
      ["Relecture légale publique (avant public launch)"],
      "Réduit le risque juridique — fort pour la confiance vente."
    ),
    section(
      "f_technologies_dependency",
      "F. Technologies Dependency",
      "PARTIAL",
      "CloneOS/Guard/Trace/ADN actifs ; CloneVoice non actif ; certaines techs en roadmap.",
      ["CloneOS / CloneGuard / CloneTrace / CloneADN actifs", "CloneBrief / CloneTrust présents"],
      ["CloneVoice non actif", "CloneReview / CloneSignals en roadmap"],
      ["Confirmer dépendances minimales pour première vente"],
      "Les techs core suffisent à une première vente ; CloneVoice non requis."
    ),
    section(
      "g_customer_activation",
      "G. Customer Activation Flow",
      "PARTIAL",
      "Checkout / success / signup existent ; parcours d'activation client E2E non prouvé.",
      ["paiement / checkout / signup présents", "paiement/success + cancel présents"],
      ["Activation client E2E non prouvée (premier output utile)"],
      ["Prouver l'activation client E2E (P6.5)"],
      "Sans activation prouvée, pas de première vente sereine."
    ),
    section(
      "h_commercial_readiness",
      "H. Commercial Readiness",
      "PARTIAL",
      "Pricing 449€/mois fixé ; preuve de valeur / ROI / objections à finaliser.",
      ["Pricing 449€/mois présent", "Demo présent"],
      ["Preuve de valeur / ROI / réponses objections à finaliser", "Limites honnêtes à afficher"],
      ["Finaliser le pack valeur/ROI/objections (P6.2/P6.6)"],
      "Conditionne la conversion commerciale honnête."
    ),
    section(
      "i_external_production",
      "I. External Production Readiness",
      "BLOCKING_BEFORE_PUBLIC_LAUNCH",
      "Stripe live, Supabase prod, domaine/email prod, monitoring, go-live proofs non prouvés.",
      ["Système go-live proofs présent", "RLS production pack présent (non appliqué)"],
      ["Stripe live non prouvé", "Supabase prod / RLS non prouvés", "Domaine / email identity non prouvés", "go-live proofs non remplis"],
      ["Prouver Stripe live + Supabase prod + domaine/email (P6.4A/P6.5A)"],
      "Bloque le lancement public externe (pas la première vente contrôlée)."
    ),
    section(
      "j_launch_scale_reality",
      "J. Launch / Scale Reality",
      "BLOCKING_BEFORE_PUBLIC_LAUNCH",
      "Lancement public externe non validé ; scale 80k non prouvé ; distinguer première vente vs public launch.",
      ["Distinction première vente / public launch documentée", "Stratégie fallback à formaliser"],
      ["public launch external not validated", "scale 80k not proven"],
      ["Formaliser la stratégie de charge support + fallback (P6.6)"],
      "Empêche toute promesse publique non prouvée."
    ),
  ];
}

// ── Score / level ─────────────────────────────────────────────────────────────

export function computePierreSellableAuditScore(sections: PierreSellableAuditSection[]): number {
  if (sections.length === 0) return 0;
  const total = sections.reduce((acc, s) => acc + s.score, 0);
  return Math.round(total / sections.length);
}

function deriveSellableLevel(score: number): PierreSellableLevel {
  if (score >= 85) return "fully_sellable";
  if (score >= 65) return "first_customer_candidate";
  if (score >= 45) return "internally_demo_sellable";
  if (score >= 25) return "partially_sellable";
  return "not_sellable";
}

// ── Gap / blocker / evidence ──────────────────────────────────────────────────

export function buildPierreSellableAuditGapMatrix(): PierreSellableAuditGap[] {
  const gap = (
    id: string,
    area: string,
    current_state: string,
    required_state: string,
    severity: PierreSellableAuditGap["severity"],
    required_before: PierreSellableAuditGap["required_before"],
    owner_phase: string,
    forbidden_shortcut: string
  ): PierreSellableAuditGap => ({ id, area, current_state, required_state, severity, required_before, owner_phase, forbidden_shortcut });
  return [
    gap("g_workflows", "HR workflows", "5 scénarios vendables non prouvés", "5 scénarios prouvés E2E", "high", "first_sale", "P6.2", "Simuler un scénario comme s'il était prouvé"),
    gap("g_runtime", "Runtime execution", "runtime execution inactive", "Décision d'activation gouvernée documentée", "medium", "future", "P6.3", "Activer le runtime sans gate"),
    gap("g_server", "Server persistence", "server persistence inactive", "Activation manuelle gouvernée (phase future)", "medium", "future", "P6.3", "Appliquer le SQL sans evidence"),
    gap("g_activation", "Customer activation", "Activation client E2E non prouvée", "Activation E2E prouvée", "high", "first_sale", "P6.5", "Marquer activé sans preuve"),
    gap("g_stripe", "Paiement live", "Stripe live non prouvé", "Stripe live prouvé", "critical", "public_launch", "P6.5A", "Déclarer live sans test réel"),
    gap("g_supabase", "Supabase prod", "Supabase prod / RLS non prouvés", "Supabase prod + RLS prouvés", "critical", "public_launch", "P6.5A", "Appliquer RLS sans vérification"),
    gap("g_identity", "Domaine / email", "Domaine / email identity non prouvés", "Domaine + email identity prouvés", "high", "public_launch", "P6.4A", "Envoyer depuis une identité non vérifiée"),
    gap("g_public_launch", "Public launch", "public launch external not validated", "Preuves externes validées", "critical", "public_launch", "P6.6", "Lancer en public sans preuves"),
    gap("g_scale", "Scale", "scale 80k non prouvé", "scale prouvé séparément", "medium", "scale", "future", "Promettre 80k sans charge testée"),
  ];
}

export function buildPierreSellableAuditBlockerMatrix(): PierreSellableAuditBlocker[] {
  const b = (
    id: string,
    label: string,
    severity: PierreSellableAuditBlocker["severity"],
    required_before: PierreSellableAuditBlocker["required_before"],
    why: string,
    owner_phase: string
  ): PierreSellableAuditBlocker => ({ id, label, severity, required_before, why, owner_phase });
  return [
    b("b_workflows", "5 scénarios RH vendables non prouvés", "high", "first_sale", "Coeur de la valeur vendable.", "P6.2"),
    b("b_activation", "Paid customer E2E not proven", "critical", "first_sale", "Sans E2E payé prouvé, pas de vente sereine.", "P6.5"),
    b("b_stripe_supabase", "Stripe live / Supabase prod not proven", "critical", "public_launch", "Bloque le lancement public externe.", "P6.5A"),
    b("b_public_launch", "Public launch external not validated", "critical", "public_launch", "Aucune promesse publique sans preuves.", "P6.6"),
    b("b_scale", "Scale 80k not proven", "medium", "scale", "Charge à tester séparément.", "future"),
  ];
}

export function buildPierreSellableAuditEvidenceMatrix(): PierreSellableAuditEvidenceItem[] {
  const ev = (id: string, label: string, expected: string): PierreSellableAuditEvidenceItem => ({ id, label, expected });
  return [
    ev("ev_workflows", "5 scénarios RH", "Captures E2E des 5 scénarios (P6.2)"),
    ev("ev_activation", "Activation client E2E", "Parcours payé prouvé (P6.5)"),
    ev("ev_governance", "CloneGuard / CloneTrace", "Refus / validation / trace visibles"),
    ev("ev_external", "Production externe", "Stripe live + Supabase prod + domaine/email"),
    ev("ev_launch", "Public launch", "go-live proofs remplis + legal relu"),
  ];
}

// ── Technology dependency map ─────────────────────────────────────────────────

export function buildPierreSellableAuditTechnologyDependencyMap(): PierreSellableAuditTechnologyDependency[] {
  const t = (
    technology: string,
    role: string,
    status: PierreSellableAuditTechnologyDependency["status"],
    required_for_first_sale: boolean
  ): PierreSellableAuditTechnologyDependency => ({ technology, role, status, required_for_first_sale });
  return [
    t("CloneOS", "Orchestration / command center", "active", true),
    t("CloneGuard", "Gouvernance / actions sensibles", "active", true),
    t("CloneTrace", "Audit immuable", "active", true),
    t("CloneADN", "Mémoire entreprise", "active", true),
    t("CloneBrief", "Briefings / résumés", "active", false),
    t("CloneTrust", "Confiance / autonomie graduée", "partial", false),
    t("CloneReview", "Revue", "roadmap", false),
    t("CloneSignals", "Signaux", "roadmap", false),
    t("CloneVoice", "Voix", "not_active", false),
  ];
}

// ── Customer journey map ──────────────────────────────────────────────────────

export function buildPierreSellableAuditCustomerJourneyMap(): PierreSellableAuditJourneyStep[] {
  const j = (
    id: string,
    step: string,
    status: PierreSellableAuditJourneyStep["status"],
    sellable_impact: string
  ): PierreSellableAuditJourneyStep => ({ id, step, status, sellable_impact });
  return [
    j("cj_discover", "Découverte (page publique)", "partial", "Clarté client à aligner."),
    j("cj_demo", "Demo Pierre", "works", "Preuve illustrative présente."),
    j("cj_checkout", "Checkout / paiement", "not_proven", "E2E payé non prouvé."),
    j("cj_account", "Compte / signup", "works", "Accès compte présent."),
    j("cj_onboarding", "Onboarding entreprise", "partial", "Consommation footprint à finaliser."),
    j("cj_employee_access", "Accès employé Pierre", "works_local", "Cockpit Pierre présent."),
    j("cj_first_output", "First useful output", "not_proven", "Valeur RH visible à prouver (5 scénarios)."),
    j("cj_proof_value", "Proof of value", "not_proven", "ROI / valeur à formaliser."),
  ];
}

// ── Risk matrix ───────────────────────────────────────────────────────────────

export function buildPierreSellableAuditRiskMatrix(): PierreSellableAuditRisk[] {
  return [
    { id: "r_false_sellable", label: "Fausse déclaration vendable (false sellable claim)", severity: "critical", mitigation: "P6.1 ne déclare pas vendable ; gate honnête en P6.6." },
    { id: "r_public_before_proof", label: "Lancement public avant preuves (public launch before proof)", severity: "critical", mitigation: "public launch externe non validé ; preuves requises." },
    { id: "r_overpromise", label: "Promesse d'autonomie non prouvée", severity: "high", mitigation: "Limites affichées honnêtement ; validation humaine sur actions sensibles." },
    { id: "r_hidden_manual", label: "Intervention manuelle cachée excessive", severity: "medium", mitigation: "Handbook opérateur + workflows clairs." },
    { id: "r_scale", label: "Promesse scale 80k non prouvée", severity: "medium", mitigation: "scale 80k non prouvé ; charge testée séparément." },
  ];
}

// ── Recommended P6 sequence ───────────────────────────────────────────────────

export function buildPierreSellableAuditP6Sequence(): PierreSellableAuditP6SequenceItem[] {
  const seq = (
    id: string,
    title: string,
    why: string,
    expected_output: string,
    optional: boolean
  ): PierreSellableAuditP6SequenceItem => ({ id, title, why, expected_output, optional });
  return [
    seq("P6.2", "P6.2 — Pierre Real Workflow Completion Pack", "Compléter les 5 scénarios RH vendables.", "5 scénarios prouvés E2E.", false),
    seq("P6.2A", "P6.2A — Public Pierre Copy & Demo Truth Alignment", "Aligner la copie publique sur le réel.", "Copie publique vérité-alignée.", true),
    seq("P6.3", "P6.3 — Pierre State/Server Activation Decision Gate", "Décider l'activation serveur gouvernée.", "Decision gate documenté.", false),
    seq("P6.4", "P6.4 — Pierre Channels & Identity Final", "Finaliser canaux & identité.", "Canaux & identité finalisés.", false),
    seq("P6.4A", "P6.4A — Email/Domain Production Readiness", "Prouver domaine/email prod.", "Domaine/email prod prouvés.", true),
    seq("P6.5", "P6.5 — Pierre Customer Activation E2E Final", "Prouver l'activation client E2E.", "E2E activation validée.", false),
    seq("P6.5A", "P6.5A — Stripe/Supabase Paid Customer Proof Gate", "Prouver paiement live + prod.", "Paid customer proof gate.", true),
    seq("P6.6", "P6.6 — Pierre Sellable Gate 100%", "Verdict vendable honnête final.", "Sellable gate verdict.", false),
  ];
}

// ── Capability map ────────────────────────────────────────────────────────────

export function buildPierreSellableAuditCapabilityMap(): PierreSellableAuditCapability[] {
  const c = (id: string, capability: string, status: PierreSellableAuditClassification): PierreSellableAuditCapability => ({ id, capability, status });
  return [
    c("cap_local_mission", "Controlled Mission locale (P5)", "DONE_BUT_LOCAL_ONLY"),
    c("cap_local_review", "Revue / approbation locale", "DONE_BUT_LOCAL_ONLY"),
    c("cap_preflight", "Preflight local", "DONE_BUT_LOCAL_ONLY"),
    c("cap_server_design", "Persistance serveur (design)", "READY_BUT_INACTIVE"),
    c("cap_governance", "CloneGuard / CloneTrace", "DONE_SELLABLE"),
    c("cap_hr_workflows", "Workflows RH vendables", "PARTIAL"),
    c("cap_activation", "Activation client E2E", "BLOCKING_BEFORE_SALE"),
    c("cap_public_launch", "Lancement public externe", "BLOCKING_BEFORE_PUBLIC_LAUNCH"),
  ];
}

// ── Sellable definition ───────────────────────────────────────────────────────

export function buildPierreSellableAuditSellableDefinition(): PierreSellableAuditSellableDefinition {
  return {
    is_sellable_when: [
      "Un client comprend ce qu'il achète.",
      "Le parcours d'achat fonctionne.",
      "L'onboarding fonctionne.",
      "Pierre produit une valeur RH visible dans au moins 5 scénarios.",
      "Les actions sensibles sont bloquées ou validées par human validation.",
      "L'historique / trace est visible.",
      "Les limites sont affichées honnêtement.",
      "Aucune promesse d'autonomie non prouvée n'est faite.",
      "Le support / handbook interne sait quoi faire.",
      "Le système s'utilise sans intervention manuelle cachée excessive.",
    ],
    not_public_launch_complete_until: [
      "Stripe live prouvé.",
      "Domaine / email prod prouvés.",
      "Supabase prod / RLS prouvés.",
      "Paid customer E2E prouvé.",
      "Copie légale / commerciale publique relue.",
      "scale 80k prouvé.",
    ],
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildPierreSellableCompletionMasterAuditReport(
  options?: { now?: string }
): PierreSellableCompletionMasterAuditReport {
  const now = options?.now ?? new Date().toISOString();
  const sections = buildPierreSellableAuditSections();
  const overall_sellable_score = computePierreSellableAuditScore(sections);
  const sellable_level = deriveSellableLevel(overall_sellable_score);

  return {
    phase: "6.1",
    title: "Pierre Sellable Completion Master Audit — vers 100% vendable (audit-only)",
    generated_at: now,
    audit_status: "ready_for_p6_2",
    overall_sellable_score,
    sellable_level,
    sections,
    gap_matrix: buildPierreSellableAuditGapMatrix(),
    blocker_matrix: buildPierreSellableAuditBlockerMatrix(),
    evidence_matrix: buildPierreSellableAuditEvidenceMatrix(),
    sellable_definition: buildPierreSellableAuditSellableDefinition(),
    not_sellable_yet_reasons: [
      "Stripe live non prouvé.",
      "Supabase prod / RLS non prouvés.",
      "Domaine / email prod non prouvés.",
      "Paid customer E2E non prouvé.",
      "Public launch externe non validé.",
      "scale 80k non prouvé.",
      "5 scénarios RH vendables non prouvés E2E.",
    ],
    first_sale_minimum_requirements: [
      "5 scénarios RH vendables prouvés E2E (P6.2).",
      "Activation client E2E prouvée (P6.5).",
      "Limites affichées honnêtement.",
      "Actions sensibles bloquées / validées humainement.",
      "Historique / trace visible.",
    ],
    public_launch_minimum_requirements: [
      "Stripe live prouvé.",
      "Supabase prod / RLS prouvés.",
      "Domaine / email prod prouvés.",
      "Paid customer E2E prouvé.",
      "Copie légale / commerciale publique relue.",
      "scale 80k prouvé.",
    ],
    pierre_capability_map: buildPierreSellableAuditCapabilityMap(),
    technology_dependency_map: buildPierreSellableAuditTechnologyDependencyMap(),
    customer_journey_map: buildPierreSellableAuditCustomerJourneyMap(),
    risk_matrix: buildPierreSellableAuditRiskMatrix(),
    recommended_p6_sequence: buildPierreSellableAuditP6Sequence(),
    final_verdict: `Pierre n'est pas encore public-launch complete. Niveau actuel : ${sellable_level} (${overall_sellable_score}%). Audit prêt — passage à P6.2. Aucune déclaration vendable, aucune activation, aucune exécution.`,
    ready_for_p6_2: true,
    pierre_sellable_declared: false,
    public_launch_validated: false,
    scale_80k_proven: false,
    server_persistence_active: false,
    runtime_execution_active: false,
    pierre_runtime_active: false,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePierreSellableCompletionMasterAuditReport(
  report: PierreSellableCompletionMasterAuditReport
): string {
  return [
    `[Pierre Sellable Audit — PHASE 6.1] statut ${report.audit_status} · score ${report.overall_sellable_score}% · niveau ${report.sellable_level}`,
    `  Sections : ${report.sections.length} · gaps : ${report.gap_matrix.length} · blockers : ${report.blocker_matrix.length}`,
    `  ${report.final_verdict}`,
    `  Audit-only — Pierre NON déclaré vendable, public launch NON validé, scale 80k NON prouvé.`,
    `  Prochaine étape : P6.2 — Pierre Real Workflow Completion Pack.`,
  ].join("\n");
}
