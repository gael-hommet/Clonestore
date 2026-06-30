// PHASE 8.5-R3 §R3.1/§R3.2 — the planner + worker role wrappers are REALLY USED on the live path. Plan
// creation runs under the planner role; if the injected runner does not become the planner, creation is
// refused. The worker loop runs every truth-call under the worker role; if the injected runner is the
// app role, the claim is refused (the app can't execute the worker truth functions). SET LOCAL ROLE is
// transaction-scoped, so the role never leaks across a reused pooled connection.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, seedRunWithJob } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs, type PlannerRunner } from "../runtime-service";
import type { SqlExecutor } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

// a role-aware runner that binds an arbitrary role for one transaction (mimics the production wrappers)
const roleRunner = (role: string) => (async (binding, fn) => h.db.transaction(async (tx) => {
  await tx.query(`set local role ${role}`);
  await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
  return fn(tx);
})) as PlannerRunner;

describe("P8.5-R3 planner + worker wrapper wiring", () => {
  it("plan creation runs under the PLANNER role (default); an app-role runner is refused", async () => {
    const m = await seedMission(h, owner);
    const plan = { steps: [{ step_key: "a", action_key: "mission.noop" }] };
    // default runner binds the planner role → run created
    const okRun = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan });
    expect(okRun.ok).toBe(true);
    // an injected runner that becomes the APP role can NOT execute the create function (revoked v24)
    const m2 = await seedMission(h, owner, "second");
    await expect(createMissionRunFromPlan(h.db, owner, { mission_id: m2, plan }, { runPlanner: roleRunner("pierre_rt_app") })).rejects.toThrow();
  });

  it("the worker loop's truth-calls run under the WORKER role; an app-role runner is refused at claim", async () => {
    await seedRunWithJob(h, owner);
    // an injected worker-tx runner that becomes the APP role can NOT execute pierre_rt_runtime_claim
    const appWorkerTx = (async (binding, fn) => h.db.transaction(async (tx) => {
      await tx.query(`set local role pierre_rt_app`);
      await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
      return fn(tx);
    })) as <T>(b: { company_id: string }, f: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
    await expect(runPierreRuntimeJobs(h.db, owner, { worker: "w" }, { runWorkerTx: appWorkerTx })).rejects.toThrow(/permission denied|claim/i);
  });

  it("SET LOCAL ROLE is transaction-scoped — the role never leaks across a reused connection", async () => {
    await h.db.transaction(async (tx) => { await tx.query(`set local role pierre_rt_runtime_worker`); const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user; expect(cu).toBe("pierre_rt_runtime_worker"); });
    const after = (await h.db.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    expect(after).not.toBe("pierre_rt_runtime_worker"); // role reset after COMMIT
  });
});
