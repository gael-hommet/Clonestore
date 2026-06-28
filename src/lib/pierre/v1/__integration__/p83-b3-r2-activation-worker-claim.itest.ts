// PHASE 8.3-B3-R2.9 — the amendment-activation worker uses a governed, tenant-bound atomic claim
// (FOR UPDATE SKIP LOCKED). Two workers never claim the same task; an expired lease is
// reclaimable; a repeatedly-failing task is retried then dead-lettered; a second run after success
// is a no-op. (PGlite single-connection → concurrency proven LOGICALLY via claim exclusivity.)
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

async function scheduledAmendment(effects: Record<string, string | null>, effectiveFrom = "2027-01-01"): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, { email: `e${Math.random().toString(36).slice(2, 8)}@acme.test` });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: effectiveFrom, effects });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-27" }); // future → schedules a task
  return amd.id;
}
async function claim(worker: string, asOf: string): Promise<string[]> {
  return h.db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [h.companyA]);
    const r = await tx.query<{ id: string }>(`select id from pierre_rt_claim_contract_activations($1,$2,$3,$4,$5)`, [h.companyA, 10, worker, 60, asOf]);
    return r.rows.map((x) => x.id);
  });
}

describe("B3-R2.9 activation worker claim", () => {
  it("two workers claiming the same due task get DISJOINT results", async () => {
    await scheduledAmendment({ "employment.role_title": "Lead" });
    const w1 = await claim("w1", "2027-02-01");
    const w2 = await claim("w2", "2027-02-01");
    expect(w1.length).toBe(1);
    expect(w2.length).toBe(0);
  });
  it("an expired lease is reclaimable", async () => {
    await scheduledAmendment({ "employment.role_title": "Lead" });
    const w1 = await claim("w1", "2027-02-01");
    expect(w1.length).toBe(1);
    await h.db.query(`update pierre_rt_contract_activation_tasks set lease_expires_at=now() - interval '1 minute' where company_id=$1`, [h.companyA]);
    const w2 = await claim("w2", "2027-02-01");
    expect(w2).toEqual(w1);
  });
  it("the worker applies a due task; a second run is a no-op", async () => {
    const amd = await scheduledAmendment({ "employment.role_title": "Principal Engineer" });
    const r1 = await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-01" });
    expect(r1.applied).toBe(1);
    const emp = (await h.db.query<{ role_title: string }>(`select e.role_title from pierre_rt_employees e join pierre_rt_employee_contracts c on c.employee_id=e.id where c.company_id=$1 and c.id=$2`, [h.companyA, amd])).rows[0];
    expect(emp.role_title).toBe("Principal Engineer");
    const r2 = await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-02" });
    expect(r2.applied).toBe(0);
    const task = (await h.db.query<{ status: string }>(`select status from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("applied");
  });
  it("a repeatedly-failing task is retried then DEAD-LETTERED after the bound", async () => {
    // an invalid site_id makes the employee update fail (FK) every time → retry → dead-letter
    const amd = await scheduledAmendment({ "employment.site_id": "00000000-0000-0000-0000-000000000000" });
    for (let i = 0; i < 3; i++) {
      await S.runDueContractActivations(h.db, owner, { as_of: "2027-02-01" });
      // simulate the retry backoff window elapsing
      await h.db.query(`update pierre_rt_contract_activation_tasks set next_retry_at=now() - interval '1 second' where company_id=$1 and amendment_contract_id=$2 and status='scheduled'`, [h.companyA, amd]);
    }
    const task = (await h.db.query<{ status: string; attempt_count: number; last_error_safe: string | null; dead_lettered_at: string | null }>(`select status, attempt_count, last_error_safe, dead_lettered_at from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd])).rows[0];
    expect(task.status).toBe("dead_letter");
    expect(task.attempt_count).toBeGreaterThanOrEqual(3);
    expect(task.dead_lettered_at).toBeTruthy();
    expect(task.last_error_safe).toBeTruthy();
    // nothing applied to the employee
    const emp = (await h.db.query<{ role_title: string }>(`select e.role_title from pierre_rt_employees e join pierre_rt_employee_contracts c on c.employee_id=e.id where c.company_id=$1 and c.id=$2`, [h.companyA, amd])).rows[0];
    expect(emp.role_title).toBe("Ingénieure"); // unchanged default
  });
});
