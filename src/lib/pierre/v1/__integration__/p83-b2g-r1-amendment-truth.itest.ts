// PHASE 8.3-B2G-R1.8 — the amendment's human reason and its technical idempotency key are
// stored separately; the key has a real tenant-scoped DB constraint; the audit shows the reason.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const parent = async () => (await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).id;

describe("R1.8 amendment truth", () => {
  it("the human reason is kept distinct from the technical key, and the audit shows the reason", async () => {
    const p = await parent();
    const amd = await C.createContractAmendment(h.db, owner, p, { reason: "Augmentation de salaire 2026", effective_from: "2026-07-01", idempotency_key: "tech-key-xyz" });
    const row = (await h.db.query<{ amendment_reason: string; amendment_idempotency_key: string }>(`select amendment_reason, amendment_idempotency_key from pierre_rt_employee_contracts where id=$1`, [amd.id])).rows[0];
    expect(row.amendment_reason).toBe("Augmentation de salaire 2026");
    expect(row.amendment_idempotency_key).toBe("tech-key-xyz");
    // the audit carries the HUMAN reason, not the technical key
    const aud = (await h.db.query<{ reason: string }>(`select reason from pierre_rt_contract_audit where contract_id=$1 and event='contract.amendment_created'`, [amd.id])).rows[0];
    expect(aud.reason).toBe("Augmentation de salaire 2026");
    expect(aud.reason).not.toBe("tech-key-xyz");
  });

  it("the same idempotency key returns the same amendment (one row)", async () => {
    const p = await parent();
    const a1 = await C.createContractAmendment(h.db, owner, p, { reason: "r", effective_from: "2026-07-01", idempotency_key: "k" });
    const a2 = await C.createContractAmendment(h.db, owner, p, { reason: "r", effective_from: "2026-07-01", idempotency_key: "k" });
    expect(a2.id).toBe(a1.id);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_contracts where parent_contract_id=$1`, [p])).rows[0].n;
    expect(n).toBe(1);
  });

  it("a tenant-scoped DB unique constraint backs the idempotency key", async () => {
    const p = await parent();
    await C.createContractAmendment(h.db, owner, p, { reason: "r", effective_from: "2026-07-01", idempotency_key: "k" });
    // a direct forged duplicate (same company+parent+key) is refused by the DB
    await expect(h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, workflow_status, parent_contract_id, amendment_idempotency_key) values (gen_random_uuid(),$1,$2,'CDI_FULL_TIME','draft','draft',$3,'k')`, [h.companyA, emp, p]))
      .rejects.toThrow(/duplicate key|unique/i);
  });
});
