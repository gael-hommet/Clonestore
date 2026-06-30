// PHASE 8.5 §16/§19 — least-privilege runtime roles. The WORKER role may claim + advance its jobs but
// can NOT read a business table (employees/contracts). The SCHEDULER role may recover/fire but can NOT
// read a business table. The APP role can NOT execute a worker truth-function and can NOT insert a
// fabricated (non-queued) job (BEFORE-INSERT guard). The dedicated executors are fail-closed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { asRole, refused } from "./p84-r1-helpers";
import { seedRunWithJob } from "./p85-helpers";
import { newUuid } from "../sql";
import { createRuntimeWorkerExecutor, RuntimeWorkerDbError } from "../runtime-worker-db";
import { createRuntimeSchedulerExecutor, RuntimeSchedulerDbError } from "../runtime-scheduler-db";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5 runtime role isolation", () => {
  it("the worker executor + scheduler executor are fail-closed without a dedicated DSN", async () => {
    const pw = process.env.PIERRE_RUNTIME_WORKER_DATABASE_URL; const ps = process.env.PIERRE_RUNTIME_SCHEDULER_DATABASE_URL;
    delete process.env.PIERRE_RUNTIME_WORKER_DATABASE_URL; delete process.env.PIERRE_RUNTIME_SCHEDULER_DATABASE_URL;
    await expect(createRuntimeWorkerExecutor()).rejects.toBeInstanceOf(RuntimeWorkerDbError);
    await expect(createRuntimeSchedulerExecutor()).rejects.toBeInstanceOf(RuntimeSchedulerDbError);
    if (pw !== undefined) process.env.PIERRE_RUNTIME_WORKER_DATABASE_URL = pw;
    if (ps !== undefined) process.env.PIERRE_RUNTIME_SCHEDULER_DATABASE_URL = ps;
  });

  it("the WORKER role may claim its jobs but is REFUSED on a contract / employee", async () => {
    await seedRunWithJob(h, owner);
    const claimed = await asRole(h, "pierre_rt_runtime_worker", h.companyA, (q) => q(`select * from pierre_rt_runtime_claim($1,$2,$3,$4,now())`, [h.companyA, 10, "w", 60]));
    expect(claimed.rows.length).toBe(1);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_worker", h.companyA, (q) => q(`select count(*) from pierre_rt_employee_contracts`)))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_worker", h.companyA, (q) => q(`select count(*) from pierre_rt_employees`)))).toBe(true);
  });

  it("the SCHEDULER role may recover but is REFUSED on a contract / employee", async () => {
    expect((await asRole(h, "pierre_rt_runtime_scheduler", h.companyA, (q) => q(`select pierre_rt_recover_runtime_leases($1, now(), 10) as n`, [h.companyA]))).rows.length).toBe(1);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_scheduler", h.companyA, (q) => q(`select count(*) from pierre_rt_employees`)))).toBe(true);
  });

  it("the APP role can NOT execute a worker truth-function (complete_job)", async () => {
    const { jobId } = await seedRunWithJob(h, owner);
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(`select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, jobId, "x", 1, "succeeded", null, "{}"])))).toBe(true);
  });

  it("the APP role has NO direct DML on runtime jobs/steps (R1.2 — governed functions only)", async () => {
    const { runId, jobId } = await seedRunWithJob(h, owner);
    const j = (await h.db.query<{ mission_id: string; step_run_id: string }>(`select mission_id, step_run_id from pierre_rt_runtime_jobs where id=$1`, [jobId])).rows[0];
    const ins = (status: string) => asRole(h, "pierre_rt_app", h.companyA, (q) => q(
      `insert into pierre_rt_runtime_jobs (id, company_id, mission_id, mission_run_id, step_run_id, action_key, status, dedup_key) values ($1,$2,$3,$4,$5,'mission.noop',$6,$7)`,
      [newUuid(), h.companyA, j.mission_id, runId, j.step_run_id, status, newUuid()]));
    expect(await refused(() => ins("succeeded"))).toBe(true);  // can't fabricate a terminal job
    expect(await refused(() => ins("queued"))).toBe(true);     // can't even insert a queued job directly
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(`update pierre_rt_step_runs set status='succeeded' where company_id=$1`, [h.companyA])))).toBe(true);
  });
});
