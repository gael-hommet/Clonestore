// PHASE 8.3-B3-R1.14 — REAL amendment activation. A past-dated signed amendment applies its
// STRUCTURED, allowlisted effects to the employee (never a free clause); a future-dated one
// persists a real scheduled task and applies NOTHING early; the activation worker applies due
// tasks idempotently; the signed parent is never overwritten; an invalid effect fails closed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as C from "../contracts";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
const sdLike = () => ({ storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

async function signedParent(): Promise<string> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, c.id);
  return c.id;
}
async function signedAmendment(parent: string, effective_from: string, effects: Record<string, string | null>): Promise<string> {
  const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "raise", effective_from, effects });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  return amd.id;
}
const employeeRow = async () => (await h.db.query<{ role_title: string; site_id: string | null; metadata: Record<string, unknown> }>(`select role_title, site_id, metadata from pierre_rt_employees where company_id=$1 and id=$2`, [h.companyA, emp])).rows[0];

describe("B3-R1.14 real amendment activation", () => {
  it("a past-dated amendment APPLIES its structured allowlisted effects to the employee (parent untouched)", async () => {
    const parent = await signedParent();
    const parentBefore = (await h.db.query(`select workflow_status, signed_at from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    const amd = await signedAmendment(parent, "2026-03-01", { "employment.role_title": "Lead Engineer", "employment.weekly_hours": "39", "employment.salary": "62000" });

    const r = await S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" });
    expect(r.activated).toBe(true);
    expect(r.scheduled).toBe(false);

    const e = await employeeRow();
    expect(e.role_title).toBe("Lead Engineer"); // real column updated
    const active = e.metadata.active_employment as Record<string, string>;
    expect(active["employment.weekly_hours"]).toBe("39");
    expect(active["employment.salary"]).toBe("62000");

    const parentAfter = (await h.db.query(`select workflow_status, signed_at from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    expect(parentAfter).toEqual(parentBefore); // signed original never overwritten
    const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd])).rows[0].n;
    expect(audit).toBe(1);
  });

  it("only ALLOWLISTED effects are applied — a free clause is never interpreted", async () => {
    const parent = await signedParent();
    // a non-allowlisted key (free clause) must be stripped at amendment creation
    const amd = await signedAmendment(parent, "2026-03-01", { "employment.role_title": "Architect", "clause.free_text": "the employee shall receive a pony", "employment.unknown": "x" });
    await S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" });
    const e = await employeeRow();
    expect(e.role_title).toBe("Architect");
    const active = e.metadata.active_employment as Record<string, string>;
    expect(active["clause.free_text"]).toBeUndefined();
    expect(active["employment.unknown"]).toBeUndefined();
    expect(Object.keys(active)).toEqual(["employment.role_title"]);
  });

  it("a future-dated amendment SCHEDULES a real task and applies NOTHING early", async () => {
    const parent = await signedParent();
    const before = (await employeeRow()).role_title;
    const amd = await signedAmendment(parent, "2027-01-01", { "employment.role_title": "VP Engineering" });
    const r = await S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" });
    expect(r.activated).toBe(false);
    expect(r.scheduled).toBe(true);
    expect(r.deferred_until).toBe("2027-01-01");

    const task = (await h.db.query<{ status: string; execute_at: string; effects: Record<string, string> }>(`select status, execute_at::text, effects from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("scheduled");
    expect(task.execute_at).toBe("2027-01-01");
    expect(task.effects["employment.role_title"]).toBe("VP Engineering");
    expect((await employeeRow()).role_title).toBe(before); // nothing applied early
  });

  it("the activation worker applies a due task idempotently (no double application)", async () => {
    const parent = await signedParent();
    const amd = await signedAmendment(parent, "2026-07-01", { "employment.role_title": "Principal Engineer" });
    await S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" }); // schedules (future at that as_of)
    // a second scheduling attempt does not create a duplicate task
    await S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" });
    const taskCount = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0].n;
    expect(taskCount).toBe(1);

    // when due, the worker applies it
    const w1 = await S.runDueContractActivations(h.db, owner, { as_of: "2026-07-02" });
    expect(w1.applied).toBe(1);
    expect((await employeeRow()).role_title).toBe("Principal Engineer");
    const task = (await h.db.query<{ status: string }>(`select status from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("applied");

    // re-running the worker applies nothing more (idempotent)
    const w2 = await S.runDueContractActivations(h.db, owner, { as_of: "2026-07-03" });
    expect(w2.applied).toBe(0);
    const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd])).rows[0].n;
    expect(audit).toBe(1); // exactly one activation
  });

  it("an invalid site_id effect FAILS CLOSED (rollback, nothing applied)", async () => {
    const parent = await signedParent();
    const before = await employeeRow();
    const amd = await signedAmendment(parent, "2026-03-01", { "employment.role_title": "Staff Engineer", "employment.site_id": "00000000-0000-0000-0000-000000000000" });
    await expect(S.activateSignedAmendment(h.db, owner, amd, { as_of: "2026-06-24" })).rejects.toThrow();
    const after = await employeeRow();
    expect(after.role_title).toBe(before.role_title); // the transaction rolled back — no partial apply
    const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd])).rows[0].n;
    expect(audit).toBe(0);
  });
});
