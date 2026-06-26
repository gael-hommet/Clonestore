// src/lib/clonestore/runtime-integration/first-customer-evidence-review-ui-copy.ts
// PHASE 7.3 — First Customer Evidence Review — UI Copy / Badges (pur)
//
// Microcopy stricte : « Evidence Review · preuves réelles uniquement · ce gate ne valide aucune
// preuve sans élément réel · un premier client réussi ne suffit pas à déclarer le lancement
// public · les go-live proofs restent manuels ». Jamais « evidence complete », « client success »,
// « public launch GO ».

import type {
  EvidenceReviewStatus,
  EvidenceCategory,
} from "./first-customer-evidence-review-types";

// ── Titre / actions (lecture seule) ───────────────────────────────────────────

export const FCER_TITLE = "Pierre — First Customer Evidence Review";
export const FCER_VIEW_MATRIX_LABEL = "Voir evidence matrix";
export const FCER_VIEW_RULES_LABEL = "Voir verification rules";
export const FCER_VIEW_CRITERIA_LABEL = "Voir criteria";
export const FCER_VIEW_LAUNCH_GATE_LABEL = "Voir public launch gate";
export const FCER_VIEW_GOLIVE_LABEL = "Voir go-live recommendation";
export const FCER_VIEW_DECISION_LABEL = "Voir decision matrix";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const FCER_MICROCOPY = "Evidence Review · preuves réelles uniquement";
export const FCER_NO_AUTO_VALIDATION =
  "Ce gate ne valide aucune preuve sans élément réel.";
export const FCER_NOT_PUBLIC =
  "Un premier client réussi ne suffit pas à déclarer le lancement public.";
export const FCER_GO_LIVE_MANUAL =
  "Les go-live proofs restent manuels.";
export const FCER_NEXT_PHASE =
  "Prochaine étape : Customer Evidence Applied / Second Controlled Customer.";
export const FCER_PANEL_GUARDRAIL =
  "Evidence Review · preuves réelles uniquement. Ce gate ne valide aucune preuve sans élément réel. Un premier client réussi ne suffit pas à déclarer le lancement public. Les go-live proofs restent manuels. Prochaine étape : Customer Evidence Applied / Second Controlled Customer.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<EvidenceReviewStatus, string> = {
  ready_to_review_when_evidence_exists: "Prêt à relire dès que l'evidence existe",
  evidence_missing: "Evidence manquante",
  evidence_partial: "Evidence partielle",
  evidence_complete: "Evidence complète",
  blocked: "Bloqué",
};

const CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  customer_identity: "Identité client",
  contract_cgv: "Contrat / CGV",
  payment_or_controlled_activation: "Paiement / activation contrôlée",
  access_activation: "Activation accès",
  setup_completion: "Setup complété",
  scenario_selection: "Scénario choisi",
  controlled_mission_creation: "Mission contrôlée",
  first_output_delivery: "Premier livrable",
  human_validation: "Validation humaine",
  customer_feedback: "Feedback client",
  incident_log: "Incidents / limites",
  post_run_decision: "Décision post-run",
};

export function getEvidenceReviewStatusLabel(status: EvidenceReviewStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getEvidenceCategoryLabel(category: EvidenceCategory): string {
  return CATEGORY_LABELS[category] ?? "Catégorie inconnue";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type FcerBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type FcerBadge = {
  id: string;
  label: string;
  tone: FcerBadgeTone;
};

export function buildFcerBadges(): FcerBadge[] {
  return [
    { id: "fcer-review-ready", label: "Audit preuves prêt", tone: "success" },
    { id: "fcer-real-only", label: "Preuves réelles uniquement", tone: "neutral" },
    { id: "fcer-public-blocked", label: "Public launch bloqué", tone: "warning" },
    { id: "fcer-go-live-manual", label: "Go-live proofs manuels", tone: "neutral" },
    { id: "fcer-next-review", label: "Prochaine étape : Evidence Applied", tone: "info" },
  ];
}
