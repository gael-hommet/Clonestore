// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-flags.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Server Feature Flags
//
// Contrôle l'activation de la persistence serveur dédiée à la table
// clonestore_enterprise_footprints.
//
// INVARIANTS :
//   - Default false. Jamais hardcoder true ici.
//   - Ne pas modifier .env.local automatiquement.
//   - Activation manuelle via : NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true
//   - Conditions pré-activation :
//       1. SQL PHASE_3_13 appliqué manuellement
//       2. RLS validée en env test
//       3. Health check select passe
//       4. Build et tests clean

import type { EnterpriseFootprintServerPersistenceMode } from "./enterprise-footprint-server-types";

// ── Clé d'environnement ───────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_ENV_KEY =
  "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED" as const;

// ── Étapes d'activation ───────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_ACTIVATION_STEPS = [
  "1. Appliquer manuellement le SQL PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql.",
  "2. Vérifier RLS enabled + policies select/insert/update own sur clonestore_enterprise_footprints.",
  "3. Lancer checkEnterpriseFootprintServerTableReadiness() en env test.",
  "4. Valider les tests E2E sur données réelles.",
  "5. Ajouter NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "6. Relancer build et tests.",
  "7. Note : lancement public externe non validé.",
] as const;

// ── Fonctions ─────────────────────────────────────────────────────────────────

/** Vérifie si la persistence serveur est activée via variable d'environnement. */
export function isEnterpriseFootprintServerPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[ENTERPRISE_FOOTPRINT_SERVER_ENV_KEY] === "true";
  } catch {
    return false;
  }
}

/** Mode de persistence actuel. */
export function getEnterpriseFootprintServerPersistenceMode(): EnterpriseFootprintServerPersistenceMode {
  return isEnterpriseFootprintServerPersistenceEnabled()
    ? "server_active"
    : "server_draft";
}

/** Explication lisible du mode actuel. */
export function explainEnterpriseFootprintServerPersistenceMode(): string {
  if (isEnterpriseFootprintServerPersistenceEnabled()) {
    return "Persistence serveur Empreinte Entreprise activée — table/RLS requises.";
  }
  return [
    "Snapshot local uniquement — persistence serveur Empreinte désactivée.",
    `Pour activer : ${ENTERPRISE_FOOTPRINT_SERVER_ENV_KEY}=true`,
    "Conditions pré-activation : SQL appliqué + RLS validée + tests clean.",
  ].join(" ");
}
