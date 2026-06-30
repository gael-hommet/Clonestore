// src/lib/pierre/v1/runtime-scheduler.ts
// PHASE 8.5 §28/§30/§33/§34 — the durable SCHEDULER + RECOVERY sweeper + EVENT ingestor. It only makes
// work AVAILABLE (it never executes a business action): it reclaims expired leases (bumping the fencing
// generation + recording the superseded one), resolves DUE timer waits, fires bounded follow-up/relance
// schedules (checking a typed stop-condition before creating a P8.4 communication), and applies ingested
// external events to resolve the exact matching wait. No setInterval/setTimeout — due work is selected by
// wake_at / next_run_at <= now() in the DB.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { newUuid } from "./sql";
import type { RuntimeDeps } from "./runtime-action-handlers";
import { createCommunicationIntents, dispatchCommunicationDeliveries } from "./communications";
import { RUNTIME_EVENT_OUTBOX_KIND, type RuntimeEventEmission } from "./runtime-event-bus";
import { buildScheduleRule, nextScheduleRunAt } from "./runtime-schedule-rules";

// R4.3 — every governed scheduler call runs under the SCHEDULER role (SET LOCAL ROLE + verified
// current_user + tenant GUC). The route injects withRuntimeSchedulerTransaction; the default binds the
// role on the passed scheduler executor and is fail-closed when that connection can not become the role.
async function withTenant<T>(db: SqlExecutor, ctx: TenantContext, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_scheduler`);
    const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_scheduler") throw new Error(`scheduler role binding failed: current_user=${cu}, expected pierre_rt_runtime_scheduler`);
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    return fn(tx);
  });
}

/** App-role tenant tx (GUC only) — for the business reads the scheduler delegates to the app executor
 *  (a stop-condition document read), which the scheduler role must NEVER perform. */
async function appTx<T>(db: SqlExecutor, ctx: TenantContext, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); return fn(tx); });
}

export type SchedulerResult = { recovered: number; timers_resolved: number; events_applied: number; relances_fired: number; schedules_completed: number; service_events_drained: number; service_waits_resolved: number };

/** R1.10/§34 — a focused recovery sweep: reclaim expired-lease jobs (bump fencing, record superseded). */
export async function runPierreRuntimeRecovery(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number } = {}): Promise<{ recovered: number }> {
  const recovered = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_recover_runtime_leases: number }>(`select pierre_rt_recover_runtime_leases($1, now(), $2)`, [ctx.company_id, Math.min(opts.limit ?? 100, 500)]))).rows[0].pierre_rt_recover_runtime_leases;
  return { recovered };
}

// ── typed stop-condition evaluation (§38) — closed set, no free expression ─────────────
async function stopConditionMet(db: SqlExecutor, ctx: TenantContext, cond: Record<string, unknown> | null): Promise<boolean> {
  if (!cond || typeof cond !== "object") return false; // no condition → bounded only by max_occurrences
  const type = String(cond.type ?? "");
  if (type === "document_status_in") {
    const r = (await appTx(db, ctx, (tx) => tx.query<{ status: string }>(`select status from pierre_rt_documents where company_id=$1 and id=$2`, [ctx.company_id, String(cond.document_id)]))).rows[0];
    const statuses = Array.isArray(cond.statuses) ? (cond.statuses as string[]) : [];
    return !!r && statuses.includes(r.status);
  }
  if (type === "object_absent") {
    const tbl = ["pierre_rt_documents", "pierre_rt_employee_contracts"].includes(String(cond.table)) ? String(cond.table) : null;
    if (!tbl) return false;
    const r = (await appTx(db, ctx, (tx) => tx.query<{ id: string }>(`select id from ${tbl} where company_id=$1 and id=$2`, [ctx.company_id, String(cond.object_id)]))).rows[0];
    return !r;
  }
  return false;
}

// ── ingest an external runtime event + resolve the exact matching wait (idempotent) ────
// R1.8 — the wait is resolved by the REAL persisted event id (FK-enforced), never an arbitrary uuid.
export async function ingestPierreRuntimeEvent(
  db: SqlExecutor, ctx: TenantContext,
  ev: { source: string; event_key: string; kind: string; object_type?: string | null; object_id?: string | null; payload_hash: string; occurred_at?: string | null; fingerprint?: string | null },
): Promise<{ status: string; resolved: number; event_id: string | null }> {
  const status = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_ingest_runtime_event: string }>(
    `select pierre_rt_ingest_runtime_event($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ctx.company_id, ev.source, ev.event_key, ev.kind, ev.object_type ?? null, ev.object_id ?? null, ev.payload_hash, ev.occurred_at ?? null]))).rows[0].pierre_rt_ingest_runtime_event;
  if (status !== "received") return { status, resolved: 0, event_id: null };
  const eventId = (await withTenant(db, ctx, (tx) => tx.query<{ id: string }>(`select id from pierre_rt_runtime_events where company_id=$1 and source=$2 and event_key=$3`, [ctx.company_id, ev.source, ev.event_key]))).rows[0].id;
  const resolved = await resolveMatchingWaits(db, ctx, eventId, ev.kind, ev.object_type ?? null, ev.object_id ?? null, ev.fingerprint ?? null);
  return { status, resolved, event_id: eventId };
}

// ── P8.5-FINAL §1/§6 — the SERVICE-EVENT INGESTOR (transactional-outbox relay) ─────────
// The real services (validation decision, P8.3 signature, P8.4 communication) emit durable runtime events
// into the outbox (rt_processing_status='pending') within their own transaction. This relay forwards each
// row into the runtime event ledger (the governed scheduler-role ingest) and resolves the EXACT wait the
// emitter declared (a distinct ledger object vs. resolution target is allowed: a delivery-keyed event may
// resolve an intent-bound wait). The ledger event carries the emitter's own kind/object for audit; the
// wait resolution uses the emitter's `resolve` target + content fingerprint. Record-only events (a
// rejection, a bounce) declare resolve=null and wake nothing. Idempotent: a re-drained row is marked
// processed; the (source,event_key) unique guards the ledger; a stale fingerprint never resolves.
async function drainRuntimeEventOutbox(db: SqlExecutor, ctx: TenantContext, appDb: SqlExecutor, limit: number): Promise<{ drained: number; resolved: number }> {
  const rows = (await appTx(appDb, ctx, (tx) => tx.query<{ id: string; payload: unknown }>(
    `select id, payload from pierre_rt_outbox where company_id=$1 and kind=$2 and (rt_processing_status is null or rt_processing_status='pending') order by created_at asc limit $3`,
    [ctx.company_id, RUNTIME_EVENT_OUTBOX_KIND, limit]))).rows;
  let drained = 0; let resolved = 0;
  for (const row of rows) {
    const e = (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as RuntimeEventEmission;
    // forward into the runtime event ledger (scheduler role) — audit identity is the emitter's own object
    const status = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_ingest_runtime_event: string }>(
      `select pierre_rt_ingest_runtime_event($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ctx.company_id, e.source, e.event_key, e.kind, e.object_type, e.object_id, e.payload_hash, e.occurred_at ?? null]))).rows[0].pierre_rt_ingest_runtime_event;
    let eventId: string | null = null;
    if (status === "received") {
      eventId = (await withTenant(db, ctx, (tx) => tx.query<{ id: string }>(`select id from pierre_rt_runtime_events where company_id=$1 and source=$2 and event_key=$3`, [ctx.company_id, e.source, e.event_key]))).rows[0].id;
    }
    // resolve the exact wait the emitter declared (only when the event newly landed; duplicates re-resolve nothing)
    if (e.resolve && status === "received") {
      resolved += await resolveMatchingWaits(db, ctx, eventId, e.resolve.event_kind, e.resolve.object_type, e.resolve.object_id, e.fingerprint ?? null);
    }
    await appTx(appDb, ctx, (tx) => tx.query(`update pierre_rt_outbox set rt_processing_status='processed', rt_processed_at=now() where company_id=$1 and id=$2`, [ctx.company_id, row.id]));
    drained += 1;
  }
  return { drained, resolved };
}

async function resolveMatchingWaits(db: SqlExecutor, ctx: TenantContext, eventId: string | null, eventKind: string, objectType: string | null, objectId: string | null, fingerprint: string | null): Promise<number> {
  const waits = (await withTenant(db, ctx, (tx) => tx.query<{ id: string }>(
    `select id from pierre_rt_runtime_waits where company_id=$1 and status='pending' and event_kind=$2
       and (object_type is null or object_type=$3) and (object_id is null or object_id=$4)`,
    [ctx.company_id, eventKind, objectType, objectId]))).rows;
  let n = 0;
  for (const w of waits) {
    const out = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_resolve_runtime_wait: string }>(
      `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [ctx.company_id, w.id, eventId, eventKind, objectType, objectId, fingerprint]))).rows[0].pierre_rt_resolve_runtime_wait;
    if (out === "resolved") n += 1;
  }
  return n;
}

// ── one scheduler tick ────────────────────────────────────────────────────────────────
export async function runPierreRuntimeScheduler(
  db: SqlExecutor, ctx: TenantContext,
  opts: { worker?: string; limit?: number } = {}, deps: RuntimeDeps = {},
): Promise<SchedulerResult> {
  const worker = opts.worker ?? `rt-scheduler:${newUuid().slice(0, 8)}`;
  const limit = Math.min(opts.limit ?? 50, 200);
  const res: SchedulerResult = { recovered: 0, timers_resolved: 0, events_applied: 0, relances_fired: 0, schedules_completed: 0, service_events_drained: 0, service_waits_resolved: 0 };
  const appDb = deps.appDb ?? db;

  // 1. recovery sweep — reclaim expired leases (bumps fencing generation, records superseded one)
  res.recovered = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_recover_runtime_leases: number }>(`select pierre_rt_recover_runtime_leases($1, now(), $2)`, [ctx.company_id, limit]))).rows[0].pierre_rt_recover_runtime_leases;

  // 2. resolve DUE timer waits (no event → resolved_by_event_id is null; FK allows it)
  const timers = (await withTenant(db, ctx, (tx) => tx.query<{ id: string }>(`select id from pierre_rt_runtime_waits where company_id=$1 and status='pending' and wait_kind='timer' and wake_at is not null and wake_at<=now() order by wake_at asc limit $2`, [ctx.company_id, limit]))).rows;
  for (const t of timers) {
    const out = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_resolve_runtime_wait: string }>(`select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [ctx.company_id, t.id, null, null, null, null, null]))).rows[0].pierre_rt_resolve_runtime_wait;
    if (out === "resolved") res.timers_resolved += 1;
  }

  // 2b. P8.5-FINAL §1/§6 — drain SERVICE-EMITTED runtime events from the transactional outbox. The
  // nominal tick NO LONGER scans the business terminal tables (signature_requests/communication_deliveries/
  // validations); the real services emit durable events themselves and this ingestor forwards them into the
  // runtime event ledger and resolves the exact matching wait. (Operator backfill is a separate script.)
  const drained = await drainRuntimeEventOutbox(db, ctx, appDb, limit);
  res.service_events_drained = drained.drained; res.service_waits_resolved = drained.resolved;

  // 3. apply pending ingested events (resolve matching waits by the REAL event id; governed apply)
  const events = (await withTenant(db, ctx, (tx) => tx.query<{ id: string; kind: string; object_type: string | null; object_id: string | null }>(`select id, kind, object_type, object_id from pierre_rt_runtime_events where company_id=$1 and application_status='pending' order by received_at asc limit $2`, [ctx.company_id, limit]))).rows;
  for (const e of events) {
    const n = await resolveMatchingWaits(db, ctx, e.id, e.kind, e.object_type, e.object_id, null);
    await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_apply_runtime_event($1,$2,$3)`, [ctx.company_id, e.id, n]));
    res.events_applied += n;
  }

  // 4. fire due follow-up / relance schedules (bounded; stop-condition checked BEFORE a communication)
  const due = (await withTenant(db, ctx, (tx) => tx.query<{ id: string; mission_run_id: string; step_run_id: string; reason: string; payload: Record<string, unknown>; stop_condition: Record<string, unknown> | null; occurrence_count: number; next_run_at: string | null; recurrence_rule: string | null }>(
    `select * from pierre_rt_claim_due_schedules($1,$2,$3,$4,now())`, [ctx.company_id, limit, worker, 60]))).rows;
  for (const s of due) {
    // a relance never fires after its stop-condition is met / the run is cancelled — GOVERNED completion
    if (await stopConditionMet(appDb, ctx, s.stop_condition)) {
      await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_complete_schedule($1,$2,$3)`, [ctx.company_id, s.id, worker]));
      res.schedules_completed += 1; continue;
    }
    const comm = (s.payload ?? {}) as { event_kind?: string; object_id?: string };
    if (comm.event_kind && comm.object_id) {
      // the relance COMMUNICATION runs under the app role (the scheduler role never does app work) →
      // a governed P8.4 intent + dispatch, never a direct send. A distinct occurrence → a distinct key.
      const occ = s.occurrence_count + 1;
      await appDb.transaction(async (tx) => {
        await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
        await tx.query(`insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
          [newUuid(), ctx.company_id, comm.event_kind, JSON.stringify({ document_id: comm.object_id, version: `relance-${occ}` }), `relance:${s.step_run_id}:${occ}`]);
        await createCommunicationIntents(tx, ctx, {}, deps.comm ?? {});
      });
      await dispatchCommunicationDeliveries(appDb, ctx, { worker: `relance:${s.id.slice(0, 8)}` }, deps.comm ?? {});
      res.relances_fired += 1;
    }
    // R1.9 — the next occurrence comes from the TYPED rule (never a hardcoded +2 days)
    const rule = s.recurrence_rule ? (JSON.parse(s.recurrence_rule) as Parameters<typeof nextScheduleRunAt>[0]) : buildScheduleRule({});
    const next = nextScheduleRunAt(rule, new Date(s.next_run_at ?? Date.now()), s.occurrence_count + 1);
    const outcome = (await withTenant(db, ctx, (tx) => tx.query<{ pierre_rt_fire_schedule: string }>(`select pierre_rt_fire_schedule($1,$2,$3,$4)`, [ctx.company_id, s.id, worker, next ? next.toISOString() : null]))).rows[0].pierre_rt_fire_schedule;
    if (outcome === "completed") res.schedules_completed += 1;
  }
  return res;
}
