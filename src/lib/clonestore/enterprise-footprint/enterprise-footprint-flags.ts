// src/lib/clonestore/enterprise-footprint/enterprise-footprint-flags.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Feature Flags
//
// Contrôle l'activation de la persistence serveur de l'Empreinte.
// Default : false. Activation : NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true
// Jamais de true hardcodé ici.

import type { EnterpriseFootprintPersistenceMode } from "./enterprise-footprint-types";

export const ENTERPRISE_FOOTPRINT_PERSISTENCE_ENV_KEY =
  "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED" as const;

export function isEnterpriseFootprintServerPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[ENTERPRISE_FOOTPRINT_PERSISTENCE_ENV_KEY] === "true";
  } catch {
    return false;
  }
}

export function getEnterpriseFootprintPersistenceMode(): EnterpriseFootprintPersistenceMode {
  return isEnterpriseFootprintServerPersistenceEnabled()
    ? "server_active"
    : "server_draft";
}

export function explainEnterpriseFootprintPersistenceMode(): string {
  if (isEnterpriseFootprintServerPersistenceEnabled()) {
    return "Persistence serveur Empreinte Entreprise activée — table/RLS validées requises.";
  }
  return "Snapshot local uniquement — persistence serveur Empreinte désactivée.";
}

export const ENTERPRISE_FOOTPRINT_ACTIVATION_STEPS = [
  "1. Préparer la table SQL clonestore_enterprise_footprints (PHASE 3.9+).",
  "2. Vérifier RLS enabled + policies select/insert/update own.",
  "3. Tester en environnement de test.",
  "4. Ajouter NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "5. Relancer build et tests.",
  "6. Note : en PHASE 3.8, la persistence Empreinte réutilise le draft onboarding persisté.",
] as const;
