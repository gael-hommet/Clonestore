// PHASE 8.5 §18 — the FENCING TOKEN (the decisive gap no prior claim family had). A worker whose lease
// expired and was reclaimed (by itself after recovery, or by the sweeper) holds a STALE generation: its
// late complete/fail/heartbeat is positively REJECTED even though its worker-id still matches. Only the
// current generation may finalize. The recovery sweeper bumps the generation and records the superseded
// one. Lease+locked_by alone is insufficient — the token is asserted in every mutator.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRunWithJob, jobRow, gov } from "./p85-helpers";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const refused = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };
const claim = (w: string) => gov(h, owner, `select * from pierre_rt_runtime_claim($1,$2,$3,$4,now())`, [h.companyA, 10, w, 60]);

describe("P8.5 fencing token", () => {
  it("a stale generation is rejected; the current generation finalizes", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    // worker w1 claims → generation 1
    const c1 = await claim("w1");
    expect(c1.rows.length).toBe(1);
    const token1 = (await jobRow(h, jobId)).fencing_token;

    // lease expires; w1 (still alive) re-claims → generation 2, SAME locked_by=w1
    await h.db.query(`update pierre_rt_runtime_jobs set lease_expires_at=now()-interval '5 seconds' where id=$1`, [jobId]);
    const c2 = await claim("w1");
    expect(c2.rows.length).toBe(1);
    const token2 = (await jobRow(h, jobId)).fencing_token;
    expect(token2).toBe(token1 + 1);

    // the OLD context (token1) must be REJECTED even though locked_by still = w1 (fencing, not ownership)
    expect(await refused(() => gov(h, owner, `select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, jobId, "w1", token1, "succeeded", null, "{}"]))).toBe(true);
    expect(await refused(() => gov(h, owner, `select pierre_rt_runtime_heartbeat($1,$2,$3,$4,$5)`, [h.companyA, jobId, "w1", token1, 60]))).toBe(true);
    expect(await refused(() => gov(h, owner, `select pierre_rt_runtime_fail_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [h.companyA, jobId, "w1", token1, "x", "x", "retry", 60, 5]))).toBe(true);

    // the CURRENT generation finalizes
    await gov(h, owner, `select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, jobId, "w1", token2, "succeeded", null, "{}"]);
    expect((await jobRow(h, jobId)).status).toBe("succeeded");
  });

  it("the recovery sweeper bumps the generation and records the superseded one", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    await claim("w1");
    const before = (await jobRow(h, jobId)).fencing_token;
    await h.db.query(`update pierre_rt_runtime_jobs set lease_expires_at=now()-interval '5 seconds' where id=$1`, [jobId]);
    const n = (await gov<{ pierre_rt_recover_runtime_leases: number }>(h, owner, `select pierre_rt_recover_runtime_leases($1, now(), 50)`, [h.companyA])).rows[0].pierre_rt_recover_runtime_leases;
    expect(n).toBe(1);
    const after = await jobRow(h, jobId);
    expect(after.fencing_token).toBe(before + 1);
    expect(after.status).toBe("retry_scheduled");
    // the superseded generation is recorded in the unified timeline
    const ev = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_events where runtime_job_id=$1 and type='runtime.job_recovered'`, [jobId])).rows[0].n;
    expect(ev).toBe(1);
    // the stale worker (old generation) is now rejected
    expect(await refused(() => gov(h, owner, `select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, jobId, "w1", before, "succeeded", null, "{}"]))).toBe(true);
  });

  it("two workers never both claim the same job (SKIP LOCKED + per-job exclusivity)", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    const a = await claim("wA");
    const b = await claim("wB"); // the job is already processing with a valid lease → not reclaimable
    expect(a.rows.length).toBe(1);
    expect(b.rows.length).toBe(0);
    expect((await jobRow(h, jobId)).locked_by).toBe("wA");
  });
});
