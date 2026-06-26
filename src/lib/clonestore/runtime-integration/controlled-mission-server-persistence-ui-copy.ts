// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-ui-copy.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — UI Copy / Badges (pur)
//
// Microcopy stricte : « design serveur uniquement · aucune persistance · aucune
// donnée envoyée · la mission reste locale ». Jamais « sauvegardé serveur »,
// « persisté », « mission serveur créée », « exécutée », « envoyé », « lancée ».

import type {
  GovernedControlledMissionServerPersistenceStatus,
  GovernedControlledMissionServerPersistenceReadiness,
} from "./controlled-mission-server-persistence-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_DRAFT_LABEL = "Voir le draft serveur";
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_REQUIREMENTS_LABEL = "Voir prérequis serveur";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY = "Design serveur uniquement · Aucune persistance";
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_WHAT_IT_DOES =
  "Ce panneau décrit la future persistance serveur gouvernée des missions contrôlées.";
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_PANEL_GUARDRAIL =
  "Ce panneau prépare une future persistance gouvernée, mais ne l'active pas. Aucune mission réelle n'est créée dans cette phase.";
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_NO_DATA =
  "Aucune donnée n'est envoyée au serveur dans cette phase.";
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_STILL_LOCAL =
  "La mission reste locale et non exécutée.";

// Faits affichés pour une mission candidate (preflight ready).
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_FACTS = [
  "Candidate pour future persistance serveur",
  "Serveur toujours désactivé",
  "Aucune donnée envoyée",
  "SQL à revue manuelle",
  "Phase future requise",
] as const;

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GovernedControlledMissionServerPersistenceStatus, string> = {
  design_only: "Design serveur uniquement",
  blocked_flag_disabled: "Bloqué — flag serveur désactivé",
  ready_for_manual_sql_review: "Prêt — revue SQL manuelle",
  ready_for_future_server_persistence: "Candidate future persistance serveur",
  blocked_missing_preflight: "Bloqué — preflight requis",
  blocked_missing_review: "Bloqué — revue locale requise",
  blocked_by_guard: "Bloqué par CloneGuard",
  blocked_by_manual_decision: "Bloqué — décision manuelle locale",
};

export function getControlledMissionServerPersistenceStatusLabel(
  status: GovernedControlledMissionServerPersistenceStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionServerPersistenceBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionServerPersistenceBadge = {
  id: string;
  label: string;
  tone: ControlledMissionServerPersistenceBadgeTone;
};

export function buildControlledMissionServerPersistenceBadges(
  readiness: GovernedControlledMissionServerPersistenceReadiness
): ControlledMissionServerPersistenceBadge[] {
  const ready = readiness.status === "ready_for_future_server_persistence";
  const blocked = readiness.status.startsWith("blocked");
  return [
    {
      id: "sp-status",
      label: ready ? "Candidate future persistance" : getControlledMissionServerPersistenceStatusLabel(readiness.status),
      tone: ready ? "success" : blocked ? "danger" : "info",
    },
    { id: "sp-server-disabled", label: "Serveur désactivé", tone: "neutral" },
    { id: "sp-no-data", label: "Aucune donnée envoyée", tone: "neutral" },
    { id: "sp-sql-review", label: "SQL à revue manuelle", tone: "info" },
    { id: "sp-future-phase", label: "Phase future requise", tone: "info" },
  ];
}
