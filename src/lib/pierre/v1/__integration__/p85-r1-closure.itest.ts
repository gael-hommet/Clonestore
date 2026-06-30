// PHASE 8.5-R1 — closure invariants for the runtime-truth hardening. The app role can not fabricate
// runtime truth; plan versions are immutable; the scheduler has governed writes; resolved waits are
// FK-bound to real events; the system secret has no generic fallback.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, type Harness } from "./harness";
import { runtimeSystemSecret } from "../runtime-system-auth";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); vi.unstubAllEnvs(); });
const has = async (sql: string) => ((await h.db.query<{ n: number }>(sql)).rows[0].n > 0);

describe("P8.5-R1 runtime truth closure", () => {
  it("the app role holds NO insert/update/delete on any runtime-truth table", async () => {
    for (const t of ["pierre_rt_mission_plan_versions", "pierre_rt_mission_runs", "pierre_rt_step_runs", "pierre_rt_step_deps", "pierre_rt_runtime_jobs", "pierre_rt_runtime_schedules"]) {
      expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='${t}' and privilege_type in ('INSERT','UPDATE','DELETE')`)).toBe(false);
    }
  });
  it("plan immutability + delete protection are in place", async () => {
    expect(await has(`select count(*)::int n from pg_trigger where tgname in ('trg_rt_plan_version_immutable','trg_rt_plan_version_no_del')`)).toBe(true);
  });
  it("the scheduler governs its writes + the event FK binds real events", async () => {
    for (const fn of ["pierre_rt_apply_runtime_event", "pierre_rt_complete_schedule", "pierre_rt_create_compiled_mission_run", "pierre_rt_create_runtime_schedule"]) {
      expect(await has(`select count(*)::int n from pg_proc where proname='${fn}'`)).toBe(true);
    }
    expect(await has(`select count(*)::int n from pg_constraint where conname='fk_rt_wait_resolved_event_ct'`)).toBe(true);
    // the scheduler role has NO raw INSERT/UPDATE on the event/schedule tables
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_runtime_scheduler' and table_name in ('pierre_rt_runtime_events','pierre_rt_runtime_schedules') and privilege_type in ('INSERT','UPDATE','DELETE')`)).toBe(false);
  });
  it("the runtime system secret has NO CRON_SECRET fallback (R1.10)", () => {
    vi.stubEnv("PIERRE_RUNTIME_SYSTEM_SECRET", ""); vi.stubEnv("CRON_SECRET", "x");
    expect(runtimeSystemSecret()).toBeNull();
  });
});
