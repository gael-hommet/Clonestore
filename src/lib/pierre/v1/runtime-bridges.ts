// src/lib/pierre/v1/runtime-bridges.ts
// PHASE 8.5-FINAL §6 — OPERATOR BACKFILL / RECONCILIATION ONLY. These functions SCAN the business terminal
// tables (signature_requests / communication_deliveries / validations) and bridge any terminal fact that
// is MISSING a durable runtime event into the ledger. They are the canonical-outbox SAFETY NET: the
// nominal path is now SERVICE-DRIVEN — the real services emit a durable runtime event in their own
// transaction (see runtime-event-bus.ts + the scheduler's drainRuntimeEventOutbox). The runtime scheduler
// tick NO LONGER calls these; they exist for an explicit operator reconciliation script (e.g. recovering
// from a crash between a terminal transition and its outbox emit), are idempotent (event_key dedup), and
// must never be wired back into the nominal tick.

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";
import { ingestPierreRuntimeEvent } from "./runtime-scheduler";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** read the business truth tables under the app role + tenant GUC (the scheduler role can NOT see them). */
function appRead<T>(appDb: SqlExecutor, ctx: TenantContext, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return appDb.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); return fn(tx); });
}

export type BridgeResult = { signatures: number; communications: number; approvals: number };

/** R4.9 — a P8.3 signature_request that reached the terminal 'completed' state resolves the durable wait
 *  bound to its real signature_request_id (event_kind 'signature.completed'). A declined/expired/failed
 *  request is NOT bridged as a completion — that step times out to an operator, never a fake success. */
export async function bridgeSignatureCompletions(db: SqlExecutor, ctx: TenantContext, appDb: SqlExecutor): Promise<number> {
  const rows = (await appRead(appDb, ctx, (tx) => tx.query<{ id: string }>(
    `select distinct sr.id from pierre_rt_signature_requests sr
       join pierre_rt_runtime_waits w on w.company_id=sr.company_id and w.object_type='signature_request'
            and w.object_id=sr.id and w.status='pending' and w.event_kind='signature.completed'
      where sr.company_id=$1 and sr.status='completed'`, [ctx.company_id]))).rows;
  let n = 0;
  for (const r of rows) {
    const res = await ingestPierreRuntimeEvent(db, ctx, { source: "p83_signature", event_key: `sig:${r.id}:completed`, kind: "signature.completed", object_type: "signature_request", object_id: r.id, payload_hash: sha(`sig:${r.id}:completed`) });
    if (res.resolved > 0) n += 1;
  }
  return n;
}

/** R4.10 — a P8.4 communication intent whose delivery reached the terminal 'delivered' state resolves a
 *  durable wait bound to the intent id (event_kind 'communication.delivered'). Truth comes from the
 *  governed delivery table, never a raw provider callback. */
export async function bridgeCommunicationDeliveries(db: SqlExecutor, ctx: TenantContext, appDb: SqlExecutor): Promise<number> {
  const rows = (await appRead(appDb, ctx, (tx) => tx.query<{ id: string }>(
    `select distinct ci.id from pierre_rt_communication_intents ci
       join pierre_rt_communication_deliveries d on d.company_id=ci.company_id and d.intent_id=ci.id and d.status='delivered'
       join pierre_rt_runtime_waits w on w.company_id=ci.company_id and w.object_type='communication'
            and w.object_id=ci.id and w.status='pending' and w.event_kind='communication.delivered'
      where ci.company_id=$1`, [ctx.company_id]))).rows;
  let n = 0;
  for (const r of rows) {
    const res = await ingestPierreRuntimeEvent(db, ctx, { source: "p84_communication", event_key: `comm:${r.id}:delivered`, kind: "communication.delivered", object_type: "communication", object_id: r.id, payload_hash: sha(`comm:${r.id}:delivered`) });
    if (res.resolved > 0) n += 1;
  }
  return n;
}

/** R4.8 — an approval (pierre_rt_validations) that has been DECIDED resolves the durable approval wait
 *  bound to its validation_id — but only after REVALIDATION (the decided validation must still belong to
 *  the same mission as the waiting run; a stale/mismatched binding is never auto-applied) and only when
 *  the decision is 'approved'. EVERY decision is mirrored to the unified outbox; a rejection is recorded
 *  but never lets the step silently proceed (the run blocks / times out to an operator). */
export async function bridgeApprovalDecisions(db: SqlExecutor, ctx: TenantContext, appDb: SqlExecutor): Promise<number> {
  const rows = (await appRead(appDb, ctx, (tx) => tx.query<{ validation_id: string; status: string; mission_id: string; run_mission: string; approved_fingerprint: string | null }>(
    `select v.id as validation_id, v.status, v.mission_id, mr.mission_id as run_mission, v.risk_context->>'approved_fingerprint' as approved_fingerprint
       from pierre_rt_validations v
       join pierre_rt_runtime_waits w on w.company_id=v.company_id and w.object_type='validation'
            and w.object_id=v.id and w.status='pending' and w.event_kind='approval.decided'
       join pierre_rt_mission_runs mr on mr.company_id=w.company_id and mr.id=w.mission_run_id
      where v.company_id=$1 and v.decided_at is not null
        and v.status in ('approved','rejected','changes_requested','expired','escalated')`, [ctx.company_id]))).rows;
  let n = 0;
  for (const r of rows) {
    if (r.mission_id !== r.run_mission) continue; // REVALIDATION — a mismatched binding is never applied
    // validation → unified outbox (idempotent; one row per (validation, decision))
    await appRead(appDb, ctx, (tx) => tx.query(
      `insert into pierre_rt_outbox (id, company_id, mission_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5,$6) on conflict (company_id, dedup_key) do nothing`,
      [newUuid(), ctx.company_id, r.mission_id, "runtime.validation_decided", JSON.stringify({ validation_id: r.validation_id, decision: r.status }), `val-decided:${r.validation_id}:${r.status}`]));
    if (r.status === "approved") {
      // the resolution carries the APPROVED content fingerprint; the governed resolve refuses it if the
      // step's pinned content changed since the wait was created (a stale approval never auto-passes).
      // the event_key includes the approved fingerprint so a CORRECTED re-approval (a new content version)
      // emits a fresh event rather than being deduped against the earlier, stale one.
      const fpKey = r.approved_fingerprint ?? "none";
      const res = await ingestPierreRuntimeEvent(db, ctx, { source: "p8x_approval", event_key: `val:${r.validation_id}:approved:${fpKey}`, kind: "approval.decided", object_type: "validation", object_id: r.validation_id, payload_hash: sha(`val:${r.validation_id}:approved:${fpKey}`), fingerprint: r.approved_fingerprint });
      if (res.resolved > 0) n += 1;
    }
    // a non-approval decision is recorded (outbox) but NOT bridged as 'approval.decided' → the step never
    // auto-passes on a rejection; it waits for the operator / expiry.
  }
  return n;
}

/** run all three governed bridges for a tenant (called from the scheduler tick). */
export async function runPierreRuntimeBridges(db: SqlExecutor, ctx: TenantContext, appDb: SqlExecutor): Promise<BridgeResult> {
  return {
    signatures: await bridgeSignatureCompletions(db, ctx, appDb),
    communications: await bridgeCommunicationDeliveries(db, ctx, appDb),
    approvals: await bridgeApprovalDecisions(db, ctx, appDb),
  };
}
