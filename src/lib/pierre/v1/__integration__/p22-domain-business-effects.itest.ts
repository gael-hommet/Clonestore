import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 domain closure — REAL SQL proof (PGlite + real migrations) for the two reusable domain actions
// that closed 12 of the 16 semantic gaps:
//   employee.timeline.append → a real pierre_rt_employee_events row (Employee-360 business object)
//   hr.reconcile.apply       → applies an external return (real event) or AWAITS it (never fakes)

let harness: Harness | null = null;
afterAll(async () => { await harness?.close(); });

function ctxFor(db: SqlExecutor, tenant: TenantContext, companyId: string, payload: Record<string, unknown>): RuntimeActionContext {
  return {
    appDb: db, tenant, companyId,
    missionId: "33333333-3333-3333-3333-333333333333", missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem", payload, deps: {}, assertLease: async () => {}, checkpoint: async () => {},
  };
}

describe("employee.timeline.append — real SQL Employee-360 business effect (P22)", () => {
  it("persists a typed timeline entry FK-linked to the employee", async () => {
    harness = await createHarness();
    const { db } = harness;
    const ctxA = harness.ctx("A");
    const emp = await createEmployee(db, ctxA, { first_name: "Alex", last_name: "Martin" });

    const before = (await db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_events where company_id=$1 and employee_id=$2 and type='hr.performance_objectives'`,
      [harness.companyA, emp.id])).rows[0].n;

    const res = await RUNTIME_ACTION_HANDLERS["employee.timeline.append"](
      ctxFor(db, ctxA, harness.companyA, { employee_id: emp.id, entry_type: "performance_objectives", data: { objective: "Increase retention" } }));

    expect(res.status).toBe("succeeded");
    expect(res.output?.kind).toBe("employee_timeline_entry");
    const after = (await db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_events where company_id=$1 and employee_id=$2 and type='hr.performance_objectives'`,
      [harness.companyA, emp.id])).rows[0].n;
    expect(after).toBe(before + 1);
  });

  it("returns a governed blocker for a non-existent employee (no fake success)", async () => {
    const h = harness!;
    const res = await RUNTIME_ACTION_HANDLERS["employee.timeline.append"](
      ctxFor(h.db, h.ctx("A"), h.companyA, { employee_id: "00000000-0000-0000-0000-0000000000fe", entry_type: "career_wishes" }));
    expect(res.status).toBe("blocked");
    expect(res.blockerCode).toBe("employee_timeline_refused");
  });

  it("does not leak across tenants", async () => {
    const h = harness!;
    const n = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_events where company_id=$1`, [h.companyB])).rows[0].n;
    expect(n).toBe(0);
  });
});

async function seedMission(h: Harness): Promise<string> {
  const id = "10000000-0000-0000-0000-000000000abc";
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [id, h.companyA, h.userA, "reconcile test mission", "00000000-0000-0000-0000-000000000c01", "00000000-0000-0000-0000-000000000e01", "p22-reconcile-idem"]);
  return id;
}

describe("hr.reconcile.apply — apply-or-await external return (P22)", () => {
  it("applies a present external return as a real reconciliation event", async () => {
    const h = harness!;
    const missionId = await seedMission(h);
    const ctx = ctxFor(h.db, h.ctx("A"), h.companyA, { reconcile_kind: "payroll", external_return: { status: "accepted", ref: "PR-1" } });
    ctx.missionId = missionId;
    const res = await RUNTIME_ACTION_HANDLERS["hr.reconcile.apply"](ctx);
    expect(res.status).toBe("succeeded");
    expect(res.output?.kind).toBe("reconciliation");
    const n = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_events where company_id=$1 and type='hr.reconcile.payroll'`, [h.companyA])).rows[0].n;
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("AWAITS (never fakes) when no external return is present", async () => {
    const h = harness!;
    const res = await RUNTIME_ACTION_HANDLERS["hr.reconcile.apply"](
      ctxFor(h.db, h.ctx("A"), h.companyA, { reconcile_kind: "signature" }));
    expect(res.status).toBe("waiting");
    expect(res.wait?.wait_kind).toBe("external_event");
  });
});
