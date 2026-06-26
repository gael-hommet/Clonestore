// src/lib/clonestore/runtime-integration/runtime-controlled-mission-persistence-flags.ts
// PHASE 4.10 — Controlled Mission Governed Persistence — Feature Flags
//
// Default false. Jamais hardcodé true. Jamais activé. .env.local jamais modifié.

import type { RuntimeControlledMissionPersistenceFeatureFlag } from "./runtime-controlled-mission-persistence-types";

export const RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG =
  "NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED" as const;

export const DEFAULT_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED = false as const;

// ── Étapes d'activation (rappel humain) ───────────────────────────────────────

export const RUNTIME_CONTROLLED_MISSION_PERSISTENCE_ACTIVATION_STEPS = [
  "1. Appliquer manuellement supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql.",
  "2. Vérifier table clonestore_controlled_mission_candidates + RLS enabled.",
  "3. Vérifier policies select/insert/update own + safety_flags CHECK + governed CHECK.",
  "4. Concevoir le workflow de validation humaine (PHASE 4.11).",
  "5. Concevoir le safe apply localStorage-first (PHASE 4.11+).",
  "6. Ajouter NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "7. Relancer build et tests.",
  "8. Note : lancement public externe non validé.",
] as const;

// ── Lecture du flag (default false) ───────────────────────────────────────────

export function isRuntimeControlledMissionServerPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG] === "true";
  } catch {
    return false;
  }
}

export function getRuntimeControlledMissionServerPersistenceFlagState(): RuntimeControlledMissionPersistenceFeatureFlag {
  return {
    flag_key: RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
    enabled: isRuntimeControlledMissionServerPersistenceEnabled(),
    default_enabled: false,
  };
}

export function explainRuntimeControlledMissionServerPersistenceFlag(): string {
  if (isRuntimeControlledMissionServerPersistenceEnabled()) {
    return "Persistance serveur des candidates de mission contrôlée activée — table/RLS + validation humaine requises.";
  }
  return [
    "Persistance serveur des candidates désactivée (default false) — candidate local/in-memory.",
    `Pour activer : ${RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG}=true`,
    "Conditions : SQL appliqué + RLS validée + workflow de validation humaine + safe apply (PHASE 4.11+).",
    "promotion_applied false. human_validation_required true. lancement public externe non validé.",
  ].join(" ");
}
