// Guided Tour — persistance de progression (P9.1).
//
// Stockage injectable (KeyValueStore) : en production on branche localStorage,
// en test on passe un faux store. Clés versionnées ; toute lecture est tolérante
// aux données corrompues (retourne null plutôt que de jeter). La progression
// distingue "reprise possible" (running, même version) de "déjà engagé"
// (completed/skipped) et de "version obsolète" (on repropose le tour).

import type { Tour, TourProgress, TourStatus } from "./types";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_PREFIX = "clonestore.guidedTour.";

export function progressKey(tourId: string): string {
  return `${STORAGE_PREFIX}${tourId}`;
}

function isTourStatus(value: unknown): value is TourStatus {
  return (
    value === "idle" ||
    value === "running" ||
    value === "completed" ||
    value === "skipped"
  );
}

export function readProgress(
  store: KeyValueStore | null | undefined,
  tourId: string,
): TourProgress | null {
  if (!store) return null;
  try {
    const raw = store.getItem(progressKey(tourId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourProgress> | null;
    if (!parsed || parsed.tourId !== tourId) return null;
    if (typeof parsed.version !== "number") return null;
    if (!isTourStatus(parsed.status)) return null;
    return {
      tourId,
      version: parsed.version,
      status: parsed.status,
      stepIndex: typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function writeProgress(
  store: KeyValueStore | null | undefined,
  progress: TourProgress,
): void {
  if (!store) return;
  try {
    store.setItem(progressKey(progress.tourId), JSON.stringify(progress));
  } catch {
    /* quota / mode privé — ne jamais bloquer l'expérience. */
  }
}

export function clearProgress(
  store: KeyValueStore | null | undefined,
  tourId: string,
): void {
  if (!store) return;
  try {
    store.removeItem(progressKey(tourId));
  } catch {
    /* ignore */
  }
}

// — Snooze « Plus tard » (P9.1 correction) —
// « Plus tard » n'est PAS un skip permanent : c'est un report temporaire.
// Stocké dans une clé distincte (timestamp d'expiration ms). Ne touche jamais
// la progression réelle (une progression commencée reste reprenable).

export function snoozeKey(tourId: string): string {
  return `${STORAGE_PREFIX}${tourId}.snooze`;
}

export function readSnoozeUntil(
  store: KeyValueStore | null | undefined,
  tourId: string,
): number | null {
  if (!store) return null;
  try {
    const raw = store.getItem(snoozeKey(tourId));
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeSnooze(
  store: KeyValueStore | null | undefined,
  tourId: string,
  untilMs: number,
): void {
  if (!store) return;
  try {
    store.setItem(snoozeKey(tourId), String(untilMs));
  } catch {
    /* ignore */
  }
}

export function clearSnooze(
  store: KeyValueStore | null | undefined,
  tourId: string,
): void {
  if (!store) return;
  try {
    store.removeItem(snoozeKey(tourId));
  } catch {
    /* ignore */
  }
}

export function isSnoozed(
  store: KeyValueStore | null | undefined,
  tourId: string,
  nowMs: number,
): boolean {
  const until = readSnoozeUntil(store, tourId);
  return until != null && nowMs < until;
}

/**
 * Faut-il proposer spontanément le tour (overlay de bienvenue) ?
 * NON si : progression déjà engagée à la version courante (running → reprise,
 * completed/skipped → terminé) OU snooze « Plus tard » encore actif.
 * OUI si : aucune progression / version périmée, et hors fenêtre de snooze.
 */
export function shouldOfferTour(
  store: KeyValueStore | null | undefined,
  tour: Tour,
  nowMs = 0,
): boolean {
  const progress = readProgress(store, tour.id);
  const engagedThisVersion =
    !!progress &&
    progress.version === tour.version &&
    (progress.status === "running" ||
      progress.status === "completed" ||
      progress.status === "skipped");
  if (engagedThisVersion) return false;
  if (isSnoozed(store, tour.id, nowMs)) return false;
  return true;
}

/**
 * Index de reprise si un tour de MÊME version était en cours (running),
 * sinon `null`. Permet « reprendre là où j'en étais » après navigation/refresh.
 */
export function resolveResumeIndex(
  store: KeyValueStore | null | undefined,
  tour: Tour,
): number | null {
  const progress = readProgress(store, tour.id);
  if (!progress) return null;
  if (progress.version !== tour.version) return null;
  if (progress.status !== "running") return null;
  const length = tour.steps.length;
  if (length <= 0) return null;
  if (progress.stepIndex < 0) return 0;
  if (progress.stepIndex > length - 1) return length - 1;
  return progress.stepIndex;
}

export function isTourCompleted(
  store: KeyValueStore | null | undefined,
  tour: Tour,
): boolean {
  const progress = readProgress(store, tour.id);
  return !!progress && progress.version === tour.version && progress.status === "completed";
}
