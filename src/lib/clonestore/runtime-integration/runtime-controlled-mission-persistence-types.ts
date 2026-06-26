// src/lib/clonestore/runtime-integration/runtime-controlled-mission-persistence-types.ts
// PHASE 4.10 — Controlled Mission Governed Persistence Design — Types
//
// DESIGN-ONLY. Conception de la persistance gouvernée des CANDIDATES de
// ControlledMission (contrats de promotion). Aucun write. Aucune route POST.
// Aucune mission réelle. Aucune exécution. Aucun moteur Pierre.

export const RUNTIME_CONTROLLED_MISSION_TABLE_NAME =
  "clonestore_controlled_mission_candidates" as const;

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistencePhase = "4.10";

export type RuntimeControlledMissionPersistenceMode =
  | "design_only"
  | "governed_candidate_future"
  | "server_flagged_future";

export type RuntimeControlledMissionPersistenceStatus =
  | "disabled"
  | "design_ready"
  | "awaiting_sql"
  | "awaiting_flag"
  | "awaiting_safe_apply"
  | "awaiting_human_validation_design"
  | "ready_for_manual_activation"
  | "blocked";

export type RuntimeControlledMissionPersistenceSource =
  | "runtime_mission_promotion_contract"
  | "controlled_mission_preview"
  | "local_runtime_draft"
  | "future_server_restore";

export type RuntimeControlledMissionPersistenceFeatureFlag = {
  flag_key: string;
  enabled: boolean;
  default_enabled: false;
};

export type RuntimeControlledMissionPersistenceHealthStatus =
  | "not_checked"
  | "table_missing"
  | "rls_missing"
  | "ready"
  | "unknown";

export type RuntimeControlledMissionPersistenceTableStatus =
  | "not_applied"
  | "applied_unverified"
  | "verified";

export type RuntimeControlledMissionPersistencePolicyStatus =
  | "select_insert_update_designed"
  | "no_delete_policy"
  | "not_applied";

export type RuntimeControlledMissionPersistenceReadiness = {
  mode: RuntimeControlledMissionPersistenceMode;
  status: RuntimeControlledMissionPersistenceStatus;
  table_name: string;
  table_status: RuntimeControlledMissionPersistenceTableStatus;
  policy_status: RuntimeControlledMissionPersistencePolicyStatus;
  health_status: RuntimeControlledMissionPersistenceHealthStatus;
  feature_flag: RuntimeControlledMissionPersistenceFeatureFlag;
  localstorage_first: true;
  human_validation_required: true;
  promotion_applied: false;
  scale_80k_not_proven: true;
  public_launch_external_validated: false;
  read_only: true;
};

// ── Safety flags (littéralement false sauf controlled / requires_human_validation) ──

export type RuntimeControlledMissionPersistenceSafetyFlags = {
  promotion_applied: false;
  execution_enabled: false;
  mission_executed: false;
  autonomous_execution: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  db_write_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
  requires_human_validation: true;
  controlled: true;
  scale_80k_not_proven: true;
};

// ── Payload / Record ──────────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistencePayload = {
  candidate_id: string;
  promotion_id: string;
  controlled_mission_id: string | null;
  draft_id: string;
  command_id: string;
  intent_id: string;
  route_id: string;
  plan_id: string;
  employee_key: string | null;
  source: string;
  status: string;
  verdict: string;
  title: string;
  objective: string;
  summary: string;
  domain: string;
  risk_level: string;
  validation_mode: string;
  candidate_payload: Record<string, unknown>;
  promotion_contract: Record<string, unknown>;
  controlled_mission_payload: Record<string, unknown>;
  guard_snapshot: Record<string, unknown>;
  trace_snapshot: Record<string, unknown>;
  validation_gates: unknown[];
  blockers: unknown[];
  idempotency_snapshot: Record<string, unknown>;
  queue_snapshot: Record<string, unknown>;
  cost_snapshot: Record<string, unknown>;
  scale_snapshot: Record<string, unknown>;
};

export type RuntimeControlledMissionPersistenceRecord = {
  // Forme future de la ligne DB (jamais écrite en P4.10).
  user_id: string | null;
  company_id: string | null;
  payload: RuntimeControlledMissionPersistencePayload;
  safety_flags: RuntimeControlledMissionPersistenceSafetyFlags;
  // Colonnes booléennes gouvernées (littérales)
  human_validation_required: true;
  promotion_applied: false;
  controlled_mission_created: false;
  mission_created: false;
  execution_enabled: false;
  execution_started: false;
  preview_only: true;
  read_only: true;
  table_name: string;
  db_write_performed: false;
};

// ── Write / Read plans ────────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistenceWritePlan = {
  status: RuntimeControlledMissionPersistenceStatus;
  table_name: string;
  would_insert: boolean;
  would_update: boolean;
  db_write_performed: false;
  promotion_applied: false;
  mission_created: false;
  execution_enabled: false;
  human_validation_required: true;
  reasons: string[];
  blocking: boolean;
};

export type RuntimeControlledMissionPersistenceReadPlan = {
  table_name: string;
  source: RuntimeControlledMissionPersistenceSource;
  localstorage_first: true;
  server_read_designed: boolean;
  db_read_performed: false;
  notes: string[];
};

// ── Issues / recommendations / actions ────────────────────────────────────────

export type RuntimeControlledMissionPersistenceIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeControlledMissionPersistenceRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeControlledMissionPersistenceAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};
