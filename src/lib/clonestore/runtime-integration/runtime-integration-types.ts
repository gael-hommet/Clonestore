// src/lib/clonestore/runtime-integration/runtime-integration-types.ts
// PHASE 4.1 — CloneOS / Pierre Runtime Operational Integration Foundation — Types
//
// DESIGN-ONLY / SIMULATION-ONLY. Contrats runtime entre CloneOS et Pierre.
//
// INVARIANTS ABSOLUS :
//   - execution_enabled false · plan_only true · read_only true
//   - pas de Supabase, pas d'API, pas de réseau, pas de DB write
//   - pas d'import src/lib/pierre, pas d'exécution CloneOS, pas d'appel IA
//   - scale 80k = architecture cible, NON prouvée

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationPhase = "4.1";

export type RuntimeIntegrationMode = "design_only" | "simulation";

export type RuntimeIntegrationStatus =
  | "draft"
  | "planned"
  | "awaiting_validation"
  | "ready_to_execute_later"
  | "blocked"
  | "simulated_only";

export type RuntimeIntegrationRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "sensitive"
  | "blocked";

export type RuntimeIntegrationValidationMode =
  | "none"
  | "human_review_recommended"
  | "human_validation_required"
  | "blocked";

export type RuntimeIntegrationTenantScope = {
  user_id: string | null;
  company_id: string | null;
  isolation: "strict";
};

export type RuntimeIntegrationEmployeeKey = string; // clé safe (ex: "pierre")

export type RuntimeIntegrationCommandSource =
  | "cloneos_command_center"
  | "profile_command_center"
  | "pierre_cockpit"
  | "simulation"
  | "unknown";

export type RuntimeIntegrationDomain =
  | "hr" | "support" | "finance" | "legal" | "sales"
  | "ops" | "marketing" | "data" | "general" | "unknown";

// ── Command ───────────────────────────────────────────────────────────────────

export type RuntimeIntegrationCommand = {
  command_id: string;
  source: RuntimeIntegrationCommandSource;
  user_id?: string;
  company_id?: string;
  raw_text: string;
  locale: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

// ── Intent ────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationIntent = {
  intent_id: string;
  command_id: string;
  normalized_text: string;
  requested_employee_key?: RuntimeIntegrationEmployeeKey;
  candidate_employee_keys: RuntimeIntegrationEmployeeKey[];
  domain: RuntimeIntegrationDomain;
  risk_level: RuntimeIntegrationRiskLevel;
  validation_mode: RuntimeIntegrationValidationMode;
  confidence: number;
  missing_context: string[];
  created_at: string;
  plan_only: true;
};

// ── Route ─────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationIntentRoute = {
  route_id: string;
  intent_id: string;
  employee_key: RuntimeIntegrationEmployeeKey | null;
  route_reason: string;
  route_confidence: number;
  available_capability_keys: string[];
  available_function_keys: string[];
  blocked_reason?: string;
  requires_human_validation: boolean;
  plan_only: true;
};

// ── Guard decision ────────────────────────────────────────────────────────────

export type RuntimeIntegrationGuardDecision = {
  decision: "allow_plan_only" | "require_human_validation" | "block";
  risk_level: RuntimeIntegrationRiskLevel;
  reasons: string[];
  sensitive_topics: string[];
  cloneguard_required: true;
  human_validation_required: boolean;
  bypass_allowed: false;
};

// ── Trace contract ────────────────────────────────────────────────────────────

export type RuntimeIntegrationTraceEvent = {
  event_key: string;
  label: string;
  at: string;
};

export type RuntimeIntegrationTraceContract = {
  trace_id: string;
  command_id: string;
  intent_id: string;
  route_id: string;
  employee_key: RuntimeIntegrationEmployeeKey | null;
  events: RuntimeIntegrationTraceEvent[];
  audit_required: true;
  clonetrace_required: true;
  contains_personal_data: boolean;
  retention_hint: string;
  read_only: true;
  server_write_enabled: false;
};

// ── Scale / queue / cost / idempotency ────────────────────────────────────────

export type RuntimeIntegrationScaleHint = {
  stateless_runtime_required: true;
  tenant_scoped_by: "user_id_and_company_id";
  idempotency_key_required: true;
  queue_recommended: true;
  worker_execution_later: true;
  retry_policy_required: true;
  dead_letter_required: true;
  rate_limit_required: true;
  cost_budget_required: true;
  model_routing_required: true;
  observability_required: true;
  load_test_required: true;
  scale_80k_not_proven: true;
};

export type RuntimeIntegrationQueueHint = {
  queue_name: string;
  concurrency_control_required: true;
  priority: "normal" | "high";
  retry_count_recommended: number;
  dead_letter_on_failure: true;
};

export type RuntimeIntegrationCostHint = {
  orchestration_model_tier: "cheap_or_standard";
  premium_model_only_for: string;
  avoid_premium_model_for: string;
  token_budget_required: true;
};

export type RuntimeIntegrationIdempotencyContract = {
  idempotency_key: string;
  derived_from: string;
  required: true;
};

export type RuntimeIntegrationTenantIsolationHint = {
  isolation: "strict";
  scoped_by: "user_id_and_company_id";
  cross_user_leak_forbidden: true;
  service_role_client_forbidden: true;
};

// ── Plan ──────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationPlanStep = {
  step_id: string;
  label: string;
  description: string;
  function_key?: string;
  capability_key?: string;
  risk_level: RuntimeIntegrationRiskLevel;
  validation_mode: RuntimeIntegrationValidationMode;
  requires_human_validation: boolean;
  status: RuntimeIntegrationStatus;
  plan_only: true;
  execution_enabled: false;
};

export type RuntimeIntegrationPlan = {
  plan_id: string;
  command_id: string;
  intent_id: string;
  employee_key: RuntimeIntegrationEmployeeKey | null;
  status: RuntimeIntegrationStatus;
  steps: RuntimeIntegrationPlanStep[];
  guard_decision: RuntimeIntegrationGuardDecision;
  trace_contract: RuntimeIntegrationTraceContract;
  scale_hints: RuntimeIntegrationScaleHint;
  queue_hints: RuntimeIntegrationQueueHint;
  cost_hints: RuntimeIntegrationCostHint;
  idempotency: RuntimeIntegrationIdempotencyContract;
  read_only: true;
  execution_enabled: false;
  created_at: string;
};

// ── Read result / issues / recommendations / actions ──────────────────────────

export type RuntimeIntegrationIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeIntegrationRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeIntegrationAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimeIntegrationReadResult = {
  mode: RuntimeIntegrationMode;
  command: RuntimeIntegrationCommand;
  intent: RuntimeIntegrationIntent;
  route: RuntimeIntegrationIntentRoute;
  plan: RuntimeIntegrationPlan;
  recommendations: RuntimeIntegrationRecommendation[];
  issues: RuntimeIntegrationIssue[];
  actions: RuntimeIntegrationAction[];
  read_only: true;
  execution_enabled: false;
  public_launch_external_validated: false;
};
