// src/lib/clonestore/runtime-integration/controlled-mission-server-restore-types.ts
// PHASE 5.6 — Controlled Mission Server Restore UI Polish — Types
//
// DESIGN-ONLY / UI. Prépare visuellement et contractuellement la future
// restauration/lecture serveur des Controlled Missions. NE RESTAURE RIEN.
// Aucun GET serveur. Aucune route. Aucune base de données. Aucun SQL appliqué.
// localStorage reste la SEULE source active. Aucune exécution.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

export type ControlledMissionServerRestorePhase = "5.6";

export type ControlledMissionServerRestoreStatus =
  | "design_only"
  | "server_disabled"
  | "flag_disabled"
  | "sql_not_applied"
  | "route_missing_by_design"
  | "ready_for_future_restore_ui";

export type ControlledMissionServerRestoreSource = "local_only";

export type ControlledMissionServerRestoreCardStatus =
  | "local_active"
  | "server_disabled"
  | "sql_not_applied"
  | "route_missing"
  | "flag_off"
  | "no_server_get"
  | "future_candidate";

export type ControlledMissionServerRestoreCardSeverity = "info" | "neutral" | "warning";

export type ControlledMissionServerRestoreDisplayCard = {
  id: string;
  title: string;
  status: ControlledMissionServerRestoreCardStatus;
  description: string;
  badge: string;
  severity: ControlledMissionServerRestoreCardSeverity;
  action_label: string;
  // Invariants littéraux.
  action_enabled: false;
  local_only: true;
};

export type ControlledMissionServerRestoreTimelineStatus = "future";

export type ControlledMissionServerRestoreTimelineItem = {
  id: string;
  label: string;
  description: string;
  status: ControlledMissionServerRestoreTimelineStatus;
  // Invariants littéraux.
  local_only: true;
  server_action_performed: false;
};

export type ControlledMissionServerRestoreDesignState = {
  phase: ControlledMissionServerRestorePhase;
  restore_status: ControlledMissionServerRestoreStatus;
  source: ControlledMissionServerRestoreSource;
  target_table: string;
  future_endpoint: string;
  flag_key: string;
  flag_default: false;
  restored_count: 0;
  server_rows_loaded: 0;
  local_rows_available: number;
  eligible_local_rows: number;
  // ── Invariants littéraux (JAMAIS true en P5.6) ─────────────────────────────
  server_restore_available: false;
  server_get_performed: false;
  db_read_performed: false;
  server_write_performed: false;
  runtime_execution_performed: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
  warnings: string[];
  required_next_steps: string[];
  display_cards: ControlledMissionServerRestoreDisplayCard[];
  restore_timeline_preview: ControlledMissionServerRestoreTimelineItem[];
};
