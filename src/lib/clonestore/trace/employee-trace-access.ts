// TECH-07 — CloneTrace Global Audit Timeline — Employee Trace Access
// Profils d'accès trace pour les employés IA.
// Un employé ne peut jamais supprimer des événements.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalTraceEmployeeAccessProfile,
  GlobalTraceEventType,
  GlobalTraceEmployeeSlug,
} from "./global-trace-types";

// ── Types d'événements RH ─────────────────────────────────────────────────────

const HR_CREATABLE_EVENT_TYPES: GlobalTraceEventType[] = [
  "request_received",
  "mission_created",
  "task_created",
  "task_started",
  "task_completed",
  "task_failed",
  "action_attempted",
  "document_prepared",
  "email_prepared",
  "memory_read",
  "memory_update_proposed",
  "validation_requested",
  "retry_scheduled",
  "schedule_created",
  "employee_handoff",
  "error_recorded",
  "system_note",
];

// ── Profils d'accès ────────────────────────────────────────────────────────────

/**
 * Profil d'accès trace de Pierre.
 * Pierre peut créer et lire les événements RH.
 * Pierre ne peut JAMAIS supprimer des événements.
 */
export const PIERRE_DEFAULT_TRACE_ACCESS_PROFILE: GlobalTraceEmployeeAccessProfile = {
  employee_slug: "pierre",
  can_create_events: true,
  can_read_events: true,
  can_read_admin_only: false,
  allowed_event_types: HR_CREATABLE_EVENT_TYPES,
  allowed_domains: ["hr", "legal", "ops"],
  max_visibility: "internal",
  requires_trace_for_actions: [
    "send_email",
    "update_memory",
    "delete_data",
    "export_data",
    "legal_decision",
    "payroll_execution",
    "termination_decision",
    "contract_signature",
  ],
  can_delete_events: false,
};

/**
 * Profil d'accès trace d'un employé inconnu (désactivé par défaut).
 */
export const UNKNOWN_EMPLOYEE_TRACE_ACCESS_PROFILE: GlobalTraceEmployeeAccessProfile = {
  employee_slug: "unknown",
  can_create_events: false,
  can_read_events: false,
  can_read_admin_only: false,
  allowed_event_types: [],
  allowed_domains: [],
  max_visibility: "internal",
  requires_trace_for_actions: [],
  can_delete_events: false,
};

/**
 * Profil d'accès trace du système (CloneOS, CloneGuard, CloneTrace).
 * Le système peut créer tous les types d'événements.
 */
export const SYSTEM_TRACE_ACCESS_PROFILE: GlobalTraceEmployeeAccessProfile = {
  employee_slug: "system",
  can_create_events: true,
  can_read_events: true,
  can_read_admin_only: true,
  allowed_event_types: [
    "request_received", "mission_created", "task_created", "task_started",
    "task_completed", "task_failed", "action_attempted", "action_allowed",
    "action_prepared", "action_requires_validation", "action_blocked",
    "action_refused", "validation_requested", "validation_approved",
    "validation_rejected", "document_prepared", "email_prepared", "email_sent",
    "memory_read", "memory_update_proposed", "memory_update_approved",
    "guard_evaluated", "policy_matched", "employee_handoff", "schedule_created",
    "schedule_triggered", "retry_scheduled", "error_recorded", "proof_attached",
    "system_note",
  ],
  allowed_domains: ["hr", "legal", "ops", "admin", "system"],
  max_visibility: "audit_only",
  requires_trace_for_actions: [],
  can_delete_events: false,
};

// ── Fonctions d'accès ─────────────────────────────────────────────────────────

/**
 * Retourne le profil d'accès trace pour un slug d'employé donné.
 */
export function getEmployeeTraceAccessProfile(
  employeeSlug: GlobalTraceEmployeeSlug,
): GlobalTraceEmployeeAccessProfile {
  if (employeeSlug === "pierre") return PIERRE_DEFAULT_TRACE_ACCESS_PROFILE;
  if (employeeSlug === "system") return SYSTEM_TRACE_ACCESS_PROFILE;
  // Employés futurs : retourner le profil désactivé par défaut
  return { ...UNKNOWN_EMPLOYEE_TRACE_ACCESS_PROFILE, employee_slug: employeeSlug };
}

/**
 * Vérifie si un employé peut créer un type d'événement donné.
 */
export function canEmployeeCreateEvent(
  employeeSlug: GlobalTraceEmployeeSlug,
  eventType: GlobalTraceEventType,
): boolean {
  const profile = getEmployeeTraceAccessProfile(employeeSlug);
  if (!profile.can_create_events) return false;
  return profile.allowed_event_types.includes(eventType);
}

/**
 * Vérifie si une action exige une trace pour un employé donné.
 */
export function doesActionRequireTrace(
  employeeSlug: GlobalTraceEmployeeSlug,
  actionType: string,
): boolean {
  const profile = getEmployeeTraceAccessProfile(employeeSlug);
  return profile.requires_trace_for_actions.includes(actionType);
}

/**
 * Un employé ne peut JAMAIS supprimer des événements — invariant absolu.
 * Cette fonction retourne toujours false.
 */
export function canEmployeeDeleteEvents(
  _employeeSlug: GlobalTraceEmployeeSlug,
): false {
  return false;
}
