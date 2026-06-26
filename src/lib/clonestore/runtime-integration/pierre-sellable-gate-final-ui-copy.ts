// src/lib/clonestore/runtime-integration/pierre-sellable-gate-final-ui-copy.ts
// PHASE 6.6 — Pierre Sellable Gate Final — UI Copy / Badges (pur)
//
// Microcopy stricte : « Sellable Gate Pierre · verdict contrôlé · Pierre est vendable pour
// une première vente contrôlée avec limites · Pierre n'est pas encore prêt pour un lancement
// public ». Jamais « public launch GO », « fully sellable public », « scale 80k prouvé ».

import type {
  PierreSellableGateStatus,
  PierreSellabilityLevel,
  PierreSellabilityVerdict,
} from "./pierre-sellable-gate-final-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PIERRE_GATE_TITLE = "Pierre — Sellable Gate Final";
export const PIERRE_GATE_VIEW_VERDICT_LABEL = "Voir verdict";
export const PIERRE_GATE_VIEW_EVIDENCE_LABEL = "Voir preuves";
export const PIERRE_GATE_VIEW_ALLOWED_LABEL = "Voir promesses autorisées";
export const PIERRE_GATE_VIEW_FORBIDDEN_LABEL = "Voir promesses interdites";
export const PIERRE_GATE_VIEW_CONDITIONS_LABEL = "Voir conditions de vente contrôlée";
export const PIERRE_GATE_VIEW_BLOCKERS_LABEL = "Voir blockers public launch";
export const PIERRE_GATE_VIEW_NEXT_LABEL = "Voir prochaine étape";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_GATE_MICROCOPY = "Sellable Gate Pierre · verdict contrôlé";
export const PIERRE_GATE_CONTROLLED_SELLABLE =
  "Pierre est vendable pour une première vente contrôlée avec limites.";
export const PIERRE_GATE_NOT_PUBLIC =
  "Pierre n'est pas encore prêt pour un lancement public.";
export const PIERRE_GATE_REMAINING =
  "Stripe live, Supabase prod, domaine/email et scale restent à prouver.";
export const PIERRE_GATE_NEXT_PHASE =
  "Prochaine étape : External Go-Live Proofs / First Live Customer.";
export const PIERRE_GATE_PANEL_GUARDRAIL =
  "Sellable Gate Pierre · verdict contrôlé. Pierre est vendable pour une première vente contrôlée avec limites. Pierre n'est pas encore prêt pour un lancement public. Stripe live, Supabase prod, domaine/email et scale restent à prouver. Prochaine étape : External Go-Live Proofs / First Live Customer.";

// ── Labels ────────────────────────────────────────────────────────────────────

const GATE_STATUS_LABELS: Record<PierreSellableGateStatus, string> = {
  controlled_sellability_ready: "Vendabilité contrôlée prête",
  blocked: "Bloqué",
  public_launch_blocked: "Lancement public bloqué",
};

const LEVEL_LABELS: Record<PierreSellabilityLevel, string> = {
  not_sellable: "Non vendable",
  demo_sellable: "Vendable en demo",
  controlled_first_customer_sellable: "Vendable premier client contrôlé",
  public_launch_sellable: "Vendable lancement public",
  scale_sellable: "Vendable à grande échelle",
};

const VERDICT_LABELS: Record<PierreSellabilityVerdict, string> = {
  READY_WITH_LIMITS: "Prêt avec limites",
  BLOCKED: "Bloqué",
  NOT_PROVEN: "Non prouvé",
};

export function getPierreGateStatusLabel(status: PierreSellableGateStatus): string {
  return GATE_STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPierreSellabilityLevelLabel(level: PierreSellabilityLevel): string {
  return LEVEL_LABELS[level] ?? "Niveau inconnu";
}

export function getPierreSellabilityVerdictLabel(verdict: PierreSellabilityVerdict): string {
  return VERDICT_LABELS[verdict] ?? "Verdict inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreGateBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreGateBadge = {
  id: string;
  label: string;
  tone: PierreGateBadgeTone;
};

export function buildPierreGateBadges(): PierreGateBadge[] {
  return [
    { id: "gate-controlled-ready", label: "Premier client contrôlé : prêt avec limites", tone: "success" },
    { id: "gate-public-blocked", label: "Lancement public : bloqué", tone: "warning" },
    { id: "gate-scale-not-proven", label: "Scale 80k : non prouvé", tone: "neutral" },
    { id: "gate-no-live-payment", label: "Aucun paiement live", tone: "neutral" },
    { id: "gate-next-external", label: "Prochaine étape : External Go-Live Proofs", tone: "info" },
  ];
}
