// B43 — Observable event sink interface + in-memory implementation

import type {
  ObservableEvent,
  ObservableEventQuery,
  ObservableSummary,
  ObservableEventStatus,
  ObservabilitySeverity,
  ObservableEventDomain,
} from "./types";
import { createCorrelationId } from "./correlation";
import { redactObservabilityMetadata } from "./redaction";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ObservableEventSink {
  record(event: Omit<ObservableEvent, "id" | "created_at">): ObservableEvent;
  list(query?: ObservableEventQuery): ObservableEvent[];
  summarize(query?: ObservableEventQuery): ObservableSummary;
  clear(): void;
  count(): number;
}

// ── Event builder helper ──────────────────────────────────────────────────────

// Fields with defaults in buildObservableEvent are optional here
export type ObservableEventInput = Omit<
  ObservableEvent,
  | "id"
  | "created_at"
  | "metadata_redacted"
  | "timestamp"
  | "retry_count"
  | "max_retries"
  | "error_code"
  | "causation_id"
  | "company_id"
  | "user_id"
  | "mission_id"
  | "task_id"
  | "agent_slug"
> & {
  timestamp?: string;
  retry_count?: number;
  max_retries?: number;
  error_code?: string | null;
  causation_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  agent_slug?: string;
  metadata?: Record<string, unknown>;
};

export function buildObservableEvent(
  input: ObservableEventInput,
): Omit<ObservableEvent, "id" | "created_at"> {
  return {
    timestamp: input.timestamp || new Date().toISOString(),
    correlation_id: input.correlation_id,
    causation_id: input.causation_id ?? null,
    company_id: input.company_id ?? null,
    user_id: input.user_id ?? null,
    agent_slug: input.agent_slug || "pierre",
    mission_id: input.mission_id ?? null,
    task_id: input.task_id ?? null,
    domain: input.domain,
    event_type: input.event_type,
    status: input.status,
    severity: input.severity,
    message: input.message,
    safe_user_message: input.safe_user_message,
    error_code: input.error_code ?? null,
    retry_count: input.retry_count ?? 0,
    max_retries: input.max_retries ?? 0,
    metadata_redacted: redactObservabilityMetadata(input.metadata ?? {}),
  };
}

// ── In-memory implementation ──────────────────────────────────────────────────

export function createInMemoryObservableEventSink(maxSize = 1000): ObservableEventSink {
  const events: ObservableEvent[] = [];
  let seq = 0;

  function matches(event: ObservableEvent, query: ObservableEventQuery): boolean {
    if (query.domain && event.domain !== query.domain) return false;
    if (query.company_id && event.company_id !== query.company_id) return false;
    if (query.user_id && event.user_id !== query.user_id) return false;
    if (query.correlation_id && event.correlation_id !== query.correlation_id) return false;
    if (query.severity && event.severity !== query.severity) return false;
    if (query.status && event.status !== query.status) return false;
    return true;
  }

  return {
    record(eventInput): ObservableEvent {
      seq++;
      const id = `evt_${Date.now().toString(36)}_${seq}`;
      const created_at = new Date().toISOString();
      const event: ObservableEvent = {
        ...eventInput,
        id,
        created_at,
        metadata_redacted: redactObservabilityMetadata(
          (eventInput as unknown as { metadata?: Record<string, unknown> }).metadata ??
          eventInput.metadata_redacted ?? {},
        ),
      };
      events.push(event);
      // Trim if over max size (keep newest)
      if (events.length > maxSize) {
        events.splice(0, events.length - maxSize);
      }
      return event;
    },

    list(query = {}): ObservableEvent[] {
      const filtered = query
        ? events.filter((e) => matches(e, query))
        : [...events];
      const limit = query.limit ?? filtered.length;
      return filtered.slice(-limit);
    },

    summarize(query = {}): ObservableSummary {
      const filtered = events.filter((e) => matches(e, query));
      const by_status: Partial<Record<ObservableEventStatus, number>> = {};
      const by_severity: Partial<Record<ObservabilitySeverity, number>> = {};
      const by_domain: Partial<Record<ObservableEventDomain, number>> = {};

      for (const e of filtered) {
        by_status[e.status] = (by_status[e.status] ?? 0) + 1;
        by_severity[e.severity] = (by_severity[e.severity] ?? 0) + 1;
        by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
      }

      return {
        total: filtered.length,
        by_status,
        by_severity,
        by_domain,
        critical_count: by_severity.critical ?? 0,
        error_count: by_severity.error ?? 0,
      };
    },

    clear(): void {
      events.splice(0, events.length);
    },

    count(): number {
      return events.length;
    },
  };
}

// ── Disabled (no-op) sink ─────────────────────────────────────────────────────

export function createDisabledObservableEventSink(): ObservableEventSink {
  const empty: ObservableEvent[] = [];

  return {
    record(input): ObservableEvent {
      const id = createCorrelationId("evt");
      const now = new Date().toISOString();
      return {
        ...input,
        id,
        created_at: now,
        metadata_redacted: {},
      };
    },
    list(): ObservableEvent[] { return []; },
    summarize(): ObservableSummary {
      return { total: 0, by_status: {}, by_severity: {}, by_domain: {}, critical_count: 0, error_count: 0 };
    },
    clear(): void {},
    count(): number { return 0; },
  };
}
