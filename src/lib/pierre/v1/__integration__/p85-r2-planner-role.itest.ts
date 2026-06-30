// PHASE 8.5-R2 §R2.4 — plan/run creation is owned by a dedicated NOLOGIN planner role. The application
// role can NO LONGER execute pierre_rt_create_compiled_mission_run, so a run can only be created by the
// server-side planner that compiled + fingerprinted the plan. The planner executor is fail-closed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { asRole, refused } from "./p84-r1-helpers";
import { seedMission } from "./p85-helpers";
import { newUuid } from "../sql";
import { createRuntimePlannerExecutor, RuntimePlannerDbError } from "../runtime-planner-db";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const has = async (sql: string, p: readonly unknown[] = []) => ((await h.db.query<{ n: number }>(sql, p)).rows[0].n > 0);

describe("P8.5-R2 planner role (non-forgeable plan creation)", () => {
  it("the dedicated planner role exists and owns the create grant; the app role does not", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname='pierre_rt_runtime_planner'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_runtime_planner' and routine_name='pierre_rt_create_compiled_mission_run'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_create_compiled_mission_run'`)).toBe(false);
  });

  it("the APP role is REFUSED on pierre_rt_create_compiled_mission_run", async () => {
    const m = await seedMission(h, owner);
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(
      `select * from pierre_rt_create_compiled_mission_run($1,$2,'1','fp','{}','{}','[]','[]',$3,null,'normal')`,
      [h.companyA, m, h.userA])))).toBe(true);
  });

  it("the planner executor is fail-closed without a dedicated DSN", async () => {
    const prev = process.env.PIERRE_RUNTIME_PLANNER_DATABASE_URL;
    delete process.env.PIERRE_RUNTIME_PLANNER_DATABASE_URL;
    await expect(createRuntimePlannerExecutor()).rejects.toBeInstanceOf(RuntimePlannerDbError);
    if (prev !== undefined) process.env.PIERRE_RUNTIME_PLANNER_DATABASE_URL = prev;
  });

  it("a structurally falsified plan is refused: a dependency on a non-existent step (planner role)", async () => {
    const m = await seedMission(h, owner);
    // run as planner (the only authorized caller) but supply a dep that names a step not in the plan
    const steps = JSON.stringify([{ step_key: "a", action_key: "mission.noop", step_ordinal: 0, input: {}, input_hash: "x", dependency_count: 1 }]);
    const deps = JSON.stringify([{ step_key: "a", depends_on: "ghost" }]);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_planner", h.companyA, (q) => q(
      `select * from pierre_rt_create_compiled_mission_run($1,$2,'1',$3,'{}','{}',$4,$5,$6,null,'normal')`,
      [h.companyA, m, newUuid(), steps, deps, h.userA])))).toBe(true);
  });
});
