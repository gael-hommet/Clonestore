// src/lib/clonestore/runtime-integration/first-live-customer-controlled-run-ui-copy.ts
// PHASE 7.2 — First Live Customer Controlled Run — UI Copy / Badges (pur)
//
// Microcopy stricte : « Premier client réel · run contrôlé · ce run prépare l'activation réelle,
// il ne déclare pas le lancement public · aucune preuve client n'est inventée · les go-live
// proofs restent manuels et vérifiables ». Jamais « client validé », « paiement vérifié »,
// « public launch GO ».

import type {
  FirstLiveCustomerRunStatus,
  FirstCustomerRiskLevel,
} from "./first-live-customer-controlled-run-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const FLC_TITLE = "Pierre — First Live Customer Run";
export const FLC_VIEW_QUALIFICATION_LABEL = "Voir qualification";
export const FLC_VIEW_RUNBOOK_LABEL = "Voir runbook";
export const FLC_VIEW_EVIDENCE_LABEL = "Voir evidence plan";
export const FLC_VIEW_NOGO_LABEL = "Voir no-go";
export const FLC_VIEW_ROLLBACK_LABEL = "Voir rollback";
export const FLC_VIEW_NEXT_LABEL = "Voir prochaine étape";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const FLC_MICROCOPY = "Premier client réel · run contrôlé";
export const FLC_NOT_PUBLIC =
  "Ce run prépare l'activation réelle, il ne déclare pas le lancement public.";
export const FLC_NO_INVENTED =
  "Aucune preuve client n'est inventée.";
export const FLC_GO_LIVE_MANUAL =
  "Les go-live proofs restent manuels et vérifiables.";
export const FLC_NEXT_PHASE =
  "Prochaine étape : First Customer Evidence Review.";
export const FLC_PANEL_GUARDRAIL =
  "Premier client réel · run contrôlé. Ce run prépare l'activation réelle, il ne déclare pas le lancement public. Aucune preuve client n'est inventée. Les go-live proofs restent manuels et vérifiables. Prochaine étape : First Customer Evidence Review.";

// ── Labels ────────────────────────────────────────────────────────────────────

const RUN_STATUS_LABELS: Record<FirstLiveCustomerRunStatus, string> = {
  ready_to_prepare_first_customer: "Prêt à préparer le premier client",
  customer_selected: "Client sélectionné",
  activation_in_progress: "Activation en cours",
  first_value_delivered: "Première valeur livrée",
  blocked: "Bloqué",
};

const RISK_LABELS: Record<FirstCustomerRiskLevel, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

export function getFlcRunStatusLabel(status: FirstLiveCustomerRunStatus): string {
  return RUN_STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getFlcRiskLabel(risk: FirstCustomerRiskLevel): string {
  return RISK_LABELS[risk] ?? "Risque inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type FlcBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type FlcBadge = {
  id: string;
  label: string;
  tone: FlcBadgeTone;
};

export function buildFlcBadges(): FlcBadge[] {
  return [
    { id: "flc-runbook-ready", label: "Runbook premier client prêt", tone: "success" },
    { id: "flc-not-public", label: "Pas lancement public", tone: "warning" },
    { id: "flc-no-invented", label: "Aucune preuve inventée", tone: "neutral" },
    { id: "flc-go-live-manual", label: "Go-live proofs manuels", tone: "neutral" },
    { id: "flc-next-review", label: "Prochaine étape : Evidence Review", tone: "info" },
  ];
}
