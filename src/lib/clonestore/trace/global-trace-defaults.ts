// TECH-07 — CloneTrace Global Audit Timeline — Defaults & Constructors
// Fonctions de construction des structures de base.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceActor,
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceTimelineId,
  GlobalTraceCompanyId,
  GlobalTraceEmployeeSlug,
  GlobalTraceEventType,
  GlobalTraceSeverity,
  GlobalTraceStatus,
  GlobalTraceVisibility,
  GlobalTraceSource,
  GlobalTraceRiskLevel,
} from "./global-trace-types";

// ── Version ──────────────────────────────────────────────────────────────────

export const DEFAULT_GLOBAL_TRACE_VERSION = "1.0.0";

// ── ID generators ────────────────────────────────────────────────────────────

export function generateTraceEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateTraceTimelineId(companyId: string): string {
  return `tl_${companyId}_${Date.now()}`;
}

// ── Acteurs ──────────────────────────────────────────────────────────────────

/**
 * Construit un acteur système (CloneTrace lui-même).
 */
export function buildSystemTraceActor(): GlobalTraceActor {
  return {
    actor_type: "system",
    actor_id: "system:clonetrace",
    actor_label: "CloneTrace System",
    is_human: false,
    is_ai: false,
    is_system: true,
  };
}

/**
 * Construit un acteur CloneGuard.
 */
export function buildCloneGuardActor(): GlobalTraceActor {
  return {
    actor_type: "cloneguard",
    actor_id: "system:cloneguard",
    actor_label: "CloneGuard",
    is_human: false,
    is_ai: false,
    is_system: true,
  };
}

/**
 * Construit un acteur ClonePolicy.
 */
export function buildClonePolicyActor(): GlobalTraceActor {
  return {
    actor_type: "clonepolicy",
    actor_id: "system:clonepolicy",
    actor_label: "ClonePolicy",
    is_human: false,
    is_ai: false,
    is_system: true,
  };
}

/**
 * Construit un acteur employé IA.
 */
export function buildAIEmployeeTraceActor(
  employeeSlug: GlobalTraceEmployeeSlug,
  employeeLabel?: string,
): GlobalTraceActor {
  return {
    actor_type: "ai_employee",
    actor_id: `ai:${employeeSlug}`,
    actor_label: employeeLabel ?? `AI Employee — ${employeeSlug}`,
    employee_slug: employeeSlug,
    is_human: false,
    is_ai: true,
    is_system: false,
  };
}

/**
 * Construit un acteur humain.
 */
export function buildHumanTraceActor(
  userId: string,
  userLabel: string,
): GlobalTraceActor {
  return {
    actor_type: "human_user",
    actor_id: `human:${userId}`,
    actor_label: userLabel,
    is_human: true,
    is_ai: false,
    is_system: false,
  };
}

/**
 * Construit un acteur CloneOS.
 */
export function buildCloneOSActor(): GlobalTraceActor {
  return {
    actor_type: "cloneos",
    actor_id: "system:cloneos",
    actor_label: "CloneOS",
    is_human: false,
    is_ai: false,
    is_system: true,
  };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Construit une timeline vide pour une entreprise.
 */
export function buildEmptyGlobalTraceTimeline(
  companyId: GlobalTraceCompanyId,
  timelineId?: GlobalTraceTimelineId,
): GlobalTraceTimeline {
  const now = new Date().toISOString();
  return {
    timeline_id: timelineId ?? generateTraceTimelineId(companyId),
    company_id: companyId,
    events: [],
    event_count: 0,
    first_event_at: undefined,
    last_event_at: undefined,
    is_demo: false,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Construit une timeline de démonstration avec quelques événements.
 */
export function buildDemoGlobalTraceTimeline(
  companyId?: GlobalTraceCompanyId,
): GlobalTraceTimeline {
  const cid = companyId ?? "cmp_demo_001";
  const tlId = `tl_${cid}_demo`;
  const now = new Date().toISOString();
  const t1 = "2026-01-15T09:00:00.000Z";
  const t2 = "2026-01-15T09:05:00.000Z";
  const t3 = "2026-01-15T09:10:00.000Z";
  const t4 = "2026-01-15T09:15:00.000Z";

  const event1: GlobalTraceEvent = {
    event_id: "evt_demo_001",
    timeline_id: tlId,
    company_id: cid,
    event_type: "mission_created",
    severity: "info",
    status: "success",
    visibility: "internal",
    source: "pierre_bridge",
    actor: buildAIEmployeeTraceActor("pierre", "Pierre — RH"),
    summary: "Mission RH créée : analyse des congés Q1 2026",
    metadata: { mission_ref: "m_001", domain: "hr" },
    related_entities: [{ entity_type: "mission", entity_id: "m_001", entity_label: "Analyse congés Q1" }],
    technology_refs: [{ technology_key: "CloneGuard", decision: "allow" }],
    proof_refs: [],
    risk_level: "low",
    mission_id: "m_001",
    employee_slug: "pierre",
    created_at: t1,
    immutable: true,
    is_demo: true,
    tags: ["hr", "mission"],
  };

  const event2: GlobalTraceEvent = {
    event_id: "evt_demo_002",
    timeline_id: tlId,
    company_id: cid,
    event_type: "document_prepared",
    severity: "info",
    status: "success",
    visibility: "internal",
    source: "pierre_bridge",
    actor: buildAIEmployeeTraceActor("pierre", "Pierre — RH"),
    summary: "Document RH préparé : résumé des absences Q1",
    metadata: { document_type: "draft", risk: "low" },
    related_entities: [{ entity_type: "document", entity_id: "doc_001", entity_label: "Résumé absences Q1" }],
    technology_refs: [{ technology_key: "CloneTrace" }],
    proof_refs: [],
    risk_level: "low",
    mission_id: "m_001",
    employee_slug: "pierre",
    created_at: t2,
    immutable: true,
    is_demo: true,
    tags: ["hr", "document"],
  };

  const event3: GlobalTraceEvent = {
    event_id: "evt_demo_003",
    timeline_id: tlId,
    company_id: cid,
    event_type: "action_blocked",
    severity: "warning",
    status: "blocked",
    visibility: "internal",
    source: "cloneguard",
    actor: buildCloneGuardActor(),
    summary: "Action bloquée : suppression de données sans validation admin",
    metadata: { action_type: "delete_data", reason: "policy_009" },
    related_entities: [],
    technology_refs: [
      { technology_key: "CloneGuard", decision: "block" },
      { technology_key: "ClonePolicy", decision: "block" },
    ],
    proof_refs: [],
    guard_decision: {
      decision: "block",
      action_type: "delete_data",
      risk_level: "high",
      rule_ids_matched: ["policy_009"],
      evaluated_at: t3,
    },
    risk_level: "high",
    employee_slug: "pierre",
    created_at: t3,
    immutable: true,
    is_demo: true,
    tags: ["guard", "blocked"],
  };

  const event4: GlobalTraceEvent = {
    event_id: "evt_demo_004",
    timeline_id: tlId,
    company_id: cid,
    event_type: "validation_requested",
    severity: "warning",
    status: "requires_validation",
    visibility: "internal",
    source: "cloneguard",
    actor: buildCloneGuardActor(),
    summary: "Validation humaine requise avant envoi email (risque high)",
    metadata: { action_type: "send_email", recipient_count: 3 },
    related_entities: [],
    technology_refs: [{ technology_key: "CloneGuard", decision: "require_validation" }],
    proof_refs: [],
    validation_ref: {
      validation_id: "val_001",
      requested_from: ["manager@demo.fr"],
      status: "pending",
    },
    risk_level: "high",
    employee_slug: "pierre",
    created_at: t4,
    immutable: true,
    is_demo: true,
    tags: ["validation", "email"],
  };

  const events = [event1, event2, event3, event4];

  return {
    timeline_id: tlId,
    company_id: cid,
    events,
    event_count: events.length,
    first_event_at: t1,
    last_event_at: t4,
    is_demo: true,
    created_at: now,
    updated_at: now,
  };
}

// ── Defaults pour les champs optionnels ──────────────────────────────────────

export function defaultTraceSeverityForEventType(
  eventType: GlobalTraceEventType,
): GlobalTraceSeverity {
  const critical: GlobalTraceEventType[] = ["action_refused", "error_recorded"];
  const warning: GlobalTraceEventType[] = [
    "action_blocked", "action_requires_validation", "validation_requested",
    "task_failed", "retry_scheduled",
  ];
  const debug: GlobalTraceEventType[] = ["memory_read", "schedule_created", "system_note"];

  if (critical.includes(eventType)) return "critical";
  if (warning.includes(eventType)) return "warning";
  if (debug.includes(eventType)) return "debug";
  return "info";
}

export function defaultTraceStatusForEventType(
  eventType: GlobalTraceEventType,
): GlobalTraceStatus {
  const statusMap: Partial<Record<GlobalTraceEventType, GlobalTraceStatus>> = {
    action_blocked: "blocked",
    action_refused: "refused",
    action_requires_validation: "requires_validation",
    validation_requested: "requires_validation",
    task_failed: "failure",
    error_recorded: "failure",
  };
  return statusMap[eventType] ?? "success";
}

export function defaultTraceVisibility(
  severity: GlobalTraceSeverity,
): GlobalTraceVisibility {
  if (severity === "critical") return "admin_only";
  return "internal";
}

export function defaultTraceSource(
  actorType: string,
): GlobalTraceSource {
  const sourceMap: Record<string, GlobalTraceSource> = {
    cloneguard: "cloneguard",
    clonepolicy: "clonepolicy",
    clonetrace: "clonetrace",
    cloneadn: "cloneadn",
    cloneos: "cloneos",
    ai_employee: "employee_runtime",
    human_user: "human_action",
    system: "system_init",
  };
  return sourceMap[actorType] ?? "system_init";
}
