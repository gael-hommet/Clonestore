// src/lib/pierre/v1/runtime-event-bus.ts
// PHASE 8.5-FINAL §1/§3/§4/§5 — SERVICE-DRIVEN runtime events. The runtime must NEVER discover a terminal
// truth by polling the business tables; instead the REAL governed service that applies the terminal
// transition (a validation decision, a signature completion, a communication delivery) EMITS a durable
// runtime event IN ITS OWN TRANSACTION. Because the app/worker roles can NOT call the scheduler-only
// pierre_rt_ingest_runtime_event, the durable sink is the transactional OUTBOX (pierre_rt_outbox, which
// the app role may write). The event is marked for RUNTIME consumption (rt_processing_status) and SKIPPED
// for the communication pipeline (comm_processing_status), so the two relays never collide. The runtime
// ingestor (the scheduler's drainRuntimeEventOutbox) later forwards each row into the runtime event
// ledger and resolves the exact matching wait. This is the canonical transactional-outbox pattern:
// producer = the real service, relay = the scheduler — event-driven, never a terminal-table scan.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";

/** the outbox `kind` that marks a row as a runtime event (the comm pipeline ignores it). */
export const RUNTIME_EVENT_OUTBOX_KIND = "runtime.event";

/** what durable wait (if any) this event resolves. null ⇒ record-only (e.g. a rejection / a bounce). */
export type RuntimeEventResolveTarget = { event_kind: string; object_type: string; object_id: string } | null;

export type RuntimeEventEmission = {
  /** ledger identity (dedup is on source+event_key) */
  source: string;
  event_key: string;
  kind: string;
  /** the object the event is ABOUT (per §4/§5: signature_request/id, communication_delivery/delivery_id, validation/id) */
  object_type: string;
  object_id: string;
  payload_hash: string;
  occurred_at?: string | null;
  provider_event_id?: string | null;
  /** the content fingerprint to match the wait (a stale approval / content change never auto-resolves) */
  fingerprint?: string | null;
  /** the wait to resolve; null = the event is recorded but resolves nothing (rejection / bounce / failure) */
  resolve: RuntimeEventResolveTarget;
};

/** Emit a durable runtime event from a REAL business service, WITHIN the caller's transaction (app-role
 *  safe). It lands in the transactional outbox marked for runtime consumption and skipped by the comm
 *  pipeline; the runtime ingestor drains it. Idempotent on (company, dedup_key) — re-emitting the same
 *  terminal fact is a no-op, so a duplicate webhook / retry yields exactly one event. */
export async function emitRuntimeEvent(tx: SqlExecutor, ctx: TenantContext, e: RuntimeEventEmission): Promise<void> {
  await tx.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key, comm_processing_status, rt_processing_status)
     values ($1,$2,$3,$4,$5,'skipped','pending')
     on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, RUNTIME_EVENT_OUTBOX_KIND, JSON.stringify(e), runtimeEventDedupKey(e.source, e.event_key)],
  );
}

export function runtimeEventDedupKey(source: string, eventKey: string): string {
  return `rtev:${source}:${eventKey}`;
}
