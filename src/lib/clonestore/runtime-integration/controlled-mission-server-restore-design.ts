// src/lib/clonestore/runtime-integration/controlled-mission-server-restore-design.ts
// PHASE 5.6 — Controlled Mission Server Restore UI Polish — Design (pur)
//
// DESIGN-ONLY. Construit l'état UI de restauration serveur FUTURE à partir des
// missions LOCALES. NE RESTAURE RIEN. Aucun GET serveur. Aucune route. Aucune base
// de données. Aucun SQL appliqué. localStorage reste la seule source active.
// Aucun appel réseau. Aucun moteur Pierre. Aucune IA. Aucune exécution.

import type { LocalControlledMission } from "./controlled-mission-safe-apply-types";
import { buildControlledMissionServerPersistenceReadiness } from "./controlled-mission-server-persistence-contract";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME } from "./controlled-mission-server-persistence-sql-draft";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG } from "./controlled-mission-server-persistence-policy";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT } from "./controlled-mission-server-persistence-api-contract";
import type {
  ControlledMissionServerRestoreDesignState,
  ControlledMissionServerRestoreDisplayCard,
  ControlledMissionServerRestoreTimelineItem,
  ControlledMissionServerRestoreStatus,
} from "./controlled-mission-server-restore-types";

// ── Comptage des lignes locales éligibles ─────────────────────────────────────

function countEligibleLocalRows(localMissions: LocalControlledMission[]): number {
  return localMissions.filter(
    (m) => buildControlledMissionServerPersistenceReadiness(m).status === "ready_for_future_server_persistence"
  ).length;
}

function deriveRestoreStatus(eligible: number): ControlledMissionServerRestoreStatus {
  return eligible > 0 ? "ready_for_future_restore_ui" : "server_disabled";
}

// ── Warnings / next steps ─────────────────────────────────────────────────────

export function buildControlledMissionServerRestoreWarnings(
  state: ControlledMissionServerRestoreDesignState
): string[] {
  void state;
  return [
    "Restauration serveur non active · Local uniquement.",
    "Aucun GET serveur n'est effectué.",
    "La source active reste localStorage.",
    "Aucune donnée n'est chargée depuis le serveur.",
    "Aucune mission n'est exécutée.",
  ];
}

export function buildControlledMissionServerRestoreRequiredNextSteps(
  state: ControlledMissionServerRestoreDesignState
): string[] {
  void state;
  return [
    "Revue manuelle du SQL serveur (PHASE 5.5) — non appliqué.",
    "Activation manuelle future du flag serveur (phase future).",
    "Création future de la route GET serveur (phase future).",
    "Lecture serveur des lignes réservée à une phase future — aucune en P5.6.",
    "Aucune exécution n'est déclenchée dans cette phase.",
  ];
}

// ── Display cards ─────────────────────────────────────────────────────────────

function card(
  card: ControlledMissionServerRestoreDisplayCard
): ControlledMissionServerRestoreDisplayCard {
  return card;
}

export function buildControlledMissionServerRestoreDisplayCards(
  state: ControlledMissionServerRestoreDesignState
): ControlledMissionServerRestoreDisplayCard[] {
  return [
    card({
      id: "rc-source",
      title: "Source active",
      status: "local_active",
      description: "La source active reste localStorage.",
      badge: "localStorage",
      severity: "info",
      action_label: "Voir état restore",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-server",
      title: "Serveur",
      status: "server_disabled",
      description: "Serveur désactivé — aucune lecture serveur.",
      badge: "Serveur désactivé",
      severity: "neutral",
      action_label: "Voir état restore",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-sql",
      title: "SQL",
      status: "sql_not_applied",
      description: "SQL non appliqué (draft P5.4).",
      badge: "SQL non appliqué",
      severity: "neutral",
      action_label: "Voir état restore",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-route",
      title: "Route serveur",
      status: "route_missing",
      description: "Route serveur non créée (design-only).",
      badge: "Route non créée",
      severity: "neutral",
      action_label: "Voir état restore",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-flag",
      title: "Flag serveur",
      status: "flag_off",
      description: "Flag serveur désactivé (false).",
      badge: "Flag false",
      severity: "neutral",
      action_label: "Voir état restore",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-get",
      title: "GET serveur",
      status: "no_server_get",
      description: "Aucun GET serveur n'est effectué.",
      badge: "Aucun GET",
      severity: "neutral",
      action_label: "Voir parcours futur",
      action_enabled: false,
      local_only: true,
    }),
    card({
      id: "rc-eligible",
      title: "Candidates à une future restauration",
      status: "future_candidate",
      description: `${state.eligible_local_rows} mission(s) locale(s) candidate(s) à une future persistance/restauration.`,
      badge: `${state.eligible_local_rows} / ${state.local_rows_available}`,
      severity: "info",
      action_label: "Voir parcours futur",
      action_enabled: false,
      local_only: true,
    }),
  ];
}

// ── Timeline preview ──────────────────────────────────────────────────────────

function tl(
  id: string,
  label: string,
  description: string
): ControlledMissionServerRestoreTimelineItem {
  return { id, label, description, status: "future", local_only: true, server_action_performed: false };
}

export function buildControlledMissionServerRestoreTimelinePreview(
  state: ControlledMissionServerRestoreDesignState
): ControlledMissionServerRestoreTimelineItem[] {
  void state;
  return [
    tl("tl-sql", "SQL manual review", "Revue manuelle du SQL serveur (non appliqué)."),
    tl("tl-flag", "Flag activation future", "Activation future du flag serveur (default false)."),
    tl("tl-route", "Route GET future", "Création future de la route GET serveur."),
    tl("tl-restore", "Restore server rows", "Lecture future des lignes serveur (aucune en P5.6)."),
    tl("tl-no-exec", "Still no execution", "Toujours aucune exécution — la mission reste préparée, non exécutée."),
  ];
}

// ── State builder ─────────────────────────────────────────────────────────────

export function buildControlledMissionServerRestoreDesignState(
  localMissions: LocalControlledMission[]
): ControlledMissionServerRestoreDesignState {
  const list = Array.isArray(localMissions) ? localMissions : [];
  const local_rows_available = list.length;
  const eligible_local_rows = countEligibleLocalRows(list);

  const base: ControlledMissionServerRestoreDesignState = {
    phase: "5.6",
    restore_status: deriveRestoreStatus(eligible_local_rows),
    source: "local_only",
    target_table: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    future_endpoint: CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT,
    flag_key: CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
    flag_default: false,
    restored_count: 0,
    server_rows_loaded: 0,
    local_rows_available,
    eligible_local_rows,
    server_restore_available: false,
    server_get_performed: false,
    db_read_performed: false,
    server_write_performed: false,
    runtime_execution_performed: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    warnings: [],
    required_next_steps: [],
    display_cards: [],
    restore_timeline_preview: [],
  };

  return {
    ...base,
    warnings: buildControlledMissionServerRestoreWarnings(base),
    required_next_steps: buildControlledMissionServerRestoreRequiredNextSteps(base),
    display_cards: buildControlledMissionServerRestoreDisplayCards(base),
    restore_timeline_preview: buildControlledMissionServerRestoreTimelinePreview(base),
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionServerRestoreDesignState(
  state: ControlledMissionServerRestoreDesignState
): string {
  return [
    `[Restauration serveur — design] statut ${state.restore_status} · source ${state.source}`,
    `  Lignes locales : ${state.local_rows_available} · candidates future restauration : ${state.eligible_local_rows}`,
    `  Lignes serveur chargées : ${state.server_rows_loaded} · restored_count : ${state.restored_count}`,
    `  Restauration serveur non active · Local uniquement · Aucun GET serveur.`,
    `  La source active reste localStorage. Aucune exécution. scale 80k non prouvé. lancement public externe non validé.`,
  ].join("\n");
}
