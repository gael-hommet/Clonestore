// TECH-07 — CloneTrace Global Audit Timeline — Pierre → Trace Bridge
// Traduit les événements Pierre natifs en événements de trace globaux.
// Non-invasif : Pierre B38-B48 n'est pas modifié.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceEventType,
  GlobalTraceRiskLevel,
  GlobalTraceCompanyId,
  GlobalTraceTimelineId,
  GlobalTraceMissionId,
  GlobalTraceTaskId,
  GlobalTraceSessionId,
  GlobalTraceEventMetadata,
  GlobalTraceRelatedEntity,
} from "./global-trace-types";
import {
  createGlobalTraceEvent,
  CreateGlobalTraceEventParams,
} from "./global-trace-event-factory";
import {
  buildAIEmployeeTraceActor,
} from "./global-trace-defaults";
import { addEventToTimeline } from "./global-trace-timeline";

// ── Types bridge ──────────────────────────────────────────────────────────────

export interface PierreTraceBridgeInput {
  company_id: GlobalTraceCompanyId;
  timeline_id: GlobalTraceTimelineId;
  pierre_event_type: string;              // Type Pierre natif
  summary: string;
  risk_level?: GlobalTraceRiskLevel;
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  session_id?: GlobalTraceSessionId;
  metadata?: GlobalTraceEventMetadata;
  is_demo?: boolean;
  related_entities?: GlobalTraceRelatedEntity[];
}

// ── Mapping Pierre → Global ────────────────────────────────────────────────────

/**
 * Mappe un type d'événement Pierre natif vers un type d'événement global.
 */
export function mapPierreEventTypeToGlobalEventType(
  pierreEventType: string,
): GlobalTraceEventType {
  const mapping: Record<string, GlobalTraceEventType> = {
    // Missions
    mission_created: "mission_created",
    mission_started: "task_started",
    mission_completed: "task_completed",
    mission_failed: "task_failed",
    // Tâches
    task_created: "task_created",
    task_started: "task_started",
    task_completed: "task_completed",
    task_failed: "task_failed",
    // Documents
    document_generated: "document_prepared",
    document_prepared: "document_prepared",
    draft_generated: "document_prepared",
    // Emails
    email_drafted: "email_prepared",
    email_prepared: "email_prepared",
    email_sent: "email_sent",
    send_email: "email_prepared",              // Pierre ne peut que préparer
    // Validation
    validation_required: "validation_requested",
    validation_requested: "validation_requested",
    validation_approved: "validation_approved",
    validation_rejected: "validation_rejected",
    human_validation_required: "validation_requested",
    // Mémoire
    memory_read: "memory_read",
    memory_update: "memory_update_proposed",
    memory_update_proposed: "memory_update_proposed",
    context_read: "memory_read",
    // Guard
    guard_check: "guard_evaluated",
    guard_blocked: "action_blocked",
    guard_refused: "action_refused",
    action_allowed: "action_allowed",
    // Erreurs
    error: "error_recorded",
    error_recorded: "error_recorded",
    task_error: "error_recorded",
    // Scheduling
    reminder_created: "schedule_created",
    followup_scheduled: "schedule_created",
    schedule_triggered: "schedule_triggered",
    // Divers
    request_received: "request_received",
    employee_handoff: "employee_handoff",
    proof_attached: "proof_attached",
    note: "system_note",
  };

  return mapping[pierreEventType] ?? "system_note";
}

/**
 * Mappe un niveau de risque Pierre natif vers un niveau de risque global.
 */
export function mapPierreRiskLevelToGlobal(
  pierreRisk?: string,
): GlobalTraceRiskLevel {
  if (!pierreRisk) return "low";
  const mapping: Record<string, GlobalTraceRiskLevel> = {
    green: "low",
    low: "low",
    yellow: "medium",
    medium: "medium",
    orange: "high",
    high: "high",
    red: "high",
    black: "critical",
    critical: "critical",
  };
  return mapping[pierreRisk.toLowerCase()] ?? "low";
}

// ── Bridge principal ──────────────────────────────────────────────────────────

/**
 * Crée un événement de trace global à partir d'un événement Pierre natif.
 * Le bridge est non-invasif : Pierre n'est pas modifié.
 */
export function createTraceEventFromPierreEvent(
  input: PierreTraceBridgeInput,
): GlobalTraceEvent {
  const globalEventType = mapPierreEventTypeToGlobalEventType(input.pierre_event_type);
  const globalRiskLevel = input.risk_level ?? mapPierreRiskLevelToGlobal(
    (input.metadata?.risk as string) ?? undefined,
  );

  const params: CreateGlobalTraceEventParams = {
    timeline_id: input.timeline_id,
    company_id: input.company_id,
    event_type: globalEventType,
    actor: buildAIEmployeeTraceActor("pierre", "Pierre — RH"),
    summary: input.summary,
    source: "pierre_bridge",
    risk_level: globalRiskLevel,
    employee_slug: "pierre",
    mission_id: input.mission_id,
    task_id: input.task_id,
    session_id: input.session_id,
    metadata: {
      pierre_event_type: input.pierre_event_type,
      ...(input.metadata ?? {}),
    },
    related_entities: input.related_entities ?? [],
    technology_refs: [{ technology_key: "CloneTrace" }],
    is_demo: input.is_demo ?? false,
    tags: ["pierre", "hr", input.pierre_event_type],
  };

  return createGlobalTraceEvent(params);
}

/**
 * Applique un événement Pierre sur une timeline en créant l'événement global correspondant.
 * Retourne la timeline mise à jour.
 */
export function applyPierreEventToTimeline(
  timeline: GlobalTraceTimeline,
  input: Omit<PierreTraceBridgeInput, "timeline_id">,
): GlobalTraceTimeline {
  const bridgeInput: PierreTraceBridgeInput = {
    ...input,
    timeline_id: timeline.timeline_id,
  };
  const event = createTraceEventFromPierreEvent(bridgeInput);
  return addEventToTimeline(timeline, event);
}

/**
 * Résumé des mappings disponibles pour Pierre → Global.
 * Utilisé pour documentation et tests.
 */
export function getPierreMappingsSummary(): Array<{
  pierre_event: string;
  global_event: GlobalTraceEventType;
}> {
  const pierreEvents = [
    "mission_created", "mission_started", "mission_completed",
    "task_created", "task_started", "task_completed", "task_failed",
    "document_generated", "email_drafted", "email_sent",
    "validation_required", "validation_approved", "validation_rejected",
    "memory_read", "memory_update",
    "guard_check", "guard_blocked", "guard_refused",
    "error", "reminder_created",
  ];
  return pierreEvents.map((pe) => ({
    pierre_event: pe,
    global_event: mapPierreEventTypeToGlobalEventType(pe),
  }));
}
