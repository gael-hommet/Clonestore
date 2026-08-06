// src/lib/clonechat/analytics/aggregate.ts
//
// Agrégateur LOCAL, typé et READ-ONLY. Produit des snapshots sûrs à partir UNIQUEMENT d'événements
// validés. Tenant-scopé lorsqu'un pseudonyme de tenant est fourni ; jamais de lecture inter-tenant ;
// jamais d'exposition d'un pseudonyme viewer, jamais de classement ni de note individuelle ; jamais
// de conclusion de qualité à partir d'un simple volume. Division par zéro → null (jamais inventé).

import {
  CLONECHAT_ANALYTICS_VERSION, type AggregateSnapshot, type AnalyticsEnvelope, type HealthSnapshot,
  type LatencyStat,
} from "./types";

type Counts = Record<string, number>;
const inc = (m: Counts, k: string | null | undefined): void => { if (k != null) m[k] = (m[k] ?? 0) + 1; };
const rate = (num: number, den: number): number | null => (den > 0 ? num / den : null);

const GUIDE_STATUS: Record<string, string> = { "guide.produced": "ready", "guide.blocked": "blocked", "guide.completed": "completed", "guide.escalated": "escalated" };
const CARE_STATUS: Record<string, string> = { "care.known_issue": "known_issue", "care.resolution_available": "resolution_available", "care.workaround_available": "workaround_available", "care.escalation": "human_escalation" };
const VISUAL_STATE: Record<string, string> = { "visual.target_found": "target_found", "visual.target_stale": "stale", "visual.fallback_text": "fallback_text" };
const INSPECT_STATUS: Record<string, string> = { "inspection.succeeded": "analyzed", "inspection.partial": "partially_analyzed", "inspection.refused": "refused", "inspection.failed": "provider_failure" };
const ACTION_STATE: Record<string, string> = { "action.planned": "planned", "action.executed": "executed", "action.failed": "failed", "action.cancelled": "cancelled", "action.deduplicated": "duplicate" };

export function aggregate(events: readonly AnalyticsEnvelope[], opts: { tenantPseudo?: string | null } = {}): AggregateSnapshot {
  const scope = opts.tenantPseudo ?? null;
  const evs = scope === null ? events : events.filter((e) => e.tenantPseudo === scope); // isolation tenant

  const byEvent: Counts = {}, byBrainMode: Counts = {}, byDiagnosis: Counts = {}, byGuideStatus: Counts = {};
  const byCareStatus: Counts = {}, byActionState: Counts = {}, byGuardDecision: Counts = {}, byVisualState: Counts = {};
  const byInspectionStatus: Counts = {}, byOnboardingStatus: Counts = {}, byMissionStatus: Counts = {};
  const byErrorCode: Counts = {}, routesUsed: Counts = {};
  const latAgg: Record<string, { count: number; min: number; max: number; sum: number }> = {};

  let requests = 0, ctxResolved = 0, ctxIncomplete = 0, clarifications = 0, fallbacks = 0;
  let securityRefusals = 0, providerFailures = 0, onboardingResumes = 0, onboardingAbandons = 0;
  const conf = { requested: 0, received: 0, expired: 0, invalid: 0 };

  for (const e of evs) {
    inc(byEvent, e.eventName);
    inc(byErrorCode, e.errorCode);
    inc(routesUsed, e.route);
    if (typeof e.durationMs === "number") {
      const a = latAgg[e.stage] ?? (latAgg[e.stage] = { count: 0, min: e.durationMs, max: e.durationMs, sum: 0 });
      a.count++; a.sum += e.durationMs; a.min = Math.min(a.min, e.durationMs); a.max = Math.max(a.max, e.durationMs);
    }
    switch (e.eventName) {
      case "clonechat.request_received": requests++; break;
      case "brain.decision_made": inc(byBrainMode, typeof e.meta.mode === "string" ? e.meta.mode : "unknown"); break;
      case "context.resolved": ctxResolved++; break;
      case "context.incomplete": ctxIncomplete++; break;
      case "diagnosis.produced": inc(byDiagnosis, typeof e.meta.kind === "string" ? e.meta.kind : "unknown"); break;
      case "diagnosis.clarification_needed": clarifications++; break;
      case "action.guard_refused": inc(byGuardDecision, "block"); securityRefusals++; break;
      case "action.confirmation_requested": conf.requested++; break;
      case "action.confirmation_received": conf.received++; break;
      case "action.confirmation_expired": conf.expired++; break;
      case "action.confirmation_invalid": conf.invalid++; break;
      case "security.refusal": securityRefusals++; break;
      case "voice.transcription_refused": securityRefusals++; break;
      case "inspection.refused": securityRefusals++; break;
      case "provider.failure": providerFailures++; break;
      case "voice.transcription_failed": providerFailures++; break;
      case "inspection.failed": providerFailures++; break;
      case "voice.tts_fallback_text": fallbacks++; break;
      case "onboarding.resumed": onboardingResumes++; break;
      case "onboarding.abandoned": onboardingAbandons++; break;
      default: break;
    }
    if (e.eventName === "visual.fallback_text") fallbacks++;
    if (e.eventName === "action.planned") inc(byGuardDecision, e.result === "needs_confirmation" ? "needs_confirmation" : e.result === "blocked" ? "block" : "allow");
    if (GUIDE_STATUS[e.eventName]) inc(byGuideStatus, GUIDE_STATUS[e.eventName]);
    if (CARE_STATUS[e.eventName]) inc(byCareStatus, CARE_STATUS[e.eventName]);
    if (VISUAL_STATE[e.eventName]) inc(byVisualState, VISUAL_STATE[e.eventName]);
    if (INSPECT_STATUS[e.eventName]) inc(byInspectionStatus, INSPECT_STATUS[e.eventName]);
    if (ACTION_STATE[e.eventName]) inc(byActionState, ACTION_STATE[e.eventName]);
    if (e.stage === "onboarding") inc(byOnboardingStatus, e.result);
    if (e.stage === "mission") inc(byMissionStatus, e.result);
  }

  const latencyByStage: Record<string, LatencyStat> = {};
  for (const [stage, a] of Object.entries(latAgg)) {
    latencyByStage[stage] = { count: a.count, minMs: a.min, maxMs: a.max, avgMs: a.count > 0 ? a.sum / a.count : null };
  }

  return Object.freeze({
    version: CLONECHAT_ANALYTICS_VERSION,
    tenantScope: scope,
    totalEvents: evs.length,
    requests,
    byEvent, byBrainMode, byDiagnosis, byGuideStatus, byCareStatus, byActionState, byGuardDecision,
    byVisualState, byInspectionStatus, byOnboardingStatus, byMissionStatus, byErrorCode, routesUsed,
    latencyByStage,
    incompleteContextRate: rate(ctxIncomplete, ctxResolved + ctxIncomplete),
    clarificationRate: rate(clarifications, requests),
    fallbackRate: rate(fallbacks, requests),
    securityRefusals, providerFailures,
    confirmations: conf,
    onboardingResumes, onboardingAbandons,
  });
}

/** Indicateurs de santé sûrs, dérivés des événements + compteurs du collecteur. */
export function health(events: readonly AnalyticsEnvelope[], meta: {
  rejectedEvents: number; deduplicatedEvents: number; failedDeliveries: number;
  bufferSize: number; maxBuffer: number; productAnalyticsDisabled: boolean;
}): HealthSnapshot {
  const total = events.length;
  const errors = events.filter((e) => e.eventName === "internal.error" || e.result === "failed").length;
  const providerFailures = events.filter((e) => e.stage === "provider" || e.eventName === "inspection.failed" || e.eventName === "voice.transcription_failed").length;
  const durations = events.map((e) => e.durationMs).filter((d): d is number => typeof d === "number");
  const avgLatencyMs = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null;
  return Object.freeze({
    version: CLONECHAT_ANALYTICS_VERSION,
    pipelineAvailable: total === 0 ? true : errors / total < 0.5,
    providerAvailable: total === 0 ? true : providerFailures / total < 0.5,
    errorRate: total > 0 ? errors / total : null,
    avgLatencyMs,
    bufferSaturation: meta.maxBuffer > 0 ? Math.min(1, meta.bufferSize / meta.maxBuffer) : 0,
    rejectedEvents: meta.rejectedEvents,
    deduplicatedEvents: meta.deduplicatedEvents,
    failedDeliveries: meta.failedDeliveries,
    productAnalyticsDisabled: meta.productAnalyticsDisabled,
  });
}
