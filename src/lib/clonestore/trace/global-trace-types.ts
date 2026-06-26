// TECH-07 — CloneTrace Global Audit Timeline — Types
// 25+ types définissant la couche globale d'audit immuable.
// Aucun événement ne peut être supprimé. Aucune donnée sensible brute.

// ── Identifiants ────────────────────────────────────────────────────────────

export type GlobalTraceEventId = string;
export type GlobalTraceTimelineId = string;
export type GlobalTraceSessionId = string;
export type GlobalTraceMissionId = string;
export type GlobalTraceTaskId = string;
export type GlobalTraceCompanyId = string;
export type GlobalTraceEmployeeSlug = string;

// ── Enums / Union types ──────────────────────────────────────────────────────

/**
 * Types d'acteurs pouvant générer un événement de trace.
 */
export type GlobalTraceActorType =
  | "human_user"
  | "ai_employee"
  | "cloneos"
  | "cloneguard"
  | "clonepolicy"
  | "clonetrace"
  | "cloneadn"
  | "system"
  | "external_service";

/**
 * Types d'événements possibles dans la timeline d'audit.
 */
export type GlobalTraceEventType =
  // Cycle de vie des missions et tâches
  | "request_received"
  | "mission_created"
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_failed"
  // Décisions Guard
  | "action_attempted"
  | "action_allowed"
  | "action_prepared"
  | "action_requires_validation"
  | "action_blocked"
  | "action_refused"
  // Validation humaine
  | "validation_requested"
  | "validation_approved"
  | "validation_rejected"
  // Documents et emails
  | "document_prepared"
  | "email_prepared"
  | "email_sent"
  // Mémoire
  | "memory_read"
  | "memory_update_proposed"
  | "memory_update_approved"
  // Infrastructure Guard / Policy
  | "guard_evaluated"
  | "policy_matched"
  // Coordination
  | "employee_handoff"
  | "schedule_created"
  | "schedule_triggered"
  | "retry_scheduled"
  // Système
  | "error_recorded"
  | "proof_attached"
  | "system_note";

/**
 * Sévérité d'un événement de trace.
 */
export type GlobalTraceSeverity =
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "critical";

/**
 * Statut d'un événement de trace.
 */
export type GlobalTraceStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failure"
  | "blocked"
  | "refused"
  | "requires_validation"
  | "cancelled";

/**
 * Visibilité d'un événement.
 */
export type GlobalTraceVisibility =
  | "public"        // Visible par tous les acteurs autorisés
  | "internal"      // Visible en interne uniquement
  | "admin_only"    // Réservé aux admins
  | "audit_only";   // Réservé à l'audit réglementaire

/**
 * Source d'un événement (quelle couche l'a généré).
 */
export type GlobalTraceSource =
  | "cloneguard"
  | "clonepolicy"
  | "clonetrace"
  | "cloneadn"
  | "cloneos"
  | "pierre_bridge"
  | "employee_runtime"
  | "human_action"
  | "system_init"
  | "test_fixture";

/**
 * Technologie CloneStore référencée dans un événement.
 */
export type GlobalTraceTechnologyKey =
  | "CloneGuard"
  | "ClonePolicy"
  | "CloneTrace"
  | "CloneADN"
  | "CloneOS"
  | "CloneTrust"
  | "CloneBrief"
  | "CloneVoice"
  | "CloneBot";

/**
 * Type d'entité liée à un événement.
 */
export type GlobalTraceRelatedEntityType =
  | "mission"
  | "task"
  | "document"
  | "email"
  | "employee"
  | "human"
  | "company"
  | "policy_rule"
  | "guard_decision"
  | "memory_item"
  | "session"
  | "proof";

/**
 * Type de preuve attachée à un événement.
 */
export type GlobalTraceProofType =
  | "screenshot"
  | "document_hash"
  | "validation_signature"
  | "guard_snapshot"
  | "policy_snapshot"
  | "human_approval"
  | "system_log";

/**
 * Niveau de risque associé à un événement.
 */
export type GlobalTraceRiskLevel = "low" | "medium" | "high" | "critical";

// ── Structures de données ────────────────────────────────────────────────────

/**
 * Métadonnées d'un événement — ne doit PAS contenir de données sensibles brutes.
 * Les clés sensibles sont automatiquement redactées.
 */
export interface GlobalTraceEventMetadata {
  [key: string]: string | number | boolean | null | string[] | undefined;
}

/**
 * Acteur responsable d'un événement.
 */
export interface GlobalTraceActor {
  actor_type: GlobalTraceActorType;
  actor_id: string;
  actor_label: string;
  employee_slug?: GlobalTraceEmployeeSlug;
  is_human: boolean;
  is_ai: boolean;
  is_system: boolean;
}

/**
 * Référence à une technologie CloneStore impliquée dans l'événement.
 */
export interface GlobalTraceTechnologyRef {
  technology_key: GlobalTraceTechnologyKey;
  version?: string;
  decision?: string;
}

/**
 * Entité liée à un événement.
 */
export interface GlobalTraceRelatedEntity {
  entity_type: GlobalTraceRelatedEntityType;
  entity_id: string;
  entity_label?: string;
}

/**
 * Preuve attachée à un événement.
 */
export interface GlobalTraceProofRef {
  proof_type: GlobalTraceProofType;
  proof_id: string;
  proof_label?: string;
  attached_at: string;
}

/**
 * Référence à une décision CloneGuard dans l'événement.
 */
export interface GlobalTraceGuardDecisionRef {
  decision: "allow" | "prepare_only" | "require_validation" | "block" | "refuse";
  action_type: string;
  risk_level: GlobalTraceRiskLevel;
  rule_ids_matched: string[];
  evaluated_at: string;
}

/**
 * Référence à une validation humaine dans l'événement.
 */
export interface GlobalTraceValidationRef {
  validation_id: string;
  requested_from: string[];
  status: "pending" | "approved" | "rejected";
  responded_at?: string;
  responder_id?: string;
}

/**
 * Événement d'audit immuable.
 * Un événement créé ne peut jamais être supprimé ni modifié.
 */
export interface GlobalTraceEvent {
  event_id: GlobalTraceEventId;
  timeline_id: GlobalTraceTimelineId;
  company_id: GlobalTraceCompanyId;
  event_type: GlobalTraceEventType;
  severity: GlobalTraceSeverity;
  status: GlobalTraceStatus;
  visibility: GlobalTraceVisibility;
  source: GlobalTraceSource;
  actor: GlobalTraceActor;
  summary: string;                          // Résumé non sensible
  description?: string;                     // Optionnel — non sensible
  metadata: GlobalTraceEventMetadata;       // Redacté automatiquement
  related_entities: GlobalTraceRelatedEntity[];
  technology_refs: GlobalTraceTechnologyRef[];
  proof_refs: GlobalTraceProofRef[];
  guard_decision?: GlobalTraceGuardDecisionRef;
  validation_ref?: GlobalTraceValidationRef;
  risk_level: GlobalTraceRiskLevel;
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  session_id?: GlobalTraceSessionId;
  parent_event_id?: GlobalTraceEventId;     // Chaînage d'événements
  employee_slug?: GlobalTraceEmployeeSlug;
  created_at: string;
  immutable: true;                          // Toujours true — jamais modifiable
  is_demo: boolean;
  tags: string[];
}

/**
 * Timeline d'audit complète pour une entreprise.
 * Contient tous les événements dans l'ordre chronologique.
 */
export interface GlobalTraceTimeline {
  timeline_id: GlobalTraceTimelineId;
  company_id: GlobalTraceCompanyId;
  events: GlobalTraceEvent[];
  event_count: number;
  first_event_at?: string;
  last_event_at?: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Filtre pour la recherche d'événements dans la timeline.
 */
export interface GlobalTraceTimelineFilter {
  event_types?: GlobalTraceEventType[];
  severity?: GlobalTraceSeverity[];
  status?: GlobalTraceStatus[];
  actor_types?: GlobalTraceActorType[];
  employee_slugs?: GlobalTraceEmployeeSlug[];
  risk_levels?: GlobalTraceRiskLevel[];
  source?: GlobalTraceSource[];
  since?: string;                           // ISO datetime
  until?: string;                           // ISO datetime
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Snapshot immédiat de la santé de la timeline.
 */
export interface GlobalTraceSnapshot {
  timeline_id: GlobalTraceTimelineId;
  company_id: GlobalTraceCompanyId;
  event_count: number;
  events_by_severity: Record<GlobalTraceSeverity, number>;
  events_by_type: Partial<Record<GlobalTraceEventType, number>>;
  events_by_status: Record<GlobalTraceStatus, number>;
  events_by_actor: Record<GlobalTraceActorType, number>;
  critical_count: number;
  error_count: number;
  blocked_count: number;
  refused_count: number;
  validation_pending_count: number;
  last_critical_event?: GlobalTraceEvent;
  last_event?: GlobalTraceEvent;
  health_score: number;                     // 0–100
  health_status: "healthy" | "degraded" | "critical" | "empty";
  is_demo: boolean;
  snapshot_at: string;
}

/**
 * Issue de validation d'un événement ou d'une timeline.
 */
export interface GlobalTraceValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

/**
 * Rapport de validation d'une timeline ou d'un ensemble d'événements.
 */
export interface GlobalTraceValidationReport {
  ok: boolean;
  errors: GlobalTraceValidationIssue[];
  warnings: GlobalTraceValidationIssue[];
  event_count: number;
  checked_at: string;
}

/**
 * Profil d'accès trace d'un employé IA.
 * Définit ce qu'un employé peut créer/lire dans la trace globale.
 */
export interface GlobalTraceEmployeeAccessProfile {
  employee_slug: GlobalTraceEmployeeSlug;
  can_create_events: boolean;
  can_read_events: boolean;
  can_read_admin_only: boolean;
  allowed_event_types: GlobalTraceEventType[];
  allowed_domains: string[];
  max_visibility: GlobalTraceVisibility;
  requires_trace_for_actions: string[];     // Actions qui exigent une trace
  can_delete_events: false;                 // Toujours false — jamais de suppression
}

/**
 * Input pour le bridge Guard → Trace.
 */
export interface GlobalGuardTraceInput {
  company_id: GlobalTraceCompanyId;
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

/**
 * Input pour le bridge Pierre → Trace.
 */
export interface GlobalPierreTraceInput {
  company_id: GlobalTraceCompanyId;
  pierre_event_type: string;               // Type Pierre natif
  summary: string;
  risk_level?: GlobalTraceRiskLevel;
  mission_id?: GlobalTraceMissionId;
  task_id?: GlobalTraceTaskId;
  session_id?: GlobalTraceSessionId;
  metadata?: GlobalTraceEventMetadata;
  is_demo?: boolean;
  related_entities?: GlobalTraceRelatedEntity[];
}
