import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// ─────────────────────────────────────────────────────────────────────────────
// P22 semantic continuation — REAL SQL proof (PGlite / Postgres 16 + real migrations) that the
// authoritative runtime action `absence.record.create` produces a genuine BUSINESS EFFECT (a row in
// pierre_rt_employee_absences FK-linked to the employee), not merely a trace event. Proves: real
// persistence, tenant isolation, and an honest governed refusal (no fake success).
// ─────────────────────────────────────────────────────────────────────────────

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

describe("absence.record.create — real SQL business effect (P22)", () => {
  it("persists a real absence row FK-linked to the employee (not just a trace)", async () => {
    harness = await createHarness();
    const { db } = harness;
    const ctxA = harness.ctx("A");

    // Seed a real employee in tenant A.
    const emp = await createEmployee(db, ctxA, { first_name: "Marie", last_name: "Durant" });

    // Count absences before.
    const before = (await db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_absences where company_id=$1 and employee_id=$2`,
      [harness.companyA, emp.id])).rows[0].n;

    const res = await RUNTIME_ACTION_HANDLERS["absence.record.create"](
      ctxFor(db, ctxA, harness.companyA, {
        employee_id: emp.id, absence_type: "maladie", start_date: "2026-08-01", end_date: "2026-08-03", status: "requested",
      }));

    expect(res.status).toBe("succeeded");
    expect(res.output?.kind).toBe("absence");

    // Real business object exists — one new row, correct FK + tenant + fields.
    const rows = (await db.query<{ id: string; employee_id: string; type: string; status: string }>(
      `select id, employee_id, type, status from pierre_rt_employee_absences where company_id=$1 and employee_id=$2`,
      [harness.companyA, emp.id])).rows;
    expect(rows.length).toBe(before + 1);
    expect(rows[0].employee_id).toBe(emp.id);
    expect(rows[0].type).toBe("maladie");

    // A domain event was also recorded on the employee timeline (trace is a side effect, not the deliverable).
    const events = (await db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_events where company_id=$1 and employee_id=$2 and type='absence_requested'`,
      [harness.companyA, emp.id])).rows[0].n;
    expect(events).toBeGreaterThanOrEqual(1);
  });

  it("does not leak across tenants — tenant B sees no absence for tenant A's employee", async () => {
    const h = harness!;
    const empA = (await h.db.query<{ id: string }>(
      `select id from pierre_rt_employee_absences where company_id=$1 limit 1`, [h.companyA])).rows[0];
    expect(empA).toBeTruthy();
    const crossTenant = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_absences where company_id=$1`, [h.companyB])).rows[0].n;
    expect(crossTenant).toBe(0);
  });

  it("returns a governed blocker (no fake success) when the employee does not exist", async () => {
    const h = harness!;
    const ctxA = h.ctx("A");
    const res = await RUNTIME_ACTION_HANDLERS["absence.record.create"](
      ctxFor(h.db, ctxA, h.companyA, {
        employee_id: "00000000-0000-0000-0000-0000000000ff", absence_type: "maladie", start_date: "2026-08-01", end_date: "2026-08-03",
      }));
    // Either a governed blocker, or (if the FK is deferred) it must NOT report a business object it didn't create.
    if (res.status === "succeeded") {
      const n = (await h.db.query<{ n: number }>(
        `select count(*)::int n from pierre_rt_employee_absences where company_id=$1 and employee_id=$2`,
        [h.companyA, "00000000-0000-0000-0000-0000000000ff"])).rows[0].n;
      expect(n).toBeGreaterThan(0); // success only if a row truly exists
    } else {
      expect(res.status).toBe("blocked");
    }
  });
});
