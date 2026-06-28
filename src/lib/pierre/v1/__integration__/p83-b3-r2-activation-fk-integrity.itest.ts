// PHASE 8.3-B3-R2.8 — the activation-task ledger has real composite tenant-safe FKs to
// employee_contracts, and the GOVERNED scheduling function enforces the full relational
// invariants: the amendment really has this parent, same tenant, same employee, both signed, the
// effects are allowlisted, and execute_at matches the amendment effective_from.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
const sdLike = () => ({ storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

async function signedParent(): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, c.id);
  return c.id;
}
async function signedAmendment(parent: string, effects: Record<string, string | null> = { "employment.role_title": "Lead" }, eff = "2027-01-01"): Promise<string> {
  const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "raise", effective_from: eff, effects });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  return amd.id;
}
async function schedule(company: string, amendmentId: string, executeAt: string, effects: Record<string, unknown>): Promise<{ ok: boolean; err?: string }> {
  try {
    return await h.db.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [company]);
      await tx.query(`select * from pierre_rt_schedule_contract_activation($1,$2,$3,$4)`, [company, amendmentId, executeAt, JSON.stringify(effects)]);
      return { ok: true };
    });
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}

describe("B3-R2.8 activation FK + governed scheduling integrity", () => {
  it("a valid signed amendment schedules", async () => {
    const p = await signedParent(); const amd = await signedAmendment(p);
    expect((await schedule(h.companyA, amd, "2027-01-01", { "employment.role_title": "Lead" })).ok).toBe(true);
  });
  it("a non-allowlisted effect is REFUSED", async () => {
    const p = await signedParent(); const amd = await signedAmendment(p);
    const r = await schedule(h.companyA, amd, "2027-01-01", { "clause.free": "pony" });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not allowlisted/i);
  });
  it("execute_at not matching the amendment effective_from is REFUSED", async () => {
    const p = await signedParent(); const amd = await signedAmendment(p, { "employment.role_title": "Lead" }, "2027-01-01");
    const r = await schedule(h.companyA, amd, "2027-06-01", { "employment.role_title": "Lead" });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not match/i);
  });
  it("an UNSIGNED (draft) amendment is REFUSED", async () => {
    const p = await signedParent();
    const draft = await C.createContractAmendment(h.db, owner, p, { reason: "draft", effective_from: "2027-01-01", effects: { "employment.role_title": "X" } });
    const r = await schedule(h.companyA, draft.id, "2027-01-01", { "employment.role_title": "X" });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not signed/i);
  });
  it("a cross-tenant amendment is REFUSED (session A, amendment of B)", async () => {
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    await publishContractTemplate(h, ownerB); await configureSignatory(h, h.companyB);
    const empB = await seedEmployee(h, h.companyB, { email: `b${newUuid().slice(0, 6)}@b.test` });
    const pB = await C.createGovernedContract(h.db, ownerB, { employee_id: empB, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await signExistingContract(h, ownerB, sdLike(), provider, pB.id);
    const amdB = await C.createContractAmendment(h.db, ownerB, pB.id, { reason: "raise", effective_from: "2027-01-01", effects: { "employment.role_title": "Lead" } });
    await signExistingContract(h, ownerB, sdLike(), provider, amdB.id);
    const r = await schedule(h.companyA, amdB.id, "2027-01-01", { "employment.role_title": "Lead" }); // A schedules B's amendment
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not found for this tenant/i);
  });
  it("a raw activation_task with a cross-tenant amendment is REFUSED by the FK", async () => {
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    await publishContractTemplate(h, ownerB); await configureSignatory(h, h.companyB);
    const empB = await seedEmployee(h, h.companyB, { email: `b2${newUuid().slice(0, 6)}@b.test` });
    const pB = await C.createGovernedContract(h.db, ownerB, { employee_id: empB, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await signExistingContract(h, ownerB, sdLike(), provider, pB.id);
    const amdB = await C.createContractAmendment(h.db, ownerB, pB.id, { reason: "raise", effective_from: "2027-01-01", effects: {} });
    await expect(h.pg.query(`insert into pierre_rt_contract_activation_tasks (id, company_id, amendment_contract_id, parent_contract_id, execute_at, status) values (gen_random_uuid(),$1,$2,$3,'2027-01-01','scheduled')`, [h.companyA, amdB.id, pB.id])).rejects.toThrow(/foreign key|violates/i);
  });
});
