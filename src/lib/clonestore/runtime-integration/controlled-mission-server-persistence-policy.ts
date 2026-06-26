// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-policy.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — Policy & Feature Flag
//
// DESIGN-ONLY. Décrit la politique RLS/gouvernance et le contrat de feature flag.
// default false. Jamais hardcodé true. Jamais activé. .env.local jamais modifié.
// Aucune route active. Aucun appel réseau. Aucune écriture.

import type { LocalControlledMission } from "./controlled-mission-safe-apply-types";
import type {
  GovernedControlledMissionServerPersistencePolicySnapshot,
  GovernedControlledMissionServerPersistenceFeatureFlagContract,
} from "./controlled-mission-server-persistence-types";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME } from "./controlled-mission-server-persistence-sql-draft";

// ── Feature flag (default false) ──────────────────────────────────────────────

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG =
  "NEXT_PUBLIC_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED" as const;

export const DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED = false as const;

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_ACTIVATION_STEPS = [
  "1. Revue manuelle de supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql.",
  "2. Appliquer manuellement le SQL en environnement de test (table + RLS + CHECK).",
  "3. Vérifier table clonestore_controlled_missions + RLS enabled + policies select/insert/update.",
  "4. Vérifier CHECK no_execution (tous les *_enabled = false, runtime_status disabled).",
  "5. Concevoir l'activation manuelle QA (PHASE 5.5) — toujours sans exécution.",
  "6. Ajouter NEXT_PUBLIC_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED=true dans .env.local (phase ultérieure).",
  "7. Relancer build et tests.",
  "8. Note : persistance serveur ≠ exécution. lancement public externe non validé.",
] as const;

export function getControlledMissionServerPersistenceFlagDefault(): boolean {
  return DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED;
}

export function isControlledMissionServerPersistenceEnabledFromEnv(
  env?: Record<string, string | undefined>
): boolean {
  const source = env ?? (typeof process !== "undefined" ? process.env : {});
  try {
    return source[CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG] === "true";
  } catch {
    return false;
  }
}

export function buildControlledMissionServerPersistenceFlagSnapshot(
  env?: Record<string, string | undefined>
): GovernedControlledMissionServerPersistenceFeatureFlagContract {
  return {
    flag_key: CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
    default_enabled: false,
    enabled: isControlledMissionServerPersistenceEnabledFromEnv(env),
    phase_status: "design_only",
    activation_steps: [...CONTROLLED_MISSION_SERVER_PERSISTENCE_ACTIVATION_STEPS],
  };
}

export function buildControlledMissionServerPersistenceFeatureFlagContract(
  env?: Record<string, string | undefined>
): GovernedControlledMissionServerPersistenceFeatureFlagContract {
  return buildControlledMissionServerPersistenceFlagSnapshot(env);
}

// ── Policy snapshot (RLS / gouvernance) ───────────────────────────────────────

export function buildControlledMissionServerPersistencePolicySnapshot(
  mission: LocalControlledMission
): GovernedControlledMissionServerPersistencePolicySnapshot {
  void mission;
  return {
    table_name: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    rls_enabled: true,
    select_policy: "select_own_controlled_mission",
    insert_policy: "insert_own_controlled_mission",
    update_policy: "update_own_controlled_mission",
    delete_policy: "none_by_design",
    service_role_required: false,
    human_validation_required: true,
    governed_check_required: true,
    no_execution_check_required: true,
  };
}
