// PHASE 8.3-B3.10 — a signed amendment activates ONLY the amendment; the signed original is
// never overwritten; a future effect is deferred; activation is idempotent.
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

describe("B3.10 amendment activation", () => {
  it("a past-dated signed amendment activates and never overwrites the signed original", async () => {
    const parent = await signedParent();
    const parentBefore = (await h.db.query(`select workflow_status, contract_type, signed_at from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "augmentation", effective_from: "2026-03-01" });
    await signExistingContract(h, owner, sdLike(), provider, amd.id);
    const act = await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-23" });
    expect(act.activated).toBe(true);
    // the original parent is byte-for-byte unchanged
    const parentAfter = (await h.db.query(`select workflow_status, contract_type, signed_at from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    expect(parentAfter).toEqual(parentBefore);
    const ev = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd.id])).rows[0].n;
    expect(ev).toBeGreaterThanOrEqual(1);
  });

  it("a future-dated signed amendment is deferred, not applied", async () => {
    const parent = await signedParent();
    const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "future raise", effective_from: "2027-01-01" });
    await signExistingContract(h, owner, sdLike(), provider, amd.id);
    const act = await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-23" });
    expect(act.activated).toBe(false);
    expect(act.deferred_until).toBe("2027-01-01");
    const ev = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd.id])).rows[0].n;
    expect(ev).toBe(0); // not activated yet
  });

  it("activation is idempotent (a second call does not double-activate)", async () => {
    const parent = await signedParent();
    const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "r", effective_from: "2026-03-01" });
    await signExistingContract(h, owner, sdLike(), provider, amd.id);
    await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-23" });
    const second = await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-23" });
    expect(second.activated).toBe(true);
    const ev = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_activated'`, [amd.id])).rows[0].n;
    expect(ev).toBe(1); // exactly one activation
  });
});
