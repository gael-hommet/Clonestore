// src/lib/cloneos/ai/cost-ledger/in-memory-ledger.ts
// B38C — In-memory ledger. Pure, no DB, safe for tests and fallback.
// Replaces the B38A budget-ledger.ts in-memory tracking for B38C event model.
// The B38A budget-ledger.ts is kept intact — this is a separate, richer implementation.

import type {
  AiCostLedger,
  AiCostLedgerEvent,
  AiCostLedgerWriteInput,
  AiCostLedgerQuery,
  AiCostLedgerConfig,
  AiCostLedgerEventStatus,
} from "./types";
import { redactSensitiveMetadata, filterEvents, aggregateCostSummary, computeRemainingBudget } from "./summaries";
import { getAiCostLedgerConfig } from "./config";

// ── ID generator ──────────────────────────────────────────────────────────────

let _counter = 0;

function generateEventId(): string {
  return `b38c_${Date.now()}_${++_counter}`;
}

// ── Event builder ─────────────────────────────────────────────────────────────

function buildEvent(
  input: AiCostLedgerWriteInput,
  status: AiCostLedgerEventStatus,
  config: AiCostLedgerConfig,
): AiCostLedgerEvent {
  const rawMetadata = input.metadata ?? {};
  const metadata = config.redact_metadata
    ? redactSensitiveMetadata(rawMetadata)
    : rawMetadata;

  const inputTokens = input.input_tokens ?? 0;
  const outputTokens = input.output_tokens ?? 0;

  return {
    id: generateEventId(),
    organization_id: input.organization_id ?? null,
    company_id: input.company_id,
    user_id: input.user_id,
    agent_slug: input.agent_slug,
    employee_slug: input.employee_slug ?? null,
    mission_id: input.mission_id ?? null,
    task_id: input.task_id ?? null,
    request_id: input.request_id ?? null,
    provider: input.provider,
    model: input.model,
    model_profile: input.model_profile ?? null,
    use_case: input.use_case,
    access_level: input.access_level,
    cost_shield_decision_status: input.cost_shield_decision_status ?? null,
    status,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    estimated_cost_cents: Math.max(0, input.estimated_cost_cents),
    actual_cost_cents: Math.max(0, input.actual_cost_cents ?? 0),
    currency: input.currency ?? "USD",
    is_live: input.is_live ?? false,
    is_demo: input.is_demo ?? false,
    is_public: input.is_public ?? false,
    is_paid_customer: input.is_paid_customer ?? false,
    metadata,
    created_at: new Date().toISOString(),
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createInMemoryAiCostLedger(
  configOverride?: Partial<AiCostLedgerConfig>,
): AiCostLedger {
  const config: AiCostLedgerConfig = {
    ...getAiCostLedgerConfig(),
    ...configOverride,
  };

  const events: AiCostLedgerEvent[] = [];

  return {
    async recordEstimated(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildEvent(input, "estimated", config);
      events.push(event);
      return event;
    },

    async recordActual(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildEvent(input, "actual", config);
      events.push(event);
      return event;
    },

    async recordBlocked(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildEvent(input, "blocked", config);
      events.push(event);
      return event;
    },

    async listEvents(query: AiCostLedgerQuery): Promise<AiCostLedgerEvent[]> {
      return filterEvents(events, query);
    },

    async summarize(query: AiCostLedgerQuery) {
      const filtered = filterEvents(events, { ...query, limit: undefined });
      return aggregateCostSummary(
        filtered,
        query,
        query.daily_cap_cents ?? config.daily_global_cap_cents,
        query.monthly_cap_cents ?? config.monthly_global_cap_cents,
      );
    },

    async getRemainingBudget(query: AiCostLedgerQuery) {
      const filtered = filterEvents(events, { ...query, limit: undefined, status: undefined });
      return computeRemainingBudget(
        filtered,
        query.daily_cap_cents ?? config.daily_global_cap_cents,
        query.monthly_cap_cents ?? config.monthly_global_cap_cents,
      );
    },
  };
}

// ── No-op ledger (for disabled mode) ─────────────────────────────────────────

export function createNoOpAiCostLedger(): AiCostLedger {
  const emptyEvent: AiCostLedgerEvent = {
    id: "noop",
    organization_id: null,
    company_id: null,
    user_id: null,
    agent_slug: "noop",
    employee_slug: null,
    mission_id: null,
    task_id: null,
    request_id: null,
    provider: "mock",
    model: "mock",
    model_profile: null,
    use_case: "noop",
    access_level: "internal_admin",
    cost_shield_decision_status: null,
    status: "blocked",
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_cents: 0,
    actual_cost_cents: 0,
    currency: "USD",
    is_live: false,
    is_demo: false,
    is_public: false,
    is_paid_customer: false,
    metadata: {},
    created_at: new Date().toISOString(),
  };

  return {
    async recordEstimated(_input) { return emptyEvent; },
    async recordActual(_input) { return emptyEvent; },
    async recordBlocked(_input) { return emptyEvent; },
    async listEvents(_query) { return []; },
    async summarize(query) {
      const now = new Date().toISOString();
      return {
        scope: "disabled",
        organization_id: null, company_id: null, user_id: null, agent_slug: null,
        period_start: now, period_end: now,
        estimated_cost_cents: 0, actual_cost_cents: 0,
        blocked_count: 0, request_count: 0, live_request_count: 0, premium_request_count: 0,
        remaining_daily_cents: query.daily_cap_cents ?? 300,
        remaining_monthly_cents: query.monthly_cap_cents ?? 1000,
      };
    },
    async getRemainingBudget(query) {
      return {
        daily_remaining_cents: query.daily_cap_cents ?? 300,
        monthly_remaining_cents: query.monthly_cap_cents ?? 1000,
      };
    },
  };
}
