// src/lib/clonestore/runtime-integration/controlled-mission-local-storage.ts
// PHASE 5.1 — Controlled Mission — LocalStorage Runtime (read/write, client-only)
//
// SEUL endroit autorisé à écrire localStorage pour les Controlled Missions locales.
// Réutilise la clé de design P4.10. Aucun appel réseau. Pas de base de données.
// Pas d'import Pierre. Pas d'exécution. Pas de persistance serveur.

import type {
  LocalControlledMission,
  LocalControlledMissionEnvelope,
} from "./controlled-mission-safe-apply-types";
import {
  RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY,
  RUNTIME_CONTROLLED_MISSION_LAST_PREVIEW_KEY,
} from "./runtime-controlled-mission-localstorage-design";

export const CONTROLLED_MISSION_LOCALSTORAGE_KEY = RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY;
export const CONTROLLED_MISSION_LAST_PREVIEW_KEY = RUNTIME_CONTROLLED_MISSION_LAST_PREVIEW_KEY;

const MAX_MISSIONS = 50;

// ── Envelope ──────────────────────────────────────────────────────────────────

export function buildLocalControlledMissionEnvelope(
  mission: LocalControlledMission,
  now?: string
): LocalControlledMissionEnvelope {
  const ts = now ?? new Date().toISOString();
  return {
    schema_version: "v1",
    saved_at: ts,
    updated_at: ts,
    id: mission.id,
    source_promotion_id: mission.source_promotion_id,
    source_draft_id: mission.source_draft_id,
    persisted_local: true,
    persisted_server: false,
    runtime_execution: "disabled",
    payload: mission,
  };
}

export function validateLocalControlledMissionEnvelope(
  envelope: LocalControlledMissionEnvelope
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (envelope?.schema_version !== "v1") issues.push("schema_version doit être v1.");
  if (!envelope?.id?.trim()) issues.push("id requis.");
  if (envelope?.persisted_server !== false) issues.push("persisted_server doit être false.");
  if (envelope?.runtime_execution !== "disabled") issues.push("runtime_execution doit être disabled.");
  if (!envelope?.payload || envelope.payload.read_only !== true) issues.push("payload.read_only doit être true.");
  if (envelope?.payload && envelope.payload.runtime_execution !== "disabled") issues.push("payload.runtime_execution doit être disabled.");
  return { valid: issues.length === 0, issues };
}

function isEnvelope(e: unknown): e is LocalControlledMissionEnvelope {
  return (
    typeof e === "object" && e !== null &&
    (e as LocalControlledMissionEnvelope).schema_version === "v1" &&
    Boolean((e as LocalControlledMissionEnvelope).id) &&
    Boolean((e as LocalControlledMissionEnvelope).payload)
  );
}

// ── Read (corrompu → [], jamais de crash) ─────────────────────────────────────

export function loadLocalControlledMissionEnvelopes(): LocalControlledMissionEnvelope[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONTROLLED_MISSION_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEnvelope);
  } catch {
    // localStorage corrompu → fallback tableau vide.
    return [];
  }
}

export function loadLocalControlledMissions(): LocalControlledMission[] {
  return loadLocalControlledMissionEnvelopes()
    .map((e) => e.payload)
    .filter((m): m is LocalControlledMission => Boolean(m) && m.read_only === true);
}

export function getLocalControlledMissionById(id: string): LocalControlledMission | null {
  if (!id) return null;
  return loadLocalControlledMissions().find((m) => m.id === id) ?? null;
}

export function hasLocalControlledMission(id: string): boolean {
  return getLocalControlledMissionById(id) !== null;
}

// ── Write (idempotent par id) ─────────────────────────────────────────────────

export function upsertLocalControlledMission(
  mission: LocalControlledMission,
  now?: string
): { ok: boolean; created: boolean; issues: string[] } {
  if (typeof window === "undefined") {
    return { ok: false, created: false, issues: ["window indisponible (SSR)."] };
  }
  try {
    const existing = loadLocalControlledMissionEnvelopes();
    const already = existing.some((e) => e.id === mission.id);
    const envelope = buildLocalControlledMissionEnvelope(mission, now);
    // Idempotence : dédupe par id, le nouveau remplace l'ancien, jamais de doublon.
    const deduped = existing.filter((e) => e.id !== mission.id);
    const merged = [envelope, ...deduped].slice(0, MAX_MISSIONS);
    window.localStorage.setItem(CONTROLLED_MISSION_LOCALSTORAGE_KEY, JSON.stringify(merged));
    window.localStorage.setItem(CONTROLLED_MISSION_LAST_PREVIEW_KEY, JSON.stringify(envelope));
    return { ok: true, created: !already, issues: [] };
  } catch {
    return { ok: false, created: false, issues: ["Échec écriture localStorage (quota / mode privé)."] };
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────

export function archiveLocalControlledMission(id: string, now?: string): boolean {
  if (typeof window === "undefined" || !id) return false;
  try {
    const envelopes = loadLocalControlledMissionEnvelopes();
    const ts = now ?? new Date().toISOString();
    let changed = false;
    const next = envelopes.map((e) => {
      if (e.id !== id) return e;
      changed = true;
      return {
        ...e,
        updated_at: ts,
        payload: {
          ...e.payload,
          status: "archived_local" as const,
          execution_status: "not_executable" as const,
          updated_at: ts,
        },
      };
    });
    if (!changed) return false;
    window.localStorage.setItem(CONTROLLED_MISSION_LOCALSTORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// ── Clear (QA only) ───────────────────────────────────────────────────────────
// Vide la clé localStorage des missions contrôlées locales. Réservé QA / reset
// utilisateur. Aucun effet serveur, aucune exécution.

export function clearLocalControlledMissionsForQA(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONTROLLED_MISSION_LOCALSTORAGE_KEY);
    window.localStorage.removeItem(CONTROLLED_MISSION_LAST_PREVIEW_KEY);
  } catch {
    /* silent */
  }
}
