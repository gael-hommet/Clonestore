// src/lib/clonestore/runtime-integration/controlled-mission-persistence-operator-handbook-ui-copy.ts
// PHASE 5.9 — Controlled Mission Persistence Operator Handbook — UI Copy / Badges (pur)
//
// Microcopy stricte : « handbook opérateur design-only · aucune activation · la source
// active reste localStorage · aucun GET/POST serveur ». Jamais « handbook activé »,
// « serveur activé », « persisté », « synchronisé », « exécuté », « lancé ».

import type {
  ControlledMissionPersistenceHandbookStatus,
} from "./controlled-mission-persistence-operator-handbook-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_HANDBOOK_VIEW_HANDBOOK_LABEL = "Voir handbook";
export const CONTROLLED_MISSION_HANDBOOK_VIEW_WORKFLOWS_LABEL = "Voir workflows";
export const CONTROLLED_MISSION_HANDBOOK_VIEW_PLAYBOOKS_LABEL = "Voir playbooks";
export const CONTROLLED_MISSION_HANDBOOK_VIEW_COMMANDS_LABEL = "Voir commandes";
export const CONTROLLED_MISSION_HANDBOOK_VIEW_DECISIONS_LABEL = "Voir décisions";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_HANDBOOK_MICROCOPY = "Handbook opérateur design-only · Aucune activation";
export const CONTROLLED_MISSION_HANDBOOK_WHAT_IT_DOES =
  "Cette documentation explique l'exploitation sûre, pas l'activation serveur.";
export const CONTROLLED_MISSION_HANDBOOK_LOCAL_SOURCE =
  "La source active reste localStorage.";
export const CONTROLLED_MISSION_HANDBOOK_NO_GET_POST =
  "Aucun GET/POST serveur n'est effectué.";
export const CONTROLLED_MISSION_HANDBOOK_NO_EXECUTION =
  "Aucune exécution n'est possible dans cette phase.";
export const CONTROLLED_MISSION_HANDBOOK_PANEL_GUARDRAIL =
  "Handbook opérateur design-only · Aucune activation. Cette documentation explique l'exploitation sûre, pas l'activation serveur. La source active reste localStorage. Aucun GET/POST serveur n'est effectué. Aucune exécution n'est possible dans cette phase.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ControlledMissionPersistenceHandbookStatus, string> = {
  design_only: "Design uniquement",
  documentation_ready: "Documentation prête",
  operator_ready: "Opérateur prêt",
  blocked: "Bloqué",
};

export function getControlledMissionHandbookStatusLabel(
  status: ControlledMissionPersistenceHandbookStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionHandbookBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionHandbookBadge = {
  id: string;
  label: string;
  tone: ControlledMissionHandbookBadgeTone;
};

export function buildControlledMissionHandbookBadges(): ControlledMissionHandbookBadge[] {
  return [
    { id: "hb-doc-ready", label: "Documentation prête", tone: "info" },
    { id: "hb-local-source", label: "Source localStorage", tone: "neutral" },
    { id: "hb-no-get-post", label: "Aucun GET/POST serveur", tone: "neutral" },
    { id: "hb-server-inactive", label: "Serveur inactif", tone: "neutral" },
    { id: "hb-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
