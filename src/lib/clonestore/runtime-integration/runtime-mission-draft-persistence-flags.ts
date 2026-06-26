// src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-flags.ts
// PHASE 4.4 — Runtime Mission Draft Persistence — Feature Flags
//
// Default false. Jamais hardcodé true. Jamais activé. .env.local jamais modifié.

import type { RuntimeMissionDraftPersistenceFeatureFlag } from "./runtime-mission-draft-persistence-types";

export const RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG =
  "NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED" as const;

export const DEFAULT_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED = false as const;

// ── Étapes d'activation (rappel humain) ───────────────────────────────────────

export const RUNTIME_MISSION_DRAFT_PERSISTENCE_ACTIVATION_STEPS = [
  "1. Appliquer manuellement supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql.",
  "2. Vérifier table clonestore_runtime_mission_drafts + RLS enabled.",
  "3. Vérifier policies select/insert/update own + safety_flags CHECK.",
  "4. Lancer le health check en env test (PHASE 4.5).",
  "5. Ajouter NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "6. Relancer build et tests.",
  "7. Note : lancement public externe non validé.",
] as const;

// ── Lecture du flag (default false) ───────────────────────────────────────────

export function isRuntimeMissionDraftServerPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG] === "true";
  } catch {
    return false;
  }
}

export function getRuntimeMissionDraftServerPersistenceFlagState(): RuntimeMissionDraftPersistenceFeatureFlag {
  return {
    flag_key: RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG,
    enabled: isRuntimeMissionDraftServerPersistenceEnabled(),
    default_enabled: false,
  };
}

export function explainRuntimeMissionDraftServerPersistenceFlag(): string {
  if (isRuntimeMissionDraftServerPersistenceEnabled()) {
    return "Persistance serveur des brouillons activée — table/RLS requises (PHASE 4.5).";
  }
  return [
    "Persistance serveur des brouillons désactivée (default false) — brouillon local/in-memory.",
    `Pour activer : ${RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG}=true`,
    "Conditions : SQL appliqué + RLS validée + safe apply (PHASE 4.5). lancement public externe non validé.",
  ].join(" ");
}
