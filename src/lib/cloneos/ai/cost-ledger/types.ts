// src/lib/cloneos/ai/cost-ledger/types.ts
// B38C — Persistent AI cost ledger types. Pure, no async, no DB.
// Companion to B38A cost-shield. Adds persistence, auditability, filtering.

// ── Provider ──────────────────────────────────────────────────────────────────

export type AiCostLedgerProvider =
  | "memory"     // In-memory only (default, safe for dev/test)
  | "supabase"   // Supabase table cloneos_ai_cost_events
  | "disabled";  // No-op — no events recorded

// ── Write mode ────────────────────────────────────────────────────────────────

export type AiCostLedgerWriteMode =
  | "memory"     // Write to memory only
  | "supabase"   // Write to Supabase (with memory fallback on error)
  | "dual_write" // Write to both
  | "disabled";  // No writes

// ── Event status ──────────────────────────────────────────────────────────────

export type AiCostLedgerEventStatus =
  | "estimated"  // Cost estimated before actual call
  | "actual"     // Actual cost confirmed after call
  | "blocked"    // Call was blocked by cost shield
  | "failed"     // Call attempted but errored
  | "refunded"   // Cost refunded (e.g. provider error credited back)
  | "adjusted";  // Manual correction

// ── Cost event ────────────────────────────────────────────────────────────────

export type AiCostLedgerEvent = {
  id: string;
  organization_id: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  employee_slug: string | null;
  mission_id: string | null;
  task_id: string | null;
  request_id: string | null;
  provider: string;
  model: string;
  model_profile: string | null;
  use_case: string;
  access_level: string;
  cost_shield_decision_status: string | null; // AiCostShieldDecisionStatus
  status: AiCostLedgerEventStatus;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  currency: string; // "USD" (costs in USD cents, convert to EUR for display)
  is_live: boolean;
  is_demo: boolean;
  is_public: boolean;
  is_paid_customer: boolean;
  metadata: Record<string, unknown>; // redacted of prompts/completions
  created_at: string; // ISO 8601
};

// ── Budget policy (for reference/SQL) ────────────────────────────────────────

export type AiBudgetPolicy = {
  id: string;
  organization_id: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string | null;
  provider: string | null;
  model: string | null;
  scope: string;
  daily_cap_cents: number | null;
  monthly_cap_cents: number | null;
  mission_cap_cents: number | null;
  premium_cap_cents: number | null;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ── Cost summary ──────────────────────────────────────────────────────────────

export type AiCostSummary = {
  scope: string;
  organization_id: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string | null;
  period_start: string;
  period_end: string;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  blocked_count: number;
  request_count: number;
  live_request_count: number;
  premium_request_count: number;
  remaining_daily_cents: number;
  remaining_monthly_cents: number;
};

// ── Write input (id and created_at are auto-set by ledger) ───────────────────

export type AiCostLedgerWriteInput = {
  organization_id?: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  employee_slug?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  request_id?: string | null;
  provider: string;
  model: string;
  model_profile?: string | null;
  use_case: string;
  access_level: string;
  cost_shield_decision_status?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_cents: number;
  actual_cost_cents?: number;
  currency?: string;
  is_live?: boolean;
  is_demo?: boolean;
  is_public?: boolean;
  is_paid_customer?: boolean;
  metadata?: Record<string, unknown>;
};

// ── Query filters ─────────────────────────────────────────────────────────────

export type AiCostLedgerQuery = {
  organization_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  agent_slug?: string;
  provider?: string;
  model?: string;
  use_case?: string;
  status?: AiCostLedgerEventStatus | AiCostLedgerEventStatus[];
  from?: string;  // ISO date string (inclusive)
  to?: string;    // ISO date string (inclusive)
  limit?: number;
  daily_cap_cents?: number;
  monthly_cap_cents?: number;
};

// ── Ledger interface ──────────────────────────────────────────────────────────

export type AiCostLedger = {
  recordEstimated(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent>;
  recordActual(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent>;
  recordBlocked(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent>;
  listEvents(query: AiCostLedgerQuery): Promise<AiCostLedgerEvent[]>;
  summarize(query: AiCostLedgerQuery): Promise<AiCostSummary>;
  getRemainingBudget(query: AiCostLedgerQuery): Promise<{
    daily_remaining_cents: number;
    monthly_remaining_cents: number;
  }>;
};

// ── Ledger config ─────────────────────────────────────────────────────────────

export type AiCostLedgerConfig = {
  provider: AiCostLedgerProvider;
  write_mode: AiCostLedgerWriteMode;
  supabase_enabled: boolean;
  fail_closed: boolean;
  log_metadata: boolean;
  redact_metadata: boolean;
  daily_global_cap_cents: number;
  monthly_global_cap_cents: number;
};

// ── Minimal DB client interface (for Supabase injection / testing) ─────────────

export type AiLedgerDbSelectBuilder = {
  eq(col: string, val: unknown): AiLedgerDbSelectBuilder;
  gte(col: string, val: unknown): AiLedgerDbSelectBuilder;
  lte(col: string, val: unknown): AiLedgerDbSelectBuilder;
  in(col: string, vals: unknown[]): AiLedgerDbSelectBuilder;
  order(col: string, opts?: { ascending?: boolean }): AiLedgerDbSelectBuilder;
  limit(n: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
};

export type AiLedgerDbClient = {
  from(table: string): {
    insert(data: object[]): Promise<{ data: unknown; error: { message: string } | null }>;
    select(columns?: string): AiLedgerDbSelectBuilder;
  };
};
