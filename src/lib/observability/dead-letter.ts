// B43 — Dead letter queue: in-memory implementation

import type { DeadLetterEntry, ObservableError, ObservableEventDomain } from "./types";
import { createCorrelationId } from "./correlation";
import { redactObservabilityMetadata } from "./redaction";

// ── Interface ─────────────────────────────────────────────────────────────────

export type DeadLetterQuery = {
  domain?: ObservableEventDomain;
  resolved?: boolean;
  correlation_id?: string;
  limit?: number;
};

export type DeadLetterResolution = {
  resolved_by: string;
  note: string;
};

export type DeadLetterSummary = {
  total: number;
  unresolved: number;
  resolved: number;
  by_domain: Partial<Record<ObservableEventDomain, number>>;
  by_error_code: Record<string, number>;
};

export interface DeadLetterSink {
  add(entry: Omit<DeadLetterEntry, "id" | "created_at" | "resolved" | "resolved_at">): DeadLetterEntry;
  list(query?: DeadLetterQuery): DeadLetterEntry[];
  resolve(id: string, resolution: DeadLetterResolution): boolean;
  summarize(): DeadLetterSummary;
  clear(): void;
  count(): number;
}

// ── Entry builder ─────────────────────────────────────────────────────────────

export type DeadLetterInput = {
  correlation_id: string;
  domain: ObservableEventDomain;
  resource_type: string;
  resource_id?: string | null;
  error: ObservableError;
  retry_count: number;
  reason: string;
  payload?: Record<string, unknown>;
};

export function buildDeadLetterEntry(
  input: DeadLetterInput,
): Omit<DeadLetterEntry, "id" | "created_at" | "resolved" | "resolved_at"> {
  return {
    correlation_id: input.correlation_id,
    domain: input.domain,
    resource_type: input.resource_type,
    resource_id: input.resource_id ?? null,
    error_code: input.error.code,
    severity: input.error.severity,
    retry_count: input.retry_count,
    payload_redacted: redactObservabilityMetadata(input.payload ?? {}),
    reason: input.reason,
  };
}

// ── In-memory implementation ──────────────────────────────────────────────────

export function createInMemoryDeadLetterSink(maxSize = 500): DeadLetterSink {
  const entries: DeadLetterEntry[] = [];

  function matches(entry: DeadLetterEntry, query: DeadLetterQuery): boolean {
    if (query.domain && entry.domain !== query.domain) return false;
    if (query.resolved !== undefined && entry.resolved !== query.resolved) return false;
    if (query.correlation_id && entry.correlation_id !== query.correlation_id) return false;
    return true;
  }

  return {
    add(input): DeadLetterEntry {
      const id = createCorrelationId("dl");
      const created_at = new Date().toISOString();
      const entry: DeadLetterEntry = {
        ...input,
        id,
        created_at,
        resolved: false,
        resolved_at: null,
      };
      entries.push(entry);
      if (entries.length > maxSize) {
        entries.splice(0, entries.length - maxSize);
      }
      return entry;
    },

    list(query = {}): DeadLetterEntry[] {
      const filtered = entries.filter((e) => matches(e, query));
      const limit = query.limit ?? filtered.length;
      return filtered.slice(-limit);
    },

    resolve(id: string, resolution: DeadLetterResolution): boolean {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.resolved) return false;
      entry.resolved = true;
      entry.resolved_at = new Date().toISOString();
      return true;
    },

    summarize(): DeadLetterSummary {
      const by_domain: Partial<Record<ObservableEventDomain, number>> = {};
      const by_error_code: Record<string, number> = {};
      let unresolved = 0;
      let resolved = 0;

      for (const e of entries) {
        by_domain[e.domain] = (by_domain[e.domain] ?? 0) + 1;
        by_error_code[e.error_code] = (by_error_code[e.error_code] ?? 0) + 1;
        if (e.resolved) resolved++;
        else unresolved++;
      }

      return {
        total: entries.length,
        unresolved,
        resolved,
        by_domain,
        by_error_code,
      };
    },

    clear(): void {
      entries.splice(0, entries.length);
    },

    count(): number {
      return entries.length;
    },
  };
}

// ── Disabled (no-op) sink ─────────────────────────────────────────────────────

export function createDisabledDeadLetterSink(): DeadLetterSink {
  return {
    add(input): DeadLetterEntry {
      return {
        ...input,
        id: createCorrelationId("dl"),
        created_at: new Date().toISOString(),
        resolved: false,
        resolved_at: null,
      };
    },
    list(): DeadLetterEntry[] { return []; },
    resolve(): boolean { return false; },
    summarize(): DeadLetterSummary {
      return { total: 0, unresolved: 0, resolved: 0, by_domain: {}, by_error_code: {} };
    },
    clear(): void {},
    count(): number { return 0; },
  };
}
