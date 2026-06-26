// src/lib/clonestore/runtime-integration/pierre-sellable-gate-final.ts
// PHASE 6.6 — Pierre Sellable Gate 100% / Final Controlled Sellability Verdict (pur)
//
// Produit le verdict de vendabilité FINAL et HONNÊTE de Pierre, sans rien activer. Distingue
// trois niveaux : (1) premier client contrôlé → READY_WITH_LIMITS ; (2) lancement public →
// BLOCKED ; (3) grande échelle 80k → NOT_PROVEN. Aucun paiement live, aucune exécution,
// aucun email réel, aucune preuve inventée. P6.6 ≠ production go-live.

import type {
  PierreP6PhaseMatrixRow,
  PierrePhaseMatrixStatus,
  PierreSellabilityVerdictRow,
  PierreSellabilityVerdict,
  PierreSellabilityVerdictTier,
  PierreEvidenceSummaryItem,
  PierreRiskMatrixRow,
  PierreRiskSeverity,
  PierreOperationalPlaybookStep,
  PierreOperatorChecklistItem,
  PierreSellableGateFinalReport,
} from "./pierre-sellable-gate-final-types";

// ── P6 phase matrix (P6.1 → P6.5) ─────────────────────────────────────────────

function phaseRow(
  id: string,
  phase: string,
  label: string,
  status: PierrePhaseMatrixStatus,
  contribution: string
): PierreP6PhaseMatrixRow {
  return { id, phase, label, status, contribution };
}

export function buildPierreP6PhaseMatrix(): PierreP6PhaseMatrixRow[] {
  return [
    phaseRow("p6_1", "P6.1", "Sellable audit", "validated", "Connaît les gaps : Pierre n'est pas fully sellable, blocker matrix dressée."),
    phaseRow("p6_2", "P6.2", "5 HR scenarios", "validated", "Prouve la valeur RH concrète (S1 → S5) avec validations humaines."),
    phaseRow("p6_3", "P6.3", "Decision gate", "validated", "Stratégie local-first controlled sale ; runtime/server inactifs."),
    phaseRow("p6_4", "P6.4", "Channels & identity", "validated", "Identité Pierre claire + canaux ; email/domaine non connectés (draft)."),
    phaseRow("p6_5", "P6.5", "Customer activation E2E", "validated", "Parcours premier client (discover → première valeur) ; aucun paiement live."),
  ];
}

// ── Sellability verdict matrix (3 tiers) ──────────────────────────────────────

function verdictRow(
  id: string,
  tier: PierreSellabilityVerdictTier,
  label: string,
  verdict: PierreSellabilityVerdict,
  conditions: string[],
  blockers: string[]
): PierreSellabilityVerdictRow {
  return { id, tier, label, verdict, conditions, blockers };
}

export function buildPierreSellabilityVerdictMatrix(): PierreSellabilityVerdictRow[] {
  return [
    verdictRow(
      "verdict_controlled",
      "controlled_first_customer",
      "Premier client contrôlé",
      "READY_WITH_LIMITS",
      [
        "Le client comprend les limites.",
        "Paiement / activation contrôlée (encadrée).",
        "Usage local-first.",
        "5 scénarios RH disponibles.",
        "L'humain valide les actions sensibles.",
        "Aucun runtime autonome.",
        "Aucun email réel envoyé.",
        "Support opérateur manuel possible.",
        "Aucune promesse de lancement public.",
      ],
      []
    ),
    verdictRow(
      "verdict_public",
      "public_launch",
      "Lancement public",
      "BLOCKED",
      [],
      [
        "Stripe live non prouvé.",
        "Supabase prod / RLS non prouvés.",
        "Domaine / email prod non prouvés.",
        "Revue légale / commerciale non finalisée.",
        "Paid customer E2E live non prouvé.",
        "Support / monitoring prod non prouvés.",
      ]
    ),
    verdictRow(
      "verdict_scale",
      "scale_80k",
      "Grande échelle (80k)",
      "NOT_PROVEN",
      [],
      [
        "Load tests non réalisés.",
        "Queue / rate limits non prouvés.",
        "DB scaling non prouvé.",
        "Support scaling non prouvé.",
        "Cost scaling non prouvé.",
      ]
    ),
  ];
}

// ── Evidence summary ──────────────────────────────────────────────────────────

function evidence(
  id: string,
  phase: string,
  label: string,
  ev: string
): PierreEvidenceSummaryItem {
  return { id, phase, label, evidence: ev };
}

export function buildPierreSellableEvidenceSummary(): PierreEvidenceSummaryItem[] {
  return [
    evidence("ev_audit", "P6.1", "Audit evidence", "Master audit : sellable_level non fully_sellable, gaps + blocker matrix documentés."),
    evidence("ev_scenarios", "P6.2", "Scenarios evidence", "5 scénarios RH (S1 → S5) avec blocages CloneGuard sur actions absolues."),
    evidence("ev_decision", "P6.3", "Decision evidence", "Decision gate : recommended_strategy local_first_controlled_sale ; runtime/server inactifs."),
    evidence("ev_identity", "P6.4", "Identity evidence", "Identité Pierre + matrice 8 canaux + readiness email/domaine (tout verified:false)."),
    evidence("ev_journey", "P6.5", "Journey evidence", "Parcours client E2E (10 étapes A→J) + first value path ; aucun paiement live."),
    evidence("ev_commands", "P6.6", "Validation commands", "tsc clean, suites par phase vertes, pfinal02, npm test, build clean."),
    evidence("ev_invariants", "P6.6", "No-activation invariants", "Aucun Stripe live, aucun runtime, aucun email réel, aucun SQL appliqué, aucun env modifié."),
  ];
}

// ── Controlled sale conditions ────────────────────────────────────────────────

export function buildPierreControlledSaleConditions(): string[] {
  return [
    "Vente encadrée (premier client contrôlé).",
    "Contrat / CGV avec limites claires.",
    "Le client est informé que c'est une première activation contrôlée.",
    "Aucune promesse d'email live.",
    "Aucune promesse de runtime autonome.",
    "Aucune promesse de paie officielle.",
    "Usage cockpit / demo / setup / use.",
    "Missions contrôlées (local-first).",
    "Validations humaines des actions sensibles.",
    "Support manuel assumé.",
    "Logs / evidence collectés.",
    "Feedback client recueilli.",
    "Aucune revendication de lancement public.",
  ];
}

// ── Public launch blockers ────────────────────────────────────────────────────

export function buildPierrePublicLaunchBlockers(): string[] {
  return [
    "Stripe live non prouvé.",
    "Supabase prod / RLS non prouvés.",
    "Domaine / email prod non prouvés.",
    "Revue légale / commerciale non finalisée.",
    "Paid customer E2E live non prouvé.",
    "Support / monitoring prod non prouvés.",
  ];
}

// ── Scale blockers ────────────────────────────────────────────────────────────

export function buildPierreScaleBlockers(): string[] {
  return [
    "Load tests non réalisés.",
    "Queue / rate limits non prouvés.",
    "DB scaling non prouvé.",
    "Support scaling non prouvé.",
    "Cost scaling non prouvé.",
  ];
}

// ── Customer promise allowed / forbidden ──────────────────────────────────────

export function buildPierreCustomerPromiseAllowed(): string[] {
  return [
    "Pierre est un employé IA RH qui prépare et structure vos tâches RH.",
    "Pierre peut vous aider sur 5 scénarios RH concrets.",
    "Pierre prépare des brouillons, checklists, plans, analyses et points de vigilance.",
    "Les actions sensibles restent soumises à validation humaine.",
    "La première activation est contrôlée.",
    "Le but est de vous faire gagner du temps RH immédiatement.",
  ];
}

export function buildPierreCustomerPromiseForbidden(): string[] {
  return [
    "Pierre remplace totalement votre RH.",
    "Pierre envoie tous vos emails automatiquement.",
    "Pierre fait la paie officielle.",
    "Pierre signe des documents.",
    "Pierre sanctionne ou licencie.",
    "Pierre est prêt pour un lancement public massif.",
    "Pierre tient 80k clients.",
    "Stripe live / Supabase prod / email prod sont déjà prouvés.",
    "Le runtime autonome est actif.",
  ];
}

// ── Operational playbook ──────────────────────────────────────────────────────

function playbookStep(id: string, step: string, description: string): PierreOperationalPlaybookStep {
  return { id, step, description, no_runtime: true, no_email: true, no_public_claim: true };
}

export function buildPierreOperationalPlaybook(): PierreOperationalPlaybookStep[] {
  return [
    playbookStep("pb_select_customer", "select customer", "Sélectionner un premier client contrôlé adapté."),
    playbookStep("pb_explain_limits", "explain limits", "Expliquer clairement les limites au client."),
    playbookStep("pb_grant_access", "grant controlled access", "Activer un accès contrôlé."),
    playbookStep("pb_setup_together", "setup together", "Faire le setup ensemble (empreinte entreprise)."),
    playbookStep("pb_choose_scenario", "choose HR scenario", "Choisir un scénario RH (S1 → S5)."),
    playbookStep("pb_first_output", "produce first output", "Produire un premier livrable (brouillon)."),
    playbookStep("pb_human_validate", "human validate", "Valider humainement les actions sensibles."),
    playbookStep("pb_document_evidence", "document evidence", "Documenter l'evidence du parcours."),
    playbookStep("pb_collect_feedback", "collect feedback", "Recueillir le feedback client."),
    playbookStep("pb_no_email", "no email send", "Ne pas envoyer d'email réel."),
    playbookStep("pb_no_public_claim", "no public launch claim", "Ne pas déclarer de lancement public."),
  ];
}

// ── Internal operator checklist ───────────────────────────────────────────────

function checklistItem(id: string, label: string, required = true): PierreOperatorChecklistItem {
  return { id, label, required };
}

export function buildPierreInternalOperatorChecklist(): PierreOperatorChecklistItem[] {
  return [
    checklistItem("oc_qualified", "Client qualifié"),
    checklistItem("oc_contract", "Contrat / CGV validés"),
    checklistItem("oc_access", "Accès accordé"),
    checklistItem("oc_setup", "Setup complété"),
    checklistItem("oc_scenario", "Scénario choisi"),
    checklistItem("oc_mission", "Mission contrôlée créée"),
    checklistItem("oc_output", "Output préparé"),
    checklistItem("oc_human_validation", "Validation humaine faite"),
    checklistItem("oc_trace", "Trace visible"),
    checklistItem("oc_no_runtime", "Aucun runtime"),
    checklistItem("oc_no_email", "Aucun email"),
    checklistItem("oc_no_public_claim", "Aucune revendication publique"),
    checklistItem("oc_feedback", "Feedback capturé"),
  ];
}

// ── Risk matrix ───────────────────────────────────────────────────────────────

function risk(id: string, riskLabel: string, severity: PierreRiskSeverity, mitigation: string): PierreRiskMatrixRow {
  return { id, risk: riskLabel, severity, mitigation };
}

export function buildPierreSellableRiskMatrix(): PierreRiskMatrixRow[] {
  return [
    risk("rk_overclaim_public", "Overclaiming public launch", "high", "Verdict explicite : public launch BLOCKED ; promesses interdites listées."),
    risk("rk_customer_misunderstanding", "Client misunderstanding controlled sale", "high", "Contrat / CGV + explication des limites en amont."),
    risk("rk_legal_payroll", "Legal / payroll misunderstanding", "high", "Pas de paie officielle ; validation humaine exclusive ; CloneGuard bloque."),
    risk("rk_email_domain", "Email / domain confusion", "medium", "Aucun email réel ; domaine non connecté ; promesses email interdites."),
    risk("rk_runtime_expectation", "Runtime expectation mismatch", "medium", "Aucun runtime autonome ; Pierre prépare, l'humain valide."),
    risk("rk_stripe_live", "Stripe live not proven", "high", "Activation contrôlée ; Stripe live à prouver avant public launch."),
    risk("rk_supabase_prod", "Supabase prod not proven", "high", "Supabase prod / RLS à prouver avant public launch."),
    risk("rk_scale_claim", "Scale claim", "high", "Scale 80k NOT_PROVEN ; aucune revendication d'échelle."),
    risk("rk_support_burden", "Support burden", "medium", "Support manuel assumé pour le premier client contrôlé."),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildPierreSellableGateFinalReport(
  options?: { now?: string }
): PierreSellableGateFinalReport {
  const now = options?.now ?? new Date().toISOString();
  return {
    phase: "6.6",
    title: "Pierre — Sellable Gate 100% / verdict de vendabilité contrôlée final",
    generated_at: now,
    gate_status: "controlled_sellability_ready",
    final_sellability_level: "controlled_first_customer_sellable",
    controlled_first_sale_ready: true,
    first_customer_sellable_with_limits: true,
    public_launch_ready: false,
    scale_ready: false,
    evidence_summary: buildPierreSellableEvidenceSummary(),
    p6_phase_matrix: buildPierreP6PhaseMatrix(),
    sellability_verdict_matrix: buildPierreSellabilityVerdictMatrix(),
    controlled_sale_conditions: buildPierreControlledSaleConditions(),
    public_launch_blockers: buildPierrePublicLaunchBlockers(),
    scale_blockers: buildPierreScaleBlockers(),
    customer_promise_allowed: buildPierreCustomerPromiseAllowed(),
    customer_promise_forbidden: buildPierreCustomerPromiseForbidden(),
    operational_playbook: buildPierreOperationalPlaybook(),
    internal_operator_checklist: buildPierreInternalOperatorChecklist(),
    risk_matrix: buildPierreSellableRiskMatrix(),
    phase_6_closure_statement:
      "Phase 6 close le verdict de vendabilité : Pierre est vendable pour un PREMIER CLIENT CONTRÔLÉ avec limites, non vendable publiquement, non vendable à grande échelle. P6.1 → P6.5 cohérents et validés.",
    final_decision:
      "Pierre est controlled-sellable (premier client contrôlé avec limites). Pierre n'est PAS public-launch sellable. Pierre n'est PAS scale-ready. Aucun paiement live, aucune exécution autonome, aucune preuve live inventée.",
    recommended_next_phase:
      "EXTERNAL GO-LIVE PROOFS — Stripe Live / Supabase Prod RLS / Domain Email / First Live Customer Evidence.",
    ready_for_external_go_live_proofs: true,
    ready_for_first_controlled_customer: true,
    pierre_fully_sellable_public_launch: false,
    stripe_live_payment_proven: false,
    supabase_prod_verified: false,
    domain_email_prod_verified: false,
    runtime_execution_active: false,
    server_persistence_active: false,
    real_email_sent: false,
    official_document_generated: false,
    ai_call_performed: false,
    sql_applied: false,
    env_modified: false,
    public_launch_validated: false,
    scale_80k_proven: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePierreSellableGateFinalReport(
  report: PierreSellableGateFinalReport
): string {
  return [
    `[Pierre Sellable Gate — PHASE 6.6] statut ${report.gate_status} · niveau ${report.final_sellability_level}`,
    `  Premier client contrôlé : ${report.controlled_first_sale_ready ? "READY_WITH_LIMITS" : "non"} · public launch : BLOCKED · scale 80k : NOT_PROVEN`,
    `  ${report.final_decision}`,
    `  Pierre controlled-sellable, PAS public-launch sellable, PAS scale-ready.`,
    `  Aucun paiement live · aucune exécution autonome · aucune preuve live inventée.`,
    `  Prochaine phase : External Go-Live Proofs — Stripe Live / Supabase Prod RLS / Domain Email / First Live Customer.`,
  ].join("\n");
}
