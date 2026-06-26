// src/lib/clonestore/runtime-integration/controlled-mission-local-review-ui-copy.ts
// PHASE 5.2 — Controlled Mission Local Review — UI Copy / Badges (pur, read-only)
//
// Microcopy stricte : « mission relue / approuvée localement / non exécutée /
// préparée pour phase ultérieure ». Jamais « lancée », « exécutée », « envoyée »,
// « Pierre traite la mission », « automatisation démarrée ».

import type {
  LocalControlledMissionReviewStatus,
  LocalControlledMissionReviewState,
} from "./controlled-mission-local-review-types";

// ── Actions ───────────────────────────────────────────────────────────────────

export const CONTROLLED_MISSION_REVIEW_START_LABEL = "Démarrer la review";
export const CONTROLLED_MISSION_REVIEW_APPROVE_LABEL = "Approuver localement";
export const CONTROLLED_MISSION_REVIEW_REQUEST_CHANGES_LABEL = "Demander modification";
export const CONTROLLED_MISSION_REVIEW_BLOCK_LABEL = "Bloquer localement";
export const CONTROLLED_MISSION_REVIEW_ARCHIVE_LABEL = "Archiver localement";
export const CONTROLLED_MISSION_REVIEW_RELIRE_LABEL = "Relire";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_REVIEW_MICROCOPY = "Approbation locale uniquement · Aucune exécution";
export const CONTROLLED_MISSION_REVIEW_NO_PIERRE = "Cette validation ne lance pas Pierre.";
export const CONTROLLED_MISSION_REVIEW_STILL_PREPARED = "La mission reste préparée et non exécutée.";
export const CONTROLLED_MISSION_REVIEW_FUTURE_PHASE =
  "La persistance serveur et l'exécution gouvernée seront traitées dans une phase ultérieure.";
export const CONTROLLED_MISSION_REVIEW_APPROVED_MESSAGE = "Mission approuvée localement. Elle n'a pas été exécutée.";
export const CONTROLLED_MISSION_REVIEW_PANEL_GUARDRAIL =
  "Ce panneau sert à relire et valider humainement une mission contrôlée locale. Même approuvée, elle ne sera pas exécutée dans cette phase.";

// ── Status labels ─────────────────────────────────────────────────────────────

const REVIEW_STATUS_LABELS: Record<LocalControlledMissionReviewStatus, string> = {
  not_reviewed: "Non relue",
  in_review: "En cours de revue",
  approved_local: "Approuvée localement",
  changes_requested: "Modifications demandées",
  blocked_local: "Bloquée localement",
  archived_local: "Archivée localement",
};

export function getControlledMissionReviewStatusLabel(status: LocalControlledMissionReviewStatus): string {
  return REVIEW_STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionReviewBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionReviewBadge = { id: string; label: string; tone: ControlledMissionReviewBadgeTone };

export function buildControlledMissionReviewBadges(
  state: LocalControlledMissionReviewState
): ControlledMissionReviewBadge[] {
  const isApproved = state.review_status === "approved_local";
  const isBlocked = state.review_status === "blocked_local";
  return [
    {
      id: "rev-status",
      label: getControlledMissionReviewStatusLabel(state.review_status),
      tone: isApproved ? "success" : isBlocked ? "danger" : state.review_status === "changes_requested" ? "warning" : "info",
    },
    { id: "rev-not-executed", label: "Non exécutée", tone: "neutral" },
    { id: "rev-server-disabled", label: "Serveur désactivé", tone: "neutral" },
    { id: "rev-local-only", label: "Approbation locale", tone: "info" },
  ];
}
