// src/lib/clonestore/runtime-integration/public-launch-final-review-gate-ui-copy.ts
// PHASE 7.6 — Public Launch Final Review Gate — UI Copy / Badges (pur)
//
// Microcopy stricte : « Final Review · preuves réelles obligatoires · les gates internes sont
// prêts, les preuves externes ne le sont pas · Pierre reste vendable uniquement en premier client
// contrôlé avec limites · le lancement public reste bloqué · la prochaine étape doit produire des
// preuves réelles, pas un nouveau gate ». Jamais « public launch GO », « production prouvée »,
// « scale prouvé ».

import type {
  PublicLaunchReviewStatus,
  PublicLaunchScorecardDimension,
} from "./public-launch-final-review-gate-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const PLF_TITLE = "Pierre — Public Launch Final Review";
export const PLF_VIEW_VERDICT_LABEL = "Voir verdict";
export const PLF_VIEW_BLOCKERS_LABEL = "Voir blockers";
export const PLF_VIEW_PROOFS_LABEL = "Voir proofs";
export const PLF_VIEW_CLAIMS_LABEL = "Voir claims";
export const PLF_VIEW_ACTIONS_LABEL = "Voir actions réelles";
export const PLF_VIEW_CLOSURE_LABEL = "Voir clôture Phase 7";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const PLF_MICROCOPY = "Final Review · preuves réelles obligatoires";
export const PLF_INTERNAL_VS_EXTERNAL =
  "Les gates internes sont prêts, les preuves externes ne le sont pas.";
export const PLF_SELLABLE_LIMITS =
  "Pierre reste vendable uniquement en premier client contrôlé avec limites.";
export const PLF_NOT_PUBLIC =
  "Le lancement public reste bloqué.";
export const PLF_NEXT_REAL =
  "La prochaine étape doit produire des preuves réelles, pas un nouveau gate.";
export const PLF_PANEL_GUARDRAIL =
  "Final Review · preuves réelles obligatoires. Les gates internes sont prêts, les preuves externes ne le sont pas. Pierre reste vendable uniquement en premier client contrôlé avec limites. Le lancement public reste bloqué. La prochaine étape doit produire des preuves réelles, pas un nouveau gate.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PublicLaunchReviewStatus, string> = {
  ready_for_final_review: "Prêt pour la revue finale",
  blocked_missing_external_proofs: "Bloqué — preuves externes manquantes",
  conditional_go: "GO conditionnel",
  public_launch_go: "Public launch GO",
  blocked: "Bloqué",
};

const SCORECARD_LABELS: Record<PublicLaunchScorecardDimension, string> = {
  product_readiness: "Produit",
  legal_readiness: "Juridique",
  payment_readiness: "Paiement",
  infrastructure_readiness: "Infrastructure",
  identity_email_readiness: "Identité / email",
  customer_evidence_readiness: "Evidence client",
  support_readiness: "Support",
  monitoring_readiness: "Monitoring",
  security_readiness: "Sécurité",
  scale_readiness: "Scale",
};

export function getPlfReviewStatusLabel(status: PublicLaunchReviewStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getPlfScorecardDimensionLabel(dimension: PublicLaunchScorecardDimension): string {
  return SCORECARD_LABELS[dimension] ?? "Dimension inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type PlfBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type PlfBadge = {
  id: string;
  label: string;
  tone: PlfBadgeTone;
};

export function buildPlfBadges(): PlfBadge[] {
  return [
    { id: "plf-internal-complete", label: "Gates internes Phase 7 complets", tone: "success" },
    { id: "plf-first-customer", label: "Premier client contrôlé : prêt avec limites", tone: "success" },
    { id: "plf-public-blocked", label: "Public launch : bloqué", tone: "warning" },
    { id: "plf-scale-not-proven", label: "Scale 80k : non prouvé", tone: "neutral" },
    { id: "plf-external-missing", label: "Preuves externes manquantes", tone: "neutral" },
    { id: "plf-next-real", label: "Prochaine étape : preuves réelles", tone: "info" },
  ];
}
