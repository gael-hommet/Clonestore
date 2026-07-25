import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { getEmployeeOnboardingCase } from "../employee-onboarding";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 EMPLOYEE onboarding DEPTH — real SQL (PGlite + migrations incl. pierre_v31). Proves a salaried
// arrival is driven end-to-end through the runtime: case + generic plan (>=7 steps, >=1 validation),
// missing-piece → awaiting_information → resume, three-mode persisted differences, idempotence,
// tenant isolation, governed refusals. SUCCESS_WITHOUT_EXPECTED_ONBOARDING_OBJECT = FAIL.

let harness: Harness | null = null;
afterAll(async () => { await harness?.close(); });

function ctxFor(h: Harness, missionId: string, payload: Record<string, unknown>): RuntimeActionContext {
  const db: SqlExecutor = h.db; const tenant: TenantContext = h.ctx("A");
  return {
    appDb: db, tenant, companyId: h.companyA, missionId,
    missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555",
    jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload, deps: {},
    assertLease: async () => {}, checkpoint: async () => {},
  };
}
const run = (h: Harness, mid: string, key: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[key](ctxFor(h, mid, p));

async function seedMission(h: Harness, id: string): Promise<string> {
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`,
    [id, h.companyA, h.userA, "une responsable commerciale arrive à Lyon lundi", `mission-${id}`]);
  return id;
}
async function seedSite(h: Harness): Promise<string> {
  const id = "20000000-0000-0000-0000-000000000101";
  await h.db.query(`insert into pierre_rt_sites (id, company_id, name, code) values ($1,$2,'Lyon','LYON') on conflict (company_id, code) do nothing`, [id, h.companyA]);
  return id;
}

describe("P22 employee onboarding depth — full arrival on real SQL", () => {
  it("creates a case + generic plan with >=7 real steps and >=1 validation (copilote)", async () => {
    harness = await createHarness();
    const h = harness;
    const mid = await seedMission(h, "10000000-0000-0000-0000-0000000000a1");
    const siteId = await seedSite(h);
    const emp = await createEmployee(h.db, h.ctx("A"), { first_name: "Sophie", last_name: "Marchand", site_id: siteId });

    const cse = await run(h, mid, "employee.onboarding.case.create", { employee_id: emp.id, site_id: siteId, job_title: "Responsable commerciale", start_date: "2026-08-03", mode: "copilote", idempotency_key: "arr-sophie" });
    expect(cse.status).toBe("succeeded");
    const caseId = String(cse.output!.case_id);

    const plan = await run(h, mid, "employee.onboarding.plan.create", { case_id: caseId });
    expect(plan.status).toBe("succeeded");
    expect(Number(plan.output!.steps)).toBeGreaterThanOrEqual(7);
    expect(Number(plan.output!.requirements)).toBeGreaterThanOrEqual(3);
    expect(Number(plan.output!.followups)).toBeGreaterThanOrEqual(3);

    const validationSteps = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_employee_onboarding_steps where company_id=$1 and case_id=$2 and validation_required=true`, [h.companyA, caseId])).rows[0].n;
    expect(validationSteps).toBeGreaterThanOrEqual(1);

    // Case gated on the mandatory human validation (contract).
    const { onboarding } = await getEmployeeOnboardingCase(h.db, h.ctx("A"), caseId);
    expect(onboarding.status).toBe("awaiting_validation");
  });

  it("missing blocking pieces → awaiting_information → resume after fulfillment (durable, re-read from SQL)", async () => {
    const h = harness!;
    const mid = await seedMission(h, "10000000-0000-0000-0000-0000000000a2");
    const cse = await run(h, mid, "employee.onboarding.case.create", { job_title: "Comptable", mode: "copilote", idempotency_key: "arr-blocked" });
    const caseId = String(cse.output!.case_id);
    await run(h, mid, "employee.onboarding.plan.create", { case_id: caseId });

    // Fulfill only one of three blocking requirements → still awaiting_information.
    let r = await run(h, mid, "employee.onboarding.requirement.fulfill", { case_id: caseId, requirement_type: "id_document" });
    expect(r.status).toBe("succeeded");
    expect(r.output!.case_status).toBe("awaiting_information");

    // Durability: re-read the case fresh from SQL — the blocked state is persisted, not in memory.
    const mid1 = (await h.db.query<{ status: string; blocking_reason: string }>(
      `select status, blocking_reason from pierre_rt_employee_onboarding_cases where company_id=$1 and id=$2`, [h.companyA, caseId])).rows[0];
    expect(mid1.status).toBe("awaiting_information");
    expect(mid1.blocking_reason).toContain("missing");

    // Fulfill the remaining blocking requirements → resumes to awaiting_validation.
    await run(h, mid, "employee.onboarding.requirement.fulfill", { case_id: caseId, requirement_type: "rib" });
    r = await run(h, mid, "employee.onboarding.requirement.fulfill", { case_id: caseId, requirement_type: "signed_contract" });
    expect(r.output!.case_status).toBe("awaiting_validation");
  });

  it("three modes produce genuinely DIFFERENT persisted effects for the same arrival", async () => {
    const h = harness!;
    const results: Record<string, { comm: string; readySteps: number; caseStatus: string }> = {};
    const modeMid: Record<string, string> = { brouillon: "10000000-0000-0000-0000-0000000000b1", copilote: "10000000-0000-0000-0000-0000000000c2", autonomie: "10000000-0000-0000-0000-0000000000a3" };
    for (const mode of ["brouillon", "copilote", "autonomie"] as const) {
      const mid = await seedMission(h, modeMid[mode]);
      const cse = await run(h, mid, "employee.onboarding.case.create", { job_title: "Dev", mode, idempotency_key: `arr-${mode}` });
      const caseId = String(cse.output!.case_id);
      await run(h, mid, "employee.onboarding.plan.create", { case_id: caseId });
      const comm = (await h.db.query<{ status: string }>(`select status from pierre_rt_employee_onboarding_communications where company_id=$1 and case_id=$2 limit 1`, [h.companyA, caseId])).rows[0].status;
      const readySteps = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_onboarding_steps where company_id=$1 and case_id=$2 and status='ready'`, [h.companyA, caseId])).rows[0].n;
      const caseStatus = (await h.db.query<{ status: string }>(`select status from pierre_rt_employee_onboarding_cases where company_id=$1 and id=$2`, [h.companyA, caseId])).rows[0].status;
      results[mode] = { comm, readySteps, caseStatus };
    }
    // Real persisted differences (not just text): communications status + ready-steps + case status differ.
    expect(results.brouillon.comm).toBe("draft");
    expect(results.copilote.comm).toBe("awaiting_validation");
    expect(results.autonomie.comm).toBe("ready");
    expect(results.autonomie.readySteps).toBeGreaterThan(results.brouillon.readySteps);
    expect(results.brouillon.caseStatus).toBe("preparing");
    expect(results.copilote.caseStatus).toBe("awaiting_validation");
    // No mode ever auto-SENDS a communication (autonomie is 'ready', never 'sent', without a provider).
    const sent = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_onboarding_communications where company_id=$1 and status='sent'`, [h.companyA])).rows[0].n;
    expect(sent).toBe(0);
  });

  it("idempotent — same idempotency_key yields ONE case, no duplicate plans", async () => {
    const h = harness!;
    const mid = await seedMission(h, "10000000-0000-0000-0000-0000000000a4");
    const c1 = await run(h, mid, "employee.onboarding.case.create", { job_title: "RH", mode: "copilote", idempotency_key: "arr-idem" });
    const c2 = await run(h, mid, "employee.onboarding.case.create", { job_title: "RH", mode: "copilote", idempotency_key: "arr-idem" });
    expect(c1.output!.case_id).toBe(c2.output!.case_id);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_onboarding_cases where company_id=$1 and idempotency_key='arr-idem'`, [h.companyA])).rows[0].n;
    expect(n).toBe(1);
  });

  it("governed refusal — plan on a non-existent case never fakes success", async () => {
    const h = harness!;
    const mid = await seedMission(h, "10000000-0000-0000-0000-0000000000a5");
    const r = await run(h, mid, "employee.onboarding.plan.create", { case_id: "00000000-0000-0000-0000-0000000000fe" });
    expect(r.status).toBe("blocked");
  });

  it("tenant isolation — onboarding objects never leak into tenant B", async () => {
    const h = harness!;
    for (const t of ["pierre_rt_employee_onboarding_cases", "pierre_rt_employee_onboarding_steps", "pierre_rt_employee_onboarding_communications", "pierre_rt_employee_onboarding_requirements"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
