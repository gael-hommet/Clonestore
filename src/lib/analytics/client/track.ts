"use client";
// Tracker client canonique — léger, aucune dépendance externe, aucune bibliothèque analytique
// lourde. sendBeacon en priorité (survit à la navigation), fetch keepalive en repli.
// Dégradation : une erreur réseau/stockage ne bloque jamais l'expérience utilisateur.

import {
  SCHEMA_VERSION,
  type CanonicalAnalyticsEventName,
  type CanonicalAnalyticsProperties,
  type CanonicalRouteKey,
  isServerOnlyCanonicalEvent,
} from "../schema";

const ENDPOINT = "/api/analytics/events";
const MAX_RETRY_QUEUE = 20;
const SENT_EVENT_IDS_KEY = "cs_analytics_sent_ids";
const MAX_SENT_ID_MEMORY = 200;

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

// Anti-double-émission borné (Strict Mode, double-clic) — mémoire de process, pas de
// stockage persistant nécessaire (le serveur dédupe de toute façon sur event_id).
const recentlySent = new Set<string>();
function rememberSent(id: string): void {
  recentlySent.add(id);
  if (recentlySent.size > MAX_SENT_ID_MEMORY) {
    const first = recentlySent.values().next().value;
    if (first) recentlySent.delete(first);
  }
}

export interface TrackOptions {
  pageViewId?: string;
  demoRunId?: string;
  routeKey?: CanonicalRouteKey;
  stepId?: string;
  properties?: CanonicalAnalyticsProperties;
  /** Empêche une deuxième émission logique du même événement dans ce process (ex: montage Strict Mode). */
  dedupeKey?: string;
}

const dedupeGuards = new Set<string>();

/**
 * Émet un événement canonique. Ne jette jamais. Retourne l'event_id généré (utile pour les
 * tests), ou null si l'événement a été refusé localement (nom server-only, dedupe déjà vu).
 */
export function track(eventName: CanonicalAnalyticsEventName, options: TrackOptions = {}): string | null {
  if (isServerOnlyCanonicalEvent(eventName)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics] "${eventName}" est un événement server-only — jamais émis par le client.`);
    }
    return null;
  }
  if (options.dedupeKey) {
    if (dedupeGuards.has(options.dedupeKey)) return null;
    dedupeGuards.add(options.dedupeKey);
  }

  const eventId = uuid();
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    eventId,
    eventName,
    occurredAt: new Date().toISOString(),
    source: "web" as const,
    pageViewId: options.pageViewId,
    demoRunId: options.demoRunId,
    routeKey: options.routeKey,
    stepId: options.stepId,
    properties: options.properties,
  };

  try {
    const body = JSON.stringify(payload);
    const sent = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      : false;
    if (!sent && typeof fetch === "function") {
      fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {
        /* dégradation silencieuse — jamais d'action utilisateur bloquée */
      });
    }
    rememberSent(eventId);
  } catch {
    /* dégradation silencieuse */
  }
  return eventId;
}

// ── page_view_id ─────────────────────────────────────────────────────────────
const PAGE_VIEW_KEY = "cs_analytics_page_view_id";

/** Génère un nouveau page_view_id pour CETTE navigation et le mémorise (session-only). */
export function newPageViewId(): string {
  const id = uuid();
  try {
    sessionStorage.setItem(PAGE_VIEW_KEY, id);
  } catch {
    /* sessionStorage indisponible (mode privé strict) — dégrade sans page_view_id persistant */
  }
  return id;
}

export function currentPageViewId(): string | null {
  try {
    return sessionStorage.getItem(PAGE_VIEW_KEY);
  } catch {
    return null;
  }
}

// ── demo_run_id ──────────────────────────────────────────────────────────────
const DEMO_RUN_KEY_PREFIX = "cs_analytics_demo_run:";

export function newDemoRunId(demoType: "demo" | "demo_pierre"): string {
  const id = uuid();
  try {
    sessionStorage.setItem(DEMO_RUN_KEY_PREFIX + demoType, id);
  } catch {
    /* dégrade sans persistance */
  }
  return id;
}

export function currentDemoRunId(demoType: "demo" | "demo_pierre"): string | null {
  try {
    return sessionStorage.getItem(DEMO_RUN_KEY_PREFIX + demoType);
  } catch {
    return null;
  }
}

export { SENT_EVENT_IDS_KEY, MAX_RETRY_QUEUE };
