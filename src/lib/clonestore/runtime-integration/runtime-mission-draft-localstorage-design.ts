// src/lib/clonestore/runtime-integration/runtime-mission-draft-localstorage-design.ts
// PHASE 4.4 — Runtime Mission Draft — LocalStorage Design (DESIGN-ONLY)
//
// Définit la stratégie future localStorage-first SANS écrire ni lire localStorage
// en P4.4. Module pur — aucune écriture/lecture localStorage (design-only).

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";

// ── Clés (déclarées, jamais écrites en P4.4) ──────────────────────────────────

export const RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY =
  "clonestore.runtimeMissionDrafts.local.v1" as const;

export const RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY =
  "clonestore.runtimeMissionDrafts.lastPreview.v1" as const;

// ── Stratégie future ──────────────────────────────────────────────────────────

export type RuntimeMissionDraftLocalStorageStrategy = {
  primary_key: string;
  last_preview_key: string;
  localstorage_first: true;
  future_flow: string[];
  writes_in_p4_4: false;
  reads_in_p4_4: false;
  read_only: true;
};

export function buildRuntimeMissionDraftLocalStorageStrategy(): RuntimeMissionDraftLocalStorageStrategy {
  return {
    primary_key: RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY,
    last_preview_key: RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY,
    localstorage_first: true,
    future_flow: [
      "1. Créer le brouillon local (in-memory) depuis le runtime result.",
      "2. Sauvegarder en localStorage en premier (PHASE 4.5).",
      "3. Si flag + serveur prêt + auth → safe apply serveur best-effort (PHASE 4.5).",
      "4. Fallback local si serveur indisponible.",
      "5. Restaurer la version la plus récente (local/server).",
    ],
    writes_in_p4_4: false,
    reads_in_p4_4: false,
    read_only: true,
  };
}

// ── Envelope (forme future, jamais persistée en P4.4) ─────────────────────────

export type RuntimeMissionDraftLocalStorageEnvelope = {
  schema_version: "v1";
  key: string;
  draft_id: string;
  command_id: string;
  plan_id: string;
  saved_at: string;
  persisted_in_p4_4: false;
  payload: RuntimeMissionDraft;
};

export function buildRuntimeMissionDraftLocalStorageEnvelope(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftLocalStorageEnvelope {
  return {
    schema_version: "v1",
    key: RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY,
    draft_id: draft.draft_id,
    command_id: draft.command_id,
    plan_id: draft.plan_id,
    saved_at: new Date().toISOString(),
    persisted_in_p4_4: false,
    payload: draft,
  };
}

export function validateRuntimeMissionDraftLocalStorageEnvelope(
  envelope: RuntimeMissionDraftLocalStorageEnvelope
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (envelope.schema_version !== "v1") issues.push("schema_version doit être v1.");
  if (!envelope.draft_id?.trim()) issues.push("draft_id requis.");
  if (envelope.persisted_in_p4_4 !== false) issues.push("persisted_in_p4_4 doit être false.");
  if (!envelope.payload || envelope.payload.read_only !== true) issues.push("payload.read_only doit être true.");
  return { valid: issues.length === 0, issues };
}

export function summarizeRuntimeMissionDraftLocalStorageDesign(): string {
  const s = buildRuntimeMissionDraftLocalStorageStrategy();
  return [
    "[LocalStorage Design] localStorage-first future flow (design-only).",
    `  Clé : ${s.primary_key}`,
    `  Écritures en P4.4 : ${s.writes_in_p4_4} · Lectures en P4.4 : ${s.reads_in_p4_4}`,
    ...s.future_flow.map((f) => `  ${f}`),
    "  P4.4 design only — aucune écriture localStorage.",
  ].join("\n");
}
