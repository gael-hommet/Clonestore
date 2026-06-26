// TECH-07 — CloneTrace Global Audit Timeline — In-Memory Storage
// Store en mémoire pour les timelines de trace.
// Pas de Supabase, pas de persistence externe.
// Un événement ajouté ne peut jamais être supprimé.

import type {
  GlobalTraceTimeline,
  GlobalTraceEvent,
  GlobalTraceCompanyId,
  GlobalTraceTimelineId,
} from "./global-trace-types";
import {
  buildEmptyGlobalTraceTimeline,
} from "./global-trace-defaults";
import {
  addEventToTimeline,
} from "./global-trace-timeline";

// ── Store interne ────────────────────────────────────────────────────────────

const traceStore = new Map<GlobalTraceCompanyId, GlobalTraceTimeline>();

// ── Accès ─────────────────────────────────────────────────────────────────────

/**
 * Récupère la timeline d'une entreprise.
 * Retourne undefined si elle n'existe pas encore.
 */
export function getGlobalTraceTimeline(
  companyId: GlobalTraceCompanyId,
): GlobalTraceTimeline | undefined {
  return traceStore.get(companyId);
}

/**
 * Récupère la timeline d'une entreprise, ou crée une timeline vide.
 */
export function getOrCreateGlobalTraceTimeline(
  companyId: GlobalTraceCompanyId,
): GlobalTraceTimeline {
  let timeline = traceStore.get(companyId);
  if (!timeline) {
    timeline = buildEmptyGlobalTraceTimeline(companyId);
    traceStore.set(companyId, timeline);
  }
  return timeline;
}

/**
 * Remplace entièrement la timeline d'une entreprise.
 * À utiliser avec précaution — préférer appendTraceEvent.
 */
export function setGlobalTraceTimeline(
  companyId: GlobalTraceCompanyId,
  timeline: GlobalTraceTimeline,
): void {
  traceStore.set(companyId, timeline);
}

/**
 * Ajoute un événement à la timeline d'une entreprise.
 * Crée la timeline si elle n'existe pas.
 * L'événement est immuable — il ne peut plus être retiré.
 */
export function appendTraceEvent(
  companyId: GlobalTraceCompanyId,
  event: GlobalTraceEvent,
): GlobalTraceTimeline {
  const current = getOrCreateGlobalTraceTimeline(companyId);
  const updated = addEventToTimeline(current, event);
  traceStore.set(companyId, updated);
  return updated;
}

/**
 * Ajoute plusieurs événements à la timeline d'une entreprise.
 */
export function appendTraceEvents(
  companyId: GlobalTraceCompanyId,
  events: GlobalTraceEvent[],
): GlobalTraceTimeline {
  let timeline = getOrCreateGlobalTraceTimeline(companyId);
  for (const event of events) {
    timeline = addEventToTimeline(timeline, event);
  }
  traceStore.set(companyId, timeline);
  return timeline;
}

/**
 * Retourne toutes les timelines stockées (pour l'admin/debug).
 */
export function getAllTraceTimelines(): GlobalTraceTimeline[] {
  return Array.from(traceStore.values());
}

/**
 * Retourne le nombre de timelines stockées.
 */
export function getTraceTimelineCount(): number {
  return traceStore.size;
}

/**
 * Vérifie si une timeline existe pour une entreprise.
 */
export function hasTraceTimeline(companyId: GlobalTraceCompanyId): boolean {
  return traceStore.has(companyId);
}

/**
 * Vide le store (test uniquement).
 * Ne doit jamais être appelé en production.
 */
export function clearTraceStore(): void {
  traceStore.clear();
}

/**
 * Retourne le nombre total d'événements dans toutes les timelines.
 */
export function getTotalTraceEventCount(): number {
  let count = 0;
  for (const timeline of traceStore.values()) {
    count += timeline.event_count;
  }
  return count;
}

/**
 * Récupère un événement par son ID dans la timeline d'une entreprise.
 */
export function getTraceEventById(
  companyId: GlobalTraceCompanyId,
  eventId: string,
): GlobalTraceEvent | undefined {
  const timeline = traceStore.get(companyId);
  return timeline?.events.find((e) => e.event_id === eventId);
}

// NOTE: Il n'existe PAS de fonction deleteTraceEvent / removeTraceEvent.
// Les événements de trace sont permanents par design (audit immuable).
