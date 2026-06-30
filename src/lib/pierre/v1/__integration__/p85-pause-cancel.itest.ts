// PHASE 8.5 §35/§36 — pause / resume / cancel. Pause holds new claims (a queued job becomes
// unclaimable) without losing state; resume re-enables exactly the ready work. Cancel transitions
// through cancelling → cancelled: queued jobs + pending waits + active schedules are cancelled (a
// processing job / external effect is NEVER pretended-undone), then the run is finalized.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs, pauseMissionRun, resumeMissionRun, requestCancelMissionRun } from "../runtime-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const TWO = { steps: [{ step_key: "a", action_key: "mission.noop" }, { step_key: "b", action_key: "mission.noop", depends_on: ["a"] }] };

describe("P8.5 pause / resume / cancel", () => {
  it("pause holds new claims; resume re-enables the work", async () => {
    const m = await seedMission(h, owner);
    const runId = (await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: TWO })).mission_run_id!;
    await pauseMissionRun(h.db, owner, runId);
    expect((await runState(h, runId)).status).toBe("paused");
    const held = await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect(held.claimed).toBe(0); // no job claimable while paused (the job is held, state preserved)
    expect((await stepStatuses(h, runId)).a).toBe("queued");

    await resumeMissionRun(h.db, owner, runId);
    expect((await runState(h, runId)).status).toBe("running");
    const resumed = await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect(resumed.succeeded).toBe(1);
    expect((await stepStatuses(h, runId)).a).toBe("succeeded");
  });

  it("cancel transitions to cancelled and cancels queued jobs + pending steps", async () => {
    const m = await seedMission(h, owner);
    const runId = (await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: TWO })).mission_run_id!;
    await requestCancelMissionRun(h.db, owner, runId);
    expect((await runState(h, runId)).status).toBe("cancelled");
    const jobs = (await h.db.query<{ status: string }>(`select status from pierre_rt_runtime_jobs where mission_run_id=$1`, [runId])).rows;
    expect(jobs.every((j) => j.status === "cancelled")).toBe(true);
    const steps = await stepStatuses(h, runId);
    expect(steps.b).toBe("cancelled");
    // a cancelled run yields no further work
    const after = await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect(after.claimed).toBe(0);
  });
});
