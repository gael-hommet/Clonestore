// B43 — Pierre dead-letter entries: creation, summarization

import type { DeadLetterEntry, ObservableError, ObservableEventDomain } from "../../observability/types";
import type { RetryDecision } from "../../observability/retry-policy";
import type { DeadLetterSink, DeadLetterSummary } from "../../observability/dead-letter";
import { buildDeadLetterEntry, createInMemoryDeadLetterSink } from "../../observability/dead-letter";
import { shouldPierreDeadLetter } from "./pierre-retry-policy";

// ── Create a Pierre dead-letter entry ─────────────────────────────────────────

export type PierreDeadLetterContext = {
  correlation_id: string;
  domain: ObservableEventDomain;
  resource_type: string;
  resource_id?: string | null;
  retry_count: number;
  payload?: Record<string, unknown>;
};

export function createPierreDeadLetterEntry(
  error: ObservableError,
  decision: RetryDecision,
  ctx: PierreDeadLetterContext,
): Omit<DeadLetterEntry, "id" | "created_at" | "resolved" | "resolved_at"> {
  return buildDeadLetterEntry({
    correlation_id: ctx.correlation_id,
    domain: ctx.domain,
    resource_type: ctx.resource_type,
    resource_id: ctx.resource_id ?? null,
    error,
    retry_count: ctx.retry_count,
    reason: decision.reason,
    payload: ctx.payload,
  });
}

// ── Should Pierre dead-letter? ────────────────────────────────────────────────

export { shouldPierreDeadLetter };

// ── Pierre-aware sink builder ─────────────────────────────────────────────────

export function createPierreDeadLetterSink(maxSize = 200): DeadLetterSink {
  return createInMemoryDeadLetterSink(maxSize);
}

// ── Summarize dead letters ────────────────────────────────────────────────────

export type PierreDeadLetterReport = {
  total: number;
  unresolved: number;
  resolved: number;
  by_domain: Partial<Record<ObservableEventDomain, number>>;
  critical_count: number;
  top_error_codes: Array<{ code: string; count: number }>;
  requires_attention: boolean;
};

export function summarizePierreDeadLetters(entries: DeadLetterEntry[]): PierreDeadLetterReport {
  const by_domain: Partial<Record<ObservableEventDomain, number>> = {};
  const by_code: Record<string, number> = {};
  let unresolved = 0;
  let critical_count = 0;

  let resolved = 0;

  for (const e of entries) {
    by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
    by_code[e.error_code] = (by_code[e.error_code] ?? 0) + 1;
    if (!e.resolved) unresolved++;
    else resolved++;
    if (e.severity === "critical") critical_count++;
  }

  const top_error_codes = Object.entries(by_code)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  return {
    total: entries.length,
    unresolved,
    resolved,
    by_domain,
    critical_count,
    top_error_codes,
    requires_attention: unresolved > 0 || critical_count > 0,
  };
}
