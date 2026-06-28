// PHASE 8.3-B3-R3.5 — the effect-history ledger is written ONLY through the governed function. The
// general app role can neither raw-INSERT nor execute it (no forged employment history); the
// specialized worker role can; the function enforces the allowlist and the relational invariants.
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

async function signedAmendment(): Promise<{ amendmentId: string; parentId: string; employeeId: string }> {
  const employeeId = await seedEmployee(h, h.companyA, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  const parent = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await signExistingContract(h, owner, sdLike(), provider, parent.id);
  const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "raise", effective_from: "2026-03-01", effects: { "employment.role_title": "Lead" } });
  await signExistingContract(h, owner, sdLike(), provider, amd.id);
  return { amendmentId: amd.id, parentId: parent.id, employeeId };
}
async function recordEffect(role: "app" | "worker" | "super", a: { emp: string; parent: string; amd: string; field: string }): Promise<{ ok: boolean; err?: string }> {
  try {
    await h.db.transaction(async (tx) => {
      if (role === "app") await tx.query("set local role pierre_rt_app");
      if (role === "worker") await tx.query("set local role pierre_rt_signature_worker");
      await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]);
      await tx.query(`select pierre_rt_record_contract_effect($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [h.companyA, a.emp, a.parent, a.amd, null, a.field, "old", "new", "2026-03-01", h.userA, null]);
    });
    return { ok: true };
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}

describe("B3-R3.5 effect-history governance", () => {
  it("the app role canNOT raw-INSERT a history row", async () => {
    const a = await signedAmendment();
    await h.pg.exec("set role pierre_rt_app");
    try {
      await expect(h.pg.query(`insert into pierre_rt_contract_effect_history (id, company_id, employee_id, amendment_contract_id, field_key, new_value) values (gen_random_uuid(),$1,$2,$3,'employment.salary','999999')`, [h.companyA, a.employeeId, a.amendmentId])).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
  it("the app role canNOT update or delete a history row", async () => {
    await h.pg.exec("set role pierre_rt_app");
    try {
      await expect(h.pg.query(`update pierre_rt_contract_effect_history set new_value='x'`)).rejects.toThrow(/permission denied/i);
      await expect(h.pg.query(`delete from pierre_rt_contract_effect_history`)).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
  it("the app role canNOT EXECUTE the governed record function", async () => {
    const a = await signedAmendment();
    const r = await recordEffect("app", { emp: a.employeeId, parent: a.parentId, amd: a.amendmentId, field: "employment.salary" });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/permission denied/i);
  });
  it("the specialized worker role CAN record a valid effect", async () => {
    const a = await signedAmendment();
    const r = await recordEffect("worker", { emp: a.employeeId, parent: a.parentId, amd: a.amendmentId, field: "employment.salary" });
    expect(r.ok).toBe(true);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_effect_history where company_id=$1 and amendment_contract_id=$2`, [h.companyA, a.amendmentId])).rows[0].n;
    expect(n).toBe(1);
  });
  it("a NON-allowlisted field is refused", async () => {
    const a = await signedAmendment();
    const r = await recordEffect("worker", { emp: a.employeeId, parent: a.parentId, amd: a.amendmentId, field: "clause.free_text" });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not allowlisted/i);
  });
  it("a parent/employee that does not match the amendment is refused", async () => {
    const a = await signedAmendment();
    const r1 = await recordEffect("worker", { emp: a.employeeId, parent: newUuid(), amd: a.amendmentId, field: "employment.salary" });
    expect(r1.ok).toBe(false); expect(r1.err).toMatch(/parent does not match/i);
    const r2 = await recordEffect("worker", { emp: newUuid(), parent: a.parentId, amd: a.amendmentId, field: "employment.salary" });
    expect(r2.ok).toBe(false); expect(r2.err).toMatch(/employee does not match/i);
  });
});
