// TECH-07 — CloneTrace Global Audit Timeline — Event Factory
// Fonctions de création d'événements + sanitisation des données sensibles.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEvent,
  GlobalTraceEventId,
  GlobalTraceTimelineId,
  GlobalTraceCompanyId,
  GlobalTraceEventType,
  GlobalTraceSeverity,
  GlobalTraceStatus,
  GlobalTraceVisibility,
  GlobalTraceSource,
  GlobalTraceRiskLevel,
  GlobalTraceActor,
  GlobalTraceEventMetadata,
  GlobalTraceRelatedEntity,
  GlobalTraceTechnologyRef,
  GlobalTraceProofRef,
  GlobalTraceGuardDecisionRef,
  GlobalTraceValidationRef,
  GlobalTraceEmployeeSlug,
  GlobalTraceMissionId,
  GlobalTraceTaskId,
  GlobalTraceSessionId,
} from "./global-trace-types";
import {
  generateTraceEventId,
  defaultTraceSeverityForEventType,
  defaultTraceStatusForEventType,
  defaultTraceVisibility,
  defaultTraceSource,
  buildSystemTraceActor,
  buildCloneGuardActor,
} from "./global-trace-defaults";

// ── Clés sensibles à redacter ────────────────────────────────────────────────

export const SENSITIVE_METADATA_KEYS = [
  "password",
  "token",
  "secret",
  "api_key",
  "authorization",
  "stripe",
  "supabase",
  "openai",
  "anthropic",
  "private_key",
  "webhook_secret",
  "sk_live_",
  "whsec_",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];

// ── Sanitisation ─────────────────────────────────────────────────────────────

/**
 * Redacte les clés sensibles dans un objet de métadonnées.
 * Ne modifie pas l'objet original — retourne une copie nettoyée.
 */
export function redactTraceMetadata(
  metadata: GlobalTraceEventMetadata,
): GlobalTraceEventMetadata {
  const result: GlobalTraceEventMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_METADATA_KEYS.some((k) =>
      keyLower.includes(k.toLowerCase()),
    );
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sanitise le résumé d'un événement.
 * Retire les patterns sensibles potentiels.
 */
export function sanitizeTraceSummary(summary: string): string {
  let sanitized = summary;
  // Redacter les tokens-like patterns (sk_live_, whsec_, Bearer, etc.)
  sanitized = sanitized.replace(/sk_live_[a-zA-Z0-9_]+/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/whsec_[a-zA-Z0-9_]+/g, "[REDACTED_SECRET]");
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED_BEARER]");
  // Supprimer les adresses email dans le summary (pas de données perso brutes)
  // On conserve les domaines uniquement pour les traces légitimes
  sanitized = sanitized.trim();
  if (!sanitized) return "[Résumé non disponible]";
  return sanitized;
}

// ── Factory principal ────────────────────────────────────────────────────────

export interface CreateGlobalTraceEventParams {
  timeline_id: GlobalTraceTimelineId;
  company_id: GlobalTraceCompanyId;
  event_type: GlobalTraceEventType;
  actor: GlobalTraceActor;
  summary: string;
  metadata?: GlobalTraceEventMetadata;
  related_entities?: GlobalTraceRelatedEntity[];
  technology_refs?: GlobalTraceTechnologyRef[];
  proof_refs?: GlobalTraceProofRef[];
  guard_decision?: GlobalTraceGuardDecisionRef;
  validation_ref?: GlobalTraceValidationRef;
  risk_level?: GlobalTraceRiskLevel;
  severity?: GlobalTraceSeverity;
  status?: GlobalTraceStatus;
  visibility?: GlobalTraceVisibility;
  source?: GlobalTraceSource;
  description?: string;
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  session_id?: GlobalTraceSessionId;
  parent_event_id?: GlobalTraceEventId;
  employee_slug?: GlobalTraceEmployeeSlug;
  is_demo?: boolean;
  tags?: string[];
  event_id?: GlobalTraceEventId;
}

/**
 * Crée un événement de trace immuable.
 * Toutes les métadonnées sont automatiquement redactées.
 * Le résumé est automatiquement sanitisé.
 */
export function createGlobalTraceEvent(
  params: CreateGlobalTraceEventParams,
): GlobalTraceEvent {
  const eventType = params.event_type;
  const severity = params.severity ?? defaultTraceSeverityForEventType(eventType);
  const status = params.status ?? defaultTraceStatusForEventType(eventType);
  const visibility = params.visibility ?? defaultTraceVisibility(severity);
  const source = params.source ?? defaultTraceSource(params.actor.actor_type);

  return {
    event_id: params.event_id ?? generateTraceEventId(),
    timeline_id: params.timeline_id,
    company_id: params.company_id,
    event_type: eventType,
    severity,
    status,
    visibility,
    source,
    actor: params.actor,
    summary: sanitizeTraceSummary(params.summary),
    description: params.description,
    metadata: redactTraceMetadata(params.metadata ?? {}),
    related_entities: params.related_entities ?? [],
    technology_refs: params.technology_refs ?? [],
    proof_refs: params.proof_refs ?? [],
    guard_decision: params.guard_decision,
    validation_ref: params.validation_ref,
    risk_level: params.risk_level ?? "low",
    mission_id: params.mission_id,
    task_id: params.task_id,
    session_id: params.session_id,
    parent_event_id: params.parent_event_id,
    employee_slug: params.employee_slug,
    created_at: new Date().toISOString(),
    immutable: true,
    is_demo: params.is_demo ?? false,
    tags: params.tags ?? [],
  };
}

// ── Factories spécialisées ────────────────────────────────────────────────────

/** Événement : mission créée */
export function createMissionCreatedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  actor: GlobalTraceActor,
  missionId: GlobalTraceMissionId,
  summary: string,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "mission_created",
    actor,
    summary,
    mission_id: missionId,
    risk_level: "low",
    related_entities: [{ entity_type: "mission", entity_id: missionId }],
    ...options,
  });
}

/** Événement : action Guard — allow */
export function createActionAllowedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  actionType: string,
  actor: GlobalTraceActor,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "action_allowed",
    actor: actor ?? buildCloneGuardActor(),
    summary: `Action autorisée : ${actionType}`,
    source: "cloneguard",
    metadata: { action_type: actionType },
    technology_refs: [{ technology_key: "CloneGuard", decision: "allow" }],
    ...options,
  });
}

/** Événement : action Guard — blocked */
export function createActionBlockedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  actionType: string,
  ruleIds: string[],
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "action_blocked",
    actor: buildCloneGuardActor(),
    summary: `Action bloquée par politique : ${actionType}`,
    source: "cloneguard",
    severity: "warning",
    status: "blocked",
    risk_level: "high",
    metadata: { action_type: actionType, rule_ids: ruleIds.join(",") },
    technology_refs: [
      { technology_key: "CloneGuard", decision: "block" },
      { technology_key: "ClonePolicy", decision: "block" },
    ],
    ...options,
  });
}

/** Événement : action Guard — refused */
export function createActionRefusedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  actionType: string,
  ruleIds: string[],
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "action_refused",
    actor: buildCloneGuardActor(),
    summary: `Action refusée — invariant absolu : ${actionType}`,
    source: "cloneguard",
    severity: "critical",
    status: "refused",
    risk_level: "critical",
    metadata: { action_type: actionType, rule_ids: ruleIds.join(",") },
    technology_refs: [
      { technology_key: "CloneGuard", decision: "refuse" },
      { technology_key: "ClonePolicy", decision: "refuse" },
    ],
    ...options,
  });
}

/** Événement : validation humaine requise */
export function createValidationRequestedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  validationId: string,
  requestedFrom: string[],
  summary: string,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "validation_requested",
    actor: buildCloneGuardActor(),
    summary,
    source: "cloneguard",
    severity: "warning",
    status: "requires_validation",
    validation_ref: {
      validation_id: validationId,
      requested_from: requestedFrom,
      status: "pending",
    },
    technology_refs: [{ technology_key: "CloneGuard", decision: "require_validation" }],
    ...options,
  });
}

/** Événement : document préparé */
export function createDocumentPreparedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  actor: GlobalTraceActor,
  documentId: string,
  documentLabel: string,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "document_prepared",
    actor,
    summary: `Document préparé : ${documentLabel}`,
    related_entities: [{ entity_type: "document", entity_id: documentId, entity_label: documentLabel }],
    technology_refs: [{ technology_key: "CloneTrace" }],
    ...options,
  });
}

/** Événement : erreur système */
export function createErrorRecordedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  errorMessage: string,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "error_recorded",
    actor: buildSystemTraceActor(),
    summary: sanitizeTraceSummary(`Erreur enregistrée : ${errorMessage}`),
    severity: "error",
    status: "failure",
    source: "system_init",
    ...options,
  });
}

/** Événement : guard évalué */
export function createGuardEvaluatedEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  decision: GlobalTraceGuardDecisionRef,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "guard_evaluated",
    actor: buildCloneGuardActor(),
    summary: `CloneGuard a évalué l'action : ${decision.action_type} → ${decision.decision}`,
    source: "cloneguard",
    guard_decision: decision,
    risk_level: decision.risk_level,
    technology_refs: [
      { technology_key: "CloneGuard", decision: decision.decision },
      { technology_key: "ClonePolicy" },
    ],
    ...options,
  });
}

/** Événement : note système */
export function createSystemNoteEvent(
  timelineId: GlobalTraceTimelineId,
  companyId: GlobalTraceCompanyId,
  note: string,
  options?: Partial<CreateGlobalTraceEventParams>,
): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: timelineId,
    company_id: companyId,
    event_type: "system_note",
    actor: buildSystemTraceActor(),
    summary: note,
    severity: "debug",
    status: "success",
    source: "system_init",
    ...options,
  });
}
