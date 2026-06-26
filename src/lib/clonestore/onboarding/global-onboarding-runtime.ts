// src/lib/clonestore/onboarding/global-onboarding-runtime.ts
// PHASE 3.6 / 3.7 — Global Onboarding Runtime Safe Bridge
//
// Orchestre la persistence onboarding en 3 modes :
//   1. localStorage only  (défaut — toujours safe)
//   2. server attempted   (health check KO → fallback LS)
//   3. server active      (flag + auth + health + validation OK)
//
// PHASE 3.7 : ajoute restoreGlobalOnboardingWithFallback
//   - Restore read-only : localStorage → serveur (si flag + auth + health OK)
//   - Compare updated_at : conserve le plus récent
//   - Jamais de write dans la section restore
//
// INVARIANTS ABSOLUS :
//   - localStorage TOUJOURS écrit en premier dans la section write (jamais skippé)
//   - DB write best-effort uniquement (jamais bloquant)
//   - Feature flag gate obligatoire avant toute tentative DB
//   - Health check obligatoire avant write et restore serveur
//   - Validation obligatoire avant write
//   - Section restore : READ ONLY — pas de insert/update/delete/upsert
//   - Aucun appel métier / email / document / mission
//   - Aucun service role côté client
//   - Jamais de throw brut vers l'UI

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlobalOnboardingDraft } from "./global-onboarding-types";
// localStorage first — import avant les autres pour signaler la priorité
import {
  saveGlobalOnboardingDraftToLocalStorage,
  loadGlobalOnboardingDraftFromLocalStorage,
  normalizeGlobalOnboardingPayload,
} from "./global-onboarding-localstorage";
import { isGlobalOnboardingServerPersistenceEnabled } from "./global-onboarding-flags";
import {
  validateGlobalOnboardingDraft,
  sanitizeGlobalOnboardingDraft,
} from "./global-onboarding-validation";
import { checkGlobalOnboardingTableReadiness } from "./global-onboarding-health";
import { persistGlobalOnboardingDraftSafely } from "./global-onboarding-storage";
import { loadGlobalOnboardingDraftReadOnly } from "./global-onboarding-readonly-client";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Résultat de persistence onboarding — côté runtime. */
export type GlobalOnboardingRuntimePersistOutcome =
  | "local_persisted"                     // localStorage seul — flag désactivé
  | "local_persisted_auth_required"       // flag OK, userId manquant
  | "local_persisted_validation_failed"   // validation échouée
  | "local_persisted_server_unavailable"  // health check KO
  | "local_and_server_persisted"          // succès total
  | "local_persisted_server_write_failed"; // write DB échoué (localStorage OK)

/** Mode de persistence actif au moment du résultat. */
export type GlobalOnboardingRuntimePersistenceMode =
  | "localstorage_only"   // localStorage uniquement (flag false ou auth manquante)
  | "server_active"       // localStorage + DB (succès)
  | "server_attempted";   // tentative DB échouée → fallback localStorage

/** Résultat structuré retourné par persistGlobalOnboardingWithFallback. */
export type GlobalOnboardingRuntimeResult = {
  outcome: GlobalOnboardingRuntimePersistOutcome;
  local_saved: boolean;
  server_saved: boolean;
  draft_id: string;
  persistence_mode: GlobalOnboardingRuntimePersistenceMode;
  error: string | null;
  warning: string | null;
};

/** Options pour persistGlobalOnboardingWithFallback. */
export type PersistGlobalOnboardingOptions = {
  supabase: SupabaseClient | null;
  userId: string | null;
  draft: GlobalOnboardingDraft;
};

// ── Runtime bridge ────────────────────────────────────────────────────────────
//
// Flux :
//   1. localStorage TOUJOURS en premier
//   2. Feature flag gate → local_persisted si false
//   3. Auth check → local_persisted_auth_required si userId manquant
//   4. Sanitize + validation → local_persisted_validation_failed si invalide
//   5. Health check table/RLS → local_persisted_server_unavailable si KO
//   6. Write DB best-effort → local_and_server_persisted ou server_write_failed
//
// NE PAS appeler depuis /profile/onboarding sans feature flag.
// localStorage reste toujours la source de vérité locale.

export async function persistGlobalOnboardingWithFallback(
  options: PersistGlobalOnboardingOptions
): Promise<GlobalOnboardingRuntimeResult> {
  const { supabase, userId, draft } = options;
  const localDraftId = draft.id;

  // ÉTAPE 1 — localStorage TOUJOURS en premier — jamais conditionnel
  try {
    saveGlobalOnboardingDraftToLocalStorage(draft);
  } catch {
    /* Silent fail — localStorage peut être indisponible (mode privé, quota) */
  }
  const localSaved = true; // localStorage toujours tenté, jamais bloquant

  // ÉTAPE 2 — Feature flag gate
  if (!isGlobalOnboardingServerPersistenceEnabled()) {
    return {
      outcome: "local_persisted",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "localstorage_only",
      error: null,
      warning: null,
    };
  }

  // ÉTAPE 3 — Auth check
  if (!userId || !userId.trim()) {
    return {
      outcome: "local_persisted_auth_required",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "localstorage_only",
      error: null,
      warning: "Connexion requise pour la persistence serveur.",
    };
  }

  // ÉTAPE 4 — Sanitize + validation
  let sanitized: GlobalOnboardingDraft;
  try {
    sanitized = sanitizeGlobalOnboardingDraft(draft);
    const validation = validateGlobalOnboardingDraft(sanitized);
    if (!validation.valid) {
      const errorMessages = validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ");
      return {
        outcome: "local_persisted_validation_failed",
        local_saved: localSaved,
        server_saved: false,
        draft_id: localDraftId,
        persistence_mode: "localstorage_only",
        error: `Validation échouée : ${errorMessages}`,
        warning: "Brouillon local sauvegardé — correction requise pour persistence serveur.",
      };
    }
  } catch (err) {
    return {
      outcome: "local_persisted_validation_failed",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "localstorage_only",
      error: err instanceof Error ? err.message : "Erreur validation inattendue",
      warning: "Brouillon local sauvegardé.",
    };
  }

  // ÉTAPE 5 — Health check table/RLS
  let health;
  try {
    health = await checkGlobalOnboardingTableReadiness(supabase, userId);
    if (!health.can_attempt_write) {
      return {
        outcome: "local_persisted_server_unavailable",
        local_saved: localSaved,
        server_saved: false,
        draft_id: localDraftId,
        persistence_mode: "server_attempted",
        error: health.error_message,
        warning: health.warning ?? "Table ou RLS non disponible — localStorage actif.",
      };
    }
  } catch (err) {
    return {
      outcome: "local_persisted_server_unavailable",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "server_attempted",
      error: err instanceof Error ? err.message : "Health check exception",
      warning: "Fallback localStorage actif.",
    };
  }

  // ÉTAPE 6 — Write DB best-effort (via persistGlobalOnboardingDraftSafely)
  try {
    const writeResult = await persistGlobalOnboardingDraftSafely(
      supabase,
      userId,
      sanitized
    );

    if (writeResult.persisted && writeResult.source === "server") {
      return {
        outcome: "local_and_server_persisted",
        local_saved: localSaved,
        server_saved: true,
        draft_id: writeResult.draft_id,
        persistence_mode: "server_active",
        error: null,
        warning: null,
      };
    }

    // Write DB échoué — localStorage OK
    return {
      outcome: "local_persisted_server_write_failed",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "server_attempted",
      error: writeResult.error,
      warning: "Write serveur échoué (best-effort) — localStorage actif.",
    };
  } catch (err) {
    return {
      outcome: "local_persisted_server_write_failed",
      local_saved: localSaved,
      server_saved: false,
      draft_id: localDraftId,
      persistence_mode: "server_attempted",
      error: err instanceof Error ? err.message : "Exception write serveur",
      warning: "Exception write serveur — localStorage actif.",
    };
  }
}

// ── Types restore ─────────────────────────────────────────────────────────────
// PHASE 3.7 — Restore read-only : jamais de write dans cette section

/** Résultat du restore onboarding — côté runtime. */
export type GlobalOnboardingRuntimeRestoreOutcome =
  | "local_draft_restored"       // localStorage seul (flag false ou pas d'auth)
  | "server_draft_restored"      // draft serveur plus récent → utilisé
  | "local_draft_preferred"      // draft localStorage plus récent → conservé
  | "server_unavailable"         // health KO → fallback localStorage
  | "empty"                      // aucun draft (ni local ni serveur)
  | "auth_required";             // flag true mais userId manquant

/** Résultat structuré retourné par restoreGlobalOnboardingWithFallback. */
export type GlobalOnboardingRuntimeRestoreResult = {
  outcome: GlobalOnboardingRuntimeRestoreOutcome;
  draft: GlobalOnboardingDraft | null;
  source: "localstorage" | "server" | "empty";
  local_checked: boolean;
  server_checked: boolean;
  error: string | null;
  warning: string | null;
};

/** Options pour restoreGlobalOnboardingWithFallback. */
export type RestoreGlobalOnboardingOptions = {
  supabase: SupabaseClient | null;
  userId: string | null;
  companyId?: string;
};

// ── Restore safe (read-only) ──────────────────────────────────────────────────
// PHASE 3.7 — Lit le draft depuis localStorage + serveur (si flag + auth + health OK).
// Compare updated_at : conserve le plus récent.
//
// INVARIANTS SECTION RESTORE :
//   - READ ONLY — aucun insert, update, delete, upsert
//   - Jamais de write en DB dans cette fonction
//   - Ne pas écraser un draft local plus récent que le serveur
//   - try/catch complet — jamais de throw brut
//
// Flux :
//   1. Lire localStorage (local_checked = true)
//   2. Si flag false → retourner draft local
//   3. Si pas userId → retourner draft local (auth_required)
//   4. Health check read-only
//   5. Si health KO → retourner draft local (server_unavailable)
//   6. loadGlobalOnboardingDraftReadOnly (select only)
//   7. Comparer updated_at local vs serveur → plus récent gagne
//   8. Retourner résultat structuré

export async function restoreGlobalOnboardingWithFallback(
  options: RestoreGlobalOnboardingOptions
): Promise<GlobalOnboardingRuntimeRestoreResult> {
  const { supabase, userId, companyId } = options;

  // ÉTAPE 1 — Charger localStorage (toujours tenté)
  let localDraft: GlobalOnboardingDraft | null = null;
  try {
    const rawLocal = loadGlobalOnboardingDraftFromLocalStorage();
    localDraft = rawLocal ? normalizeGlobalOnboardingPayload(rawLocal) : null;
  } catch {
    /* Silent fail */
  }
  const localChecked = true;

  // ÉTAPE 2 — Feature flag gate
  if (!isGlobalOnboardingServerPersistenceEnabled()) {
    return {
      outcome: localDraft ? "local_draft_restored" : "empty",
      draft: localDraft,
      source: localDraft ? "localstorage" : "empty",
      local_checked: localChecked,
      server_checked: false,
      error: null,
      warning: null,
    };
  }

  // ÉTAPE 3 — Auth check
  if (!userId || !userId.trim()) {
    return {
      outcome: "auth_required",
      draft: localDraft,
      source: localDraft ? "localstorage" : "empty",
      local_checked: localChecked,
      server_checked: false,
      error: null,
      warning: "Connexion requise pour le restore serveur — brouillon local utilisé.",
    };
  }

  // ÉTAPE 4 — Health check read-only
  let serverChecked = false;
  try {
    const health = await checkGlobalOnboardingTableReadiness(supabase, userId);
    if (!health.can_attempt_write) {
      // can_attempt_write false = table absente ou RLS bloquée
      return {
        outcome: "server_unavailable",
        draft: localDraft,
        source: localDraft ? "localstorage" : "empty",
        local_checked: localChecked,
        server_checked: false,
        error: health.error_message,
        warning: health.warning ?? "Serveur indisponible — brouillon local utilisé.",
      };
    }
  } catch (err) {
    return {
      outcome: "server_unavailable",
      draft: localDraft,
      source: localDraft ? "localstorage" : "empty",
      local_checked: localChecked,
      server_checked: false,
      error: err instanceof Error ? err.message : "Health check exception",
      warning: "Exception health check — brouillon local utilisé.",
    };
  }

  // ÉTAPE 5 — Lecture serveur (READ ONLY — pas de write)
  // loadGlobalOnboardingDraftReadOnly = select uniquement
  try {
    const readResult = await loadGlobalOnboardingDraftReadOnly(supabase, userId, companyId);
    serverChecked = true;
    const serverDraft = readResult.draft;

    if (!serverDraft) {
      // Pas de draft serveur → utiliser local
      return {
        outcome: localDraft ? "local_draft_restored" : "empty",
        draft: localDraft,
        source: localDraft ? "localstorage" : "empty",
        local_checked: localChecked,
        server_checked: serverChecked,
        error: null,
        warning: null,
      };
    }

    // ÉTAPE 6 — Comparer updated_at : conserver le plus récent
    if (localDraft) {
      const localTs = new Date(localDraft.updated_at ?? 0).getTime();
      const serverTs = new Date(serverDraft.updated_at ?? 0).getTime();

      if (localTs >= serverTs) {
        // Local plus récent ou égal — ne pas écraser
        return {
          outcome: "local_draft_preferred",
          draft: localDraft,
          source: "localstorage",
          local_checked: localChecked,
          server_checked: serverChecked,
          error: null,
          warning: "Brouillon local plus récent que le serveur — conservé.",
        };
      }
    }

    // Serveur plus récent — utiliser draft serveur
    return {
      outcome: "server_draft_restored",
      draft: { ...serverDraft, source: "server" },
      source: "server",
      local_checked: localChecked,
      server_checked: serverChecked,
      error: null,
      warning: null,
    };
  } catch (err) {
    return {
      outcome: "server_unavailable",
      draft: localDraft,
      source: localDraft ? "localstorage" : "empty",
      local_checked: localChecked,
      server_checked: serverChecked,
      error: err instanceof Error ? err.message : "Erreur restore serveur",
      warning: "Exception restore serveur — brouillon local utilisé.",
    };
  }
}
