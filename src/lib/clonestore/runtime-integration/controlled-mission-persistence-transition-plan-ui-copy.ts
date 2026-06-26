// src/lib/clonestore/runtime-integration/controlled-mission-persistence-transition-plan-ui-copy.ts
// PHASE 5.8 — Controlled Mission Persistence Transition Plan — UI Copy / Badges (pur)
//
// Microcopy stricte : « plan de transition design-only · aucune activation · la source
// active reste localStorage · aucun GET/POST serveur ». Jamais « transition activée »,
// « serveur activé », « persisté », « synchronisé », « exécuté », « lancé ».

import type {
  ControlledMissionPersistenceTransitionStatus,
  ControlledMissionPersistenceTransitionReadinessLevel,
  ControlledMissionPersistenceTransitionPhaseStatus,
} from "./controlled-mission-persistence-transition-plan-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_TRANSITION_VIEW_PLAN_LABEL = "Voir plan transition";
export const CONTROLLED_MISSION_TRANSITION_VIEW_RISKS_LABEL = "Voir risques";
export const CONTROLLED_MISSION_TRANSITION_VIEW_ROLLBACK_LABEL = "Voir rollback";
export const CONTROLLED_MISSION_TRANSITION_VIEW_NEXT_STEPS_LABEL = "Voir prochaines étapes";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_TRANSITION_MICROCOPY = "Plan de transition design-only · Aucune activation";
export const CONTROLLED_MISSION_TRANSITION_WHAT_IT_DOES =
  "Ce plan prépare le passage futur vers le serveur, sans l'activer.";
export const CONTROLLED_MISSION_TRANSITION_LOCAL_SOURCE =
  "La source active reste localStorage.";
export const CONTROLLED_MISSION_TRANSITION_NO_GET_POST =
  "Aucun GET/POST serveur n'est effectué.";
export const CONTROLLED_MISSION_TRANSITION_NO_EXECUTION =
  "Aucune exécution n'est possible dans cette phase.";
export const CONTROLLED_MISSION_TRANSITION_PANEL_GUARDRAIL =
  "Plan de transition design-only · Aucune activation. Ce plan prépare le passage futur vers le serveur, sans l'activer. La source active reste localStorage. Aucun GET/POST serveur n'est effectué. Aucune exécution n'est possible dans cette phase.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ControlledMissionPersistenceTransitionStatus, string> = {
  design_only: "Design serveur uniquement",
  local_only_current: "localStorage uniquement (actuel)",
  ready_for_future_manual_sql_apply: "Prêt pour application SQL manuelle future",
  blocked_until_manual_activation: "Bloqué jusqu'à activation manuelle",
  next_phase_candidate: "Candidat phase suivante",
};

const LEVEL_LABELS: Record<ControlledMissionPersistenceTransitionReadinessLevel, string> = {
  incomplete: "Incomplet",
  design_ready: "Design prêt",
  manually_review_ready: "Prêt pour revue manuelle",
  next_phase_candidate: "Candidat phase suivante",
};

const PHASE_STATUS_LABELS: Record<ControlledMissionPersistenceTransitionPhaseStatus, string> = {
  future: "Future",
  blocked: "Bloquée",
  ready_for_manual_review: "Revue manuelle requise",
  design_ready: "Design prêt",
};

export function getControlledMissionTransitionStatusLabel(
  status: ControlledMissionPersistenceTransitionStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getControlledMissionTransitionLevelLabel(
  level: ControlledMissionPersistenceTransitionReadinessLevel
): string {
  return LEVEL_LABELS[level] ?? "Niveau inconnu";
}

export function getControlledMissionTransitionPhaseStatusLabel(
  status: ControlledMissionPersistenceTransitionPhaseStatus
): string {
  return PHASE_STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionTransitionBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionTransitionBadge = {
  id: string;
  label: string;
  tone: ControlledMissionTransitionBadgeTone;
};

export function buildControlledMissionTransitionBadges(): ControlledMissionTransitionBadge[] {
  return [
    { id: "tr-design-only", label: "Design-only", tone: "info" },
    { id: "tr-local-source", label: "Source localStorage", tone: "neutral" },
    { id: "tr-no-get-post", label: "Aucun GET/POST serveur", tone: "neutral" },
    { id: "tr-flag-off", label: "Flag désactivé", tone: "neutral" },
    { id: "tr-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
