// PHASE 8.3-B3-R2.11 — amendment activation is ATOMIC. A failure injected at any step (after the
// employee update, before/after the history, before the outbox) rolls EVERYTHING back: the
// employee is unchanged, no history row survives, the task is not applied, no audit/outbox is
// emitted, and the parent is never touched.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as C from "../contracts";
import * as S from "../signatures";

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

async function signedPastAmendment(): Promise<{ amendmentId: string; employeeId: string; parentId: string }> {
  const employeeId = await seedEmployee(h, h.companyA, { email: `e${Math.random().toString(36).slice(2, 8)}@acme.test`, role_title: "Ingénieure" });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2026-03-01", effects: { "employment.role_title": "Lead Engineer", "employment.salary": "62000" } });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  return { amendmentId: amd.id, employeeId, parentId: parent.id };
}
async function assertNoPartialState(amendmentId: string, employeeId: string, parentId: string) {
  const emp = (await h.db.query<{ role_title: string; metadata: Record<string, unknown> | null }>(`select role_title, metadata from pierre_rt_employees where company_id=$1 and id=$2`, [h.companyA, employeeId])).rows[0];
  expect(emp.role_title).toBe("Ingénieure"); // unchanged
  expect((emp.metadata?.active_employment ?? null)).toBeNull(); // no effects persisted
  const hist = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amendmentId])).rows[0].n;
  expect(hist).toBe(0); // no history
  const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where company_id=$1 and contract_id=$2 and event='contract.amendment_activated'`, [h.companyA, amendmentId])).rows[0].n;
  expect(audit).toBe(0); // no audit/outbox
  const parent = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where company_id=$1 and id=$2`, [h.companyA, parentId])).rows[0];
  expect(parent.workflow_status).toBe("signed"); // parent untouched
}

describe("B3-R2.11 activation atomicity (failpoints roll everything back)", () => {
  for (const fp of ["after_employee_update", "before_history", "after_history", "before_outbox"] as const) {
    it(`failpoint '${fp}' → no partial state`, async () => {
      const { amendmentId, employeeId, parentId } = await signedPastAmendment();
      await expect(S.activateSignedAmendment(h.db, owner, amendmentId, { as_of: "2026-06-27", __failpoint: fp })).rejects.toThrow();
      await assertNoPartialState(amendmentId, employeeId, parentId);
    });
  }
  it("without a failpoint the activation commits fully (employee + history + audit)", async () => {
    const { amendmentId, employeeId } = await signedPastAmendment();
    await S.activateSignedAmendment(h.db, owner, amendmentId, { as_of: "2026-06-27" });
    const emp = (await h.db.query<{ role_title: string }>(`select role_title from pierre_rt_employees where company_id=$1 and id=$2`, [h.companyA, employeeId])).rows[0];
    expect(emp.role_title).toBe("Lead Engineer");
    const hist = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amendmentId])).rows[0].n;
    expect(hist).toBe(2);
  });
});
