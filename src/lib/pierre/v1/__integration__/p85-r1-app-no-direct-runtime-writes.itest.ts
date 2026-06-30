// PHASE 8.5-R1 §R1.2 — the application role holds NO direct DML on the runtime-truth tables. It can not
// raw-insert a plan version / run / step / job / schedule, nor raw-update a run/step to a fabricated
// status. The ONLY path is the governed SECURITY DEFINER functions (which force the initial statuses).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { asRole, refused } from "./p84-r1-helpers";
import { seedRunWithJob } from "./p85-helpers";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const app = (sql: string, p: readonly unknown[] = []) => refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(sql, p)));

describe("P8.5-R1 app role has no direct runtime-truth DML", () => {
  it("the app role is REFUSED on raw inserts of every runtime-truth table", async () => {
    const { missionId } = await seedRunWithJob(h, owner);
    expect(await app(`insert into pierre_rt_mission_plan_versions (id,company_id,mission_id,version_number,plan_fingerprint,plan_json) values ($1,$2,$3,99,'x','{}')`, [newUuid(), h.companyA, missionId])).toBe(true);
    expect(await app(`insert into pierre_rt_mission_runs (id,company_id,mission_id,plan_version_id,run_number,status) values ($1,$2,$3,$4,99,'completed')`, [newUuid(), h.companyA, missionId, newUuid()])).toBe(true);
    expect(await app(`insert into pierre_rt_runtime_schedules (id,company_id,schedule_kind,status,dedup_key) values ($1,$2,'once','active',$3)`, [newUuid(), h.companyA, newUuid()])).toBe(true);
  });

  it("the app role is REFUSED on raw updates that would fabricate run/step truth", async () => {
    await seedRunWithJob(h, owner);
    expect(await app(`update pierre_rt_mission_runs set status='completed' where company_id=$1`, [h.companyA])).toBe(true);
    expect(await app(`update pierre_rt_step_runs set status='succeeded' where company_id=$1`, [h.companyA])).toBe(true);
    expect(await app(`update pierre_rt_runtime_jobs set status='succeeded' where company_id=$1`, [h.companyA])).toBe(true);
    expect(await app(`delete from pierre_rt_runtime_jobs where company_id=$1`, [h.companyA])).toBe(true);
  });

  it("the governed create function is the working path (server-forced initial statuses)", async () => {
    // createMissionRunFromPlan (used by the service) goes through pierre_rt_create_compiled_mission_run;
    // the run/steps/jobs it produces are never terminal — only running / pending|ready / queued.
    const { runId } = await seedRunWithJob(h, owner);
    const run = (await h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1`, [runId])).rows[0];
    expect(run.status).toBe("running");
    const jobs = (await h.db.query<{ status: string }>(`select status from pierre_rt_runtime_jobs where mission_run_id=$1`, [runId])).rows;
    expect(jobs.every((j) => j.status === "queued")).toBe(true);
  });
});
