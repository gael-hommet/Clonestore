// TECH-09 — CloneBrief Executive Summaries — Source Adapters
// Adapte les données des technologies globales (Trace/OS/Guard/ADN) vers CloneBrief.
// Pure functions: no async, no Supabase, no Next.js, no side effects.
// Ne mute jamais les inputs. N'écrit jamais en storage. N'appelle jamais le réseau.

import type { GlobalTraceTimeline, GlobalTraceEvent } from "../trace/global-trace-types";
import type { GlobalEnterpriseMemory } from "../adn/global-enterprise-memory";
import type {
  CloneOSCommandCenterResult,
  CloneOSCommandGuardResult,
} from "../cloneos/cloneos-command-types";
import type {
  CloneBriefGenerationInput,
  CloneBriefCompanyId,
  CloneBriefSourceRef,
} from "./clonebrief-types";
import {
  buildTraceBriefSourceRef,
  buildCommandBriefSourceRef,
  buildSystemBriefSourceRef,
  buildAdnBriefSourceRef,
} from "./clonebrief-defaults";

// ── Adapters CloneTrace → CloneBrief ──────────────────────────────────────────

/**
 * Adapte un événement CloneTrace en référence de source pour CloneBrief.
 */
export function adaptTraceEventToBriefSource(event: GlobalTraceEvent): CloneBriefSourceRef {
  return {
    ...buildTraceBriefSourceRef(event.event_id),
    source_label: `[${event.event_type}] ${event.summary.slice(0, 80)}`,
    created_at: event.created_at,
  };
}

/**
 * Adapte une timeline CloneTrace complète en tableau de sources.
 * Filtre les événements système internes si demandé.
 */
export function adaptTraceTimelineToBriefSources(
  timeline: GlobalTraceTimeline,
  options?: { include_system?: boolean },
): CloneBriefSourceRef[] {
  const events = timeline.events ?? [];
  return events
    .filter((e) => options?.include_system || e.source !== "system_init")
    .map(adaptTraceEventToBriefSource);
}

// ── Adapters CloneOS → CloneBrief ─────────────────────────────────────────────

/**
 * Adapte un résultat CloneOS en référence de source.
 */
export function adaptCloneOSResultToBriefSource(
  result: CloneOSCommandCenterResult,
): CloneBriefSourceRef {
  return {
    ...buildCommandBriefSourceRef(result.command_id),
    source_label: `[CloneOS ${result.status}] ${result.classified_command?.summary ?? result.command_id}`,
    created_at: result.generated_at,
  };
}

/**
 * Adapte un tableau de résultats CloneOS en tableau de sources.
 */
export function adaptCloneOSResultsToBriefSources(
  results: CloneOSCommandCenterResult[],
): CloneBriefSourceRef[] {
  return results.map(adaptCloneOSResultToBriefSource);
}

/**
 * Alias : adapte un seul résultat CloneOS (compatibilité spec Phase 4).
 */
export function adaptCloneOSResultToBriefSources(
  result: CloneOSCommandCenterResult,
): CloneBriefSourceRef[] {
  return [adaptCloneOSResultToBriefSource(result)];
}

// ── Adapters CloneGuard → CloneBrief ──────────────────────────────────────────

/**
 * Adapte un résultat Guard (issu d'un CloneOSCommandCenterResult) en sources.
 */
export function adaptGuardResultToBriefSources(
  guardResult: CloneOSCommandGuardResult,
): CloneBriefSourceRef[] {
  const refs: CloneBriefSourceRef[] = [];
  for (const task of guardResult.task_results) {
    if (task.decision === "block" || task.decision === "refuse") {
      for (const ruleId of task.rule_ids_matched) {
        refs.push({
          source_type: "cloneguard",
          source_id: ruleId,
          source_label: `Règle ${ruleId} — décision: ${task.decision}`,
          created_at: guardResult.evaluated_at,
        });
      }
    }
  }
  return refs;
}

// ── Adapters CloneADN → CloneBrief ────────────────────────────────────────────

/**
 * Adapte la mémoire entreprise en source de référence.
 */
export function adaptEnterpriseMemoryToBriefSources(
  memory: GlobalEnterpriseMemory,
): CloneBriefSourceRef[] {
  return [buildAdnBriefSourceRef(memory.company_id)];
}

// ── Builders d'input ──────────────────────────────────────────────────────────

/**
 * Construit un CloneBriefGenerationInput depuis une timeline CloneTrace.
 */
export function buildBriefGenerationInputFromTrace(
  timeline: GlobalTraceTimeline,
  options?: Partial<CloneBriefGenerationInput>,
): CloneBriefGenerationInput {
  return {
    company_id: timeline.company_id as CloneBriefCompanyId,
    brief_type: options?.brief_type ?? "daily",
    audience: options?.audience ?? "founder",
    trace_timeline: timeline,
    trace_events: timeline.events ?? [],
    command_results: options?.command_results ?? [],
    enterprise_memory: options?.enterprise_memory,
    is_demo: options?.is_demo ?? timeline.is_demo ?? false,
    ...options,
  };
}

/**
 * Construit un CloneBriefGenerationInput depuis un tableau de résultats CloneOS.
 */
export function buildBriefGenerationInputFromCommandResults(
  results: CloneOSCommandCenterResult[],
  companyId: CloneBriefCompanyId,
  options?: Partial<CloneBriefGenerationInput>,
): CloneBriefGenerationInput {
  return {
    company_id: companyId,
    brief_type: options?.brief_type ?? "daily",
    audience: options?.audience ?? "founder",
    trace_events: [],
    command_results: results,
    is_demo: options?.is_demo ?? false,
    ...options,
  };
}

/**
 * Fusionne plusieurs tableaux de sources en éliminant les doublons d'IDs.
 */
export function mergeBriefSources(...sources: CloneBriefSourceRef[][]): CloneBriefSourceRef[] {
  const seen = new Set<string>();
  const merged: CloneBriefSourceRef[] = [];
  for (const group of sources) {
    for (const ref of group) {
      if (!seen.has(ref.source_id)) {
        seen.add(ref.source_id);
        merged.push(ref);
      }
    }
  }
  return merged;
}

// ── Extraction helpers ────────────────────────────────────────────────────────

/**
 * Extrait les événements bloqués/refusés d'un input.
 */
export function extractBlockedEventsFromInput(
  input: CloneBriefGenerationInput,
): GlobalTraceEvent[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  return events.filter(
    (e) =>
      e.event_type === "action_blocked" ||
      e.event_type === "action_refused" ||
      e.status === "blocked" ||
      e.status === "refused",
  );
}

/**
 * Extrait les événements de validation en attente d'un input.
 */
export function extractValidationEventsFromInput(
  input: CloneBriefGenerationInput,
): GlobalTraceEvent[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  return events.filter(
    (e) =>
      e.event_type === "validation_requested" ||
      e.event_type === "action_requires_validation" ||
      e.status === "requires_validation",
  );
}

/**
 * Extrait les événements critiques d'un input.
 */
export function extractCriticalEventsFromInput(
  input: CloneBriefGenerationInput,
): GlobalTraceEvent[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  return events.filter(
    (e) => e.severity === "critical" || e.risk_level === "critical" || e.severity === "error",
  );
}

/**
 * Extrait les événements d'actions terminées d'un input.
 */
export function extractCompletedEventsFromInput(
  input: CloneBriefGenerationInput,
): GlobalTraceEvent[] {
  const events = input.trace_events ?? input.trace_timeline?.events ?? [];
  return events.filter(
    (e) =>
      e.event_type === "task_completed" ||
      e.event_type === "document_prepared" ||
      e.event_type === "email_prepared" ||
      e.event_type === "email_sent" ||
      e.event_type === "action_allowed" ||
      e.status === "success",
  );
}

/**
 * Extrait les résultats CloneOS bloqués depuis l'input.
 */
export function extractBlockedCommandResultsFromInput(
  input: CloneBriefGenerationInput,
): CloneOSCommandCenterResult[] {
  const results = input.command_results ?? [];
  return results.filter((r) => r.status === "blocked" || r.status === "refused");
}

/**
 * Construit la liste globale des sources depuis un input.
 */
export function buildAllSourceRefsFromInput(
  input: CloneBriefGenerationInput,
): CloneBriefSourceRef[] {
  const traceSources = input.trace_timeline
    ? adaptTraceTimelineToBriefSources(input.trace_timeline)
    : (input.trace_events ?? []).map(adaptTraceEventToBriefSource);

  const osSources = adaptCloneOSResultsToBriefSources(input.command_results ?? []);

  const adnSources = input.enterprise_memory
    ? adaptEnterpriseMemoryToBriefSources(input.enterprise_memory)
    : [];

  const guardSources = (input.command_results ?? [])
    .filter((r) => r.guard_result)
    .flatMap((r) => adaptGuardResultToBriefSources(r.guard_result!));

  const systemRef = buildSystemBriefSourceRef();

  return mergeBriefSources(traceSources, osSources, adnSources, guardSources, [systemRef]);
}
