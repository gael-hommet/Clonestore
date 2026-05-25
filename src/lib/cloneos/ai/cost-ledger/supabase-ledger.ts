// src/lib/cloneos/ai/cost-ledger/supabase-ledger.ts
// B38C — Supabase-backed cost ledger. Accepts injected client for testability.
// Table: cloneos_ai_cost_events (see docs/sql/B38C_AI_COST_LEDGER.sql)
// Service role access required for writes (bypasses RLS).
// Falls back gracefully if fail_closed=false.

import type {
  AiCostLedger,
  AiCostLedgerEvent,
  AiCostLedgerWriteInput,
  AiCostLedgerQuery,
  AiCostLedgerConfig,
  AiCostLedgerEventStatus,
  AiLedgerDbClient,
} from "./types";
import { redactSensitiveMetadata, filterEvents, aggregateCostSummary, computeRemainingBudget } from "./summaries";
import { getAiCostLedgerConfig } from "./config";
import { AiCostLedgerWriteError } from "./errors";

const EVENTS_TABLE = "cloneos_ai_cost_events";

// ── ID generator ──────────────────────────────────────────────────────────────

let _counter = 0;

function generateEventId(): string {
  return `b38c_supa_${Date.now()}_${++_counter}`;
}

// ── Row builder ───────────────────────────────────────────────────────────────

function buildRow(
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

// ── Insert helper ─────────────────────────────────────────────────────────────

async function insertEvent(
  client: AiLedgerDbClient,
  event: AiCostLedgerEvent,
  config: AiCostLedgerConfig,
): Promise<AiCostLedgerEvent> {
  try {
    const { error } = await client.from(EVENTS_TABLE).insert([event]);
    if (error) {
      if (config.fail_closed) {
        throw new AiCostLedgerWriteError(
          `B38C: Supabase insert failed (fail_closed=true): ${error.message}`,
        );
      }
      // fail_closed=false: log warning, return event anyway (local copy)
      console.warn(`[B38C] Ledger write failed (fail_closed=false): ${error.message}`);
      return { ...event, status: "failed" };
    }
  } catch (err) {
    if (err instanceof AiCostLedgerWriteError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (config.fail_closed) {
      throw new AiCostLedgerWriteError(`B38C: Supabase error (fail_closed=true): ${msg}`);
    }
    console.warn(`[B38C] Ledger error (fail_closed=false): ${msg}`);
    return { ...event, status: "failed" };
  }
  return event;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSupabaseAiCostLedger(
  client: AiLedgerDbClient,
  configOverride?: Partial<AiCostLedgerConfig>,
): AiCostLedger {
  const config: AiCostLedgerConfig = {
    ...getAiCostLedgerConfig(),
    ...configOverride,
  };

  return {
    async recordEstimated(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildRow(input, "estimated", config);
      return insertEvent(client, event, config);
    },

    async recordActual(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildRow(input, "actual", config);
      return insertEvent(client, event, config);
    },

    async recordBlocked(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent> {
      const event = buildRow(input, "blocked", config);
      return insertEvent(client, event, config);
    },

    async listEvents(query: AiCostLedgerQuery): Promise<AiCostLedgerEvent[]> {
      try {
        let builder = client.from(EVENTS_TABLE).select("*");

        if (query.company_id !== undefined && query.company_id !== null) {
          builder = builder.eq("company_id", query.company_id);
        }
        if (query.user_id !== undefined && query.user_id !== null) {
          builder = builder.eq("user_id", query.user_id);
        }
        if (query.agent_slug) {
          builder = builder.eq("agent_slug", query.agent_slug);
        }
        if (query.provider) {
          builder = builder.eq("provider", query.provider);
        }
        if (query.use_case) {
          builder = builder.eq("use_case", query.use_case);
        }
        if (query.status) {
          const statuses = Array.isArray(query.status) ? query.status : [query.status];
          builder = builder.in("status", statuses);
        }
        if (query.from) {
          builder = builder.gte("created_at", query.from);
        }
        if (query.to) {
          builder = builder.lte("created_at", query.to);
        }

        builder = builder.order("created_at", { ascending: true });

        const limit = query.limit && query.limit > 0 ? query.limit : 500;
        const { data, error } = await builder.limit(limit);

        if (error) {
          console.warn(`[B38C] listEvents error: ${error.message}`);
          return [];
        }

        return (data ?? []) as AiCostLedgerEvent[];
      } catch (err) {
        console.warn(`[B38C] listEvents exception: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    },

    async summarize(query: AiCostLedgerQuery) {
      // Fetch events then aggregate client-side (simpler than complex SQL for B38C)
      const events = await this.listEvents({ ...query, limit: 1000 });
      return aggregateCostSummary(
        events,
        query,
        query.daily_cap_cents ?? config.daily_global_cap_cents,
        query.monthly_cap_cents ?? config.monthly_global_cap_cents,
      );
    },

    async getRemainingBudget(query: AiCostLedgerQuery) {
      const events = await this.listEvents({ ...query, limit: 1000, status: undefined });
      return computeRemainingBudget(
        events,
        query.daily_cap_cents ?? config.daily_global_cap_cents,
        query.monthly_cap_cents ?? config.monthly_global_cap_cents,
      );
    },
  };
}
