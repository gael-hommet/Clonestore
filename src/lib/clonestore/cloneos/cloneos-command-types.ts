// TECH-08 — CloneOS Command Center Alignment — Types
// CloneOS est le noyau opératoire global.
// CloneOS n'est pas Pierre. CloneOS n'est pas CloneChat.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type { EmployeeRuntimeContract } from "../employees/employee-runtime-contract";

// ── Identifiants ─────────────────────────────────────────────────────────────

export type CloneOSCommandId = string;
export type CloneOSMissionId = string;
export type CloneOSTaskId = string;
export type CloneOSCompanyId = string;
export type CloneOSEmployeeSlug = string;
export type CloneOSSessionId = string;

// ── Statuts ───────────────────────────────────────────────────────────────────

/**
 * Cycle de vie d'une commande CloneOS.
 */
export type CloneOSCommandStatus =
  | "received"
  | "classified"
  | "routed"
  | "planned"
  | "guarded"
  | "trace_ready"
  | "ready_for_execution"
  | "requires_validation"
  | "blocked"
  | "refused"
  | "failed";

// ── Intentions ────────────────────────────────────────────────────────────────

/**
 * Intention détectée dans la commande.
 */
export type CloneOSCommandIntent =
  | "ask_information"
  | "create_document"
  | "prepare_email"
  | "send_email"
  | "create_task"
  | "update_memory"
  | "analyze_file"
  | "plan_followup"
  | "hr_operation"
  | "support_operation"
  | "finance_operation"
  | "admin_operation"
  | "unknown";

// ── Domaines ──────────────────────────────────────────────────────────────────

/**
 * Domaine métier de la commande.
 */
export type CloneOSCommandDomain =
  | "hr"
  | "support"
  | "finance"
  | "admin"
  | "legal"
  | "sales"
  | "marketing"
  | "ops"
  | "engineering"
  | "general"
  | "unknown";

// ── Priorité ──────────────────────────────────────────────────────────────────

export type CloneOSCommandPriority = "low" | "normal" | "high" | "urgent";

// ── Risque ────────────────────────────────────────────────────────────────────

export type CloneOSCommandRiskLevel = "low" | "medium" | "high" | "critical";

// ── Source ────────────────────────────────────────────────────────────────────

/**
 * D'où vient la commande.
 */
export type CloneOSCommandSource =
  | "clonechat"
  | "employee_page"
  | "pierre_cockpit"
  | "profile_command_center"
  | "api"
  | "system";

// ── Acteur ────────────────────────────────────────────────────────────────────

export interface CloneOSCommandActor {
  actor_type: "human_user" | "system" | "api";
  user_id?: string;
  user_label?: string;
  company_id: CloneOSCompanyId;
}

// ── Input ─────────────────────────────────────────────────────────────────────

/**
 * Entrée brute d'une commande CloneOS.
 */
export interface CloneOSCommandInput {
  command_id?: CloneOSCommandId;
  company_id: CloneOSCompanyId;
  user_id?: string;
  source: CloneOSCommandSource;
  raw_request: string;
  preferred_employee_slug?: CloneOSEmployeeSlug;
  attached_file_refs: string[];
  metadata: Record<string, string | number | boolean | null>;
  created_at?: string;
  is_demo?: boolean;
  session_id?: CloneOSSessionId;
}

// ── Classified Command ────────────────────────────────────────────────────────

/**
 * Commande après classification heuristique.
 */
export interface CloneOSClassifiedCommand {
  command_id: CloneOSCommandId;
  domain: CloneOSCommandDomain;
  intent: CloneOSCommandIntent;
  priority: CloneOSCommandPriority;
  risk_level: CloneOSCommandRiskLevel;
  summary: string;
  extracted_entities: Record<string, string>;
  requires_employee: boolean;
  candidate_employee_slugs: CloneOSEmployeeSlug[];
  confidence: number;                    // 0.0 → 1.0
  classification_notes: string[];
}

// ── Employee Route ────────────────────────────────────────────────────────────

/**
 * Résultat du routage vers un employé IA.
 */
export interface CloneOSEmployeeRoute {
  employee_slug: CloneOSEmployeeSlug;
  employee_display_name: string;
  domain: CloneOSCommandDomain;
  route_reason: string;
  is_available: boolean;
  readiness_status: "ready" | "partially_ready" | "not_ready" | "no_employee";
  hard_required_technologies: string[];
  soft_required_technologies: string[];
  missing_required_technologies: string[];
  confidence: number;
  route_warnings: string[];
}

// ── Command Context ───────────────────────────────────────────────────────────

/**
 * Contexte enrichi pour exécuter la commande.
 * Agrège Employee Contract + GlobalTechConfig + CloneADN + CloneGuard + CloneTrace.
 */
export interface CloneOSCommandContext {
  command_id: CloneOSCommandId;
  company_id: CloneOSCompanyId;
  selected_employee_slug?: CloneOSEmployeeSlug;
  employee_contract?: EmployeeRuntimeContract;
  technology_context: CloneOSTechnologyContext;
  enterprise_memory_context: CloneOSEnterpriseMemoryContext;
  guard_context: CloneOSGuardContext;
  trace_timeline_id?: string;
  context_warnings: string[];
}

export interface CloneOSTechnologyContext {
  required_tech_slugs: string[];
  available_tech_slugs: string[];
  missing_required: string[];
  tech_readiness_summary: Record<string, number>;
}

export interface CloneOSEnterpriseMemoryContext {
  company_name: string;
  language: string;
  timezone: string;
  default_tone: string;
  active_rules: string[];
  has_enterprise_memory: boolean;
}

export interface CloneOSGuardContext {
  guard_available: boolean;
  absolute_blocked_actions: string[];
  always_validation_required: string[];
  policy_rules_count: number;
}

// ── Task Plan ─────────────────────────────────────────────────────────────────

export interface CloneOSTaskPlan {
  task_id: CloneOSTaskId;
  title: string;
  description: string;
  action_type: string;              // Compatible avec GlobalGuardActionType
  risk_level: CloneOSCommandRiskLevel;
  requires_validation: boolean;
  can_auto_execute: boolean;
  order: number;
  depends_on_task_ids: CloneOSTaskId[];
  expected_artifact_type?: string;
}

// ── Mission Plan ──────────────────────────────────────────────────────────────

export interface CloneOSMissionPlan {
  mission_id: CloneOSMissionId;
  title: string;
  description: string;
  employee_slug: CloneOSEmployeeSlug;
  domain: CloneOSCommandDomain;
  intent: CloneOSCommandIntent;
  priority: CloneOSCommandPriority;
  risk_level: CloneOSCommandRiskLevel;
  tasks: CloneOSTaskPlan[];
  missing_information: string[];
  validation_required: boolean;
  expected_outputs: string[];
  plan_notes: string[];
}

// ── Guard Result ──────────────────────────────────────────────────────────────

export interface CloneOSTaskGuardResult {
  task_id: CloneOSTaskId;
  action_type: string;
  decision: "allow" | "prepare_only" | "require_validation" | "block" | "refuse";
  rule_ids_matched: string[];
  requires_human_validation: boolean;
  can_execute: boolean;
  notes: string[];
}

export interface CloneOSCommandGuardResult {
  overall_decision: "allow" | "prepare_only" | "require_validation" | "block" | "refused";
  task_results: CloneOSTaskGuardResult[];
  has_blocked_tasks: boolean;
  has_refused_tasks: boolean;
  has_validation_required_tasks: boolean;
  critical_action_count: number;
  evaluated_at: string;
}

// ── Trace Result ──────────────────────────────────────────────────────────────

export interface CloneOSCommandTraceResult {
  timeline_id: string;
  event_count: number;
  event_ids: string[];
  trace_ready: boolean;
  trace_notes: string[];
}

// ── Command Plan ──────────────────────────────────────────────────────────────

/**
 * Plan complet issu du pipeline CloneOS.
 * N'exécute rien — plan seulement.
 */
export interface CloneOSCommandPlan {
  command_id: CloneOSCommandId;
  mission_plan?: CloneOSMissionPlan;
  guard_result?: CloneOSCommandGuardResult;
  trace_result?: CloneOSCommandTraceResult;
  final_status: CloneOSCommandStatus;
  next_action: string;
  plan_notes: string[];
}

// ── Center Result ─────────────────────────────────────────────────────────────

/**
 * Résultat complet du pipeline CloneOS Command Center.
 */
export interface CloneOSCommandCenterResult {
  ok: boolean;
  status: CloneOSCommandStatus;
  command_id: CloneOSCommandId;
  classified_command?: CloneOSClassifiedCommand;
  selected_route?: CloneOSEmployeeRoute;
  context?: CloneOSCommandContext;
  mission_plan?: CloneOSMissionPlan;
  guard_result?: CloneOSCommandGuardResult;
  trace_result?: CloneOSCommandTraceResult;
  errors: string[];
  warnings: string[];
  next_action: string;
  generated_at: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface CloneOSCommandValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CloneOSCommandValidationReport {
  ok: boolean;
  errors: CloneOSCommandValidationIssue[];
  warnings: CloneOSCommandValidationIssue[];
  checked_at: string;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface CloneOSCommandSnapshot {
  total_commands: number;
  by_status: Record<CloneOSCommandStatus, number>;
  by_domain: Partial<Record<CloneOSCommandDomain, number>>;
  by_employee: Record<string, number>;
  by_risk: Record<CloneOSCommandRiskLevel, number>;
  validation_needed_count: number;
  blocked_count: number;
  refused_count: number;
  health_score: number;
  health_status: "healthy" | "degraded" | "critical" | "empty";
  generated_at: string;
}
