// PHASE 8.5-R4 §R4.11 — the lease controller keeps a long action's lease alive and ABORTS on loss. Each
// beat goes through the governed pierre_rt_runtime_heartbeat (extending lease_expires_at); when a newer
// generation reclaims the job (recovery bumps the fencing), the next beat is refused → isLost flips and
// runWithLease surfaces the loss instead of letting the action "succeed". The worker engages the
// controller only for a LONG action (timeout beyond one lease window).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRunWithJob } from "./p85-helpers";
import { RuntimeLeaseController, LeaseLostError, type LeaseScheduler } from "../runtime-lease-controller";
import { runPierreRuntimeJobs } from "../runtime-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function claimJob(jobId: string, worker: string): Promise<number> {
  return h.db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [owner.company_id]);
    const r = await tx.query<{ id: string; fencing_token: number }>(`select * from pierre_rt_runtime_claim($1,$2,$3,$4,now())`, [owner.company_id, 10, worker, 60]);
    return Number(r.rows.find((x) => x.id === jobId)!.fencing_token);
  });
}
const beatFn = (jobId: string, worker: string, token: number) => () =>
  h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [owner.company_id]); await tx.query(`select pierre_rt_runtime_heartbeat($1,$2,$3,$4,$5)`, [owner.company_id, jobId, worker, token, 60]); }).then(() => undefined);
const leaseExpiry = (jobId: string) => h.db.query<{ lease_expires_at: string }>(`select lease_expires_at from pierre_rt_runtime_jobs where id=$1`, [jobId]).then((r) => r.rows[0].lease_expires_at);

describe("P8.5-R4 lease controller", () => {
  it("each beat extends the lease via the governed heartbeat", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    const token = await claimJob(jobId, "w1");
    const before = await leaseExpiry(jobId);
    const c = new RuntimeLeaseController({ heartbeat: beatFn(jobId, "w1", token), intervalMs: 1000 });
    await c.beat();
    await c.beat();
    expect(c.beats).toBe(2);
    expect(c.isLost).toBe(false);
    expect(new Date(await leaseExpiry(jobId)).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it("a beat refused after the job is reclaimed marks the lease LOST and aborts the action", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    const token = await claimJob(jobId, "w1");
    // a recovery sweep in the future reclaims the (now-expired) processing job → fencing bumped
    await h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [owner.company_id]); await tx.query(`select pierre_rt_recover_runtime_leases($1, $2::timestamptz, 10)`, [owner.company_id, "2026-12-31T00:00:00Z"]); });

    const c = new RuntimeLeaseController({ heartbeat: beatFn(jobId, "w1", token), intervalMs: 1000 });
    // the action "completes" but the lease was lost while it ran → runWithLease must NOT report success
    await expect(c.runWithLease(async () => { await c.beat(); return "done"; })).rejects.toBeInstanceOf(LeaseLostError);
    expect(c.isLost).toBe(true);
  });

  it("ensureHeld throws once the lease is lost", async () => {
    const c = new RuntimeLeaseController({ heartbeat: () => Promise.reject(new Error("stale fencing token")), intervalMs: 1000 });
    await c.beat();
    expect(c.isLost).toBe(true);
    expect(() => c.ensureHeld()).toThrow(LeaseLostError);
  });

  it("the worker engages the controller for a LONG action (timeout beyond one lease window)", async () => {
    // a tiny lease (1s) makes the default 60s-timeout noop a 'long' action → the controller is engaged
    const scheduled: Array<{ ms: number }> = []; let cancels = 0;
    const fakeScheduler: LeaseScheduler = { schedule: (_fn, ms) => { scheduled.push({ ms }); return { ms }; }, cancel: () => { cancels += 1; } };
    await seedRunWithJob(h, owner);
    const res = await runPierreRuntimeJobs(h.db, owner, { lease_seconds: 1 }, { leaseScheduler: fakeScheduler });
    expect(res.succeeded).toBe(1);
    expect(scheduled.length).toBe(1); // the keep-alive timer was started for the long action
    expect(cancels).toBe(1);          // …and cleanly stopped
  });
});
