// src/lib/pierre/v1/queue.ts
// PHASE 8.1 — Pierre Production Runtime Core — durable Postgres job queue.
//
// FOR UPDATE SKIP LOCKED claim, leases + heartbeats, exponential backoff with
// jitter, dead-letter, stale-lease recovery, per-tenant concurrency caps, global
// caps, idempotent enqueue. No in-memory queue, no browser dependency.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";

export type JobRow = {
  id: string; company_id: string; task_id: string; mission_id: string;
  status: "ready" | "retry" | "leased" | "succeeded" | "failed" | "dead" | "cancelled";
  priority: number; run_after: string; attempts: number; max_attempts: number;
  lease_owner: string | null; lease_expires_at: string | null; last_error: string | null;
  dedup_key: string; created_at: string; updated_at: string;
};

export type ClaimOptions = {
  worker_id: string;
  lease_ms?: number;
  batch?: number;
  tenant_concurrency_cap?: number; // max simultaneously-leased jobs per company
};

/** Idempotent enqueue (dedup_key unique per company). */
export async function enqueueJob(db: SqlExecutor, j: { company_id: string; task_id: string; mission_id: string; priority?: number; run_after?: string | null; max_attempts?: number; dedup_key: string }): Promise<void> {
  await db.query(
    `insert into pierre_rt_jobs (id, company_id, task_id, mission_id, status, priority, run_after, max_attempts, dedup_key)
     values ($1,$2,$3,$4,'ready',$5, coalesce($6, now()), $7, $8)
     on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), j.company_id, j.task_id, j.mission_id, j.priority ?? 100, j.run_after ?? null, j.max_attempts ?? 5, j.dedup_key]);
}

/**
 * Atomically claim up to `batch` runnable jobs for a worker. Uses FOR UPDATE
 * SKIP LOCKED so concurrent workers never claim the same job. Respects per-tenant
 * concurrency caps (fairness) and expired leases (claimable again).
 */
export async function claimJobs(db: SqlExecutor, opts: ClaimOptions): Promise<JobRow[]> {
  const lease = opts.lease_ms ?? 30000;
  const batch = Math.max(1, Math.min(50, opts.batch ?? 1));
  const cap = opts.tenant_concurrency_cap ?? 1000000;

  return db.transaction(async (tx) => {
    // 1) Lock candidate rows with SKIP LOCKED (concurrent workers never collide).
    // 2) Lease only those within the per-tenant concurrency cap (fairness),
    //    counting jobs already leased for that company. Locked-but-not-leased
    //    rows stay 'ready' (lock released at tx end) for the next round.
    const { rows } = await tx.query<JobRow>(
      `with locked as (
         select id, company_id, priority, run_after, created_at
           from pierre_rt_jobs j
          where j.status in ('ready','retry')
            and j.run_after <= now()
            and (j.lease_expires_at is null or j.lease_expires_at < now())
          order by j.priority desc, j.run_after asc, j.created_at asc
          for update skip locked
          limit $3
       ),
       leased_counts as (
         select company_id, count(*)::int c from pierre_rt_jobs
          where status = 'leased' and lease_expires_at > now() group by company_id
       ),
       ranked as (
         select l.id,
           coalesce(lc.c, 0) + row_number() over (
             partition by l.company_id order by l.priority desc, l.run_after asc, l.created_at asc
           ) as eff
         from locked l left join leased_counts lc on lc.company_id = l.company_id
       ),
       to_claim as (select id from ranked where eff <= $4)
       update pierre_rt_jobs j
          set status = 'leased', lease_owner = $1,
              lease_expires_at = now() + ($2 || ' milliseconds')::interval,
              attempts = j.attempts + 1, updated_at = now()
         from to_claim t
        where j.id = t.id
       returning j.*`,
      [opts.worker_id, lease, batch, cap]);
    return rows;
  });
}

/** Heartbeat: extend a lease the worker still owns. Returns false if lost. */
export async function heartbeat(db: SqlExecutor, jobId: string, workerId: string, leaseMs = 30000): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `update pierre_rt_jobs
        set lease_expires_at = now() + ($3 || ' milliseconds')::interval, updated_at = now()
      where id = $1 and lease_owner = $2 and status = 'leased'
      returning id`, [jobId, workerId, leaseMs]);
  return rows.length === 1;
}

export async function completeJob(db: SqlExecutor, jobId: string, workerId: string): Promise<void> {
  await db.query(
    `update pierre_rt_jobs set status='succeeded', lease_owner=null, lease_expires_at=null, updated_at=now()
      where id=$1 and lease_owner=$2`, [jobId, workerId]);
}

export function backoffMs(attempts: number, baseMs = 500, capMs = 60000): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp));
  return exp + jitter;
}

/** Fail a job: retry with backoff if attempts remain, else dead-letter. */
export async function failJob(db: SqlExecutor, job: JobRow, workerId: string, error: string): Promise<"retry_scheduled" | "dead_lettered"> {
  return db.transaction(async (tx) => {
    if (job.attempts >= job.max_attempts) {
      await tx.query(`update pierre_rt_jobs set status='dead', lease_owner=null, lease_expires_at=null, last_error=$2, updated_at=now() where id=$1 and lease_owner=$3`, [job.id, error.slice(0, 500), workerId]);
      await tx.query(
        `insert into pierre_rt_dead_letters (id, company_id, job_id, task_id, mission_id, reason, payload)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [newUuid(), job.company_id, job.id, job.task_id, job.mission_id, error.slice(0, 500), JSON.stringify({ attempts: job.attempts })]);
      return "dead_lettered";
    }
    const delay = backoffMs(job.attempts);
    await tx.query(
      `update pierre_rt_jobs
          set status='retry', lease_owner=null, lease_expires_at=null, last_error=$2,
              run_after = now() + ($3 || ' milliseconds')::interval, updated_at=now()
        where id=$1 and lease_owner=$4`,
      [job.id, error.slice(0, 500), delay, workerId]);
    return "retry_scheduled";
  });
}

/** Recover jobs whose lease expired (worker crashed): make them claimable again.
 *  Guarantees no task stays leased forever. Returns number recovered. */
export async function recoverStaleLeases(db: SqlExecutor): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `update pierre_rt_jobs
        set status='retry', lease_owner=null, lease_expires_at=null, run_after=now(), updated_at=now()
      where status='leased' and lease_expires_at < now()
      returning id`);
  return rows.length;
}

export async function cancelJobsForTask(db: SqlExecutor, companyId: string, taskId: string): Promise<void> {
  await db.query(`update pierre_rt_jobs set status='cancelled', lease_owner=null, lease_expires_at=null, updated_at=now()
                  where company_id=$1 and task_id=$2 and status in ('ready','retry','leased')`, [companyId, taskId]);
}

export async function queueDepth(db: SqlExecutor, companyId?: string): Promise<{ ready: number; leased: number; dead: number }> {
  const params: unknown[] = [];
  let where = `1=1`;
  if (companyId) { params.push(companyId); where = `company_id=$1`; }
  const { rows } = await db.query<{ status: string; n: number }>(
    `select status, count(*)::int n from pierre_rt_jobs where ${where} group by status`, params);
  const m = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { ready: (m.ready ?? 0) + (m.retry ?? 0), leased: m.leased ?? 0, dead: m.dead ?? 0 };
}
