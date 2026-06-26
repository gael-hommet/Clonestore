// src/lib/clonestore/runtime-integration/runtime-mission-draft-server-api-contract.ts
// PHASE 4.5 — Runtime Mission Draft — Server API Contract
//
// Module pur. Contrat de l'endpoint de persistance de brouillon (feature-flaggé).
// POST = sauvegarde de brouillon uniquement. Jamais d'exécution, jamais de mission réelle.
// Pas de fetch. Pas de Supabase. Pas d'import Pierre.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import type { RuntimeMissionDraftPersistenceRecord } from "./runtime-mission-draft-persistence-types";
import { RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG } from "./runtime-mission-draft-persistence-flags";

export const RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT = "/api/clonestore/runtime/mission-drafts" as const;

export type RuntimeMissionDraftServerApiMethod = "GET" | "POST";

export type RuntimeMissionDraftServerApiStatus =
  | "ok"
  | "disabled"
  | "auth_required"
  | "server_unavailable"
  | "table_missing"
  | "invalid_request"
  | "error";

export type RuntimeMissionDraftServerSaveRequest = {
  draft: RuntimeMissionDraft;
  company_id?: string;
};

export type RuntimeMissionDraftServerError = {
  code: string;
  message: string;
};

export type RuntimeMissionDraftServerCapabilities = {
  endpoint: string;
  methods: RuntimeMissionDraftServerApiMethod[];
  supports_save: true;
  supports_read: true;
  supports_execution: false;
  supports_mission_creation: false;
  supports_ai_call: false;
  supports_email_send: false;
  supports_document_generation: false;
  supports_clonevoice: false;
  feature_flag: string;
  flag_enabled: boolean;
  scale_80k_not_proven: true;
  public_launch_external_validated: false;
};

export type RuntimeMissionDraftServerSaveResponse = {
  ok: boolean;
  status: RuntimeMissionDraftServerApiStatus;
  draft?: RuntimeMissionDraft;
  record?: RuntimeMissionDraftPersistenceRecord;
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
  capabilities?: RuntimeMissionDraftServerCapabilities;
  error?: RuntimeMissionDraftServerError;
};

export type RuntimeMissionDraftServerReadResponse = {
  ok: boolean;
  status: RuntimeMissionDraftServerApiStatus;
  drafts: RuntimeMissionDraft[];
  db_read_performed: boolean;
  error?: RuntimeMissionDraftServerError;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftServerCapabilities(
  flagEnabled: boolean
): RuntimeMissionDraftServerCapabilities {
  return {
    endpoint: RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT,
    methods: ["GET", "POST"],
    supports_save: true,
    supports_read: true,
    supports_execution: false,
    supports_mission_creation: false,
    supports_ai_call: false,
    supports_email_send: false,
    supports_document_generation: false,
    supports_clonevoice: false,
    feature_flag: RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG,
    flag_enabled: flagEnabled,
    scale_80k_not_proven: true,
    public_launch_external_validated: false,
  };
}

function baseSaveResponse(): Omit<RuntimeMissionDraftServerSaveResponse, "ok" | "status"> {
  return {
    db_write_performed: false,
    mission_created: false,
    execution_started: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
  };
}

export function buildRuntimeMissionDraftServerSaveResponse(
  status: RuntimeMissionDraftServerApiStatus,
  extra?: Partial<RuntimeMissionDraftServerSaveResponse>
): RuntimeMissionDraftServerSaveResponse {
  return {
    ok: status === "ok" || status === "disabled",
    status,
    ...baseSaveResponse(),
    ...(extra ?? {}),
    // Forcer les invariants même si extra tente de les surcharger
    mission_created: false,
    execution_started: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
  };
}

export function buildRuntimeMissionDraftServerError(
  error: RuntimeMissionDraftServerError,
  status: RuntimeMissionDraftServerApiStatus = "error"
): RuntimeMissionDraftServerSaveResponse {
  return {
    ok: false,
    status,
    ...baseSaveResponse(),
    error,
  };
}

// ── Validation / sanitization ─────────────────────────────────────────────────

export function validateRuntimeMissionDraftServerSaveRequest(
  body: unknown
): { valid: boolean; error?: RuntimeMissionDraftServerError } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: { code: "INVALID_BODY", message: "Corps de requête invalide." } };
  }
  const draft = (body as Record<string, unknown>).draft;
  if (typeof draft !== "object" || draft === null) {
    return { valid: false, error: { code: "DRAFT_REQUIRED", message: "draft requis." } };
  }
  const d = draft as Record<string, unknown>;
  if (typeof d.draft_id !== "string" || !d.draft_id.trim()) {
    return { valid: false, error: { code: "DRAFT_ID_REQUIRED", message: "draft.draft_id requis." } };
  }
  if (d.execution_enabled !== false) {
    return { valid: false, error: { code: "EXECUTION_FORBIDDEN", message: "execution_enabled doit être false." } };
  }
  return { valid: true };
}

export function sanitizeRuntimeMissionDraftServerSaveRequest(
  body: unknown
): RuntimeMissionDraftServerSaveRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.draft !== "object" || obj.draft === null) return null;
  return {
    draft: obj.draft as RuntimeMissionDraft,
    company_id: typeof obj.company_id === "string" ? obj.company_id : undefined,
  };
}
