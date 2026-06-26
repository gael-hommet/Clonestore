// PHASE 8.3-B2G-R1.1 — the normal creation path can never set a parent; only an amendment can.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
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

describe("R1.1 parent bypass closure", () => {
  it("createGovernedContract never sets a parent (a forged body field is ignored at the type+service boundary)", async () => {
    // even when a caller passes an extra parent_contract_id, the service signature drops it
    const forged = { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01", parent_contract_id: newUuid() } as never;
    const c = await C.createGovernedContract(h.db, owner, forged);
    expect(c.parent_contract_id).toBeNull();
  });

  it("only createContractAmendment sets a parent, and it is the real parent", async () => {
    const parent = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const amd = await C.createContractAmendment(h.db, owner, parent.id, { reason: "augmentation", effective_from: "2026-07-01" });
    expect(amd.parent_contract_id).toBe(parent.id);
  });

  it("the DB refuses a forged cross-tenant / chained / self parent (defence in depth)", async () => {
    const eB = await seedEmployee(h, h.companyB);
    const pA = (await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).id;
    // company B contract pointing at company A's contract → blocked at the DB
    await expect(h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, workflow_status, parent_contract_id) values ($1,$2,$3,'CDI_FULL_TIME','draft','draft',$4)`, [newUuid(), h.companyB, eB, pA]))
      .rejects.toThrow(/another tenant|parent/i);
    // parent immutable after creation
    await expect(h.db.query(`update pierre_rt_employee_contracts set parent_contract_id=$1 where id=$1`, [pA])).rejects.toThrow(/immutable/);
  });
});
