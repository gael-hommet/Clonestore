// src/lib/clonestore/runtime-integration/pierre-state-server-activation-decision-gate.ts
// PHASE 6.3 — Pierre State/Server Activation Decision Gate (pur)
//
// DECISION GATE. Recommande la stratégie d'état/serveur/runtime pour une première vente
// contrôlée, SANS rien activer. N'applique pas le SQL. N'active pas le flag. Ne crée pas
// de route. Ne déclenche pas le runtime. Aucun email réel. Aucun document officiel.
// Aucun appel réseau / IA. Première vente contrôlée ≠ lancement public.

import type {
  PierreStateStrategyItem,
  PierreStateStrategyAppliesTo,
  PierreStateStrategyDecision,
  PierreDecisionGateApproval,
  PierreDecisionGateRisk,
  PierreDecisionGateDependencyItem,
  PierreStateServerActivationDecisionGate,
} from "./pierre-state-server-activation-decision-gate-types";

// ── Strategy items ────────────────────────────────────────────────────────────

function strategy(
  id: string,
  title: string,
  applies_to: PierreStateStrategyAppliesTo,
  decision: PierreStateStrategyDecision,
  reason: string,
  required_conditions: string[],
  forbidden_shortcuts: string[]
): PierreStateStrategyItem {
  return { id, title, applies_to, decision, reason, required_conditions, forbidden_shortcuts };
}

function localFirstStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_local_first",
    "Local-first controlled sale",
    "first_sale",
    "allow_with_limits",
    "Les 5 scénarios RH (P6.2) sont prêts pour démo / première vente contrôlée avec human-in-the-loop ; la persistance serveur n'est pas obligatoire pour une première vente honnête.",
    ["Scénarios contrôlés démontrables", "Validation humaine des actions sensibles", "Limites affichées honnêtement", "Support manuel transparent si nécessaire"],
    ["Promettre une autonomie complète", "Présenter une démo comme une production prouvée"]
  );
}
function serverPersistenceStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_server_persistence",
    "Server persistence",
    "public_launch",
    "future",
    "La persistance serveur reste inactive tant que SQL/RLS/flag/routes ne sont pas prouvés ; non requise pour une première vente contrôlée.",
    ["SQL appliqué manuellement avec evidence", "RLS verified", "Flag explicitement activé", "Routes relues"],
    ["Appliquer le SQL sans evidence", "Activer le flag sans revue"]
  );
}
function runtimeStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_runtime",
    "Runtime execution",
    "runtime",
    "future",
    "Le runtime autonome reste inactif ; activation future seulement après P6.4/P6.5/P6.6 avec CloneGuard + CloneTrace + validation + rollback + observability.",
    ["CloneGuard actif", "CloneTrace actif", "Validation humaine", "Rollback documenté", "Observability"],
    ["Activer le runtime sans guardrails", "Exécuter sans validation humaine"]
  );
}
function emailSendingStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_email",
    "Email sending",
    "public_launch",
    "block",
    "Aucun email réel envoyé ; uniquement des brouillons soumis à validation humaine.",
    ["Identité/domaine email prouvés", "Validation humaine avant envoi"],
    ["Envoyer un email réel sans validation"]
  );
}
function officialDocumentStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_document",
    "Official document generation",
    "public_launch",
    "block",
    "Aucun document officiel généré ; uniquement des brouillons soumis à validation humaine.",
    ["Validation humaine", "Cadre légal vérifié"],
    ["Générer un document officiel automatiquement"]
  );
}
function publicLaunchStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_public_launch",
    "Public launch",
    "public_launch",
    "future",
    "Le lancement public exige serveur prod, RLS prod, Stripe live, domaine/email, paid customer E2E, legal copy review, monitoring — non prouvés.",
    ["Serveur prod + RLS prod", "Stripe live", "Domaine / email prod", "Paid customer E2E", "Legal copy review", "Monitoring"],
    ["Lancer en public sans preuves externes"]
  );
}
function scaleStrategy(): PierreStateStrategyItem {
  return strategy(
    "st_scale",
    "Scale 80k",
    "scale",
    "future",
    "Le scale 80k n'est pas prouvé ; charge à tester séparément, jamais promise sans preuve.",
    ["Tests de charge", "Architecture stateless prouvée"],
    ["Promettre 80k sans charge testée"]
  );
}

export function buildPierreDecisionGateStrategyItems(): PierreStateStrategyItem[] {
  return [
    localFirstStrategy(),
    serverPersistenceStrategy(),
    runtimeStrategy(),
    emailSendingStrategy(),
    officialDocumentStrategy(),
    publicLaunchStrategy(),
    scaleStrategy(),
  ];
}

// ── Activation conditions / no-go ─────────────────────────────────────────────

export function buildPierreDecisionGateActivationConditions(): string[] {
  return [
    "SQL appliqué manuellement avec evidence (SQL manual evidence).",
    "RLS verified dans l'environnement cible.",
    "Feature flag serveur explicitement activé.",
    "Routes serveur GET/POST relues (routes reviewed).",
    "Clés d'idempotency en place (idempotency keys).",
    "Audit events (CloneTrace) en place.",
    "Rollback documenté.",
    "Aucune surpromesse dans la copie publique.",
    "Approbation manuelle opérateur.",
    "Suite de tests verte + build vert.",
  ];
}

export function buildPierreDecisionGateNoGoConditions(): string[] {
  return [
    "SQL not applied.",
    "RLS not verified.",
    "Flag serveur false (flag false).",
    "Aucune revue de route serveur.",
    "Aucun rollback (no rollback).",
    "Aucune trace d'audit.",
    "Aucune validation humaine pour RH sensible.",
    "Copie légale publique non relue.",
    "Public launch external not validated.",
    "Scale 80k not proven.",
  ];
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export function buildPierreDecisionGateApprovals(): PierreDecisionGateApproval[] {
  const a = (
    category: string,
    required_approver: string,
    approval_level: PierreDecisionGateApproval["approval_level"],
    evidence_required: string[],
    forbidden_without_approval: string[]
  ): PierreDecisionGateApproval => ({ category, required_approver, approval_level, can_be_self_approved: false, evidence_required, forbidden_without_approval });
  return [
    a("server_persistence_activation", "Gouvernance + opérateur", "governance", ["SQL evidence", "RLS verified", "Flag review"], ["Activer la persistance serveur"]),
    a("runtime_execution", "Gouvernance", "governance", ["CloneGuard + CloneTrace", "Rollback", "Observability"], ["Exécuter le runtime autonome"]),
    a("email_sending", "Manager RH", "hr_manager", ["Identité email prouvée", "Validation humaine"], ["Envoyer un email réel"]),
    a("official_document_generation", "Manager RH / Légal", "legal", ["Validation humaine", "Cadre légal"], ["Générer un document officiel"]),
    a("payroll_actions", "Manager RH / Paie", "hr_manager", ["Validation pré-paie", "Aucune DSN/bulletin"], ["Modifier la paie réelle"]),
    a("legal_disciplinary_actions", "Légal / Direction", "legal", ["Faits vérifiés", "Validation humaine exclusive"], ["Prononcer une sanction / un licenciement"]),
    a("public_launch", "Gouvernance / Founder", "founder", ["Preuves externes complètes", "Legal copy review"], ["Déclarer le lancement public"]),
    a("scale_claims", "Gouvernance", "governance", ["Tests de charge"], ["Promettre le scale 80k"]),
  ];
}

// ── Risk matrix ───────────────────────────────────────────────────────────────

export function buildPierreDecisionGateRiskMatrix(): PierreDecisionGateRisk[] {
  return [
    { id: "r_server_early", label: "Activating server too early", severity: "high", mitigation: "Conditions d'activation + flag default false ; aucune activation en P6.3." },
    { id: "r_confuse_sale_launch", label: "Confusing controlled sale with public launch", severity: "critical", mitigation: "Première vente contrôlée ≠ lancement public — distinction explicite." },
    { id: "r_runtime_no_guardrails", label: "Runtime execution without guardrails", severity: "critical", mitigation: "Runtime futur uniquement avec CloneGuard + CloneTrace + rollback + observability." },
    { id: "r_email_doc_side_effects", label: "Email/document side effects", severity: "high", mitigation: "Brouillons uniquement ; aucun envoi/génération réel sans validation humaine." },
    { id: "r_payroll_legal", label: "Payroll/legal side effects", severity: "critical", mitigation: "Paie/sanction/licenciement bloqués ou validation humaine exclusive." },
    { id: "r_persistence_no_rls", label: "Data persistence without RLS", severity: "critical", mitigation: "RLS verified obligatoire avant toute persistance." },
    { id: "r_false_sellable", label: "False sellable claim", severity: "critical", mitigation: "Pierre non déclaré fully sellable ; gate honnête en P6.6." },
    { id: "r_scale_no_proof", label: "Scale claim without proof", severity: "medium", mitigation: "scale 80k non prouvé ; charge testée séparément." },
  ];
}

// ── Rollback / audit trace / dependency map ───────────────────────────────────

export function buildPierreDecisionGateRollbackStrategy(): string[] {
  return [
    "Garder le flag serveur false par défaut.",
    "Désactiver le flag (disable flag).",
    "Revenir au local-first (revert to local-first).",
    "Ignorer les server rows.",
    "Geler le runtime (freeze runtime).",
    "Bloquer l'exécution email/document (block email/document execution).",
    "Revoir les logs d'audit (CloneTrace).",
    "Restaurer l'état UI précédent.",
    "Communiquer en interne : aucun lancement public.",
  ];
}

export function buildPierreDecisionGateAuditTraceRequirements(): string[] {
  return [
    "decision_gate_created",
    "strategy_selected",
    "activation_not_performed",
    "risks_listed",
    "approvals_required",
    "rollback_defined",
    "no_public_launch_confirmed",
    "no_runtime_execution_confirmed",
    "ready_for_p6_4",
  ];
}

export function buildPierreDecisionGateDependencyMap(): PierreDecisionGateDependencyItem[] {
  const d = (id: string, title: string, why: string, optional: boolean): PierreDecisionGateDependencyItem => ({ id, title, why, optional });
  return [
    d("P6.4", "P6.4 — Pierre Channels & Identity Final", "Finaliser canaux & identité pour la première vente.", false),
    d("P6.4A", "P6.4A — Email/Domain Production Readiness", "Prouver domaine/email prod (si activation email future).", true),
    d("P6.5", "P6.5 — Pierre Customer Activation E2E Final", "Prouver l'activation client E2E.", false),
    d("P6.5A", "P6.5A — Stripe/Supabase Paid Customer Proof Gate", "Prouver paiement live + prod.", true),
    d("P6.6", "P6.6 — Pierre Sellable Gate 100%", "Verdict vendable honnête final.", false),
    d("P6.6A", "P6.6A — Public Launch External Proof Gate", "Preuves externes de lancement public.", true),
  ];
}

// ── Gate ──────────────────────────────────────────────────────────────────────

export function buildPierreStateServerActivationDecisionGate(
  options?: { now?: string }
): PierreStateServerActivationDecisionGate {
  const now = options?.now ?? new Date().toISOString();
  const items = buildPierreDecisionGateStrategyItems();
  const first_sale = items.find((x) => x.id === "st_local_first")!;
  const server = items.find((x) => x.id === "st_server_persistence")!;
  const runtime = items.find((x) => x.id === "st_runtime")!;
  const publicLaunch = items.find((x) => x.id === "st_public_launch")!;

  return {
    phase: "6.3",
    title: "Pierre — Decision Gate état / serveur / runtime (décision gouvernée, aucune activation)",
    generated_at: now,
    gate_status: "ready_for_p6_4",
    recommended_strategy: "local_first_controlled_sale",
    decision_summary:
      "Pour une première vente contrôlée : local-first / demo-proof / human-in-the-loop. Persistance serveur et runtime autonome restent inactifs. Le lancement public exige des preuves externes non encore disponibles. Aucune activation effectuée dans cette phase.",
    first_sale_state_strategy: first_sale,
    public_launch_state_strategy: publicLaunch,
    runtime_strategy: runtime,
    server_persistence_strategy: server,
    state_strategy_items: items,
    activation_conditions: buildPierreDecisionGateActivationConditions(),
    no_go_conditions: buildPierreDecisionGateNoGoConditions(),
    approval_requirements: buildPierreDecisionGateApprovals(),
    risk_matrix: buildPierreDecisionGateRiskMatrix(),
    rollback_strategy: buildPierreDecisionGateRollbackStrategy(),
    audit_trace_requirements: buildPierreDecisionGateAuditTraceRequirements(),
    p6_dependency_map: buildPierreDecisionGateDependencyMap(),
    next_phase_recommendation: "PHASE 6.4 — Pierre Channels & Identity Final / Email Domain & Contact Surface Readiness.",
    final_verdict:
      "Décision : local-first controlled sale. Aucune activation serveur / runtime. Première vente contrôlée ≠ lancement public. Pierre non déclaré fully sellable. Prochaine étape : P6.4.",
    ready_for_p6_4: true,
    server_persistence_activated: false,
    runtime_execution_activated: false,
    sql_applied: false,
    server_flag_enabled: false,
    route_created: false,
    server_get_created: false,
    server_post_created: false,
    email_sent: false,
    official_document_generated: false,
    ai_call_performed: false,
    pierre_fully_sellable_declared: false,
    public_launch_validated: false,
    scale_80k_proven: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePierreStateServerActivationDecisionGate(
  gate: PierreStateServerActivationDecisionGate
): string {
  return [
    `[Pierre Decision Gate — PHASE 6.3] statut ${gate.gate_status} · stratégie ${gate.recommended_strategy}`,
    `  Première vente : ${gate.first_sale_state_strategy.decision} · public launch : ${gate.public_launch_state_strategy.decision} · runtime : ${gate.runtime_strategy.decision} · serveur : ${gate.server_persistence_strategy.decision}`,
    `  ${gate.final_verdict}`,
    `  Aucune activation · aucune route · aucun SQL appliqué · aucune exécution · Première vente contrôlée ≠ lancement public.`,
    `  Prochaine étape : P6.4 — Pierre Channels & Identity Final.`,
  ].join("\n");
}
