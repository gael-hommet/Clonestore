// B43 — withObservableRuntime: main observable execution wrapper

import type { ObservableEventDomain, ObservableEventStatus, ObservabilitySeverity, ObservableEvent } from "./types";
import type { ObservableEventSink, ObservableEventInput } from "./event-log";
import type { DeadLetterSink } from "./dead-letter";
import { createCorrelationId, ensureCorrelationId } from "./correlation";
import { normalizeUnknownError } from "./errors";
import { decideRetry, shouldDeadLetter } from "./retry-policy";
import { buildDeadLetterEntry } from "./dead-letter";
import { buildObservableEvent } from "./event-log";
import { createInMemoryObservableEventSink } from "./event-log";
import { createInMemoryDeadLetterSink } from "./dead-letter";

// ── Runtime context ───────────────────────────────────────────────────────────

export type ObservableRuntimeContext = {
  correlation_id: string;
  causation_id?: string | null;
  domain: ObservableEventDomain;
  event_type: string;
  company_id?: string | null;
  user_id?: string | null;
  agent_slug?: string;
  mission_id?: string | null;
  task_id?: string | null;
  retry_count?: number;
  resource_type?: string;
  resource_id?: string | null;
};

export type ObservableRuntimeOptions = {
  sink?: ObservableEventSink;
  dead_letter_sink?: DeadLetterSink;
  now?: Date;
};

export type ObservableRuntimeResult<T> = {
  ok: boolean;
  value?: T;
  error?: ReturnType<typeof normalizeUnknownError>;
  event: ObservableEvent;
  retried: boolean;
  dead_lettered: boolean;
};

// ── Default singletons (no-op in test mode) ───────────────────────────────────

let _defaultSink: ObservableEventSink | null = null;
let _defaultDlSink: DeadLetterSink | null = null;

export function getDefaultObservableSink(): ObservableEventSink {
  if (!_defaultSink) _defaultSink = createInMemoryObservableEventSink();
  return _defaultSink;
}

export function getDefaultDeadLetterSink(): DeadLetterSink {
  if (!_defaultDlSink) _defaultDlSink = createInMemoryDeadLetterSink();
  return _defaultDlSink;
}

export function resetDefaultSinks(): void {
  _defaultSink = null;
  _defaultDlSink = null;
}

// ── Core wrapper ──────────────────────────────────────────────────────────────

export async function withObservableRuntime<T>(
  ctx: ObservableRuntimeContext,
  fn: () => Promise<T>,
  options: ObservableRuntimeOptions = {},
): Promise<ObservableRuntimeResult<T>> {
  const sink = options.sink ?? getDefaultObservableSink();
  const dlSink = options.dead_letter_sink ?? getDefaultDeadLetterSink();
  const now = options.now ?? new Date();
  const correlation_id = ensureCorrelationId(ctx.correlation_id);
  const retry_count = ctx.retry_count ?? 0;

  // Record "started" event
  const startedEvent = sink.record(
    buildObservableEvent({
      correlation_id,
      causation_id: ctx.causation_id ?? null,
      company_id: ctx.company_id ?? null,
      user_id: ctx.user_id ?? null,
      agent_slug: ctx.agent_slug ?? "pierre",
      mission_id: ctx.mission_id ?? null,
      task_id: ctx.task_id ?? null,
      domain: ctx.domain,
      event_type: ctx.event_type,
      status: "started",
      severity: "info",
      message: `[${ctx.domain}] ${ctx.event_type} started`,
      safe_user_message: null,
      retry_count,
      max_retries: 0,
    }),
  );

  try {
    const value = await fn();

    sink.record(
      buildObservableEvent({
        correlation_id,
        causation_id: ctx.causation_id ?? null,
        company_id: ctx.company_id ?? null,
        user_id: ctx.user_id ?? null,
        agent_slug: ctx.agent_slug ?? "pierre",
        mission_id: ctx.mission_id ?? null,
        task_id: ctx.task_id ?? null,
        domain: ctx.domain,
        event_type: ctx.event_type,
        status: "succeeded",
        severity: "info",
        message: `[${ctx.domain}] ${ctx.event_type} succeeded`,
        safe_user_message: null,
        retry_count,
        max_retries: 0,
      }),
    );

    return {
      ok: true,
      value,
      event: startedEvent,
      retried: retry_count > 0,
      dead_lettered: false,
    };
  } catch (err) {
    const observableError = normalizeUnknownError(err, {
      domain: ctx.domain,
      metadata: {
        event_type: ctx.event_type,
        resource_type: ctx.resource_type,
        resource_id: ctx.resource_id,
      },
    });

    const retryDecision = decideRetry(observableError, {
      retry_count,
      now,
    });

    const deadLettered = shouldDeadLetter(observableError, retryDecision);

    const status: ObservableEventStatus = deadLettered
      ? "dead_lettered"
      : retryDecision.should_retry
      ? "retried"
      : "failed";

    const severity: ObservabilitySeverity =
      observableError.severity === "critical" ? "critical" : "error";

    const failedEvent = sink.record(
      buildObservableEvent({
        correlation_id,
        causation_id: ctx.causation_id ?? null,
        company_id: ctx.company_id ?? null,
        user_id: ctx.user_id ?? null,
        agent_slug: ctx.agent_slug ?? "pierre",
        mission_id: ctx.mission_id ?? null,
        task_id: ctx.task_id ?? null,
        domain: ctx.domain,
        event_type: ctx.event_type,
        status,
        severity,
        message: `[${ctx.domain}] ${ctx.event_type} ${status}: ${observableError.code}`,
        safe_user_message: observableError.safe_message,
        error_code: observableError.code,
        retry_count,
        max_retries: retryDecision.max_retries,
      }),
    );

    if (deadLettered) {
      dlSink.add(
        buildDeadLetterEntry({
          correlation_id,
          domain: ctx.domain,
          resource_type: ctx.resource_type ?? ctx.event_type,
          resource_id: ctx.resource_id ?? null,
          error: observableError,
          retry_count,
          reason: retryDecision.reason,
        }),
      );
    }

    return {
      ok: false,
      error: observableError,
      event: failedEvent,
      retried: retryDecision.should_retry,
      dead_lettered: deadLettered,
    };
  }
}

// ── Sync variant (no async fn) ────────────────────────────────────────────────

export function withObservableRuntimeSync<T>(
  ctx: ObservableRuntimeContext,
  fn: () => T,
  options: ObservableRuntimeOptions = {},
): Omit<ObservableRuntimeResult<T>, "event"> & { event: ObservableEvent | null } {
  const sink = options.sink ?? getDefaultObservableSink();
  const correlation_id = ensureCorrelationId(ctx.correlation_id);
  const retry_count = ctx.retry_count ?? 0;

  try {
    const value = fn();
    const event = sink.record(
      buildObservableEvent({
        correlation_id,
        causation_id: ctx.causation_id ?? null,
        company_id: ctx.company_id ?? null,
        user_id: ctx.user_id ?? null,
        agent_slug: ctx.agent_slug ?? "pierre",
        mission_id: ctx.mission_id ?? null,
        task_id: ctx.task_id ?? null,
        domain: ctx.domain,
        event_type: ctx.event_type,
        status: "succeeded",
        severity: "info",
        message: `[${ctx.domain}] ${ctx.event_type} succeeded`,
        safe_user_message: null,
        retry_count,
        max_retries: 0,
      }),
    );
    return { ok: true, value, event, retried: false, dead_lettered: false };
  } catch (err) {
    const observableError = normalizeUnknownError(err, { domain: ctx.domain });
    const event = sink.record(
      buildObservableEvent({
        correlation_id,
        causation_id: ctx.causation_id ?? null,
        company_id: ctx.company_id ?? null,
        user_id: ctx.user_id ?? null,
        agent_slug: ctx.agent_slug ?? "pierre",
        mission_id: ctx.mission_id ?? null,
        task_id: ctx.task_id ?? null,
        domain: ctx.domain,
        event_type: ctx.event_type,
        status: "failed",
        severity: "error",
        message: `[${ctx.domain}] ${ctx.event_type} failed: ${observableError.code}`,
        safe_user_message: observableError.safe_message,
        error_code: observableError.code,
        retry_count,
        max_retries: 0,
      }),
    );
    return { ok: false, error: observableError, event, retried: false, dead_lettered: false };
  }
}
