// TECH-09 — CloneBrief Executive Summaries — Types
// CloneBrief est la couche de synthèse exécutive de CloneStore.
// CloneBrief n'est pas un employé IA. CloneBrief n'est pas CloneChat.
// CloneBrief consomme CloneTrace + CloneADN + CloneOS + CloneGuard.
// Elle ne génère aucune action. Elle ne modifie aucune DB.
// Pure types: no async, no Supabase, no Next.js, no side effects.

import type { GlobalTraceTimeline, GlobalTraceEvent } from "../trace/global-trace-types";
import type { GlobalEnterpriseMemory } from "../adn/global-enterprise-memory";
import type { CloneOSCommandCenterResult } from "../cloneos/cloneos-command-types";

// ── Identifiants ──────────────────────────────────────────────────────────────

export type CloneBriefId = string;              // "brief_<timestamp>_<rand>"
export type CloneBriefCompanyId = string;       // identique à CloneOS/Trace company_id
export type CloneBriefEmployeeSlug = string;    // "pierre" / "unknown"

// ── Enums / Union types ───────────────────────────────────────────────────────

/**
 * Type de briefing — définit le périmètre de synthèse.
 */
export type CloneBriefType =
  | "daily"           // Résumé du jour
  | "weekly"          // Résumé hebdomadaire
  | "monthly"         // Résumé mensuel
  | "mission"         // Résumé d'une mission précise
  | "employee"        // Résumé centré sur un employé IA
  | "risk"            // Briefing risques uniquement
  | "validation"      // Briefing validations en attente
  | "incident"        // Briefing incident / alerte
  | "executive";      // Synthèse dirigeant complète

/**
 * Audience cible du briefing.
 */
export type CloneBriefAudience =
  | "founder"         // Fondateur / dirigeant
  | "manager"         // Manager / responsable
  | "admin"           // Administrateur plateforme
  | "employee_owner"  // Propriétaire de l'employé IA
  | "internal";       // Usage interne CloneStore

/**
 * Statut du briefing généré.
 */
export type CloneBriefStatus =
  | "draft"           // En cours de génération
  | "ready"           // Prêt — contenu disponible
  | "empty"           // Aucune activité à synthétiser
  | "partial"         // Partiellement généré (sources incomplètes)
  | "blocked"         // Bloqué — sources inaccessibles
  | "failed";         // Échec de génération

/**
 * Sévérité d'un élément du briefing.
 */
export type CloneBriefSeverity =
  | "info"            // Information neutre
  | "success"         // Action réussie
  | "warning"         // Point d'attention
  | "risk"            // Risque identifié
  | "critical";       // Situation critique

/**
 * Priorité d'un élément ou section.
 */
export type CloneBriefPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

/**
 * Types de sections d'un briefing.
 */
export type CloneBriefSectionType =
  | "overview"                // Vue d'ensemble
  | "completed_actions"       // Actions terminées
  | "pending_actions"         // Actions en attente
  | "blocked_actions"         // Actions bloquées
  | "validations_required"    // Validations humaines requises
  | "risks"                   // Risques identifiés
  | "employee_activity"       // Activité par employé IA
  | "technology_activity"     // Activité par technologie
  | "next_steps"              // Prochaines étapes
  | "attention_points"        // Points nécessitant attention
  | "system_health";          // Santé du système

/**
 * Source d'une donnée dans le briefing.
 */
export type CloneBriefSourceType =
  | "clonetrace"         // Provient d'un événement CloneTrace
  | "cloneos"            // Provient d'un résultat CloneOS
  | "cloneguard"         // Provient d'une décision CloneGuard
  | "cloneadn"           // Provient de la mémoire CloneADN
  | "employee_runtime"   // Provient du contrat employé
  | "system";            // Généré par le système CloneBrief

/**
 * Statut d'une action dans le briefing.
 */
export type CloneBriefActionStatus =
  | "completed"
  | "in_progress"
  | "pending"
  | "blocked"
  | "refused"
  | "requires_validation"
  | "cancelled"
  | "planned";

// ── Structures de données ─────────────────────────────────────────────────────

/**
 * Référence à une source de données utilisée dans le briefing.
 */
export interface CloneBriefSourceRef {
  source_type: CloneBriefSourceType;
  source_id: string;
  source_label: string;
  created_at: string;
}

/**
 * Métrique clé du briefing.
 */
export interface CloneBriefMetric {
  metric_id: string;
  label: string;
  value: number | string;
  unit?: string;
  severity: CloneBriefSeverity;
  source_ref?: CloneBriefSourceRef;
}

/**
 * Élément d'action dans le briefing.
 */
export interface CloneBriefActionItem {
  item_id: string;
  title: string;
  description: string;
  status: CloneBriefActionStatus;
  priority: CloneBriefPriority;
  severity: CloneBriefSeverity;
  employee_slug?: CloneBriefEmployeeSlug;
  mission_id?: string;
  task_id?: string;
  due_at?: string;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Élément de risque dans le briefing.
 */
export interface CloneBriefRiskItem {
  item_id: string;
  title: string;
  description: string;
  severity: CloneBriefSeverity;
  priority: CloneBriefPriority;
  risk_level: "low" | "medium" | "high" | "critical";
  employee_slug?: CloneBriefEmployeeSlug;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Élément de validation en attente dans le briefing.
 */
export interface CloneBriefValidationItem {
  item_id: string;
  title: string;
  description: string;
  priority: CloneBriefPriority;
  requested_at: string;
  requested_from: string[];
  employee_slug?: CloneBriefEmployeeSlug;
  mission_id?: string;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Élément bloqué dans le briefing.
 */
export interface CloneBriefBlockedItem {
  item_id: string;
  title: string;
  description: string;
  block_reason: string;
  severity: CloneBriefSeverity;
  is_absolute_refusal: boolean;
  employee_slug?: CloneBriefEmployeeSlug;
  action_type?: string;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Synthèse d'activité d'un employé IA.
 */
export interface CloneBriefEmployeeSummary {
  employee_slug: CloneBriefEmployeeSlug;
  display_name: string;
  domain: string;
  total_events: number;
  completed_actions: number;
  blocked_actions: number;
  refused_actions: number;
  pending_validations: number;
  last_activity_at?: string;
  health_score: number;
  activity_summary: string;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Synthèse d'activité d'une technologie.
 */
export interface CloneBriefTechnologySummary {
  technology_key: string;
  display_name: string;
  event_count: number;
  decision_summary?: string;
  health_score: number;
  source_refs: CloneBriefSourceRef[];
}

/**
 * Section d'un briefing.
 */
export interface CloneBriefSection {
  section_id: string;
  type: CloneBriefSectionType;
  title: string;
  summary: string;
  priority: CloneBriefPriority;
  severity: CloneBriefSeverity;
  items: (CloneBriefActionItem | CloneBriefRiskItem | CloneBriefValidationItem | CloneBriefBlockedItem)[];
  source_refs: CloneBriefSourceRef[];
  is_empty: boolean;
}

/**
 * Période couverte par le briefing.
 */
export interface CloneBriefPeriod {
  from: string;   // ISO date
  to: string;     // ISO date
  label: string;  // "Aujourd'hui", "Cette semaine", "Janvier 2026", etc.
  type: "day" | "week" | "month" | "custom" | "mission";
}

/**
 * Résumé exécutif complet — produit final de CloneBrief.
 * Ne contient aucune donnée inventée. Synthèse uniquement.
 */
export interface CloneBriefExecutiveSummary {
  brief_id: CloneBriefId;
  company_id: CloneBriefCompanyId;
  brief_type: CloneBriefType;
  period: CloneBriefPeriod;
  audience: CloneBriefAudience;
  status: CloneBriefStatus;
  title: string;
  executive_summary: string;
  key_metrics: CloneBriefMetric[];
  sections: CloneBriefSection[];
  action_items: CloneBriefActionItem[];
  risk_items: CloneBriefRiskItem[];
  validation_items: CloneBriefValidationItem[];
  blocked_items: CloneBriefBlockedItem[];
  employee_summaries: CloneBriefEmployeeSummary[];
  technology_summaries: CloneBriefTechnologySummary[];
  source_refs: CloneBriefSourceRef[];
  generated_at: string;
  is_demo: boolean;
  warnings: string[];
}

// ── Input de génération ───────────────────────────────────────────────────────

/**
 * Input pour générer un briefing.
 * Agrège les sources de données disponibles.
 */
export interface CloneBriefGenerationInput {
  company_id: CloneBriefCompanyId;
  brief_type: CloneBriefType;
  audience: CloneBriefAudience;
  period?: CloneBriefPeriod;
  trace_timeline?: GlobalTraceTimeline;
  trace_events?: GlobalTraceEvent[];
  command_results?: CloneOSCommandCenterResult[];
  enterprise_memory?: GlobalEnterpriseMemory;
  employee_slug_filter?: CloneBriefEmployeeSlug;
  mission_id_filter?: string;
  include_demo_data?: boolean;
  is_demo?: boolean;
  options?: CloneBriefGenerationOptions;
}

/**
 * Options de génération du briefing.
 */
export interface CloneBriefGenerationOptions {
  max_action_items?: number;
  max_risk_items?: number;
  max_blocked_items?: number;
  include_completed?: boolean;
  include_system_events?: boolean;
  language?: string;
  show_empty_sections?: boolean;
}

/**
 * Résultat de génération CloneBrief.
 */
export interface CloneBriefGenerationResult {
  ok: boolean;
  brief: CloneBriefExecutiveSummary;
  warnings: string[];
  errors: string[];
  generation_notes: string[];
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface CloneBriefValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CloneBriefValidationReport {
  ok: boolean;
  errors: CloneBriefValidationIssue[];
  warnings: CloneBriefValidationIssue[];
  section_count: number;
  action_item_count: number;
  risk_item_count: number;
  validation_item_count: number;
  blocked_item_count: number;
  checked_at: string;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface CloneBriefSnapshot {
  total_briefs: number;
  by_status: Record<CloneBriefStatus, number>;
  by_type: Partial<Record<CloneBriefType, number>>;
  total_action_items: number;
  total_risk_items: number;
  total_validation_items: number;
  total_blocked_items: number;
  attention_needed_count: number;
  health_score: number;
  health_status: "healthy" | "degraded" | "critical" | "empty";
  generated_at: string;
}
