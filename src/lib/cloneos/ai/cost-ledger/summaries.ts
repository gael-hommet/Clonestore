// src/lib/cloneos/ai/cost-ledger/summaries.ts
// B38C — Pure aggregation helpers for cost events. No async, no DB.
// Used by both memory ledger (direct) and Supabase ledger (after fetch).

import type { AiCostLedgerEvent, AiCostSummary, AiCostLedgerQuery } from "./types";

// ── Metadata redaction ────────────────────────────────────────────────────────
// NEVER store prompts, completions, or API keys in event metadata.

const SENSITIVE_METADATA_KEYS = new Set([
  "prompt", "input", "content", "completion", "output", "response", "text",
  "system_prompt", "user_message", "assistant_message", "raw_response",
]);

export function redactSensitiveMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!SENSITIVE_METADATA_KEYS.has(k.toLowerCase())) {
      redacted[k] = v;
    }
  }
  return redacted;
}

// ── Event filtering ───────────────────────────────────────────────────────────

export function filterEvents(
  events: AiCostLedgerEvent[],
  query: AiCostLedgerQuery,
): AiCostLedgerEvent[] {
  let result = events;

  if (query.organization_id !== undefined && query.organization_id !== null) {
    result = result.filter((e) => e.organization_id === query.organization_id);
  }
  if (query.company_id !== undefined && query.company_id !== null) {
    result = result.filter((e) => e.company_id === query.company_id);
  }
  if (query.user_id !== undefined && query.user_id !== null) {
    result = result.filter((e) => e.user_id === query.user_id);
  }
  if (query.agent_slug) {
    result = result.filter((e) => e.agent_slug === query.agent_slug);
  }
  if (query.provider) {
    result = result.filter((e) => e.provider === query.provider);
  }
  if (query.model) {
    result = result.filter((e) => e.model === query.model);
  }
  if (query.use_case) {
    result = result.filter((e) => e.use_case === query.use_case);
  }
  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    result = result.filter((e) => statuses.includes(e.status));
  }
  if (query.from) {
    result = result.filter((e) => e.created_at >= query.from!);
  }
  if (query.to) {
    result = result.filter((e) => e.created_at <= query.to!);
  }

  // Sort by created_at ascending
  result = [...result].sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (query.limit && query.limit > 0) {
    result = result.slice(0, query.limit);
  }

  return result;
}

// ── Cost aggregation ──────────────────────────────────────────────────────────

export function aggregateCostSummary(
  events: AiCostLedgerEvent[],
  query: AiCostLedgerQuery,
  dailyCapCents = 300,
  monthlyCapCents = 1000,
): AiCostSummary {
  const nonBlocked = events.filter(
    (e) => e.status !== "blocked" && e.status !== "failed",
  );
  const blocked = events.filter((e) => e.status === "blocked");

  const estimatedTotal = nonBlocked.reduce(
    (s, e) => s + Math.max(0, e.estimated_cost_cents),
    0,
  );
  const actualTotal = nonBlocked.reduce(
    (s, e) => s + Math.max(0, e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents),
    0,
  );

  // Daily: events today
  const today = new Date().toISOString().slice(0, 10);
  const dailyEvents = nonBlocked.filter((e) => e.created_at.slice(0, 10) === today);
  const dailyUsed = dailyEvents.reduce(
    (s, e) => s + Math.max(0, e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents),
    0,
  );

  // Monthly: events this month
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyEvents = nonBlocked.filter((e) => e.created_at.slice(0, 7) === thisMonth);
  const monthlyUsed = monthlyEvents.reduce(
    (s, e) => s + Math.max(0, e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents),
    0,
  );

  const now = new Date().toISOString();

  return {
    scope: buildSummaryScope(query),
    organization_id: query.organization_id ?? null,
    company_id: query.company_id ?? null,
    user_id: query.user_id ?? null,
    agent_slug: query.agent_slug ?? null,
    period_start: query.from ?? `${today}T00:00:00.000Z`,
    period_end: query.to ?? now,
    estimated_cost_cents: Math.round(estimatedTotal * 10000) / 10000,
    actual_cost_cents: Math.round(actualTotal * 10000) / 10000,
    blocked_count: blocked.length,
    request_count: events.length,
    live_request_count: events.filter((e) => e.is_live).length,
    premium_request_count: events.filter((e) =>
      e.model.includes("opus") || e.model.includes("gpt-4o"),
    ).length,
    remaining_daily_cents: Math.max(0, (query.daily_cap_cents ?? dailyCapCents) - dailyUsed),
    remaining_monthly_cents: Math.max(0, (query.monthly_cap_cents ?? monthlyCapCents) - monthlyUsed),
  };
}

function buildSummaryScope(query: AiCostLedgerQuery): string {
  if (query.company_id) return `company:${query.company_id}`;
  if (query.user_id) return `user:${query.user_id}`;
  if (query.agent_slug) return `agent:${query.agent_slug}`;
  return "global";
}

// ── Remaining budget ──────────────────────────────────────────────────────────

export function computeRemainingBudget(
  events: AiCostLedgerEvent[],
  dailyCapCents: number,
  monthlyCapCents: number,
): { daily_remaining_cents: number; monthly_remaining_cents: number } {
  const nonBlocked = events.filter(
    (e) => e.status !== "blocked" && e.status !== "failed",
  );

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const dailyUsed = nonBlocked
    .filter((e) => e.created_at.slice(0, 10) === today)
    .reduce((s, e) => s + Math.max(0, e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents), 0);

  const monthlyUsed = nonBlocked
    .filter((e) => e.created_at.slice(0, 7) === thisMonth)
    .reduce((s, e) => s + Math.max(0, e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents), 0);

  return {
    daily_remaining_cents: Math.max(0, dailyCapCents - dailyUsed),
    monthly_remaining_cents: Math.max(0, monthlyCapCents - monthlyUsed),
  };
}
