// src/lib/clonestore/runtime-integration/pierre-state-server-activation-decision-gate-ui-copy.ts
// PHASE 6.3 — Pierre State/Server Activation Decision Gate — UI Copy / Badges (pur)
//
// Microcopy stricte : « decision gate Pierre · aucune activation · première vente
// contrôlée ≠ lancement public · le runtime autonome reste inactif ». Jamais « serveur
// activé », « runtime exécuté », « public launch GO », « Pierre fully sellable ».

import type {
  PierreDecisionGateStatus,
  PierreDecisionGateStrategy,
  PierreStateStrategyDecision,
} from "./pierre-state-server-activation-decision-gate-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PIERRE_DECISION_GATE_TITLE = "Pierre — Decision Gate état / serveur / runtime";
export const PIERRE_DECISION_GATE_VIEW_DECISION_LABEL = "Voir décision";
export const PIERRE_DECISION_GATE_VIEW_CONDITIONS_LABEL = "Voir conditions";
export const PIERRE_DECISION_GATE_VIEW_NOGO_LABEL = "Voir no-go";
export const PIERRE_DECISION_GATE_VIEW_APPROVALS_LABEL = "Voir approvals";
export const PIERRE_DECISION_GATE_VIEW_ROLLBACK_LABEL = "Voir rollback";
export const PIERRE_DECISION_GATE_VIEW_P6_LABEL = "Voir P6";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_DECISION_GATE_MICROCOPY = "Decision Gate Pierre · Aucune activation";
export const PIERRE_DECISION_GATE_SALE_VS_LAUNCH = "Première vente contrôlée ≠ lancement public.";
export const PIERRE_DECISION_GATE_RUNTIME_INACTIVE = "Le runtime autonome reste inactif.";
export const PIERRE_DECISION_GATE_SERVER_INACTIVE =
  "La persistance serveur reste inactive tant que les conditions ne sont pas prouvées.";
export const PIERRE_DECISION_GATE_NEXT_P6_4 =
  "Prochaine étape : P6.4 — Pierre Channels & Identity Final.";
export const PIERRE_DECISION_GATE_PANEL_GUARDRAIL =
  "Decision Gate Pierre · Aucune activation. Première vente contrôlée ≠ lancement public. Le runtime autonome reste inactif. La persistance serveur reste inactive tant que les conditions ne sont pas prouvées. Prochaine étape : P6.4 — Pierre Channels & Identity Final.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PierreDecisionGateStatus, string> = {
  decision_ready: "Décision prête",
  blocked: "Bloqué",
  ready_for_p6_4: "Prêt pour P6.4",
};

const STRATEGY_LABELS: Record<PierreDecisionGateStrategy, string> = {
  local_first_controlled_sale: "Local-first — première vente contrôlée",
  governed_server_persistence_before_sale: "Persistance serveur gouvernée avant vente",
  runtime_activation_before_sale: "Activation runtime avant vente",
  public_launch_requires_server: "Lancement public nécessite serveur",
};

const DECISION_LABELS: Record<PierreStateStrategyDecision, string> = {
  allow: "Autorisé",
  allow_with_limits: "Autorisé avec limites",
  block: "Bloqué",
  future: "Futur",
};

export function getPierreDecisionGateStatusLabel(status: PierreDecisionGateStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPierreDecisionGateStrategyLabel(strategy: PierreDecisionGateStrategy): string {
  return STRATEGY_LABELS[strategy] ?? "Stratégie inconnue";
}

export function getPierreDecisionGateDecisionLabel(decision: PierreStateStrategyDecision): string {
  return DECISION_LABELS[decision] ?? "Décision inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreDecisionGateBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreDecisionGateBadge = {
  id: string;
  label: string;
  tone: PierreDecisionGateBadgeTone;
};

export function buildPierreDecisionGateBadges(): PierreDecisionGateBadge[] {
  return [
    { id: "dg-local-first", label: "Local-first vente contrôlée", tone: "success" },
    { id: "dg-no-activation", label: "Aucune activation", tone: "neutral" },
    { id: "dg-server-inactive", label: "Serveur inactif", tone: "neutral" },
    { id: "dg-runtime-inactive", label: "Runtime inactif", tone: "neutral" },
    { id: "dg-not-public", label: "Pas lancement public", tone: "neutral" },
  ];
}
