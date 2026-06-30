// src/lib/pierre/v1/__integration__/p85-helpers.ts
// PHASE 8.5 — shared runtime test helpers (NOT a test file).
import type { Harness } from "./harness";
import type { TenantContext } from "../tenant-context";
import { newUuid } from "../sql";

/** Seed a real server mission in the tenant; returns its id. */
export async function seedMission(h: Harness, ctx: TenantContext, instruction = "Onboarder un salarié"): Promise<string> {
  const id = newUuid();
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, status, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,'planned',$5,$6,$7)`,
    [id, ctx.company_id, ctx.user_id, instruction, newUuid(), newUuid(), `mission:${id}`]);
  return id;
}

/** Seed a minimal document object (for communication / read actions). */
export async function seedRuntimeDocument(h: Harness, ctx: TenantContext, title = "Document"): Promise<string> {
  const id = newUuid();
  const owner = (await h.db.query<{ id: string }>(`select id from pierre_rt_members where company_id=$1 order by created_at asc limit 1`, [ctx.company_id])).rows[0]?.id ?? null;
  await h.db.query(
    `insert into pierre_rt_documents (id, company_id, document_type, title, sensitivity, status, created_by, owner_membership_id) values ($1,$2,'employment_contract',$3,'high','draft',$4,$5)`,
    [id, ctx.company_id, title, ctx.user_id, owner]);
  return id;
}

/** Run a query with the tenant GUC bound (so SECURITY DEFINER governed functions resolve the tenant). */
export async function gov<T = Record<string, unknown>>(h: Harness, ctx: TenantContext, sql: string, params: readonly unknown[] = []): Promise<{ rows: T[] }> {
  return h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); return tx.query<T>(sql, params); });
}

/** Seed a mission + a single-step run; returns the run id + the queued job id. */
export async function seedRunWithJob(h: Harness, ctx: TenantContext, actionKey = "mission.noop", input: Record<string, unknown> = {}): Promise<{ missionId: string; runId: string; jobId: string }> {
  const missionId = await seedMission(h, ctx);
  const { createMissionRunFromPlan } = await import("../runtime-service");
  const created = await createMissionRunFromPlan(h.db, ctx, { mission_id: missionId, plan: { steps: [{ step_key: "s1", action_key: actionKey, input }] } });
  const jobId = (await h.db.query<{ id: string }>(`select id from pierre_rt_runtime_jobs where company_id=$1 and mission_run_id=$2`, [ctx.company_id, created.mission_run_id])).rows[0].id;
  return { missionId, runId: created.mission_run_id!, jobId };
}

export async function jobRow(h: Harness, jobId: string): Promise<{ status: string; fencing_token: number; locked_by: string | null; attempt_count: number; lease_expires_at: string | null }> {
  return (await h.db.query<{ status: string; fencing_token: number; locked_by: string | null; attempt_count: number; lease_expires_at: string | null }>(`select status, fencing_token, locked_by, attempt_count, lease_expires_at from pierre_rt_runtime_jobs where id=$1`, [jobId])).rows[0];
}

/** One full runtime tick: the worker executes ready jobs, then the scheduler resolves waits + runs the
 *  governed bridges. Returns the scheduler result so a test can assert what was bridged this tick. */
export async function runtimeTick(h: Harness, ctx: TenantContext): Promise<import("../runtime-scheduler").SchedulerResult> {
  const { runPierreRuntimeJobs } = await import("../runtime-service");
  const { runPierreRuntimeScheduler } = await import("../runtime-scheduler");
  await runPierreRuntimeJobs(h.db, ctx, { worker: "w" });
  return runPierreRuntimeScheduler(h.db, ctx, {});
}

export async function runState(h: Harness, runId: string): Promise<{ status: string }> {
  return (await h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1`, [runId])).rows[0];
}
export async function stepStatuses(h: Harness, runId: string): Promise<Record<string, string>> {
  const rows = (await h.db.query<{ step_key: string; status: string }>(`select step_key, status from pierre_rt_step_runs where mission_run_id=$1`, [runId])).rows;
  return Object.fromEntries(rows.map((r) => [r.step_key, r.status]));
}
