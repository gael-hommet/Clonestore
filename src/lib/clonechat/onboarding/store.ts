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

/** Raison PRÉCISE pour laquelle un état persisté n'est pas repris (rend l'expiration non décorative). */
export type OnboardingLoadRejection =
  | "none" // état valide, repris
  | "empty" // aucun état persisté
  | "unavailable" // stockage indisponible (load a levé)
  | "version" // version ancienne → migration sûre = écarter
  | "isolation" // viewer/tenant différent → jamais réutilisé
  | "expired"; // état réellement expiré → remplacé par un état frais

export interface OnboardingLoadOutcome {
  readonly snapshot: OnboardingPersisted | null; // renseigné pour "none" ; pour "expired" (état lapsé, NON repris)
  readonly rejected: OnboardingLoadRejection;
}

/**
 * Charge un état persisté en le VALIDANT et en EXPLIQUANT tout rejet. C'est ici que l'expiration est
 * RÉELLEMENT détectée : un état lapsé n'est jamais repris — l'appelant le remplace par un état frais
 * (jamais un état corrompu/étranger/expiré réutilisé).
 */
export function loadOnboardingOutcome(store: OnboardingStore, key: string, viewerKey: string, tenantKey: string, nowMs: number): OnboardingLoadOutcome {
  let raw: OnboardingPersisted | null = null;
  try {
    raw = store.load(key);
  } catch {
    return { snapshot: null, rejected: "unavailable" }; // stockage indisponible → reprise fraîche honnête
  }
  if (!raw) return { snapshot: null, rejected: "empty" };
  if (raw.version !== CLONECHAT_ONBOARDING_VERSION) return { snapshot: null, rejected: "version" }; // version ancienne
  if (raw.viewerKey !== viewerKey || raw.tenantKey !== tenantKey) return { snapshot: null, rejected: "isolation" }; // isolation
  if (raw.expiresAtMs !== null && nowMs > raw.expiresAtMs) return { snapshot: raw, rejected: "expired" }; // réellement expiré
  return { snapshot: raw, rejected: "none" };
}

/**
 * Charge un état persisté VALIDÉ (clé correspondante, version courante, non expiré) ou null. Toute
 * incohérence → null (reprise « fraîche » honnête). Conservé pour compat ; s'appuie sur
 * loadOnboardingOutcome (source de vérité de la détection d'expiration).
 */
export function loadValidOnboarding(store: OnboardingStore, key: string, viewerKey: string, tenantKey: string, nowMs: number): OnboardingPersisted | null {
  const out = loadOnboardingOutcome(store, key, viewerKey, tenantKey, nowMs);
  return out.rejected === "none" ? out.snapshot : null;
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
