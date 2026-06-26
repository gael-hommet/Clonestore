// src/lib/clonestore/runtime-integration/runtime-mission-draft-api-client.ts
// PHASE 4.5 — Runtime Mission Draft — Server API Client
//
// fetch autorisé UNIQUEMENT vers /api/clonestore/runtime/mission-drafts.
// POST = sauvegarde de brouillon uniquement. Aucune exécution. Aucune route Pierre.
// Aucune route enterprise-footprint. Aucun fournisseur IA. Aucun auto-call à l'import.

import { RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT } from "./runtime-mission-draft-server-api-contract";
import type {
  RuntimeMissionDraftServerSaveResponse,
  RuntimeMissionDraftServerError,
} from "./runtime-mission-draft-server-api-contract";
import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";

export function isRuntimeMissionDraftServerSaveResponse(
  value: unknown
): value is RuntimeMissionDraftServerSaveResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ok === "boolean" &&
    typeof v.status === "string" &&
    v.mission_created === false &&
    v.execution_started === false
  );
}

export function normalizeRuntimeMissionDraftServerApiError(
  error: unknown
): RuntimeMissionDraftServerError {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.code === "string" && typeof e.message === "string") {
      return { code: e.code, message: e.message };
    }
    if (typeof e.message === "string") return { code: "CLIENT_ERROR", message: e.message };
  }
  if (error instanceof Error) return { code: "CLIENT_ERROR", message: error.message };
  return { code: "UNKNOWN_ERROR", message: "Erreur inconnue." };
}

// ── GET capabilities ──────────────────────────────────────────────────────────

export async function fetchRuntimeMissionDraftServerCapabilities(): Promise<RuntimeMissionDraftServerSaveResponse> {
  const res = await fetch(RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data: unknown = await res.json();
  if (!isRuntimeMissionDraftServerSaveResponse(data)) {
    throw normalizeRuntimeMissionDraftServerApiError({ code: "INVALID_RESPONSE", message: "Réponse capabilities invalide." });
  }
  return data;
}

// ── POST save (brouillon uniquement) ──────────────────────────────────────────

export async function postRuntimeMissionDraftServerSave(
  draft: RuntimeMissionDraft,
  companyId?: string
): Promise<{ response: RuntimeMissionDraftServerSaveResponse; http_status: number }> {
  // POST = sauvegarde de brouillon uniquement — aucune exécution, aucune mission réelle.
  const res = await fetch(RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, company_id: companyId }),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!isRuntimeMissionDraftServerSaveResponse(data)) {
    throw normalizeRuntimeMissionDraftServerApiError({ code: "INVALID_RESPONSE", message: "Réponse de sauvegarde invalide." });
  }
  return { response: data, http_status: res.status };
}
