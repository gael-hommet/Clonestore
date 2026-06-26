// src/lib/clonestore/runtime-integration/runtime-mission-draft-localstorage.ts
// PHASE 4.5 — Runtime Mission Draft — LocalStorage Runtime (read/write)
//
// Sauvegarde/restauration localStorage des RuntimeMissionDraft. Côté client uniquement.
// Safe, versionné, rollbackable. SEUL endroit autorisé à écrire localStorage pour les drafts.
// Pas de fetch. Pas de Supabase. Pas d'import Pierre. Pas d'exécution.

import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";
import {
  validateRuntimeMissionDraft,
  sanitizeRuntimeMissionDraft,
} from "./runtime-mission-draft-validation";
import {
  RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY as DESIGN_LOCALSTORAGE_KEY,
  RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY as DESIGN_LAST_PREVIEW_KEY,
} from "./runtime-mission-draft-localstorage-design";

export const RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY = DESIGN_LOCALSTORAGE_KEY;
export const RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY = DESIGN_LAST_PREVIEW_KEY;

const MAX_DRAFTS = 30;

// ── Envelope ──────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftLocalStorageServerSyncStatus =
  | "not_attempted" | "disabled" | "synced" | "failed";

export type RuntimeMissionDraftLocalStorageEnvelope = {
  schema_version: "v1";
  saved_at: string;
  updated_at: string;
  draft_id: string;
  command_id: string;
  plan_id: string;
  source: "localstorage";
  persisted_local: true;
  persisted_server: false;
  server_sync_status: RuntimeMissionDraftLocalStorageServerSyncStatus;
  safety_flags: {
    execution_enabled: false;
    db_write_enabled: false;
    pierre_engine_called: false;
    ai_call_performed: false;
    email_sent: false;
    message_sent: false;
    document_generated: false;
    clonevoice_active: false;
    public_launch_external_validated: false;
  };
  payload: RuntimeMissionDraft;
};

export type RuntimeMissionDraftLocalStorageSaveOptions = {
  server_sync_status?: RuntimeMissionDraftLocalStorageServerSyncStatus;
  now?: string;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftLocalStorageEnvelope(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionDraftLocalStorageSaveOptions
): RuntimeMissionDraftLocalStorageEnvelope {
  const now = options?.now ?? new Date().toISOString();
  const safe = sanitizeRuntimeMissionDraft(draft);
  return {
    schema_version: "v1",
    saved_at: now,
    updated_at: now,
    draft_id: safe.draft_id,
    command_id: safe.command_id,
    plan_id: safe.plan_id,
    source: "localstorage",
    persisted_local: true,
    persisted_server: false,
    server_sync_status: options?.server_sync_status ?? "not_attempted",
    safety_flags: {
      execution_enabled: false,
      db_write_enabled: false,
      pierre_engine_called: false,
      ai_call_performed: false,
      email_sent: false,
      message_sent: false,
      document_generated: false,
      clonevoice_active: false,
      public_launch_external_validated: false,
    },
    payload: safe,
  };
}

export function validateRuntimeMissionDraftLocalStorageEnvelope(
  envelope: RuntimeMissionDraftLocalStorageEnvelope
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (envelope?.schema_version !== "v1") issues.push("schema_version doit être v1.");
  if (!envelope?.draft_id?.trim()) issues.push("draft_id requis.");
  if (envelope?.persisted_server !== false) issues.push("persisted_server doit être false.");
  if (!envelope?.payload || envelope.payload.read_only !== true) issues.push("payload.read_only doit être true.");
  if (envelope?.payload && envelope.payload.execution_enabled !== false) issues.push("payload.execution_enabled doit être false.");
  return { valid: issues.length === 0, issues };
}

export function serializeRuntimeMissionDraftLocalStorageEnvelope(
  envelope: RuntimeMissionDraftLocalStorageEnvelope
): string {
  return JSON.stringify(envelope);
}

export function parseRuntimeMissionDraftLocalStorageEnvelope(
  raw: string
): RuntimeMissionDraftLocalStorageEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const env = parsed as RuntimeMissionDraftLocalStorageEnvelope;
    if (env.schema_version !== "v1" || !env.draft_id || !env.payload) return null;
    return env;
  } catch {
    return null;
  }
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export function mergeRuntimeMissionDraftLocalStorageList(
  existing: RuntimeMissionDraftLocalStorageEnvelope[],
  next: RuntimeMissionDraftLocalStorageEnvelope
): RuntimeMissionDraftLocalStorageEnvelope[] {
  const deduped = existing.filter((e) => e.draft_id !== next.draft_id);
  return [next, ...deduped].slice(0, MAX_DRAFTS);
}

// ── LocalStorage read ─────────────────────────────────────────────────────────

export function loadRuntimeMissionDraftsFromLocalStorage(): RuntimeMissionDraftLocalStorageEnvelope[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RuntimeMissionDraftLocalStorageEnvelope =>
        typeof e === "object" && e !== null &&
        (e as RuntimeMissionDraftLocalStorageEnvelope).schema_version === "v1" &&
        Boolean((e as RuntimeMissionDraftLocalStorageEnvelope).draft_id)
    );
  } catch {
    return [];
  }
}

export function loadRuntimeMissionDraftFromLocalStorage(
  draftId: string
): RuntimeMissionDraftLocalStorageEnvelope | null {
  if (!draftId) return null;
  return loadRuntimeMissionDraftsFromLocalStorage().find((e) => e.draft_id === draftId) ?? null;
}

export function loadLatestRuntimeMissionDraftFromLocalStorage(): RuntimeMissionDraftLocalStorageEnvelope | null {
  const list = loadRuntimeMissionDraftsFromLocalStorage();
  if (list.length === 0) return null;
  return list.reduce((latest, current) => {
    const lt = new Date(latest.updated_at).getTime();
    const ct = new Date(current.updated_at).getTime();
    return ct > lt ? current : latest;
  });
}

// ── LocalStorage write (autorisé uniquement ici) ──────────────────────────────

export function saveRuntimeMissionDraftToLocalStorage(
  draft: RuntimeMissionDraft,
  options?: RuntimeMissionDraftLocalStorageSaveOptions
): { ok: boolean; envelope: RuntimeMissionDraftLocalStorageEnvelope | null; issues: string[] } {
  // Validation préalable — refuse tout draft non-safe.
  const validation = validateRuntimeMissionDraft(draft);
  if (!validation.valid) {
    return { ok: false, envelope: null, issues: validation.issues.map((i) => i.message) };
  }
  if (typeof window === "undefined") {
    return { ok: false, envelope: null, issues: ["window indisponible (SSR)."] };
  }

  const envelope = buildRuntimeMissionDraftLocalStorageEnvelope(draft, options);
  try {
    const existing = loadRuntimeMissionDraftsFromLocalStorage();
    const merged = mergeRuntimeMissionDraftLocalStorageList(existing, envelope);
    window.localStorage.setItem(RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY, JSON.stringify(merged));
    window.localStorage.setItem(RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY, serializeRuntimeMissionDraftLocalStorageEnvelope(envelope));
    return { ok: true, envelope, issues: [] };
  } catch {
    return { ok: false, envelope: null, issues: ["Échec écriture localStorage (quota / mode privé)."] };
  }
}

export function removeRuntimeMissionDraftFromLocalStorage(draftId: string): boolean {
  if (typeof window === "undefined" || !draftId) return false;
  try {
    const existing = loadRuntimeMissionDraftsFromLocalStorage();
    const next = existing.filter((e) => e.draft_id !== draftId);
    window.localStorage.setItem(RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearRuntimeMissionDraftsFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY);
    window.localStorage.removeItem(RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY);
  } catch {
    /* silent fail */
  }
}
