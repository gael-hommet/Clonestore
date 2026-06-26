// TECH-07 — CloneTrace Global Audit Timeline — Timeline Management
// Gestion de la timeline : ajout d'événements (jamais de suppression).
// Un événement ajouté ne peut plus être retiré ni modifié.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEvent,
  GlobalTraceEventId,
  GlobalTraceTimeline,
  GlobalTraceTimelineFilter,
  GlobalTraceEventType,
  GlobalTraceSeverity,
  GlobalTraceStatus,
  GlobalTraceActorType,
  GlobalTraceRiskLevel,
} from "./global-trace-types";

// ── Ajout d'événement ─────────────────────────────────────────────────────────

/**
 * Ajoute un événement à la timeline.
 * - Ne modifie JAMAIS un événement existant (immuabilité).
 * - Retourne une nouvelle timeline avec l'événement ajouté.
 * - Si l'event_id existe déjà, l'événement est ignoré (idempotent).
 */
export function addEventToTimeline(
  timeline: GlobalTraceTimeline,
  event: GlobalTraceEvent,
): GlobalTraceTimeline {
  // Vérification immuabilité : l'event doit avoir immutable=true
  if (!event.immutable) {
    // On crée une version corrigée avec immutable=true
    event = { ...event, immutable: true };
  }

  // Idempotence : si l'event_id existe déjà, on ignore
  const alreadyExists = timeline.events.some((e) => e.event_id === event.event_id);
  if (alreadyExists) {
    return timeline;
  }

  const newEvents = [...timeline.events, event];
  const sortedEvents = newEvents.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];

  return {
    ...timeline,
    events: sortedEvents,
    event_count: sortedEvents.length,
    first_event_at: firstEvent?.created_at,
    last_event_at: lastEvent?.created_at,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Ajoute plusieurs événements à la timeline en une seule opération.
 * Chaque événement est ajouté idempotement.
 */
export function addEventsToTimeline(
  timeline: GlobalTraceTimeline,
  events: GlobalTraceEvent[],
): GlobalTraceTimeline {
  let current = timeline;
  for (const event of events) {
    current = addEventToTimeline(current, event);
  }
  return current;
}

// ── Lecture / filtrage ────────────────────────────────────────────────────────

/**
 * Filtre les événements d'une timeline selon les critères donnés.
 */
export function filterTimelineEvents(
  timeline: GlobalTraceTimeline,
  filter: GlobalTraceTimelineFilter,
): GlobalTraceEvent[] {
  let events = [...timeline.events];

  if (filter.event_types && filter.event_types.length > 0) {
    events = events.filter((e) => filter.event_types!.includes(e.event_type));
  }

  if (filter.severity && filter.severity.length > 0) {
    events = events.filter((e) => filter.severity!.includes(e.severity));
  }

  if (filter.status && filter.status.length > 0) {
    events = events.filter((e) => filter.status!.includes(e.status));
  }

  if (filter.actor_types && filter.actor_types.length > 0) {
    events = events.filter((e) => filter.actor_types!.includes(e.actor.actor_type));
  }

  if (filter.employee_slugs && filter.employee_slugs.length > 0) {
    events = events.filter(
      (e) => e.employee_slug && filter.employee_slugs!.includes(e.employee_slug),
    );
  }

  if (filter.risk_levels && filter.risk_levels.length > 0) {
    events = events.filter((e) => filter.risk_levels!.includes(e.risk_level));
  }

  if (filter.source && filter.source.length > 0) {
    events = events.filter((e) => filter.source!.includes(e.source));
  }

  if (filter.since) {
    const since = new Date(filter.since).getTime();
    events = events.filter((e) => new Date(e.created_at).getTime() >= since);
  }

  if (filter.until) {
    const until = new Date(filter.until).getTime();
    events = events.filter((e) => new Date(e.created_at).getTime() <= until);
  }

  if (filter.mission_id) {
    events = events.filter((e) => e.mission_id === filter.mission_id);
  }

  if (filter.task_id) {
    events = events.filter((e) => e.task_id === filter.task_id);
  }

  if (filter.tags && filter.tags.length > 0) {
    events = events.filter((e) =>
      filter.tags!.some((tag) => e.tags.includes(tag)),
    );
  }

  // Pagination
  const offset = filter.offset ?? 0;
  if (offset > 0) {
    events = events.slice(offset);
  }

  if (filter.limit && filter.limit > 0) {
    events = events.slice(0, filter.limit);
  }

  return events;
}

/**
 * Récupère un événement par son ID.
 */
export function getEventById(
  timeline: GlobalTraceTimeline,
  eventId: GlobalTraceEventId,
): GlobalTraceEvent | undefined {
  return timeline.events.find((e) => e.event_id === eventId);
}

// ── Groupements ───────────────────────────────────────────────────────────────

/**
 * Groupe les événements par type.
 */
export function groupEventsByType(
  events: GlobalTraceEvent[],
): Map<GlobalTraceEventType, GlobalTraceEvent[]> {
  const map = new Map<GlobalTraceEventType, GlobalTraceEvent[]>();
  for (const event of events) {
    const existing = map.get(event.event_type) ?? [];
    map.set(event.event_type, [...existing, event]);
  }
  return map;
}

/**
 * Groupe les événements par sévérité.
 */
export function groupEventsBySeverity(
  events: GlobalTraceEvent[],
): Map<GlobalTraceSeverity, GlobalTraceEvent[]> {
  const map = new Map<GlobalTraceSeverity, GlobalTraceEvent[]>();
  for (const event of events) {
    const existing = map.get(event.severity) ?? [];
    map.set(event.severity, [...existing, event]);
  }
  return map;
}

/**
 * Groupe les événements par statut.
 */
export function groupEventsByStatus(
  events: GlobalTraceEvent[],
): Map<GlobalTraceStatus, GlobalTraceEvent[]> {
  const map = new Map<GlobalTraceStatus, GlobalTraceEvent[]>();
  for (const event of events) {
    const existing = map.get(event.status) ?? [];
    map.set(event.status, [...existing, event]);
  }
  return map;
}

/**
 * Groupe les événements par acteur.
 */
export function groupEventsByActor(
  events: GlobalTraceEvent[],
): Map<GlobalTraceActorType, GlobalTraceEvent[]> {
  const map = new Map<GlobalTraceActorType, GlobalTraceEvent[]>();
  for (const event of events) {
    const actorType = event.actor.actor_type;
    const existing = map.get(actorType) ?? [];
    map.set(actorType, [...existing, event]);
  }
  return map;
}

/**
 * Groupe les événements par mission.
 */
export function groupEventsByMission(
  events: GlobalTraceEvent[],
): Map<string, GlobalTraceEvent[]> {
  const map = new Map<string, GlobalTraceEvent[]>();
  for (const event of events) {
    const key = event.mission_id ?? "__no_mission__";
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, event]);
  }
  return map;
}

/**
 * Retourne les N derniers événements (chronologiques).
 */
export function getLatestEvents(
  timeline: GlobalTraceTimeline,
  n: number,
): GlobalTraceEvent[] {
  return [...timeline.events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, n);
}

/**
 * Retourne les événements critiques ou d'erreur.
 */
export function getCriticalEvents(
  timeline: GlobalTraceTimeline,
): GlobalTraceEvent[] {
  return timeline.events.filter(
    (e) => e.severity === "critical" || e.severity === "error",
  );
}

/**
 * Retourne les événements Guard (blocked/refused/requires_validation).
 */
export function getGuardDecisionEvents(
  timeline: GlobalTraceTimeline,
): GlobalTraceEvent[] {
  const guardTypes: GlobalTraceEvent["event_type"][] = [
    "action_blocked",
    "action_refused",
    "action_requires_validation",
    "guard_evaluated",
  ];
  return timeline.events.filter((e) => guardTypes.includes(e.event_type));
}

/**
 * Compte les événements par niveau de risque.
 */
export function countEventsByRiskLevel(
  events: GlobalTraceEvent[],
): Record<GlobalTraceRiskLevel, number> {
  return {
    low: events.filter((e) => e.risk_level === "low").length,
    medium: events.filter((e) => e.risk_level === "medium").length,
    high: events.filter((e) => e.risk_level === "high").length,
    critical: events.filter((e) => e.risk_level === "critical").length,
  };
}
