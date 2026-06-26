// TECH-07 — CloneTrace Global Audit Timeline — Snapshot
// Génère un snapshot instantané avec score de santé.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceTimeline,
  GlobalTraceSnapshot,
  GlobalTraceSeverity,
  GlobalTraceEventType,
  GlobalTraceStatus,
  GlobalTraceActorType,
} from "./global-trace-types";

// ── Score de santé ────────────────────────────────────────────────────────────

/**
 * Calcule un score de santé de la timeline entre 0 et 100.
 *
 * Pénalités :
 * - Chaque événement critical : -10 pts (max -40)
 * - Chaque événement error    : -5  pts (max -20)
 * - Chaque blocked            : -3  pts (max -15)
 * - Chaque refused            : -8  pts (max -24)
 * - Validation en attente > 5 : -5  pts
 * - Timeline vide             : 50 pts (ni healthy ni critical)
 */
function computeTraceHealthScore(snapshot: Omit<GlobalTraceSnapshot, "health_score" | "health_status" | "snapshot_at">): number {
  if (snapshot.event_count === 0) return 50;

  let score = 100;

  const criticalPenalty = Math.min(snapshot.critical_count * 10, 40);
  const errorPenalty = Math.min(snapshot.error_count * 5, 20);
  const blockedPenalty = Math.min(snapshot.blocked_count * 3, 15);
  const refusedPenalty = Math.min(snapshot.refused_count * 8, 24);
  const validationPenalty = snapshot.validation_pending_count > 5 ? 5 : 0;

  score -= criticalPenalty + errorPenalty + blockedPenalty + refusedPenalty + validationPenalty;

  return Math.max(0, Math.min(100, score));
}

function computeHealthStatus(
  score: number,
  eventCount: number,
): GlobalTraceSnapshot["health_status"] {
  if (eventCount === 0) return "empty";
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  return "critical";
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Construit un snapshot instantané de la timeline avec score de santé.
 */
export function buildGlobalTraceSnapshot(
  timeline: GlobalTraceTimeline,
): GlobalTraceSnapshot {
  const events = timeline.events;

  // Comptage par sévérité
  const eventsBySeverity: Record<GlobalTraceSeverity, number> = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };
  for (const e of events) {
    eventsBySeverity[e.severity] = (eventsBySeverity[e.severity] ?? 0) + 1;
  }

  // Comptage par type
  const eventsByType: Partial<Record<GlobalTraceEventType, number>> = {};
  for (const e of events) {
    eventsByType[e.event_type] = (eventsByType[e.event_type] ?? 0) + 1;
  }

  // Comptage par statut
  const eventsByStatus: Record<GlobalTraceStatus, number> = {
    pending: 0,
    in_progress: 0,
    success: 0,
    failure: 0,
    blocked: 0,
    refused: 0,
    requires_validation: 0,
    cancelled: 0,
  };
  for (const e of events) {
    eventsByStatus[e.status] = (eventsByStatus[e.status] ?? 0) + 1;
  }

  // Comptage par acteur
  const eventsByActor: Record<GlobalTraceActorType, number> = {
    human_user: 0,
    ai_employee: 0,
    cloneos: 0,
    cloneguard: 0,
    clonepolicy: 0,
    clonetrace: 0,
    cloneadn: 0,
    system: 0,
    external_service: 0,
  };
  for (const e of events) {
    const at = e.actor.actor_type;
    eventsByActor[at] = (eventsByActor[at] ?? 0) + 1;
  }

  // Métriques clés
  const criticalCount = eventsBySeverity.critical;
  const errorCount = eventsBySeverity.error;
  const blockedCount = eventsByStatus.blocked;
  const refusedCount = eventsByStatus.refused;
  const validationPendingCount = events.filter(
    (e) => e.event_type === "validation_requested" &&
      e.validation_ref?.status === "pending",
  ).length;

  // Dernier événement critique
  const criticalEvents = events
    .filter((e) => e.severity === "critical")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const lastCriticalEvent = criticalEvents[0];

  // Dernier événement
  const sortedByDate = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const lastEvent = sortedByDate[0];

  const snapshotBase = {
    timeline_id: timeline.timeline_id,
    company_id: timeline.company_id,
    event_count: events.length,
    events_by_severity: eventsBySeverity,
    events_by_type: eventsByType,
    events_by_status: eventsByStatus,
    events_by_actor: eventsByActor,
    critical_count: criticalCount,
    error_count: errorCount,
    blocked_count: blockedCount,
    refused_count: refusedCount,
    validation_pending_count: validationPendingCount,
    last_critical_event: lastCriticalEvent,
    last_event: lastEvent,
    is_demo: timeline.is_demo,
  };

  const healthScore = computeTraceHealthScore(snapshotBase);
  const healthStatus = computeHealthStatus(healthScore, events.length);

  return {
    ...snapshotBase,
    health_score: healthScore,
    health_status: healthStatus,
    snapshot_at: new Date().toISOString(),
  };
}
