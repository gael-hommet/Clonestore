// PHASE 8.3-B3-R3.4 — completing/failing an activation task requires OWNING a valid lease. A
// worker can never complete or fail a task claimed by another worker, a task with no claim, or a
// task whose lease has expired.
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

async function scheduledTask(): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2027-01-01", effects: { "employment.role_title": "Lead" } });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  await S.activateSignedAmendment(h.db, owner, amd.id, { as_of: "2026-06-27" }); // schedules
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_contract_activation_tasks where company_id=$1 and amendment_contract_id=$2`, [h.companyA, amd.id])).rows[0].id;
}
async function gov(fn: string, params: unknown[]): Promise<{ ok: boolean; err?: string }> {
  try { await h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); await tx.query(`select ${fn}`, params); }); return { ok: true }; }
  catch (e) { return { ok: false, err: (e as Error).message }; }
}
async function claim(worker: string): Promise<string[]> {
  return h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); return (await tx.query<{ id: string }>(`select id from pierre_rt_claim_contract_activations($1,$2,$3,$4,$5)`, [h.companyA, 10, worker, 60, "2027-02-01"])).rows.map((r) => r.id); }); }
const complete = (task: string, worker: string) => gov(`pierre_rt_complete_contract_activation($1,$2,$3)`, [h.companyA, task, worker]);
const fail = (task: string, worker: string) => gov(`pierre_rt_fail_contract_activation($1,$2,$3,$4,$5)`, [h.companyA, task, worker, "err", 3]);

describe("B3-R3.4 activation lease ownership", () => {
  it("complete WITHOUT a claim is refused", async () => {
    const t = await scheduledTask();
    const r = await complete(t, "w1"); // never claimed
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not own this task lease/i);
  });
  it("worker B cannot complete the claim of worker A", async () => {
    const t = await scheduledTask();
    expect(await claim("A")).toEqual([t]);
    const r = await complete(t, "B");
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not own this task lease/i);
  });
  it("the owning worker completes its own claim", async () => {
    const t = await scheduledTask();
    await claim("A");
    expect((await complete(t, "A")).ok).toBe(true);
    const st = (await h.db.query<{ status: string }>(`select status from pierre_rt_contract_activation_tasks where company_id=$1 and id=$2`, [h.companyA, t])).rows[0];
    expect(st.status).toBe("applied");
  });
  it("an EXPIRED lease cannot be completed", async () => {
    const t = await scheduledTask();
    await claim("A");
    await h.db.query(`update pierre_rt_contract_activation_tasks set lease_expires_at=now() - interval '1 minute' where company_id=$1 and id=$2`, [h.companyA, t]);
    const r = await complete(t, "A");
    expect(r.ok).toBe(false); expect(r.err).toMatch(/lease has expired/i);
  });
  it("worker B cannot FAIL the claim of worker A; an expired lease cannot be failed", async () => {
    const t = await scheduledTask();
    await claim("A");
    expect((await fail(t, "B")).ok).toBe(false);
    await h.db.query(`update pierre_rt_contract_activation_tasks set lease_expires_at=now() - interval '1 minute' where company_id=$1 and id=$2`, [h.companyA, t]);
    const r = await fail(t, "A");
    expect(r.ok).toBe(false); expect(r.err).toMatch(/lease has expired/i);
  });
  it("a double complete is idempotent (second is a no-op)", async () => {
    const t = await scheduledTask();
    await claim("A");
    expect((await complete(t, "A")).ok).toBe(true);
    expect((await complete(t, "A")).ok).toBe(true); // applied → idempotent no-op
  });
});
