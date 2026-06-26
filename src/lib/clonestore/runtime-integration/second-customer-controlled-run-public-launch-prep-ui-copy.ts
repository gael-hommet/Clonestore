// src/lib/clonestore/runtime-integration/second-customer-controlled-run-public-launch-prep-ui-copy.ts
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep — UI Copy / Badges (pur)
//
// Microcopy stricte : « Deuxième client · run contrôlé · ce gate prépare le client 2, il ne le
// démarre pas · la comparaison multi-client reste à prouver · le lancement public reste bloqué ».
// Jamais « client 2 démarré », « reproductibilité prouvée », « public launch GO ».

import type {
  SecondCustomerRunStatus,
  SecondCustomerRiskLevel,
} from "./second-customer-controlled-run-public-launch-prep-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const SC2_TITLE = "Pierre — Second Customer Controlled Run";
export const SC2_VIEW_QUALIFICATION_LABEL = "Voir qualification";
export const SC2_VIEW_RUNBOOK_LABEL = "Voir runbook";
export const SC2_VIEW_EVIDENCE_LABEL = "Voir evidence";
export const SC2_VIEW_COMPARISON_LABEL = "Voir comparaison";
export const SC2_VIEW_REPRODUCIBILITY_LABEL = "Voir reproductibilité";
export const SC2_VIEW_LAUNCH_PREP_LABEL = "Voir public launch prep";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const SC2_MICROCOPY = "Deuxième client · run contrôlé";
export const SC2_NOT_STARTED =
  "Ce gate prépare le client 2, il ne le démarre pas.";
export const SC2_MULTI_UNPROVEN =
  "La comparaison multi-client reste à prouver.";
export const SC2_NOT_PUBLIC =
  "Le lancement public reste bloqué.";
export const SC2_NEXT_PHASE =
  "Prochaine étape : Public Launch Final Review Gate.";
export const SC2_PANEL_GUARDRAIL =
  "Deuxième client · run contrôlé. Ce gate prépare le client 2, il ne le démarre pas. La comparaison multi-client reste à prouver. Le lancement public reste bloqué. Prochaine étape : Public Launch Final Review Gate.";

// ── Labels ────────────────────────────────────────────────────────────────────

const RUN_STATUS_LABELS: Record<SecondCustomerRunStatus, string> = {
  ready_to_prepare_second_customer: "Prêt à préparer le client 2",
  second_customer_selected: "Client 2 sélectionné",
  second_customer_in_progress: "Client 2 en cours",
  second_customer_completed: "Client 2 terminé",
  blocked: "Bloqué",
};

const RISK_LABELS: Record<SecondCustomerRiskLevel, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

export function getSc2RunStatusLabel(status: SecondCustomerRunStatus): string {
  return RUN_STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getSc2RiskLabel(risk: SecondCustomerRiskLevel): string {
  return RISK_LABELS[risk] ?? "Risque inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type Sc2BadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type Sc2Badge = {
  id: string;
  label: string;
  tone: Sc2BadgeTone;
};

export function buildSc2Badges(): Sc2Badge[] {
  return [
    { id: "sc2-runbook-ready", label: "Runbook client 2 prêt", tone: "success" },
    { id: "sc2-not-started", label: "Client 2 non démarré", tone: "neutral" },
    { id: "sc2-multi-unproven", label: "Multi-client à prouver", tone: "neutral" },
    { id: "sc2-public-blocked", label: "Public launch bloqué", tone: "warning" },
    { id: "sc2-next-review", label: "Prochaine étape : Public Launch Review", tone: "info" },
  ];
}
