// PHASE 8.3-B3-R3.4 — the activation worker threads a STABLE worker id from claim through
// complete/fail. A successful end-to-end application PROVES the worker that claimed also owns the
// completion (a changed id would fail ownership and never apply). A repeatedly-failing task is
// retried then dead-lettered under the same ownership discipline.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
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

async function scheduled(effects: Record<string, string | null>): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2027-01-01", effects });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-27" });
  return amd.id;
}

describe("B3-R3.4 activation worker ownership end-to-end", () => {
  it("the worker claims AND completes with a stable id → the task is applied", async () => {
    const amd = await scheduled({ "employment.role_title": "Lead Engineer" });
    const r = await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-01", worker: "stable-worker-1" });
    expect(r.applied).toBe(1); // complete required the same worker that claimed → only succeeds if stable
    const task = (await h.db.query<{ status: string; locked_by: string | null }>(`select status, locked_by from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("applied");
    expect(task.locked_by).toBeNull(); // lease released on completion
  });
  it("a repeatedly-failing task is retried then DEAD-LETTERED (ownership preserved each round)", async () => {
    const amd = await scheduled({ "employment.site_id": "00000000-0000-0000-0000-000000000000" }); // invalid → apply fails
    for (let i = 0; i < 3; i++) {
      await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-01", worker: `w-${i}` });
      await h.db.query(`update pierre_rt_contract_activation_tasks set next_retry_at=now() - interval '1 second' where company_id=$1 and amendment_contract_id=$2 and status='scheduled'`, [h.companyA, amd]);
    }
    const task = (await h.db.query<{ status: string; attempt_count: number; dead_lettered_at: string | null }>(`select status, attempt_count, dead_lettered_at from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("dead_letter");
    expect(task.attempt_count).toBeGreaterThanOrEqual(3);
    expect(task.dead_lettered_at).toBeTruthy();
  });
  it("a second worker run after success applies nothing more (idempotent)", async () => {
    await scheduled({ "employment.role_title": "Principal" });
    const a = await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-01", worker: "w1" });
    expect(a.applied).toBe(1);
    const b = await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-02", worker: "w2" });
    expect(b.applied).toBe(0);
  });
});
