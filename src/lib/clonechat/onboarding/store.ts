// src/lib/clonechat/onboarding/store.ts
//
// Persistance SÛRE, abstraite et injectable de l'onboarding. Isolation inter-tenant par la clé
// (viewer+tenant), expiration contrôlée, migration de version sûre (une version ancienne est
// écartée, jamais mal interprétée), aucune donnée sensible. Mock mémoire déterministe pour le gate ;
// aucune dépendance obligatoire à une base externe.

import { CLONECHAT_ONBOARDING_VERSION, type OnboardingPersisted } from "./types";

/** Clé de persistance liée au viewer ET au tenant (isolation inter-tenant). */
export function onboardingKey(viewerKey: string, tenantKey: string): string {
  return `ob:${viewerKey}::${tenantKey}`;
}

export interface OnboardingStore {
  load(key: string): OnboardingPersisted | null;
  save(key: string, state: OnboardingPersisted): void;
  clear(key: string): void;
}

/**
 * Charge un état persisté en le VALIDANT : clé correspondante, version courante, non expiré. Toute
 * incohérence → null (reprise « fraîche » honnête, jamais un état corrompu/étranger réutilisé).
 */
export function loadValidOnboarding(store: OnboardingStore, key: string, viewerKey: string, tenantKey: string, nowMs: number): OnboardingPersisted | null {
  let raw: OnboardingPersisted | null = null;
  try {
    raw = store.load(key);
  } catch {
    return null; // stockage indisponible → comportement honnête (reprise fraîche)
  }
  if (!raw) return null;
  if (raw.version !== CLONECHAT_ONBOARDING_VERSION) return null; // version ancienne → migration sûre = écarter
  if (raw.viewerKey !== viewerKey || raw.tenantKey !== tenantKey) return null; // isolation : jamais un autre viewer/tenant
  if (raw.expiresAtMs !== null && nowMs > raw.expiresAtMs) return null; // expiré
  return raw;
}

/** Mock mémoire déterministe (par processus). Isolation appliquée à la lecture (clé exacte). */
export function createInMemoryOnboardingStore(): OnboardingStore {
  const rows = new Map<string, OnboardingPersisted>();
  return {
    load: (key) => rows.get(key) ?? null,
    save: (key, state) => { rows.set(key, state); },
    clear: (key) => { rows.delete(key); },
  };
}

/** Store indisponible : échoue honnêtement (load null, save/clear inertes) — jamais un plantage. */
export function createUnavailableOnboardingStore(): OnboardingStore {
  return {
    load: () => { throw new Error("storage_unavailable"); },
    save: () => { /* no-op honnête */ },
    clear: () => { /* no-op honnête */ },
  };
}
