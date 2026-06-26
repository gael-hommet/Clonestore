// src/lib/clonestore/runtime-integration/runtime-mission-draft-safe-apply-types.ts
// PHASE 4.5 — Runtime Mission Draft Safe Apply — Types
//
// localStorage-first. Serveur best-effort feature-flaggé. Aucune exécution.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import type { RuntimeMissionDraftLocalStorageEnvelope } from "./runtime-mission-draft-localstorage";

export type RuntimeMissionDraftSafeApplyMode =
  | "local_only"
  | "local_first_server_best_effort";

export type RuntimeMissionDraftSafeApplyStatus =
  | "local_saved"
  | "local_saved_server_disabled"
  | "local_saved_server_synced"
  | "local_saved_server_failed"
  | "local_failed"
  | "validation_failed"
  | "auth_required"
  | "server_unavailable"
  | "server_blocked"
  | "restored_local"
  | "restored_server"
  | "restored_none";

export type RuntimeMissionDraftSafeApplySource =
  | "localstorage"
  | "server"
  | "none";

export type RuntimeMissionDraftSafeApplyAttempt = {
  local_attempted: boolean;
  server_attempted: boolean;
  attempted_at: string;
};

export type RuntimeMissionDraftSafeApplyServerResult = {
  ok: boolean;
  status: string;
  http_status: number;
  db_write_performed: boolean;
  error_message?: string;
};

export type RuntimeMissionDraftSafeApplyIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeMissionDraftSafeApplyRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeMissionDraftSafeApplyAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimeMissionDraftSafeApplyResult = {
  ok: boolean;
  status: RuntimeMissionDraftSafeApplyStatus;
  local_saved: boolean;
  server_attempted: boolean;
  server_synced: boolean;
  db_write_performed: boolean;
  mission_created: false;
  execution_started: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
  draft?: RuntimeMissionDraft;
  envelope?: RuntimeMissionDraftLocalStorageEnvelope;
  server_result?: RuntimeMissionDraftSafeApplyServerResult;
  issues: RuntimeMissionDraftSafeApplyIssue[];
  recommendations: RuntimeMissionDraftSafeApplyRecommendation[];
  actions: RuntimeMissionDraftSafeApplyAction[];
  attempted_at: string;
};

export type RuntimeMissionDraftSafeApplyRestoreResult = {
  ok: boolean;
  status: RuntimeMissionDraftSafeApplyStatus;
  source: RuntimeMissionDraftSafeApplySource;
  draft: RuntimeMissionDraft | null;
  envelope: RuntimeMissionDraftLocalStorageEnvelope | null;
  execution_started: false;
  attempted_at: string;
};
