import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee, createAbsence } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 PRE-PAYROLL depth — real SQL (PGlite + migrations incl. pierre_v32). A 58-employee monthly
// pre-payroll driven through the runtime: open period → collect variables from REAL absences (source-
// linked) → detect deterministic anomalies → evidence → validate → export (row_count+hash) →
// provider reconciliation → factual brief. Missing-piece/resume, three-mode SQL diff, idempotence,
// tenant isolation, governed refusals. Pierre NEVER transmits/DSN. SUCCESS_WITHOUT_OBJECT = FAIL.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-0000000000f0";
afterAll(async () => { await harness?.close(); });

function ctxFor(h: Harness, payload: Record<string, unknown>): RuntimeActionContext {
  const db: SqlExecutor = h.db; const tenant: TenantContext = h.ctx("A");
  return {
    appDb: db, tenant, companyId: h.companyA, missionId: MISSION,
    missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555",
    jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload, deps: {},
    assertLease: async () => {}, checkpoint: async () => {},
  };
}
const run = (h: Harness, key: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[key](ctxFor(h, p));

async function seedMission(h: Harness, id: string): Promise<void> {
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`,
    [id, h.companyA, h.userA, "prépare la pré-paie de juillet", `pay-${id}`]);
}

describe("P22 pre-payroll depth — 58-employee month on real SQL", () => {
  let periodId = "";
  let sickVarId = "";

  it("opens the period, collects source-linked variables from real absences, detects real anomalies", async () => {
    harness = await createHarness();
    const h = harness;
    await seedMission(h, MISSION);
    const ctxA = h.ctx("A");

    // 58 active employees; give a spread of real absences within July.
    const empIds: string[] = [];
    for (let i = 0; i < 58; i++) {
      const e = await createEmployee(h.db, ctxA, { first_name: `E${i}`, last_name: `Nom${i}` });
      empIds.push(e.id);
    }
    // 5 sick leaves (need evidence), 4 paid leaves.
    for (let i = 0; i < 5; i++) await createAbsence(h.db, ctxA, empIds[i], { type: "maladie", start_date: "2026-07-05", end_date: "2026-07-08" });
    for (let i = 5; i < 9; i++) await createAbsence(h.db, ctxA, empIds[i], { type: "conges_payes", start_date: "2026-07-10", end_date: "2026-07-15" });

    const p = await run(h, "payroll.period.open", { period_key: "2026-07", starts_on: "2026-07-01", ends_on: "2026-07-31", mode: "copilote", idempotency_key: "pay-2026-07" });
    expect(p.status).toBe("succeeded");
    expect(Number(p.output!.population)).toBe(58);
    periodId = String(p.output!.period_id);

    const col = await run(h, "payroll.population.collect", { period_id: periodId });
    expect(col.status).toBe("succeeded");
    expect(Number(col.output!.variables_created)).toBe(9); // 5 sick + 4 paid, each source-linked, once

    // Re-collect is idempotent — no duplicate variables.
    const col2 = await run(h, "payroll.population.collect", { period_id: periodId });
    expect(Number(col2.output!.variables_created)).toBe(0);

    const totalVars = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2`, [h.companyA, periodId])).rows[0].n;
    expect(totalVars).toBe(9);

    // Anomaly detection: 5 sick variables lack evidence → 5 missing_evidence anomalies (deterministic).
    const an = await run(h, "payroll.anomaly.detect", { period_id: periodId });
    expect(an.status).toBe("succeeded");
    const missingEvidence = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_anomalies where company_id=$1 and period_id=$2 and anomaly_type='missing_evidence'`, [h.companyA, periodId])).rows[0].n;
    expect(missingEvidence).toBe(5);
    // Re-detect is idempotent (dedup_key).
    const an2 = await run(h, "payroll.anomaly.detect", { period_id: periodId });
    expect(Number(an2.output!.anomalies_created)).toBe(0);

    sickVarId = (await h.db.query<{ id: string }>(`select id from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status='needs_evidence' limit 1`, [h.companyA, periodId])).rows[0].id;
  });

  it("missing evidence → awaiting_information, resumes after evidence attached", async () => {
    const h = harness!;
    let r = await run(h, "payroll.readiness.compute", { period_id: periodId });
    expect(r.output!.status).toBe("awaiting_information"); // 5 sick vars still need evidence

    // Attach evidence to all 5 sick variables.
    const sickVars = (await h.db.query<{ id: string }>(`select id from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status='needs_evidence'`, [h.companyA, periodId])).rows;
    for (const v of sickVars) await run(h, "payroll.variable.evidence.attach", { variable_id: v.id });

    r = await run(h, "payroll.readiness.compute", { period_id: periodId });
    // No more missing evidence; anomalies still open (the missing_evidence anomalies remain until resolved) → awaiting_validation.
    expect(["awaiting_validation", "ready_to_export"]).toContain(r.output!.status);
  });

  it("generates a real export with row_count + content hash (never a fake transmission)", async () => {
    const h = harness!;
    const ex = await run(h, "payroll.export.generate", { period_id: periodId, format: "csv" });
    expect(ex.status).toBe("succeeded");
    expect(Number(ex.output!.row_count)).toBe(9);
    expect(String(ex.output!.hash)).toHaveLength(64); // sha256 hex
    const exportRows = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_export_rows er join pierre_rt_payroll_exports e on e.id=er.export_id where er.company_id=$1 and e.period_id=$2`, [h.companyA, periodId])).rows[0].n;
    expect(exportRows).toBe(9);
    // The period is 'exported' — NEVER 'transmitted' (no provider return yet).
    const pstatus = (await h.db.query<{ status: string }>(`select status from pierre_rt_payroll_periods where company_id=$1 and id=$2`, [h.companyA, periodId])).rows[0].status;
    expect(pstatus).toBe("exported");
    const transmitted = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_periods where company_id=$1 and status='transmitted'`, [h.companyA])).rows[0].n;
    expect(transmitted).toBe(0);
  });

  it("reconciles a provider return, dedups double webhooks, reopens anomaly on rejection", async () => {
    const h = harness!;
    const exportId = (await h.db.query<{ id: string }>(`select id from pierre_rt_payroll_exports where company_id=$1 and period_id=$2 limit 1`, [h.companyA, periodId])).rows[0].id;
    const r1 = await run(h, "payroll.provider_return.reconcile", { period_id: periodId, export_id: exportId, provider: "test_cabinet", provider_event_id: "evt-1", result_status: "partially_rejected", accepted_rows: 7, rejected_rows: 2, errors: [{ row: 3, msg: "bad" }] });
    expect(r1.output!.applied).toBe(true);
    // Same webhook again → deduped, not double-applied.
    const r2 = await run(h, "payroll.provider_return.reconcile", { period_id: periodId, export_id: exportId, provider: "test_cabinet", provider_event_id: "evt-1", result_status: "partially_rejected", accepted_rows: 7, rejected_rows: 2 });
    expect(r2.output!.deduped).toBe(true);
    const recons = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_reconciliations where company_id=$1 and period_id=$2`, [h.companyA, periodId])).rows[0].n;
    expect(recons).toBe(1);
    const rejAnom = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_anomalies where company_id=$1 and period_id=$2 and anomaly_type='provider_rejection'`, [h.companyA, periodId])).rows[0].n;
    expect(rejAnom).toBe(1);
  });

  it("builds a factual brief — numbers come from SQL, DSN disclaimed", async () => {
    const h = harness!;
    const b = await run(h, "payroll.brief.generate", { period_id: periodId });
    expect(b.status).toBe("succeeded");
    const brief = b.output!.brief as Record<string, unknown>;
    expect(brief.population).toBe(58);
    expect(brief.total_variables).toBe(9);
    expect(brief.export_rows).toBe(9);
    expect(String(brief.dsn_note)).toContain("DSN");
  });

  it("three modes persist a genuinely different export status for the same data", async () => {
    const h = harness!;
    const statuses: Record<string, string> = {};
    for (const mode of ["brouillon", "copilote", "autonomie"] as const) {
      const p = await run(h, "payroll.period.open", { period_key: `2026-08-${mode}`, starts_on: "2026-08-01", ends_on: "2026-08-31", mode, idempotency_key: `pay-aug-${mode}` });
      const pid = String(p.output!.period_id);
      await run(h, "payroll.variable.create", { period_id: pid, employee_id: (await h.db.query<{ id: string }>(`select id from pierre_rt_employees where company_id=$1 limit 1`, [h.companyA])).rows[0].id, variable_type: "bonus", amount: 100 });
      const ex = await run(h, "payroll.export.generate", { period_id: pid, format: "csv" });
      statuses[mode] = String(ex.output!.status);
    }
    expect(statuses.brouillon).toBe("draft");
    expect(statuses.copilote).toBe("awaiting_validation");
    expect(statuses.autonomie).toBe("validated");
    // No mode ever transmits (no fake transmission / DSN in any mode).
    const transmitted = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_exports where company_id=$1 and status='transmitted'`, [h.companyA])).rows[0].n;
    expect(transmitted).toBe(0);
  });

  it("governed refusals + tenant isolation", async () => {
    const h = harness!;
    const badEmp = await run(h, "payroll.variable.create", { period_id: periodId, employee_id: "00000000-0000-0000-0000-0000000000fe", variable_type: "not_a_type" });
    expect(badEmp.status).toBe("blocked");
    for (const t of ["pierre_rt_payroll_periods", "pierre_rt_payroll_variables", "pierre_rt_payroll_anomalies", "pierre_rt_payroll_exports"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
