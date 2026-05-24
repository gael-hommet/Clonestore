// src/lib/cloneos/ai/usage-log.ts
// B32 — AI usage log builder. Pure, no DB writes.
// Callers (API routes) handle persistence via supabaseAdmin.
// Schema: see docs/sql/ai_usage_logs.sql

import type {
  AiUsageLogInput,
  AiUsageLogStatus,
  CloneAIProviderId,
  AiRuntimeMode,
} from "./types";

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildAiUsageLog(params: {
  agent_slug: string;
  use_case: string;
  provider: CloneAIProviderId;
  model_id: string;
  runtime_mode: AiRuntimeMode;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
  latency_ms: number;
  status: AiUsageLogStatus;
  error_code?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}): AiUsageLogInput {
  return {
    agent_slug: typeof params.agent_slug === "string" ? params.agent_slug : "unknown",
    use_case: typeof params.use_case === "string" ? params.use_case : "unknown",
    provider: params.provider ?? "mock",
    model_id: typeof params.model_id === "string" ? params.model_id : "unknown",
    runtime_mode: params.runtime_mode ?? "mock",
    input_tokens: typeof params.input_tokens === "number" && params.input_tokens >= 0 ? params.input_tokens : 0,
    output_tokens: typeof params.output_tokens === "number" && params.output_tokens >= 0 ? params.output_tokens : 0,
    estimated_cost_cents: typeof params.estimated_cost_cents === "number" ? Math.max(0, params.estimated_cost_cents) : 0,
    latency_ms: typeof params.latency_ms === "number" && params.latency_ms >= 0 ? params.latency_ms : 0,
    status: params.status ?? "ok",
    error_code: params.error_code ?? null,
    user_id: params.user_id ?? null,
    metadata: params.metadata ?? {},
  };
}

// ── Console trace (fire-and-forget for production, no PII in default path) ───

export function traceAiUsageLog(log: AiUsageLogInput): void {
  if (log.runtime_mode === "mock") return; // silent in mock mode

  const logPrompts = process.env.AI_LOG_PROMPTS === "true";
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    agent: log.agent_slug,
    use_case: log.use_case,
    provider: log.provider,
    model: log.model_id,
    mode: log.runtime_mode,
    tokens_in: log.input_tokens,
    tokens_out: log.output_tokens,
    cost_cents: log.estimated_cost_cents,
    latency_ms: log.latency_ms,
    status: log.status,
    ...(log.error_code ? { error_code: log.error_code } : {}),
  };

  if (!logPrompts && log.metadata) {
    // Strip any prompt content from metadata trace
    const { prompt: _p, input: _i, content: _c, ...safeMetadata } = log.metadata as Record<string, unknown>;
    if (Object.keys(safeMetadata).length > 0) {
      entry.metadata = safeMetadata;
    }
  } else if (logPrompts && log.metadata) {
    entry.metadata = log.metadata;
  }

  try {
    console.log("[AI_USAGE]", JSON.stringify(entry));
  } catch {
    // ignore serialization error
  }
}

// ── Aggregate helpers (for budget computation before DB is available) ─────────

export function sumCosts(logs: AiUsageLogInput[]): number {
  if (!Array.isArray(logs)) return 0;
  return logs.reduce((sum, l) => sum + (typeof l.estimated_cost_cents === "number" ? l.estimated_cost_cents : 0), 0);
}

export function filterByPeriod(
  logs: AiUsageLogInput[],
  _period: "daily" | "monthly",
): AiUsageLogInput[] {
  // Without created_at in AiUsageLogInput, we return all — period filtering is for DB layer.
  // This helper exists for future extension.
  if (!Array.isArray(logs)) return [];
  return logs;
}
