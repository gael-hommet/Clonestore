// src/lib/clonestore/runtime-integration/pierre-customer-activation-e2e-final-ui-copy.ts
// PHASE 6.5 — Pierre Customer Activation E2E Final — UI Copy / Badges (pur)
//
// Microcopy stricte : « activation Pierre · parcours client contrôlé · le parcours prouve
// la première valeur, pas le lancement public · aucune exécution autonome ». Jamais
// « paiement live », « Stripe live activé », « public launch GO », « Pierre fully sellable ».

import type {
  PierreActivationStatus,
  PierreActivationPathStatus,
} from "./pierre-customer-activation-e2e-final-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PIERRE_ACTIVATION_TITLE = "Pierre — Activation client E2E";
export const PIERRE_ACTIVATION_VIEW_JOURNEY_LABEL = "Voir parcours";
export const PIERRE_ACTIVATION_VIEW_FIRST_VALUE_LABEL = "Voir première valeur";
export const PIERRE_ACTIVATION_VIEW_ACCESS_LABEL = "Voir accès";
export const PIERRE_ACTIVATION_VIEW_SCENARIOS_LABEL = "Voir scénarios";
export const PIERRE_ACTIVATION_VIEW_EVIDENCE_LABEL = "Voir preuves";
export const PIERRE_ACTIVATION_VIEW_BLOCKERS_LABEL = "Voir blockers";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PIERRE_ACTIVATION_MICROCOPY = "Activation Pierre · parcours client contrôlé";
export const PIERRE_ACTIVATION_FIRST_VALUE = "Le parcours prouve la première valeur, pas le lancement public.";
export const PIERRE_ACTIVATION_NO_AUTONOMOUS = "Aucune exécution autonome n'est activée.";
export const PIERRE_ACTIVATION_STRIPE_FUTURE =
  "Stripe live / production restent à prouver avant public launch.";
export const PIERRE_ACTIVATION_NEXT_P6_6 =
  "Prochaine étape : P6.6 — Pierre Sellable Gate 100%.";
export const PIERRE_ACTIVATION_PANEL_GUARDRAIL =
  "Activation Pierre · parcours client contrôlé. Le parcours prouve la première valeur, pas le lancement public. Aucune exécution autonome n'est activée. Stripe live / production restent à prouver avant public launch. Prochaine étape : P6.6 — Pierre Sellable Gate 100%.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PierreActivationStatus, string> = {
  e2e_path_ready: "Parcours E2E prêt",
  first_paid_customer_path_ready: "Parcours premier client payant prêt",
  blocked: "Bloqué",
};

const PATH_STATUS_LABELS: Record<PierreActivationPathStatus, string> = {
  ready: "Prêt",
  ready_local: "Prêt (local)",
  design_ready: "Design prêt",
  needs_live_proof: "Preuve live requise",
  blocked: "Bloqué",
};

export function getPierreActivationStatusLabel(status: PierreActivationStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPierreActivationPathStatusLabel(status: PierreActivationPathStatus): string {
  return PATH_STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PierreActivationBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PierreActivationBadge = {
  id: string;
  label: string;
  tone: PierreActivationBadgeTone;
};

export function buildPierreActivationBadges(): PierreActivationBadge[] {
  return [
    { id: "act-path-ready", label: "Parcours première vente", tone: "success" },
    { id: "act-no-live-payment", label: "Aucun paiement live", tone: "neutral" },
    { id: "act-no-autonomous", label: "Aucune exécution autonome", tone: "neutral" },
    { id: "act-not-public", label: "Pas lancement public", tone: "neutral" },
    { id: "act-next-p66", label: "Prochaine étape P6.6", tone: "info" },
  ];
}
