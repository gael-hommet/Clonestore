// src/lib/pierre/v1/__integration__/p83-b2g-contract-amendment.itest.ts
// PHASE 8.3-B2G §8 — an amendment is governed and never mutates the original: own contract,
// own version, own document/approvals, parent link frozen. Cross-tenant / chained / cancelled
// parents are refused; the original is unchanged.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let ownerB: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

async function signedParent(): Promise<string> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id); await C.approveContract(h.db, owner, c.id); await C.finalizeContract(h.db, owner, c.id);
  await C.prepareContractSignature(h.db, owner, c.id);
  await h.db.query(`update pierre_rt_employee_contracts set workflow_status='submitted' where id=$1`, [c.id]);
  await h.db.query(`update pierre_rt_employee_contracts set workflow_status='in_progress' where id=$1`, [c.id]);
  await h.db.query(`update pierre_rt_employee_contracts set workflow_status='signed' where id=$1`, [c.id]);
  return c.id;
}

describe("§8 contract amendment", () => {
  it("an amendment is a new governed contract linked to the parent; the original is unchanged", async () => {
    const parent = await signedParent();
    const before = (await h.db.query(`select workflow_status, contract_type from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "augmentation", effective_from: "2026-07-01" });
    expect(amd.parent_contract_id).toBe(parent);
    expect(amd.employee_id).toBe(emp);            // same employee
    expect(amd.workflow_status).toBe("draft");    // own lifecycle
    expect(amd.id).not.toBe(parent);
    // the amendment has its own version
    const v = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_contract_versions where contract_id=$1`, [amd.id]);
    expect(v.rows[0].n).toBe(1);
    // the original is untouched
    const after = (await h.db.query(`select workflow_status, contract_type from pierre_rt_employee_contracts where id=$1`, [parent])).rows[0];
    expect(after).toEqual(before);
  });

  it("a cross-tenant parent is invisible (refused)", async () => {
    const parent = await signedParent();
    await expect(C.createContractAmendment(h.db, ownerB, parent, { reason: "x", effective_from: "2026-07-01" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("an amendment of an amendment is refused (no chains)", async () => {
    const parent = await signedParent();
    const amd = await C.createContractAmendment(h.db, owner, parent, { reason: "r1", effective_from: "2026-07-01" });
    await expect(C.createContractAmendment(h.db, owner, amd.id, { reason: "r2", effective_from: "2026-08-01" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("the same amendment idempotency key does not create a duplicate", async () => {
    const parent = await signedParent();
    const a1 = await C.createContractAmendment(h.db, owner, parent, { reason: "dup", effective_from: "2026-07-01", idempotency_key: "amd-key-1" });
    const a2 = await C.createContractAmendment(h.db, owner, parent, { reason: "dup", effective_from: "2026-07-01", idempotency_key: "amd-key-1" });
    expect(a2.id).toBe(a1.id);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_contracts where parent_contract_id=$1`, [parent]);
    expect(n.rows[0].n).toBe(1);
  });
});
