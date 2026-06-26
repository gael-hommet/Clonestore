// src/lib/clonestore/runtime-integration/controlled-mission-preflight-ui-copy.ts
// PHASE 5.3 — Controlled Mission Preflight — UI Copy / Badges (pur, read-only)
//
// Microcopy stricte : « preflight local · candidate pour future exécution gouvernée ·
// mission non exécutée · aucune action déclenchée ». Jamais « lancée », « exécutée »,
// « runtime activé », « envoyé », « Pierre traite la mission ».

import type {
  LocalControlledMissionPreflightStatus,
  LocalControlledMissionReadinessLevel,
  LocalControlledMissionPreflightState,
} from "./controlled-mission-preflight-types";

// ── Actions ───────────────────────────────────────────────────────────────────

export const CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL = "Lancer le preflight local";
export const CONTROLLED_MISSION_PREFLIGHT_REVIEW_REPORT_LABEL = "Relire le rapport preflight";

// ── Microcopy / guardrails ────────────────────────────────────────────────────

export const CONTROLLED_MISSION_PREFLIGHT_MICROCOPY = "Preflight local uniquement · Aucune exécution";
export const CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES =
  "Ce contrôle vérifie si la mission pourrait être candidate à une future exécution gouvernée.";
export const CONTROLLED_MISSION_PREFLIGHT_NO_PIERRE = "Ce contrôle ne lance pas Pierre.";
export const CONTROLLED_MISSION_PREFLIGHT_READY_NO_ACTION = "Un statut ready ne déclenche aucune action.";
export const CONTROLLED_MISSION_PREFLIGHT_STILL_PREPARED = "La mission reste préparée et non exécutée.";
export const CONTROLLED_MISSION_PREFLIGHT_READY_MESSAGE =
  "Préflight local réussi. Candidate pour une future exécution gouvernée. Aucune exécution n'a eu lieu.";
export const CONTROLLED_MISSION_PREFLIGHT_PANEL_GUARDRAIL =
  "Ce panneau prépare une future exécution gouvernée, mais ne l'active pas. Aucune mission réelle n'est créée dans cette phase.";

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LocalControlledMissionPreflightStatus, string> = {
  not_started: "Preflight non démarré",
  ready_for_preflight: "Prêt pour le preflight",
  preflight_running_local: "Preflight en cours (local)",
  ready_for_future_governed_execution: "Candidate future exécution gouvernée",
  blocked_by_missing_review: "Bloqué — revue locale requise",
  blocked_by_guard: "Bloqué par CloneGuard",
  blocked_by_missing_information: "Bloqué — informations manquantes",
  blocked_by_manual_decision: "Bloqué — décision manuelle locale",
  blocked_by_runtime_requirements: "Bloqué — prérequis runtime",
  archived_local: "Archivée localement",
};

const LEVEL_LABELS: Record<LocalControlledMissionReadinessLevel, string> = {
  not_ready: "Non prête",
  needs_review: "Revue requise",
  locally_ready: "Prête localement",
  future_execution_candidate: "Candidate future exécution",
};

export function getControlledMissionPreflightStatusLabel(status: LocalControlledMissionPreflightStatus): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getControlledMissionReadinessLevelLabel(level: LocalControlledMissionReadinessLevel): string {
  return LEVEL_LABELS[level] ?? "Niveau inconnu";
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type ControlledMissionPreflightBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";
export type ControlledMissionPreflightBadge = { id: string; label: string; tone: ControlledMissionPreflightBadgeTone };

export function buildControlledMissionPreflightBadges(
  state: LocalControlledMissionPreflightState
): ControlledMissionPreflightBadge[] {
  const ready = state.preflight_status === "ready_for_future_governed_execution";
  const blocked = state.preflight_status.startsWith("blocked");
  return [
    {
      id: "pf-status",
      label: ready ? "Preflight local ready" : getControlledMissionPreflightStatusLabel(state.preflight_status),
      tone: ready ? "success" : blocked ? "danger" : "info",
    },
    { id: "pf-not-executed", label: "Non exécutée", tone: "neutral" },
    { id: "pf-server-disabled", label: "Serveur désactivé", tone: "neutral" },
    { id: "pf-future-phase", label: "Phase future requise", tone: "info" },
  ];
}
