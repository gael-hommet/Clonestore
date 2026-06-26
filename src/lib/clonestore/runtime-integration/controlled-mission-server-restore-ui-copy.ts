// src/lib/clonestore/runtime-integration/controlled-mission-server-restore-ui-copy.ts
// PHASE 5.6 — Controlled Mission Server Restore UI Polish — UI Copy / Badges (pur)
//
// Microcopy stricte : « restauration serveur non active · local uniquement · aucun
// GET serveur · la source active reste localStorage ». Jamais « restauré depuis
// serveur », « chargé serveur », « synchronisé », « serveur actif », « exécuté ».

import type {
  ControlledMissionServerRestoreStatus,
} from "./controlled-mission-server-restore-types";

// ── Actions (lecture seule) ───────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_RESTORE_VIEW_STATE_LABEL = "Voir état restore";
export const CONTROLLED_MISSION_SERVER_RESTORE_VIEW_FUTURE_LABEL = "Voir parcours futur";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY = "Restauration serveur non active · Local uniquement";
export const CONTROLLED_MISSION_SERVER_RESTORE_WHAT_IT_DOES =
  "Cette interface prépare la lecture serveur future, mais ne charge aucune donnée serveur.";
export const CONTROLLED_MISSION_SERVER_RESTORE_NO_GET =
  "Aucun GET serveur n'est effectué.";
export const CONTROLLED_MISSION_SERVER_RESTORE_LOCAL_SOURCE =
  "La source active reste localStorage.";
export const CONTROLLED_MISSION_SERVER_RESTORE_NO_EXECUTION =
  "Aucune mission n'est exécutée.";
export const CONTROLLED_MISSION_SERVER_RESTORE_PANEL_GUARDRAIL =
  "Restauration serveur — non active. Cette interface prépare la lecture serveur future, mais ne charge aucune donnée serveur. La source active reste localStorage.";

// Faits affichés dans le panneau de restauration.
export const CONTROLLED_MISSION_SERVER_RESTORE_FACTS = [
  "Source active : localStorage",
  "Serveur : désactivé",
  "SQL : non appliqué",
  "Route serveur : non créée",
  "Flag : false",
  "Aucun GET serveur",
  "Aucune donnée chargée depuis le serveur",
  "Aucune exécution",
] as const;

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ControlledMissionServerRestoreStatus, string> = {
  design_only: "Design serveur uniquement",
  server_disabled: "Serveur désactivé",
  flag_disabled: "Flag serveur désactivé",
  sql_not_applied: "SQL non appliqué",
  route_missing_by_design: "Route serveur non créée",
  ready_for_future_restore_ui: "Prêt pour UI de restauration future",
};

export function getControlledMissionServerRestoreStatusLabel(
  status: ControlledMissionServerRestoreStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionServerRestoreBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionServerRestoreBadge = {
  id: string;
  label: string;
  tone: ControlledMissionServerRestoreBadgeTone;
};

export function buildControlledMissionServerRestoreBadges(): ControlledMissionServerRestoreBadge[] {
  return [
    { id: "sr-local", label: "Local uniquement", tone: "info" },
    { id: "sr-server-off", label: "Serveur désactivé", tone: "neutral" },
    { id: "sr-no-get", label: "Aucun GET serveur", tone: "neutral" },
    { id: "sr-sql-off", label: "SQL non appliqué", tone: "neutral" },
    { id: "sr-no-execution", label: "Aucune exécution", tone: "neutral" },
  ];
}
