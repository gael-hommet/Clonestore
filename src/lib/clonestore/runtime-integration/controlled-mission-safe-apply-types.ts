// src/lib/clonestore/runtime-integration/controlled-mission-safe-apply-types.ts
// PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First — Types
//
// localStorage-first UNIQUEMENT. Une Controlled Mission locale est PRÉPARÉE,
// jamais exécutée, jamais envoyée, jamais persistée serveur, jamais connectée à
// Pierre runtime. Aucune mission réelle. Aucun appel IA/email/document/PDF.

import type { LocalControlledMissionReviewState } from "./controlled-mission-local-review-types";
import type { LocalControlledMissionPreflightState } from "./controlled-mission-preflight-types";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type LocalControlledMissionPhase = "5.1";

export type LocalControlledMissionSource = "local_safe_apply";

export type LocalControlledMissionStatus =
  | "local_controlled_created"
  | "waiting_manual_review"
  | "blocked_by_guard"
  | "blocked_by_missing_information"
  | "archived_local";

// Aucun statut ne doit laisser croire que la mission est exécutée.
export type LocalControlledMissionExecutionStatus =
  | "not_executable"
  | "local_only"
  | "pending_manual_review";

export type LocalControlledMissionServerPersistence = "disabled";
export type LocalControlledMissionRuntimeExecution = "disabled";

export type LocalControlledMissionPriority = "low" | "normal" | "high";

export type LocalControlledMissionRiskLevel =
  | "low" | "medium" | "high" | "sensitive" | "blocked";

// ── Composants ────────────────────────────────────────────────────────────────

export type LocalControlledMissionStep = {
  id: string;
  label: string;
  detail: string;
  requires_human: boolean;
  execution_enabled: false;
};

export type LocalControlledMissionValidationRequirement = {
  requirement_id: string;
  label: string;
  reason: string;
  required_role: string;
};

export type LocalControlledMissionTimelineItem = {
  id: string;
  event: string;
  label: string;
  detail: string;
};

export type LocalControlledMissionGuardSummary = {
  decision: string;
  cloneguard_required: true;
  clonetrace_required: true;
  human_validation_required: true;
};

// ── Modèle local ──────────────────────────────────────────────────────────────

export type LocalControlledMission = {
  id: string;
  source_draft_id: string;
  source_promotion_id: string;
  tenant_id: string;
  employee_id: string | null;
  title: string;
  summary: string;
  intent: string;
  category: string;
  priority: LocalControlledMissionPriority;
  risk_level: LocalControlledMissionRiskLevel;
  status: LocalControlledMissionStatus;
  steps: LocalControlledMissionStep[];
  validation_requirements: LocalControlledMissionValidationRequirement[];
  guard_summary: LocalControlledMissionGuardSummary;
  warnings: string[];
  blocked_reasons: string[];
  human_readable_timeline: LocalControlledMissionTimelineItem[];
  // ── PHASE 5.2 — Bloc de revue/validation humaine LOCALE (optionnel) ──────────
  // Présent dès qu'une review locale est démarrée. Même approuvé, n'exécute rien.
  review_state?: LocalControlledMissionReviewState;
  // ── PHASE 5.3 — Bloc de preflight / readiness LOCALE (optionnel) ─────────────
  // Présent dès qu'un preflight local est lancé. « ready » = candidate future, jamais exécution.
  preflight_state?: LocalControlledMissionPreflightState;
  created_at: string;
  updated_at: string;
  source: LocalControlledMissionSource;
  // ── Invariants littéraux ──────────────────────────────────────────────────
  execution_status: LocalControlledMissionExecutionStatus;
  server_persistence: LocalControlledMissionServerPersistence;
  runtime_execution: LocalControlledMissionRuntimeExecution;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
  read_only: true;
};

// ── LocalStorage envelope (versionnée) ────────────────────────────────────────

export type LocalControlledMissionEnvelope = {
  schema_version: "v1";
  saved_at: string;
  updated_at: string;
  id: string;
  source_promotion_id: string;
  source_draft_id: string;
  persisted_local: true;
  persisted_server: false;
  runtime_execution: "disabled";
  payload: LocalControlledMission;
};

// ── Safe apply result ─────────────────────────────────────────────────────────

export type ControlledMissionSafeApplyStatus =
  | "created"
  | "already_exists"
  | "blocked"
  | "invalid_input"
  | "local_save_failed";

export type ControlledMissionSafeApplyInputCheck = {
  valid: boolean;
  reason: string | null;
  can_safe_apply: boolean;
};

export type ControlledMissionSafeApplyResult = {
  ok: boolean;
  status: ControlledMissionSafeApplyStatus;
  mission: LocalControlledMission | null;
  already_existed: boolean;
  warnings: string[];
  blocked_reasons: string[];
  // ── Invariants littéraux ──────────────────────────────────────────────────
  server_persistence_performed: false;
  runtime_execution_performed: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  applied_at: string;
};

export type LocalControlledMissionBuildOptions = {
  now?: string;
  tenant_id?: string;
  user_id?: string;
};
