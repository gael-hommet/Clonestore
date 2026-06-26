// src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-types.ts
// PHASE 4.4 — Runtime Mission Draft Safe Persistence Design — Types
//
// DESIGN-ONLY. Conception de la persistance gouvernée des brouillons de mission.
// Aucun write. Aucune route POST. Aucune mission créée. Aucun moteur Pierre.

export const RUNTIME_MISSION_DRAFT_TABLE_NAME = "clonestore_runtime_mission_drafts" as const;

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistencePhase = "4.4";

export type RuntimeMissionDraftPersistenceMode =
  | "design_only"
  | "localstorage_first_future"
  | "server_flagged_future";

export type RuntimeMissionDraftPersistenceStatus =
  | "disabled"
  | "design_ready"
  | "awaiting_sql"
  | "awaiting_flag"
  | "awaiting_safe_apply"
  | "ready_for_manual_activation"
  | "blocked";

export type RuntimeMissionDraftPersistenceSource =
  | "local_in_memory"
  | "localstorage_design"
  | "server_design";

export type RuntimeMissionDraftPersistenceFeatureFlag = {
  flag_key: string;
  enabled: boolean;
  default_enabled: false;
};

export type RuntimeMissionDraftPersistenceHealthStatus =
  | "not_checked"
  | "table_missing"
  | "rls_missing"
  | "ready"
  | "unknown";

export type RuntimeMissionDraftPersistenceTableStatus =
  | "not_applied"
  | "applied_unverified"
  | "verified";

export type RuntimeMissionDraftPersistencePolicyStatus =
  | "select_insert_update_designed"
  | "no_delete_policy"
  | "not_applied";

export type RuntimeMissionDraftPersistenceReadiness = {
  mode: RuntimeMissionDraftPersistenceMode;
  status: RuntimeMissionDraftPersistenceStatus;
  table_name: string;
  table_status: RuntimeMissionDraftPersistenceTableStatus;
  policy_status: RuntimeMissionDraftPersistencePolicyStatus;
  health_status: RuntimeMissionDraftPersistenceHealthStatus;
  feature_flag: RuntimeMissionDraftPersistenceFeatureFlag;
  localstorage_first: true;
  scale_80k_not_proven: true;
  public_launch_external_validated: false;
  read_only: true;
};

// ── Safety flags ──────────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistenceSafetyFlags = {
  execution_enabled: false;
  db_write_enabled: false;
  api_execution_enabled: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
};

// ── Payload / Record ──────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistencePayload = {
  draft_id: string;
  command_id: string;
  intent_id: string;
  route_id: string;
  plan_id: string;
  employee_key: string | null;
  kind: string;
  status: string;
  source: string;
  title: string;
  objective: string;
  summary: string;
  domain: string;
  risk_level: string;
  validation_mode: string;
  draft_payload: Record<string, unknown>;
  guard_snapshot: Record<string, unknown>;
  trace_snapshot: Record<string, unknown>;
  idempotency_snapshot: Record<string, unknown>;
  queue_snapshot: Record<string, unknown>;
  cost_snapshot: Record<string, unknown>;
  scale_snapshot: Record<string, unknown>;
};

export type RuntimeMissionDraftPersistenceRecord = {
  // Forme future de la ligne DB (jamais écrite en P4.4).
  user_id: string | null;
  company_id: string | null;
  payload: RuntimeMissionDraftPersistencePayload;
  safety_flags: RuntimeMissionDraftPersistenceSafetyFlags;
  table_name: string;
  read_only: true;
  db_write_performed: false;
};

// ── Write / Read plans ────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistenceWritePlan = {
  status: RuntimeMissionDraftPersistenceStatus;
  table_name: string;
  would_insert: boolean;
  would_update: boolean;
  db_write_performed: false;
  api_execution_enabled: false;
  reasons: string[];
  blocking: boolean;
};

export type RuntimeMissionDraftPersistenceReadPlan = {
  table_name: string;
  source: RuntimeMissionDraftPersistenceSource;
  localstorage_first: true;
  server_read_designed: boolean;
  db_read_performed: false;
  notes: string[];
};

// ── Issues / recommendations / actions ────────────────────────────────────────

export type RuntimeMissionDraftPersistenceIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeMissionDraftPersistenceRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeMissionDraftPersistenceAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};
