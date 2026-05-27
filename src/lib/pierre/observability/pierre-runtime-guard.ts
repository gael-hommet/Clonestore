// B43 — withPierreObservableRuntime: Pierre-specific observable wrapper

import type { ObservableEventDomain } from "../../observability/types";
import type { ObservableEventSink } from "../../observability/event-log";
import type { DeadLetterSink } from "../../observability/dead-letter";
import type { ObservableRuntimeResult } from "../../observability/runtime";
import { withObservableRuntime } from "../../observability/runtime";
import { ensureCorrelationId } from "../../observability/correlation";
import { normalizeUnknownError } from "../../observability/errors";
import { decidePierreRetry, shouldPierreDeadLetter } from "./pierre-retry-policy";
import { createPierreDeadLetterEntry } from "./pierre-dead-letter";

// ── Pierre runtime context ────────────────────────────────────────────────────

export type PierreRuntimeContext = {
  correlation_id?: string | null;
  causation_id?: string | null;
  company_id: string;
  user_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  domain: ObservableEventDomain;
  event_type: string;
  resource_type?: string;
  resource_id?: string | null;
  retry_count?: number;
  agent_slug?: string;
};

export type PierreRuntimeOptions = {
  sink?: ObservableEventSink;
  dead_letter_sink?: DeadLetterSink;
  now?: Date;
};

// ── Main Pierre wrapper ───────────────────────────────────────────────────────

export async function withPierreObservableRuntime<T>(
  ctx: PierreRuntimeContext,
  fn: () => Promise<T>,
  options: PierreRuntimeOptions = {},
): Promise<ObservableRuntimeResult<T>> {
  const correlation_id = ensureCorrelationId(ctx.correlation_id ?? undefined, "pierre");

  const result = await withObservableRuntime<T>(
    {
      correlation_id,
      causation_id: ctx.causation_id ?? null,
      domain: ctx.domain,
      event_type: ctx.event_type,
      company_id: ctx.company_id,
      user_id: ctx.user_id ?? null,
      agent_slug: ctx.agent_slug ?? "pierre",
      mission_id: ctx.mission_id ?? null,
      task_id: ctx.task_id ?? null,
      retry_count: ctx.retry_count ?? 0,
      resource_type: ctx.resource_type,
      resource_id: ctx.resource_id ?? null,
    },
    fn,
    {
      sink: options.sink,
      dead_letter_sink: options.dead_letter_sink,
      now: options.now,
    },
  );

  // Pierre-specific dead-letter override (more conservative than generic)
  if (!result.ok && result.error && !result.dead_lettered) {
    const retryDecision = decidePierreRetry(result.error, {
      retry_count: ctx.retry_count ?? 0,
      now: options.now,
    });

    if (shouldPierreDeadLetter(result.error, retryDecision) && options.dead_letter_sink) {
      options.dead_letter_sink.add(
        createPierreDeadLetterEntry(result.error, retryDecision, {
          correlation_id,
          domain: ctx.domain,
          resource_type: ctx.resource_type ?? ctx.event_type,
          resource_id: ctx.resource_id ?? null,
          retry_count: ctx.retry_count ?? 0,
        }),
      );
      return { ...result, dead_lettered: true };
    }
  }

  return result;
}

// ── Guard: company_id is required ─────────────────────────────────────────────

export function assertPierreCompanyId(company_id: unknown): asserts company_id is string {
  if (!company_id || typeof company_id !== "string" || company_id.trim().length === 0) {
    throw new Error("PIERRE_SECURITY_VIOLATION: company_id is required and must be a non-empty string");
  }
}

// ── Guard: cross-tenant check ─────────────────────────────────────────────────

export function assertNoTenantMismatch(
  requestedCompanyId: string,
  resourceCompanyId: string,
  context: string,
): void {
  if (requestedCompanyId !== resourceCompanyId) {
    throw new Error(
      `PIERRE_MISSION_COMPANY_MISMATCH: tenant mismatch in ${context} — ` +
      `requested=${requestedCompanyId} vs resource=${resourceCompanyId}`,
    );
  }
}
