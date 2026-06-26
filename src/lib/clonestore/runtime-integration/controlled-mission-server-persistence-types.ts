// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-types.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence Draft — Types
//
// DESIGN-ONLY. Conçoit la persistance SERVEUR gouvernée d'une Controlled Mission
// LOCALE (P5.1) revue (P5.2) et passée au preflight (P5.3). N'ACTIVE RIEN.
// Aucune persistance serveur. Aucune route active. Aucune mission réelle.
// Aucune exécution. Aucun moteur Pierre. Aucune IA. Aucun email/document.
// Aucun appel réseau. localStorage reste la seule source active.
//
// Module auto-contenu (aucun import) pour éviter tout cycle.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type GovernedControlledMissionServerPersistencePhase = "5.4";

export type GovernedControlledMissionServerPersistenceStatus =
  | "design_only"
  | "blocked_flag_disabled"
  | "ready_for_manual_sql_review"
  | "ready_for_future_server_persistence"
  | "blocked_missing_preflight"
  | "blocked_missing_review"
  | "blocked_by_guard"
  | "blocked_by_manual_decision";

export type GovernedControlledMissionExecutionStatus =
  | "not_executable"
  | "server_draft_only"
  | "waiting_future_governed_execution_phase";

export type GovernedControlledMissionRuntimeStatus = "disabled";

export type GovernedControlledMissionGovernanceStatus =
  | "requires_human_governance"
  | "preflight_ready"
  | "blocked";

// ── Snapshots ─────────────────────────────────────────────────────────────────

export type GovernedControlledMissionGuardSnapshot = {
  decision: string;
  cloneguard_required: true;
  clonetrace_required: true;
  human_validation_required: true;
};

export type GovernedControlledMissionReviewSnapshot = {
  review_status: string;
  validation_score: number;
  approved_local: boolean;
  reviewer_role: string;
};

export type GovernedControlledMissionPreflightSnapshot = {
  preflight_status: string;
  readiness_score: number;
  readiness_level: string;
  no_execution_performed: true;
};

export type GovernedControlledMissionRuntimeRequirementsSnapshot = {
  stateless_runtime_required: true;
  idempotency_required: true;
  rate_limit_required: true;
  queue_required: true;
  tenant_isolation_required: true;
  runtime_execution: "disabled";
  future_phase_required: true;
};

export type GovernedControlledMissionHumanValidationSnapshot = {
  review_status: string;
  validation_score: number;
  approved_local: boolean;
  reviewer_role: string;
};

export type GovernedControlledMissionTraceSnapshot = {
  clonetrace_required: true;
  server_write_performed: false;
  events: string[];
  final_event: "server_persistence_not_started";
};

// ── Server draft (forme future de la ligne, JAMAIS écrite en P5.4) ────────────

export type GovernedControlledMissionServerDraft = {
  id: string;
  local_controlled_mission_id: string;
  source_draft_id: string;
  source_promotion_id: string;
  company_id: string | null;
  user_id: string | null;
  tenant_id: string;
  employee_id: string | null;
  title: string;
  summary: string;
  intent: string;
  category: string;
  priority: string;
  risk_level: string;
  local_review_status: string;
  preflight_status: string;
  readiness_score: number;
  readiness_level: string;
  server_persistence_status: GovernedControlledMissionServerPersistenceStatus;
  execution_status: GovernedControlledMissionExecutionStatus;
  runtime_status: GovernedControlledMissionRuntimeStatus;
  governance_status: GovernedControlledMissionGovernanceStatus;
  guard_snapshot: GovernedControlledMissionGuardSnapshot;
  review_snapshot: GovernedControlledMissionReviewSnapshot;
  preflight_snapshot: GovernedControlledMissionPreflightSnapshot;
  runtime_requirements_snapshot: GovernedControlledMissionRuntimeRequirementsSnapshot;
  human_validation_snapshot: GovernedControlledMissionHumanValidationSnapshot;
  trace_snapshot: GovernedControlledMissionTraceSnapshot;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // ── Invariants littéraux (JAMAIS true en P5.4) ─────────────────────────────
  local_origin: true;
  execution_enabled: false;
  runtime_execution_enabled: false;
  pierre_engine_enabled: false;
  ai_execution_enabled: false;
  email_sending_enabled: false;
  document_generation_enabled: false;
  clonevoice_enabled: false;
};

export type GovernedControlledMissionServerDraftBuildOptions = {
  now?: string;
  company_id?: string | null;
  user_id?: string | null;
};

// ── Eligibility ───────────────────────────────────────────────────────────────

export type GovernedControlledMissionServerDraftEligibility = {
  eligible: boolean;
  blocked_status: GovernedControlledMissionServerPersistenceStatus | null;
  reason: string | null;
};

// ── Readiness ─────────────────────────────────────────────────────────────────

export type GovernedControlledMissionServerPersistenceReadiness = {
  status: GovernedControlledMissionServerPersistenceStatus;
  execution_status: GovernedControlledMissionExecutionStatus;
  runtime_status: GovernedControlledMissionRuntimeStatus;
  governance_status: GovernedControlledMissionGovernanceStatus;
  readiness_score: number;
  readiness_level: string;
  blocking_reasons: string[];
  required_next_steps: string[];
  server_persistence_flag_enabled: boolean;
  requires_manual_sql_review: true;
  table_name: string;
  // ── Invariants littéraux ────────────────────────────────────────────────────
  local_origin: true;
  server_write_performed: false;
  execution_enabled: false;
};

// ── Policy snapshot (RLS / gouvernance) ───────────────────────────────────────

export type GovernedControlledMissionServerPersistencePolicySnapshot = {
  table_name: string;
  rls_enabled: true;
  select_policy: string;
  insert_policy: string;
  update_policy: string;
  delete_policy: "none_by_design";
  service_role_required: false;
  human_validation_required: true;
  governed_check_required: true;
  no_execution_check_required: true;
};

export type GovernedControlledMissionServerPersistenceRlsPolicyDraft = {
  table_name: string;
  rls_enabled: true;
  policies: string[];
  delete_policy: "none_by_design";
  service_role_required: false;
  notes: string[];
};

// ── Feature flag contract ─────────────────────────────────────────────────────

export type GovernedControlledMissionServerPersistenceFeatureFlagContract = {
  flag_key: string;
  default_enabled: false;
  enabled: boolean;
  phase_status: "design_only";
  activation_steps: string[];
};

// ── API contract (route future, JAMAIS créée en P5.4) ─────────────────────────

export type GovernedControlledMissionServerPersistenceApiSafetyFlags = {
  execution_enabled: false;
  runtime_execution_enabled: false;
  pierre_engine_enabled: false;
  ai_execution_enabled: false;
  email_sending_enabled: false;
  document_generation_enabled: false;
  clonevoice_enabled: false;
  db_write_performed: false;
};

export type GovernedControlledMissionServerPersistenceApiContract = {
  future_endpoint: string;
  future_method: "POST";
  current_phase_status: "disabled_design_only";
  route_file_created: false;
  request_shape: Record<string, string>;
  response_shape: Record<string, string>;
  safety_flags: GovernedControlledMissionServerPersistenceApiSafetyFlags;
};

// ── SQL draft ─────────────────────────────────────────────────────────────────

export type GovernedControlledMissionServerPersistenceSqlDraft = {
  table_name: string;
  file_path: string;
  applied: false;
  do_not_apply: true;
  markers: string[];
  sql: string;
};
