// PHASE 8.5-R4 §R4.3 — the scheduler runs every governed call under the SCHEDULER role. The scheduler
// truth functions require that role (the app role is refused); SET LOCAL ROLE is transaction-scoped so
// the role never leaks across a reused connection.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission } from "./p85-helpers";
import { asRole, refused } from "./p84-r1-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5-R4 scheduler wrapper (role-bound)", () => {
  it("a timer wait is resolved by the scheduler running under the scheduler role", async () => {
    const m = await seedMission(h, owner);
    const runId = (await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "w", action_key: "wait.until_time", input: { wake_at: new Date(Date.now() - 1000).toISOString() } },
    ] } })).mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    const sched = await runPierreRuntimeScheduler(h.db, owner, {}); // internally binds the scheduler role
    expect(sched.timers_resolved).toBe(1);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1`, [runId])).rows[0].status).toBe("completed");
  });

  it("the scheduler truth functions REQUIRE the scheduler role (app role refused)", async () => {
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(`select pierre_rt_recover_runtime_leases($1, now(), 10)`, [h.companyA])))).toBe(true);
    expect((await asRole(h, "pierre_rt_runtime_scheduler", h.companyA, (q) => q(`select pierre_rt_recover_runtime_leases($1, now(), 10) as n`, [h.companyA]))).rows.length).toBe(1);
  });

  it("SET LOCAL ROLE scheduler is transaction-scoped (no leak across the connection)", async () => {
    await h.db.transaction(async (tx) => { await tx.query(`set local role pierre_rt_runtime_scheduler`); expect((await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user).toBe("pierre_rt_runtime_scheduler"); });
    expect((await h.db.query<{ current_user: string }>(`select current_user`)).rows[0].current_user).not.toBe("pierre_rt_runtime_scheduler");
  });
});
