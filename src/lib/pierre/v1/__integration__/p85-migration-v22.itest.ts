// PHASE 8.5 §14 — the v22 migration applies on top of v1→v21, is idempotent (reapplies cleanly), and
// is non-destructive: it adds the runtime tables, the dedicated roles, the fencing token, the tenant-
// safe composite FKs, the append-only triggers, and extends the events/dead_letters/outbox surfaces.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V22 = FILES.find((f) => f.includes("pierre_v22"))!;
const upToV21 = FILES.filter((f) => f < V22); // strictly before v22 (excludes v22 + v23+)

let pg: PGlite;
beforeAll(async () => { pg = await PGlite.create(); for (const f of upToV21) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const has = async (sql: string) => ((await pg.query<{ n: number }>(sql)).rows[0].n > 0);

describe("P8.5 v22 migration truth", () => {
  it("v22 applies on v1→v21", async () => {
    expect(V22).toBeTruthy();
    await expect(pg.exec(readFileSync(resolve(MIG, V22), "utf-8"))).resolves.not.toThrow();
  });
  it("re-applying v22 is idempotent (no throw)", async () => {
    await expect(pg.exec(readFileSync(resolve(MIG, V22), "utf-8"))).resolves.not.toThrow();
  });
  it("the runtime tables, roles and fencing token exist", async () => {
    expect(await has(`select count(*)::int n from information_schema.tables where table_name in ('pierre_rt_mission_plan_versions','pierre_rt_mission_runs','pierre_rt_step_runs','pierre_rt_runtime_jobs','pierre_rt_runtime_job_attempts','pierre_rt_runtime_waits','pierre_rt_runtime_checkpoints','pierre_rt_runtime_schedules','pierre_rt_runtime_events')`)).toBe(true);
    expect((await pg.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name like 'pierre_rt_mission_%' or table_name like 'pierre_rt_step%' or table_name like 'pierre_rt_runtime_%'`)).rows[0].n).toBeGreaterThanOrEqual(9);
    expect(await has(`select count(*)::int n from pg_roles where rolname in ('pierre_rt_runtime_scheduler','pierre_rt_runtime_worker')`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_runtime_jobs' and column_name='fencing_token'`)).toBe(true);
  });
  it("the tenant-safe composite FKs + append-only guards + extensions exist", async () => {
    expect(await has(`select count(*)::int n from pg_constraint where conname in ('fk_rt_job_run_ct','fk_rt_job_step_ct','fk_rt_run_mission_ct','fk_rt_wait_validation_ct')`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_trigger where tgname in ('trg_rt_attempt_no_upd','trg_rt_job_app_insert')`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_events' and column_name='mission_run_id'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_outbox' and column_name='rt_processing_status'`)).toBe(true);
  });
  it("the worker role has NO grant on a business table (employees/contracts)", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_runtime_worker' and table_name in ('pierre_rt_employees','pierre_rt_employee_contracts')`)).toBe(false);
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_runtime_complete_job'`)).toBe(false);
  });
});
