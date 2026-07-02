// src/lib/pierre/v1/fair-claim.ts
// PHASE 8.9 — tenant-fair job claiming (minimal fairness primitive, NO schema change,
// NO rewrite of the durable queue).
//
// WHY: queue.claimJobs() orders its candidate window by (priority desc, run_after asc,
// created_at asc) across ALL tenants. A single tenant with a large, older backlog fills
// that oldest-first candidate window, so other tenants' newer jobs are never even locked
// in a round. The existing `tenant_concurrency_cap` throttles the noisy tenant's *in-flight*
// count but does not admit other tenants into the oldest-first candidate set — so under a
// sustained single-tenant flood, quiet tenants wait behind the whole backlog (measured in
// P8.9: fairness closure). This module adds tenant-AWARE selection on top of the same
// FOR UPDATE SKIP LOCKED primitive:
//   • claimJobsForTenant() — a tenant-scoped atomic claim (one company).
//   • fairClaimRound()      — weighted round-robin over the due tenants, a bounded quota
//                             per tenant per round, so no tenant can monopolize a worker.
// Within a tenant, strict (priority, age) order is preserved. The only relaxation is the
// GLOBAL priority ordering across tenants — a deliberate, documented trade-off: cross-tenant
// service becomes fair (bounded wait for every tenant) at the cost of a noisy tenant's
// low-priority-but-old jobs no longer blocking other tenants. See
// P8_9_100K_SELLABILITY_REPORT.md §"1,000-active-tenant fairness".

import type { SqlExecutor } from "./sql";
import type { JobRow } from "./queue";

export type TenantClaimOptions = {
  company_id: string;
  worker_id: string;
  lease_ms?: number;
  batch?: number;
};

/**
 * Atomically claim up to `batch` runnable jobs for ONE company. Same safety as
 * queue.claimJobs (FOR UPDATE SKIP LOCKED → concurrent workers never claim the same
 * job) but scoped to a single tenant so a fair scheduler can give each tenant a bounded
 * quota. Within the tenant, jobs are taken in (priority desc, run_after asc, created_at asc)
 * order.
 */
export async function claimJobsForTenant(db: SqlExecutor, opts: TenantClaimOptions): Promise<JobRow[]> {
  const lease = opts.lease_ms ?? 30000;
  const batch = Math.max(1, Math.min(50, opts.batch ?? 1));
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<JobRow>(
      `with locked as (
         select id from pierre_rt_jobs
          where company_id = $3
            and status in ('ready','retry')
            and run_after <= now()
            and (lease_expires_at is null or lease_expires_at < now())
          order by priority desc, run_after asc, created_at asc
          for update skip locked
          limit $4
       )
       update pierre_rt_jobs j
          set status = 'leased', lease_owner = $1,
              lease_expires_at = now() + ($2 || ' milliseconds')::interval,
              attempts = j.attempts + 1, updated_at = now()
         from locked l
        where j.id = l.id
       returning j.*`,
      [opts.worker_id, lease, opts.company_id, batch]);
    return rows;
  });
}

/** Companies that currently have at least one runnable (ready/retry, due, unleased) job.
 *  Bounded by `limit`. Cheap tenant discovery for the fair scheduler. */
export async function dueTenants(db: SqlExecutor, limit = 5000): Promise<string[]> {
  const { rows } = await db.query<{ company_id: string }>(
    `select distinct company_id from pierre_rt_jobs
      where status in ('ready','retry') and run_after <= now()
        and (lease_expires_at is null or lease_expires_at < now())
      limit $1`, [Math.max(1, limit)]);
  return rows.map((r) => r.company_id);
}

export type FairRoundOptions = {
  worker_id: string;
  tenants: readonly string[];      // the (sub)set of tenants this worker is responsible for
  maxPerTenant?: number;           // quota per tenant per round (weighted round-robin weight)
  lease_ms?: number;
  totalBatch?: number;             // stop once this many jobs claimed this round (0 = no cap)
};

/**
 * One fair round: iterate the tenant list, claiming up to `maxPerTenant` jobs from each
 * (round-robin). No tenant can take more than its quota, so a flooding tenant cannot
 * monopolize a worker — every tenant in the list is offered service each round. Returns
 * every job claimed this round (already leased to `worker_id`).
 */
export async function fairClaimRound(db: SqlExecutor, opts: FairRoundOptions): Promise<JobRow[]> {
  const maxPerTenant = Math.max(1, opts.maxPerTenant ?? 1);
  const totalBatch = opts.totalBatch ?? 0;
  const out: JobRow[] = [];
  for (const cid of opts.tenants) {
    if (totalBatch > 0 && out.length >= totalBatch) break;
    const jobs = await claimJobsForTenant(db, { company_id: cid, worker_id: opts.worker_id, batch: maxPerTenant, lease_ms: opts.lease_ms });
    for (const j of jobs) out.push(j);
  }
  return out;
}
