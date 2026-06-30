// PHASE 8.5 §33/§34 — crash recovery. A worker that claims a job and dies mid-flight leaves it
// 'processing' with an expiring lease; the recovery sweeper reclaims it (bumping the fencing
// generation) and a fresh worker re-executes it EXACTLY once — the dead generation can never finalize.
// Completion is atomic (job + step + cascade + next-step enqueue in one governed call), so there is no
// "completed-but-next-not-scheduled" gap to repair.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses, jobRow, gov } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5 crash recovery", () => {
  it("a dead worker's job is reclaimed by the sweeper and re-executed exactly once", async () => {
    const m = await seedMission(h, owner);
    const runId = (await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "a", action_key: "mission.noop" }, { step_key: "b", action_key: "mission.noop", depends_on: ["a"] },
    ] } })).mission_run_id!;
    const jobA = (await h.db.query<{ id: string }>(`select id from pierre_rt_runtime_jobs where mission_run_id=$1`, [runId])).rows[0].id;

    // a worker claims A then "crashes" (never completes); the lease expires
    await gov(h, owner, `select * from pierre_rt_runtime_claim($1,$2,$3,$4,now())`, [h.companyA, 10, "dead-worker", 60]);
    const deadToken = (await jobRow(h, jobA)).fencing_token;
    await h.db.query(`update pierre_rt_runtime_jobs set lease_expires_at=now()-interval '10 seconds' where id=$1`, [jobA]);

    // the sweeper reclaims A (new generation); the dead worker can no longer finalize it
    const sweep = await runPierreRuntimeScheduler(h.db, owner, {});
    expect(sweep.recovered).toBe(1);
    expect((await jobRow(h, jobA)).fencing_token).toBe(deadToken + 1);
    let refused = false;
    try { await gov(h, owner, `select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, jobA, "dead-worker", deadToken, "succeeded", null, "{}"]); } catch { refused = true; }
    expect(refused).toBe(true);

    // a fresh worker re-executes A exactly once → only ONE successful attempt recorded, run advances
    await runPierreRuntimeJobs(h.db, owner, { worker: "w-new" });
    expect((await stepStatuses(h, runId)).a).toBe("succeeded");
    expect((await stepStatuses(h, runId)).b).toBe("queued");
    const successes = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_job_attempts where job_id=$1 and result_status='succeeded'`, [jobA])).rows[0].n;
    expect(successes).toBe(1); // exactly once, no double execution

    // finish the run
    await runPierreRuntimeJobs(h.db, owner, { worker: "w-new" });
    expect((await runState(h, runId)).status).toBe("completed");
  });
});
