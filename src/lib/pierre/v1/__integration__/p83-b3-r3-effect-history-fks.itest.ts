// PHASE 8.3-B3-R3.5 — the effect-history ledger has composite tenant-safe FKs to employees and
// employee_contracts (employee / parent / amendment) and to the activation task, plus a
// per-(amendment, field) uniqueness. A cross-tenant reference is refused by the DB; a duplicate
// (amendment, field) is refused.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
import * as C from "../contracts";

let h: Harness; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
const sdLike = () => ({ storage, scanner });
beforeEach(async () => { h = await createHarness(); storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" }); });
afterEach(async () => { await h.close(); });

async function amendmentFor(owner: TenantContext): Promise<{ amendmentId: string; parentId: string; employeeId: string }> {
  await publishContractTemplate(h, owner); await configureSignatory(h, owner.company_id);
  const employeeId = await seedEmployee(h, owner.company_id, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2026-03-01", effects: { "employment.role_title": "Lead" } });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  return { amendmentId: amd.id, parentId: parent.id, employeeId };
}
// raw superuser insert (bypasses the app revoke) — exercises the composite FKs + uniqueness directly
async function rawInsert(company: string, emp: string, parent: string | null, amd: string, field: string): Promise<{ ok: boolean; err?: string }> {
  try {
    await h.pg.query(`insert into pierre_rt_contract_effect_history (id, company_id, employee_id, parent_contract_id, amendment_contract_id, field_key, new_value) values (gen_random_uuid(),$1,$2,$3,$4,$5,'v')`, [company, emp, parent, amd, field]);
    return { ok: true };
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}

describe("B3-R3.5 effect-history composite FKs + uniqueness", () => {
  it("a valid same-tenant reference is accepted", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const a = await amendmentFor(ownerA);
    expect((await rawInsert(h.companyA, a.employeeId, a.parentId, a.amendmentId, "employment.salary")).ok).toBe(true);
  });
  it("a cross-tenant EMPLOYEE reference is refused by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await amendmentFor(ownerA); const b = await amendmentFor(ownerB);
    const r = await rawInsert(h.companyA, b.employeeId, a.parentId, a.amendmentId, "employment.salary"); // B's employee under A
    expect(r.ok).toBe(false); expect(r.err).toMatch(/foreign key|violates/i);
  });
  it("a cross-tenant CONTRACT (parent/amendment) reference is refused by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await amendmentFor(ownerA); const b = await amendmentFor(ownerB);
    expect((await rawInsert(h.companyA, a.employeeId, b.parentId, a.amendmentId, "employment.salary")).ok).toBe(false);
    expect((await rawInsert(h.companyA, a.employeeId, a.parentId, b.amendmentId, "employment.salary")).ok).toBe(false);
  });
  it("a cross-tenant TASK reference is refused by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await amendmentFor(ownerA); const b = await amendmentFor(ownerB);
    // a task for B
    await h.pg.exec("set session_replication_role=replica");
    const taskB = newUuid();
    await h.pg.query(`insert into pierre_rt_contract_activation_tasks (id, company_id, amendment_contract_id, execute_at, status) values ($1,$2,$3,'2027-01-01','scheduled')`, [taskB, h.companyB, b.amendmentId]);
    await h.pg.exec("set session_replication_role=default");
    let err = "";
    try { await h.pg.query(`insert into pierre_rt_contract_effect_history (id, company_id, employee_id, parent_contract_id, amendment_contract_id, activation_task_id, field_key, new_value) values (gen_random_uuid(),$1,$2,$3,$4,$5,'employment.salary','v')`, [h.companyA, a.employeeId, a.parentId, a.amendmentId, taskB]); }
    catch (e) { err = (e as Error).message; }
    expect(err).toMatch(/foreign key|violates/i);
  });
  it("a duplicate (amendment, field) is refused by the unique index", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const a = await amendmentFor(ownerA);
    expect((await rawInsert(h.companyA, a.employeeId, a.parentId, a.amendmentId, "employment.salary")).ok).toBe(true);
    const dup = await rawInsert(h.companyA, a.employeeId, a.parentId, a.amendmentId, "employment.salary");
    expect(dup.ok).toBe(false); expect(dup.err).toMatch(/unique|duplicate/i);
  });
});
