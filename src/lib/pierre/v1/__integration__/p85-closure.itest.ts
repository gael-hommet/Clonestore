// PHASE 8.5 — closure invariants: a governed autonomous runtime provable under the REAL roles. Roles
// are dedicated + least-privilege; truth functions are worker/scheduler-only; jobs carry a fencing
// token; attempts are append-only; the plan compiler refuses unsafe plans; the runtime drives business
// effects ONLY through the governed P8.3/P8.4 services.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { compileMissionPlan } from "../runtime-plan-compiler";
import { isKnownRuntimeAction, getRuntimeActionDefinition } from "../runtime-action-registry";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const has = async (sql: string) => ((await h.db.query<{ n: number }>(sql)).rows[0].n > 0);

describe("P8.5 governed autonomous runtime closure", () => {
  it("the dedicated runtime roles exist and the worker holds NO business grant", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname in ('pierre_rt_runtime_scheduler','pierre_rt_runtime_worker')`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_runtime_worker' and table_name in ('pierre_rt_employees','pierre_rt_employee_contracts','pierre_rt_documents')`)).toBe(false);
  });
  it("job truth is governed-only: the app role cannot execute claim/complete/fail/wait", async () => {
    for (const fn of ["pierre_rt_runtime_complete_job", "pierre_rt_runtime_fail_job", "pierre_rt_runtime_wait_job", "pierre_rt_runtime_claim"]) {
      expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='${fn}'`)).toBe(false);
    }
  });
  it("a fencing token + append-only attempts/checkpoints are in place", async () => {
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_runtime_jobs' and column_name='fencing_token'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_trigger where tgname in ('trg_rt_attempt_no_upd','trg_rt_attempt_no_del','trg_rt_ckpt_no_upd')`)).toBe(true);
  });
  it("the action registry is closed (no generic/arbitrary action) and the compiler refuses unsafe plans", () => {
    for (const bad of ["database.query", "http.request", "run_code", "execute_prompt", "arbitrary_tool", "email.send", "signature.execute"]) {
      expect(isKnownRuntimeAction(bad)).toBe(false);
    }
    expect(getRuntimeActionDefinition("mission.noop")).toBeTruthy();
    expect(compileMissionPlan({ steps: [] }).blockers).toContain("empty_plan");
    expect(compileMissionPlan({ steps: [{ step_key: "x", action_key: "database.query" }] }).ok).toBe(false);
  });
  it("the runtime-safe FKs are tenant-scoped (no cross-tenant run/job/wait)", async () => {
    expect(await has(`select count(*)::int n from pg_constraint where conname like 'fk_rt_%_ct'`)).toBe(true);
    // the RLS policy carries no `company_id is null OR` leak on the runtime event ledger
    const leaky = (await h.db.query<{ qual: string | null }>(`select pg_get_expr(polqual, polrelid) as qual from pg_policy where polrelid='pierre_rt_runtime_jobs'::regclass`)).rows[0]?.qual ?? "";
    expect(leaky).not.toMatch(/is null/i);
  });
});
