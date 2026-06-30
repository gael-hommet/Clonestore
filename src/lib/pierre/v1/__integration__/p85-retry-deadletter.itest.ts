// PHASE 8.5 §31/§32 — bounded retries → dead-letter. A retriable failure reschedules with a bounded
// backoff; once the attempt bound is reached the job DEAD-LETTERS (a dedicated dead-letter row is
// written, the step is dead_lettered, the run is blocked). A block disposition never retries. A
// reconcile (ambiguous) disposition parks the job in waiting_reconciliation (no blind retry).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRunWithJob, jobRow, runState, gov } from "./p85-helpers";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

const claim = (w: string) => gov(h, owner, `select * from pierre_rt_runtime_claim($1,$2,$3,$4,now())`, [h.companyA, 10, w, 60]);
const fail = (jobId: string, w: string, token: number, disp: string, max: number) => gov<{ pierre_rt_runtime_fail_job: string }>(h, owner, `select pierre_rt_runtime_fail_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [h.companyA, jobId, w, token, "transient", "boom", disp, 1, max]);
const due = (jobId: string) => h.db.query(`update pierre_rt_runtime_jobs set next_retry_at=now()-interval '1 second' where id=$1`, [jobId]);

describe("P8.5 retry → dead-letter", () => {
  it("a retriable failure retries with a bound, then dead-letters (run blocked, dead-letter row)", async () => {
    const { runId, jobId } = await seedRunWithJob(h, owner);
    // attempt 1 → retry; attempt 2 → retry; attempt 3 (>= max 3) → dead_letter
    let token = (await claim("w")).rows[0].fencing_token as number;
    expect((await fail(jobId, "w", token, "retry", 3)).rows[0].pierre_rt_runtime_fail_job).toBe("retry_scheduled");
    await due(jobId);
    token = (await claim("w")).rows[0].fencing_token as number;
    expect((await fail(jobId, "w", token, "retry", 3)).rows[0].pierre_rt_runtime_fail_job).toBe("retry_scheduled");
    await due(jobId);
    token = (await claim("w")).rows[0].fencing_token as number;
    expect((await fail(jobId, "w", token, "retry", 3)).rows[0].pierre_rt_runtime_fail_job).toBe("dead_letter");

    expect((await jobRow(h, jobId)).status).toBe("dead_letter");
    expect((await runState(h, runId)).status).toBe("blocked");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_dead_letters where runtime_job_id=$1`, [jobId])).rows[0].n).toBe(1);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_step_runs where mission_run_id=$1`, [runId])).rows[0].status).toBe("dead_lettered");
  });

  it("a reconcile disposition parks the job in waiting_reconciliation (no blind retry)", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    const token = (await claim("w")).rows[0].fencing_token as number;
    expect((await fail(jobId, "w", token, "reconcile", 5)).rows[0].pierre_rt_runtime_fail_job).toBe("waiting_reconciliation");
    expect((await jobRow(h, jobId)).status).toBe("waiting_reconciliation");
  });

  it("a block disposition never retries (run blocked immediately)", async () => {
    const { runId, jobId } = await seedRunWithJob(h, owner);
    const token = (await claim("w")).rows[0].fencing_token as number;
    expect((await fail(jobId, "w", token, "block", 5)).rows[0].pierre_rt_runtime_fail_job).toBe("blocked");
    expect((await runState(h, runId)).status).toBe("blocked");
  });
});
