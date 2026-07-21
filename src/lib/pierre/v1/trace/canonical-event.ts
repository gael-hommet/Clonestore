// src/lib/pierre/v1/trace/canonical-event.ts
// P19 — CLONETRACE CANONICAL EVENT ENVELOPE. Before P19 events were fragmented across pierre_rt_events,
// pierre_rt_outbox, the (unwired) ObservableEvent, and legacy pierre_task_logs — no single format, correlation
// not propagated to task-level events, no way to reconstruct a mission end-to-end. This is the ONE canonical
// versioned envelope. Legacy shapes are translated by ADAPTERS; new writes use this envelope. The canonical
// store remains V1 (pierre_rt_events) — this is the format, not a new store. Pure, deterministic.

export const CLONETRACE_ENVELOPE_VERSION = "ct-1" as const;

export type CanonicalTraceEvent = {
  readonly envelope_version: typeof CLONETRACE_ENVELOPE_VERSION;
  readonly event_id: string;
  readonly event_type: string;
  readonly occurred_at: string;              // ISO
  readonly company_id: string;
  readonly entity_id: string | null;
  readonly legal_country: string | null;
  readonly country_pack_version: string | null;
  readonly user_id: string | null;
  readonly employee_id: string | null;
  readonly conversation_id: string | null;
  readonly mission_id: string | null;
  readonly task_id: string | null;
  readonly artifact_id: string | null;
  readonly validation_id: string | null;
  readonly provider: string | null;
  readonly action: string | null;
  readonly permission: string | null;
  readonly guard_decision: string | null;
  readonly policy_version: string | null;
  readonly cloneadn_version: string | null;
  readonly correlation_id: string | null;
  readonly causation_id: string | null;
  readonly idempotency_key: string | null;
  readonly attempt: number | null;
  readonly duration_ms: number | null;
  readonly cost: number | null;              // only when genuinely known
  readonly previous_state: string | null;
  readonly new_state: string | null;
  readonly result: string | null;
  readonly error_code: string | null;
  readonly redacted_metadata: Record<string, unknown>;
  readonly provenance: string;               // which subsystem emitted it
};

const SECRET_KEY = /(secret|token|api[_-]?key|password|authorization|bearer|private[_-]?key|service[_-]?role)/i;

/** Redact secret-looking keys and truncate long strings so logs never carry secrets or excessive PII. Pure. */
export function redactMetadata(meta: unknown): Record<string, unknown> {
  const src = (typeof meta === "object" && meta !== null && !Array.isArray(meta)) ? meta as Record<string, unknown> : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (SECRET_KEY.test(k)) { out[k] = "[redacted]"; continue; }
    if (typeof v === "string") { out[k] = v.length > 512 ? v.slice(0, 512) + "…" : v; continue; }
    if (typeof v === "object" && v !== null) { out[k] = "[object]"; continue; }
    out[k] = v;
  }
  return out;
}

export type BuildTraceInput = Partial<CanonicalTraceEvent> & {
  event_id: string; event_type: string; occurred_at: string; company_id: string; provenance: string;
};

/** Build a canonical envelope, filling every field with an explicit null default and redacting metadata. Pure. */
export function buildCanonicalTraceEvent(input: BuildTraceInput): CanonicalTraceEvent {
  return {
    envelope_version: CLONETRACE_ENVELOPE_VERSION,
    event_id: input.event_id, event_type: input.event_type, occurred_at: input.occurred_at,
    company_id: input.company_id, entity_id: input.entity_id ?? null, legal_country: input.legal_country ?? null,
    country_pack_version: input.country_pack_version ?? null, user_id: input.user_id ?? null, employee_id: input.employee_id ?? null,
    conversation_id: input.conversation_id ?? null, mission_id: input.mission_id ?? null, task_id: input.task_id ?? null,
    artifact_id: input.artifact_id ?? null, validation_id: input.validation_id ?? null, provider: input.provider ?? null,
    action: input.action ?? null, permission: input.permission ?? null, guard_decision: input.guard_decision ?? null,
    policy_version: input.policy_version ?? null, cloneadn_version: input.cloneadn_version ?? null,
    correlation_id: input.correlation_id ?? null, causation_id: input.causation_id ?? null, idempotency_key: input.idempotency_key ?? null,
    attempt: input.attempt ?? null, duration_ms: input.duration_ms ?? null, cost: input.cost ?? null,
    previous_state: input.previous_state ?? null, new_state: input.new_state ?? null, result: input.result ?? null,
    error_code: input.error_code ?? null, redacted_metadata: redactMetadata(input.redacted_metadata), provenance: input.provenance,
  };
}

function pick(o: Record<string, unknown>, k: string): string | null { const v = o[k]; return typeof v === "string" && v ? v : null; }
function num(o: Record<string, unknown>, k: string): number | null { const v = o[k]; return typeof v === "number" ? v : null; }
const asObj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null) ? v as Record<string, unknown> : {};

/** Adapter: a legacy V1 `pierre_rt_events` row → canonical envelope. */
export function fromRtEventRow(row: unknown): CanonicalTraceEvent {
  const r = asObj(row);
  return buildCanonicalTraceEvent({
    event_id: pick(r, "id") ?? "unknown", event_type: pick(r, "type") ?? "unknown",
    occurred_at: pick(r, "created_at") ?? "", company_id: pick(r, "company_id") ?? "unknown",
    mission_id: pick(r, "mission_id"), task_id: pick(r, "task_id"),
    user_id: pick(r, "actor_id"), correlation_id: pick(r, "correlation_id"),
    previous_state: pick(r, "prev_state"), new_state: pick(r, "new_state"),
    redacted_metadata: asObj(r.metadata), provenance: "pierre_rt_events",
  });
}

/** Adapter: an ObservableEvent → canonical envelope (folds the richest legacy schema in). */
export function fromObservableEvent(ev: unknown): CanonicalTraceEvent {
  const r = asObj(ev);
  return buildCanonicalTraceEvent({
    event_id: pick(r, "event_id") ?? pick(r, "id") ?? "unknown", event_type: pick(r, "event_type") ?? "unknown",
    occurred_at: pick(r, "occurred_at") ?? pick(r, "created_at") ?? "", company_id: pick(r, "company_id") ?? "unknown",
    user_id: pick(r, "user_id"), employee_id: pick(r, "employee_id"), mission_id: pick(r, "mission_id"), task_id: pick(r, "task_id"),
    correlation_id: pick(r, "correlation_id"), causation_id: pick(r, "causation_id"), attempt: num(r, "retry_count"),
    result: pick(r, "status"), error_code: pick(r, "error_code"),
    redacted_metadata: asObj(r.metadata_redacted), provenance: "observability",
  });
}

/**
 * Reconstruct an ordered mission timeline from canonical events (any provenance). Filters to a mission,
 * orders by occurred_at then event_id, and reports whether the trail is contiguous by correlation. Pure.
 */
export function reconstructMissionTimeline(events: readonly CanonicalTraceEvent[], missionId: string): {
  readonly mission_id: string;
  readonly ordered: readonly CanonicalTraceEvent[];
  readonly correlation_ids: readonly string[];
  readonly reconstructable: boolean;
} {
  const ordered = events
    .filter((e) => e.mission_id === missionId)
    .slice()
    .sort((a, b) => (a.occurred_at.localeCompare(b.occurred_at)) || a.event_id.localeCompare(b.event_id));
  const correlation_ids = Array.from(new Set(ordered.map((e) => e.correlation_id).filter((c): c is string => !!c)));
  // Reconstructable = at least one event AND every event shares one correlation id (a linkable trail).
  const reconstructable = ordered.length > 0 && correlation_ids.length <= 1 && ordered.every((e) => e.company_id === ordered[0].company_id);
  return { mission_id: missionId, ordered, correlation_ids, reconstructable };
}
