// src/lib/clonestore/onboarding/global-onboarding-localstorage.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — LocalStorage Abstraction
//
// Centralise la logique localStorage pour l'onboarding global.
// Compatible server-safe (typeof window checks).
// try/catch partout. Jamais de throw brut.
//
// Utilisation dans /profile/onboarding :
//   import { GLOBAL_ONBOARDING_LOCALSTORAGE_KEY,
//            saveGlobalOnboardingDraftToLocalStorage,
//            loadGlobalOnboardingDraftFromLocalStorage }
//     from "@/lib/clonestore/onboarding";

import { GLOBAL_ONBOARDING_LOCALSTORAGE_KEY } from "./global-onboarding-defaults";
import { sanitizeGlobalOnboardingDraft } from "./global-onboarding-validation";
import type { GlobalOnboardingDraft } from "./global-onboarding-types";

// ── Chargement ────────────────────────────────────────────────────────────────

export function loadGlobalOnboardingDraftFromLocalStorage(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GLOBAL_ONBOARDING_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────

export function saveGlobalOnboardingDraftToLocalStorage(
  draft: GlobalOnboardingDraft | unknown
): void {
  if (typeof window === "undefined") return;
  try {
    // Sanitize si c'est un GlobalOnboardingDraft (a company_id)
    const toSave =
      draft &&
      typeof draft === "object" &&
      "company_id" in (draft as object)
        ? sanitizeGlobalOnboardingDraft(draft as GlobalOnboardingDraft)
        : draft;

    const serialized = JSON.stringify(toSave);
    window.localStorage.setItem(GLOBAL_ONBOARDING_LOCALSTORAGE_KEY, serialized);
  } catch {
    /* quota ou mode privé — silent fail */
  }
}

// ── Effacement ────────────────────────────────────────────────────────────────

export function clearGlobalOnboardingDraftLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GLOBAL_ONBOARDING_LOCALSTORAGE_KEY);
  } catch {
    /* silent fail */
  }
}

// ── Migration legacy ──────────────────────────────────────────────────────────

export function migrateLegacyGlobalOnboardingPayload(
  payload: unknown
): GlobalOnboardingDraft | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  // Vérification minimale : doit avoir au moins company ou currentStep
  if (!p.company && !p.currentStep && !p.company_id) return null;
  return payload as GlobalOnboardingDraft;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizeGlobalOnboardingPayload(
  payload: unknown
): GlobalOnboardingDraft | null {
  if (!payload) return null;
  return migrateLegacyGlobalOnboardingPayload(payload);
}
