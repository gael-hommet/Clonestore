// src/lib/clonestore/enterprise-footprint/enterprise-footprint-localstorage.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — LocalStorage
//
// Snapshot read-only de l'Empreinte Entreprise en localStorage.
// Le snapshot est calculé depuis le GlobalOnboardingDraft.
//
// Invariants :
//   - typeof window checks (SSR safe)
//   - try/catch partout — jamais de throw brut
//   - sanitize avant save
//   - jamais de secret/token/clé API dans le snapshot

import { ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY } from "./enterprise-footprint-defaults";
import { sanitizeEnterpriseFootprint } from "./enterprise-footprint-validation";
import type { EnterpriseFootprint } from "./enterprise-footprint-types";

// ── Chargement ────────────────────────────────────────────────────────────────

export function loadEnterpriseFootprintFromLocalStorage(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────

export function saveEnterpriseFootprintToLocalStorage(
  footprint: EnterpriseFootprint | unknown
): void {
  if (typeof window === "undefined") return;
  try {
    const toSave =
      footprint &&
      typeof footprint === "object" &&
      "company_id" in (footprint as object)
        ? sanitizeEnterpriseFootprint(footprint as EnterpriseFootprint)
        : footprint;

    const serialized = JSON.stringify(toSave);
    window.localStorage.setItem(ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY, serialized);
  } catch {
    /* quota ou mode privé — silent fail */
  }
}

// ── Effacement ────────────────────────────────────────────────────────────────

export function clearEnterpriseFootprintLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY);
  } catch {
    /* silent fail */
  }
}

// ── Migration legacy ──────────────────────────────────────────────────────────

export function migrateLegacyEnterpriseFootprintPayload(
  payload: unknown
): EnterpriseFootprint | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (!p.company_id && !p.company) return null;
  return payload as EnterpriseFootprint;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizeEnterpriseFootprintPayload(
  payload: unknown
): EnterpriseFootprint | null {
  if (!payload) return null;
  return migrateLegacyEnterpriseFootprintPayload(payload);
}
