// TECH-08 — CloneOS Command Center — Command Trace Integration
// Crée les événements de trace pour le pipeline CloneOS.
// Utilise CloneTrace (TECH-07) + Guard Trace Bridge.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSMissionPlan,
  CloneOSCommandGuardResult,
  CloneOSCommandTraceResult,
} from "./cloneos-command-types";

// TECH-07 — CloneTrace
import type { GlobalTraceEvent } from "../trace/global-trace-types";
import {
  createGlobalTraceEvent,
  createSystemNoteEvent,
  redactTraceMetadata,
  sanitizeTraceSummary,
} from "../trace/global-trace-event-factory";
import {
  buildSystemTraceActor,
  buildCloneGuardActor,
  buildAIEmployeeTraceActor,
  buildCloneOSActor,
} from "../trace/global-trace-defaults";
import {
  createTraceEventFromGuardDecision,
} from "../trace/guard-trace-bridge";
import type { GuardTraceBridgeInput } from "../trace/guard-trace-bridge";

// ── Events de trace ───────────────────────────────────────────────────────────

/**
 * Crée l'événement "request_received".
 */
export function createCommandReceivedTraceEvent(
  input: CloneOSCommandInput,
  timelineId: string,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: input.company_id,
    event_type: "request_received",
    actor: buildCloneOSActor(),
    summary: sanitizeTraceSummary(
      `Commande reçue via ${input.source} : "${input.raw_request.slice(0, 80)}…"`,
    ),
    source: "cloneos",
    risk_level: "low",
    metadata: redactTraceMetadata({
      source: input.source,
      has_files: input.attached_file_refs.length > 0 ? "true" : "false",
    }),
    technology_refs: [{ technology_key: "CloneOS" }],
    is_demo: input.is_demo ?? false,
    tags: ["cloneos", "command", "received"],
  });
}

/**
 * Crée l'événement "mission_created" depuis le routage.
 */
export function createCommandRoutedTraceEvent(
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
  timelineId: string,
  companyId: string,
): GlobalTraceEvent {
  const actor = route.employee_slug
    ? buildAIEmployeeTraceActor(route.employee_slug, route.employee_display_name)
    : buildSystemTraceActor();

  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: route.is_available ? "mission_created" : "action_blocked",
    actor,
    summary: route.is_available
      ? `Commande routée vers ${route.employee_display_name} — domaine ${classified.domain}`
      : `Aucun employé disponible pour le domaine "${classified.domain}"`,
    source: "cloneos",
    risk_level: classified.risk_level as "low" | "medium" | "high" | "critical",
    employee_slug: route.employee_slug || undefined,
    metadata: {
      domain: classified.domain,
      intent: classified.intent,
      employee_slug: route.employee_slug,
      confidence: String(route.confidence),
    },
    technology_refs: [{ technology_key: "CloneOS" }],
    tags: ["cloneos", "route", classified.domain],
  });
}

/**
 * Crée l'événement "task_created" depuis le plan de mission.
 */
export function createCommandPlannedTraceEvent(
  plan: CloneOSMissionPlan,
  timelineId: string,
  companyId: string,
): GlobalTraceEvent {
  const actor = plan.employee_slug && plan.employee_slug !== "system"
    ? buildAIEmployeeTraceActor(plan.employee_slug)
    : buildCloneOSActor();

  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "task_created",
    actor,
    summary: `Plan créé : ${plan.tasks.length} tâche(s) — validation=${plan.validation_required}`,
    source: "cloneos",
    risk_level: plan.risk_level,
    employee_slug: plan.employee_slug || undefined,
    mission_id: plan.mission_id,
    metadata: {
      task_count: plan.tasks.length,
      validation_required: String(plan.validation_required),
      priority: plan.priority,
    },
    technology_refs: [{ technology_key: "CloneOS" }, { technology_key: "CloneGuard" }],
    tags: ["cloneos", "plan", plan.domain],
  });
}

/**
 * Crée les événements Guard pour les décisions de chaque tâche.
 */
export function createCommandGuardedTraceEvents(
  guardResult: CloneOSCommandGuardResult,
  plan: CloneOSMissionPlan,
  timelineId: string,
  companyId: string,
  employeeSlug?: string,
): GlobalTraceEvent[] {
  const events: GlobalTraceEvent[] = [];

  for (const taskGuard of guardResult.task_results) {
    if (taskGuard.decision === "allow") continue; // allow n'a pas besoin de trace Guard spécifique

    const bridgeInput: GuardTraceBridgeInput = {
      company_id: companyId,
      timeline_id: timelineId,
      decision: taskGuard.decision as "allow" | "prepare_only" | "require_validation" | "block" | "refuse",
      action_type: taskGuard.action_type,
      risk_level: plan.risk_level,
      employee_slug: employeeSlug,
      rule_ids_matched: taskGuard.rule_ids_matched,
      mission_id: plan.mission_id,
    };

    const ev = createTraceEventFromGuardDecision(bridgeInput);
    events.push(ev);
  }

  // Événement Guard global
  const guardSummaryEvent = createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "guard_evaluated",
    actor: buildCloneGuardActor(),
    summary: `CloneGuard évalué — décision globale : ${guardResult.overall_decision}`,
    source: "cloneguard",
    risk_level: plan.risk_level,
    employee_slug: employeeSlug,
    mission_id: plan.mission_id,
    metadata: {
      overall_decision: guardResult.overall_decision,
      has_blocked: String(guardResult.has_blocked_tasks),
      has_refused: String(guardResult.has_refused_tasks),
      has_validation: String(guardResult.has_validation_required_tasks),
    },
    technology_refs: [
      { technology_key: "CloneGuard", decision: guardResult.overall_decision },
      { technology_key: "ClonePolicy" },
    ],
    tags: ["guard", guardResult.overall_decision],
  });

  events.push(guardSummaryEvent);
  return events;
}

// ── Builder principal ─────────────────────────────────────────────────────────

export function buildCloneOSCommandTraceEvents(
  input: CloneOSCommandInput,
  classified: CloneOSClassifiedCommand,
  route: CloneOSEmployeeRoute,
  plan: CloneOSMissionPlan | undefined,
  guardResult: CloneOSCommandGuardResult | undefined,
  timelineId: string,
): GlobalTraceEvent[] {
  const events: GlobalTraceEvent[] = [];

  // 1. request_received
  events.push(createCommandReceivedTraceEvent(input, timelineId));

  // 2. route event
  events.push(createCommandRoutedTraceEvent(classified, route, timelineId, input.company_id));

  // 3. plan event
  if (plan && plan.tasks.length > 0) {
    events.push(createCommandPlannedTraceEvent(plan, timelineId, input.company_id));
  }

  // 4. guard events
  if (guardResult && plan) {
    const guardEvents = createCommandGuardedTraceEvents(
      guardResult,
      plan,
      timelineId,
      input.company_id,
      route.employee_slug || undefined,
    );
    events.push(...guardEvents);
  }

  return events;
}

/**
 * Construit le résultat de trace à partir des événements générés.
 */
export function buildCloneOSCommandTraceResult(
  events: GlobalTraceEvent[],
  timelineId: string,
): CloneOSCommandTraceResult {
  return {
    timeline_id: timelineId,
    event_count: events.length,
    event_ids: events.map((e) => e.event_id),
    trace_ready: events.length > 0,
    trace_notes: events.length === 0
      ? ["Aucun événement de trace généré."]
      : [`${events.length} événement(s) prêt(s) pour la timeline.`],
  };
}
