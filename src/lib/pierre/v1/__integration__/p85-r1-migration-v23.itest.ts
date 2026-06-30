// PHASE 8.5-R1 §R1.13 — v23 applies on v1→v22, is idempotent, and is non-destructive: it revokes the
// app role's runtime-truth DML, adds the governed create/schedule/event/tenant-claim functions, the
// plan-immutability trigger, and the resolved_by_event_id FK.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V23 = FILES.find((f) => f.includes("pierre_v23"))!;
const upToV22 = FILES.filter((f) => f < V23);

let pg: PGlite;
beforeAll(async () => { pg = await PGlite.create(); for (const f of upToV22) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const has = async (sql: string) => ((await pg.query<{ n: number }>(sql)).rows[0].n > 0);

describe("P8.5-R1 v23 migration truth", () => {
  it("v23 applies on v1→v22", async () => {
    expect(V23).toBeTruthy();
    await expect(pg.exec(readFileSync(resolve(MIG, V23), "utf-8"))).resolves.not.toThrow();
  });
  it("re-applying v23 is idempotent (no throw)", async () => {
    await expect(pg.exec(readFileSync(resolve(MIG, V23), "utf-8"))).resolves.not.toThrow();
  });
  it("the app role's runtime-truth DML is revoked", async () => {
    for (const t of ["pierre_rt_mission_plan_versions", "pierre_rt_mission_runs", "pierre_rt_step_runs", "pierre_rt_runtime_jobs", "pierre_rt_runtime_schedules"]) {
      expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='${t}' and privilege_type in ('INSERT','UPDATE','DELETE')`)).toBe(false);
    }
  });
  it("the governed functions + immutability trigger + event FK exist", async () => {
    for (const fn of ["pierre_rt_create_compiled_mission_run", "pierre_rt_create_runtime_schedule", "pierre_rt_apply_runtime_event", "pierre_rt_complete_schedule", "pierre_rt_claim_runtime_tenants", "pierre_rt_supersede_plan_version"]) {
      expect(await has(`select count(*)::int n from pg_proc where proname='${fn}'`)).toBe(true);
    }
    expect(await has(`select count(*)::int n from pg_trigger where tgname='trg_rt_plan_version_immutable'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_constraint where conname='fk_rt_wait_resolved_event_ct'`)).toBe(true);
  });
  it("the governed create function is granted to app; the worker truth fns are not", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_create_compiled_mission_run'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_runtime_complete_job'`)).toBe(false);
  });
});
