// src/lib/clonestore/onboarding/global-onboarding-flags.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Feature Flags
//
// Contrôle l'activation de la persistence serveur via variable d'environnement.
// Default : false. Activation : NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
// Jamais de true hardcodé ici.

import type { GlobalOnboardingPersistenceMode } from "./global-onboarding-types";

export const GLOBAL_ONBOARDING_PERSISTENCE_ENV_KEY =
  "NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED" as const;

export function isGlobalOnboardingServerPersistenceEnabled(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return process.env[GLOBAL_ONBOARDING_PERSISTENCE_ENV_KEY] === "true";
  } catch {
    return false;
  }
}

export function getGlobalOnboardingPersistenceMode(): GlobalOnboardingPersistenceMode {
  return isGlobalOnboardingServerPersistenceEnabled()
    ? "server_active"
    : "server_draft";
}

export function explainGlobalOnboardingPersistenceMode(): string {
  if (isGlobalOnboardingServerPersistenceEnabled()) {
    return "Persistence serveur onboarding activée — table/RLS validées requises.";
  }
  return "Brouillon local uniquement — persistence serveur désactivée.";
}

export const GLOBAL_ONBOARDING_ACTIVATION_STEPS = [
  "1. Appliquer supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql dans Supabase Dashboard.",
  "2. Vérifier table public.clonestore_global_onboarding_drafts + RLS enabled.",
  "3. Vérifier policies select_own, insert_own, update_own.",
  "4. Tester en environnement de test.",
  "5. Ajouter NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "6. Relancer build et tests.",
] as const;
