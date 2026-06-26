// src/lib/clonestore/cloneos-history/cloneos-history-flags.ts
// PHASE 3.3 — Apply CloneOS History Persistence Safely — Feature Flags
//
// Contrôle l'activation de la persistence serveur via variable d'environnement.
// Par défaut : désactivé (localStorage uniquement).
// Activation : NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true
//   + table SQL appliquée manuellement (PHASE 3.3 doc)
//   + RLS validée en environnement de test.
//
// IMPORTANT :
//   - Jamais de true hardcodé ici.
//   - La valeur dépend uniquement de l'env var.
//   - Si env var absente ou différente de "true" → false.
//   - Ne modifie pas les public launch flags.

import type { CloneOSHistoryPersistenceMode } from "./cloneos-history-types";

// ── Clé variable d'environnement ──────────────────────────────────────────────

export const CLONEOS_HISTORY_PERSISTENCE_ENV_KEY =
  "NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED" as const;

// ── Vérification configuration ────────────────────────────────────────────────
// Retourne true uniquement si env var = "true" (exact match).

export function isCloneOSHistoryServerPersistenceConfigured(): boolean {
  if (typeof process === "undefined") return false;
  try {
    return (
      process.env[CLONEOS_HISTORY_PERSISTENCE_ENV_KEY] === "true"
    );
  } catch {
    return false;
  }
}

// ── Activation ────────────────────────────────────────────────────────────────
// Alias sémantique. Default : false.

export function isCloneOSHistoryServerPersistenceEnabled(): boolean {
  return isCloneOSHistoryServerPersistenceConfigured();
}

// ── Mode de persistence ───────────────────────────────────────────────────────

export function getCloneOSHistoryPersistenceMode(): CloneOSHistoryPersistenceMode {
  return isCloneOSHistoryServerPersistenceEnabled()
    ? "server_active"
    : "server_draft";
}

// ── Explication lisible ───────────────────────────────────────────────────────
// Utilisé pour les badges UI et la doc.

export function explainCloneOSHistoryPersistenceMode(): string {
  if (isCloneOSHistoryServerPersistenceEnabled()) {
    return "Server persistence activée uniquement si table/RLS validées.";
  }
  return "Server persistence désactivée — fallback localStorage.";
}

// ── Instructions d'activation ─────────────────────────────────────────────────
// Rappel humain affiché dans les logs ou la doc.

export const CLONEOS_HISTORY_ACTIVATION_STEPS = [
  "1. Appliquer supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql dans Supabase Dashboard.",
  "2. Vérifier table public.clonestore_cloneos_history + RLS enabled.",
  "3. Vérifier policies cloneos_history_select_own + cloneos_history_insert_own.",
  "4. Tester en environnement de test (npx tsc --noEmit, npm run test:phase3-3).",
  "5. Ajouter NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
  "6. Relancer npm run build.",
] as const;
