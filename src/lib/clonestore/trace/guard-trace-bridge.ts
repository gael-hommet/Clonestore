// TECH-07 — CloneTrace Global Audit Timeline — Guard → Trace Bridge
// Traduit une décision CloneGuard (TECH-06) en événement de trace.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceRiskLevel,
  GlobalTraceCompanyId,
  GlobalTraceTimelineId,
  GlobalTraceMissionId,
  GlobalTraceTaskId,
  GlobalTraceSessionId,
  GlobalTraceEmployeeSlug,
  GlobalTraceEventMetadata,
  GlobalTraceGuardDecisionRef,
  GlobalTraceEventType,
} from "./global-trace-types";
import {
  createGlobalTraceEvent,
  CreateGlobalTraceEventParams,
} from "./global-trace-event-factory";
import {
  buildCloneGuardActor,
} from "./global-trace-defaults";
import { addEventToTimeline } from "./global-trace-timeline";

// ── Types bridge ──────────────────────────────────────────────────────────────

export interface GuardTraceBridgeInput {
  company_id: GlobalTraceCompanyId;
  timeline_id: GlobalTraceTimelineId;
  decision: "allow" | "prepare_only" | "require_validation" | "block" | "refuse";
  action_type: string;
  risk_level: GlobalTraceRiskLevel;
  employee_slug?: GlobalTraceEmployeeSlug;
  rule_ids_matched?: string[];
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  session_id?: GlobalTraceSessionId;
  metadata?: GlobalTraceEventMetadata;
  is_demo?: boolean;
}

// ── Mapping Guard → Trace ─────────────────────────────────────────────────────

/**
 * Mappe une décision Guard vers un type d'événement de trace.
 */
export function mapGuardDecisionToTraceEventType(
  decision: GuardTraceBridgeInput["decision"],
): GlobalTraceEventType {
  const mapping: Record<string, GlobalTraceEventType> = {
    allow: "action_allowed",
    prepare_only: "action_prepared",
    require_validation: "action_requires_validation",
    block: "action_blocked",
    refuse: "action_refused",
  };
  return mapping[decision] ?? "guard_evaluated";
}

// ── Bridge principal ──────────────────────────────────────────────────────────

/**
 * Crée un événement de trace à partir d'une décision CloneGuard.
 * Le bridge garantit que chaque décision Guard laisse une trace immuable.
 */
export function createTraceEventFromGuardDecision(
  input: GuardTraceBridgeInput,
): GlobalTraceEvent {
  const eventType = mapGuardDecisionToTraceEventType(input.decision);

  const decisionLabels: Record<string, string> = {
    allow: "autorisée",
    prepare_only: "préparée uniquement (pas d'envoi automatique)",
    require_validation: "soumise à validation humaine",
    block: "bloquée par politique",
    refuse: "refusée — invariant absolu",
  };
  const label = decisionLabels[input.decision] ?? input.decision;
  const summary = `Action ${label} : ${input.action_type} [risque=${input.risk_level}]`;

  const guardDecisionRef: GlobalTraceGuardDecisionRef = {
    decision: input.decision,
    action_type: input.action_type,
    risk_level: input.risk_level,
    rule_ids_matched: input.rule_ids_matched ?? [],
    evaluated_at: new Date().toISOString(),
  };

  const params: CreateGlobalTraceEventParams = {
    timeline_id: input.timeline_id,
    company_id: input.company_id,
    event_type: eventType,
    actor: buildCloneGuardActor(),
    summary,
    source: "cloneguard",
    risk_level: input.risk_level,
    guard_decision: guardDecisionRef,
    employee_slug: input.employee_slug,
    mission_id: input.mission_id,
    task_id: input.task_id,
    session_id: input.session_id,
    metadata: {
      action_type: input.action_type,
      rule_ids: (input.rule_ids_matched ?? []).join(","),
      ...(input.metadata ?? {}),
    },
    technology_refs: [
      { technology_key: "CloneGuard", decision: input.decision },
      { technology_key: "ClonePolicy" },
    ],
    is_demo: input.is_demo ?? false,
    tags: ["guard", input.decision, input.action_type],
  };

  return createGlobalTraceEvent(params);
}

/**
 * Applique une décision Guard sur une timeline en créant l'événement correspondant.
 * Retourne la timeline mise à jour.
 */
export function applyGuardDecisionToTimeline(
  timeline: GlobalTraceTimeline,
  input: Omit<GuardTraceBridgeInput, "timeline_id">,
): GlobalTraceTimeline {
  const bridgeInput: GuardTraceBridgeInput = {
    ...input,
    timeline_id: timeline.timeline_id,
  };
  const event = createTraceEventFromGuardDecision(bridgeInput);
  return addEventToTimeline(timeline, event);
}

/**
 * Crée un événement de trace de validation_requested à partir d'une décision Guard require_validation.
 * Complémentaire à createTraceEventFromGuardDecision pour capturer la validation.
 */
export function createValidationRequestTraceFromGuard(
  input: GuardTraceBridgeInput & {
    validation_id: string;
    requested_from: string[];
  },
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: input.timeline_id,
    company_id: input.company_id,
    event_type: "validation_requested",
    actor: buildCloneGuardActor(),
    summary: `Validation humaine requise pour : ${input.action_type} [risque=${input.risk_level}]`,
    source: "cloneguard",
    risk_level: input.risk_level,
    employee_slug: input.employee_slug,
    mission_id: input.mission_id,
    task_id: input.task_id,
    session_id: input.session_id,
    validation_ref: {
      validation_id: input.validation_id,
      requested_from: input.requested_from,
      status: "pending",
    },
    technology_refs: [
      { technology_key: "CloneGuard", decision: "require_validation" },
    ],
    metadata: {
      action_type: input.action_type,
      ...(input.metadata ?? {}),
    },
    is_demo: input.is_demo ?? false,
    tags: ["guard", "validation", input.action_type],
  });
}
