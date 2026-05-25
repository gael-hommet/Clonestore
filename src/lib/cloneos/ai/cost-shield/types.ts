// src/lib/cloneos/ai/cost-shield/types.ts
// B38A — AI Cost Shield types. Pure, no async, no DB.
// Protects CloneStore against uncontrolled AI consumption from non-paying users.

// ── Shield operating mode ─────────────────────────────────────────────────────

export type AiCostShieldMode =
  | "disabled"   // No enforcement — passes all through (dev only)
  | "observe"    // Evaluates but never blocks — logs warnings
  | "enforce";   // Full enforcement — blocks non-paying users

// ── Commercial access levels ──────────────────────────────────────────────────

export type AiCommercialAccessLevel =
  | "anonymous"           // Not logged in — 0€ AI, static demo only
  | "public_demo"         // Marketing demo — 0€ AI, static only
  | "logged_unpaid"       // Registered but not subscribed — 0€ AI, mock only
  | "qualified_prospect"  // Sales-qualified lead — very low budget, mostly mock
  | "trial_limited"       // Trial (disabled for now — no open-bar 7-day trial)
  | "paid_customer"       // Active subscriber — real AI within budget
  | "internal_admin";     // Internal validation (B38B) — real AI within global cap

// ── Provider identifiers (B38A scope) ────────────────────────────────────────

export type AiCostShieldProvider = "openai" | "anthropic" | "mock";

// ── Decision status codes ─────────────────────────────────────────────────────

export type AiCostShieldDecisionStatus =
  | "allow"                    // Full real AI call permitted
  | "allow_mock_only"          // Allow but force mock provider
  | "allow_static_demo"        // Allow but serve static demo content
  | "block_not_paid"           // Blocked — user is not a paying customer
  | "block_budget_exceeded"    // Blocked — budget cap reached
  | "block_global_cap"         // Blocked — global daily/monthly cap hit
  | "block_model_disabled"     // Blocked — requested model not available
  | "block_provider_disabled"  // Blocked — provider (e.g. Anthropic) disabled
  | "block_emergency_shutdown" // Blocked — kill switch active
  | "block_invalid_context"    // Blocked — missing required context (company_id)
  | "require_human_approval";  // Hold — needs explicit approval before proceeding

// ── Inbound shield request ────────────────────────────────────────────────────

export type AiCostShieldRequest = {
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  employee_slug: string | null;
  mission_id: string | null;
  task_id: string | null;
  access_level: AiCommercialAccessLevel;
  provider: AiCostShieldProvider;
  model: string;
  use_case: string;
  input_token_estimate: number;
  max_output_tokens: number;
  estimated_cost_cents: number;
  is_client_visible: boolean;
  is_demo: boolean;
  is_public: boolean;
  is_paid_customer: boolean;
  requires_premium_model: boolean;
  requested_at: string;
  metadata: Record<string, unknown>;
};

// ── Decision returned by the shield ──────────────────────────────────────────

export type AiCostShieldDecision = {
  status: AiCostShieldDecisionStatus;
  allowed: boolean;
  runtime_mode: AiCostShieldMode;
  provider: AiCostShieldProvider;
  model: string;
  estimated_cost_cents: number;
  remaining_budget_cents: number;
  reason: string;
  user_message: string;
  internal_code: string;
  should_log: boolean;
  fallback_to_mock: boolean;
  fallback_to_static_demo: boolean;
  requires_approval: boolean;
};

// ── Budget scope keys ─────────────────────────────────────────────────────────

export type AiBudgetScopeKind =
  | "global_daily"
  | "global_monthly"
  | "company_daily"
  | "company_monthly"
  | "user_daily"
  | "user_monthly"
  | "mission"
  | "task"
  | "model_daily"
  | "premium_model_daily";

// ── Budget ledger entry ───────────────────────────────────────────────────────

export type AiBudgetLedgerEntry = {
  id: string;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  provider: AiCostShieldProvider;
  model: string;
  use_case: string;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  input_tokens: number;
  output_tokens: number;
  status: "estimated" | "actual" | "blocked" | "mock";
  decision_status: AiCostShieldDecisionStatus;
  created_at: string;
  metadata: Record<string, unknown>;
};

// ── Budget snapshot for scope enforcement ─────────────────────────────────────

export type AiBudgetSnapshot = {
  scope: AiBudgetScopeKind;
  key: string;
  used_cents: number;
  max_cents: number;
  remaining_cents: number;
  exceeded: boolean;
};

// ── Context passed to the shield (optional enrichments) ───────────────────────

export type AiCostShieldContext = {
  shield_mode?: AiCostShieldMode;
  budget_snapshots?: AiBudgetSnapshot[];
  override_allow?: boolean;
};
