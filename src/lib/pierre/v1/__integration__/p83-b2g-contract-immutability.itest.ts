// src/lib/pierre/v1/__integration__/p83-b2g-contract-immutability.itest.ts
// PHASE 8.3-B2G §7 — a finalized/signed contract version is immutable at the DB level; a
// signed contract's identity is frozen. Direct SQL mutation is refused.

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

async function finalizedContract() {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  await C.finalizeContract(h.db, owner, c.id);
  return c.id;
}

describe("§7 contract immutability", () => {
  it("a finalized contract version's content cannot be mutated by direct SQL", async () => {
    const id = await finalizedContract();
    const v = (await h.db.query<{ id: string }>(`select id from pierre_rt_employee_contract_versions where contract_id=$1 order by version desc limit 1`, [id])).rows[0];
    await expect(h.db.query(`update pierre_rt_employee_contract_versions set content_hash='tampered' where id=$1`, [v.id])).rejects.toThrow(/immutable/);
    await expect(h.db.query(`update pierre_rt_employee_contract_versions set canonical_hash='tampered' where id=$1`, [v.id])).rejects.toThrow(/immutable/);
    await expect(h.db.query(`update pierre_rt_employee_contract_versions set template_version_id=null where id=$1`, [v.id])).rejects.toThrow(/immutable/);
  });

  it("a signed contract's identity is frozen and it cannot move to a modifiable state", async () => {
    const id = await finalizedContract();
    // walk it to signed through the legal path (prepare → submitted → in_progress → signed)
    await C.prepareContractSignature(h.db, owner, id);
    await h.db.query(`update pierre_rt_employee_contracts set workflow_status='submitted' where id=$1`, [id]);
    await h.db.query(`update pierre_rt_employee_contracts set workflow_status='in_progress' where id=$1`, [id]);
    await h.db.query(`update pierre_rt_employee_contracts set workflow_status='signed' where id=$1`, [id]);
    // identity frozen
    await expect(h.db.query(`update pierre_rt_employee_contracts set contract_type='OTHER' where id=$1`, [id])).rejects.toThrow(/signed contract is immutable/);
    // cannot go back to a modifiable state
    await expect(h.db.query(`update pierre_rt_employee_contracts set workflow_status='draft' where id=$1`, [id])).rejects.toThrow(/illegal contract workflow transition/);
    // only superseded / archived are allowed
    await h.db.query(`update pierre_rt_employee_contracts set workflow_status='superseded' where id=$1`, [id]);
  });

  it("a finalized contract cannot get a new version (R1.7); reopening invalidates the prior approval", async () => {
    const id = await finalizedContract();
    // R1.7 — a final contract is locked: no new version (corrections go through an amendment)
    await expect(C.createContractVersion(h.db, owner, id, { effective_from: "2026-02-01" })).rejects.toMatchObject({ code: "conflict" });

    // a separate contract: approve then reopen (request-changes) → a new version is allowed and
    // the prior approval no longer counts for the new head.
    const c2 = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c2.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c2.id);
    await C.approveContract(h.db, owner, c2.id);
    await C.requestContractChanges(h.db, owner, c2.id);   // approved → changes_requested (reopen)
    const nv = await C.createContractVersion(h.db, owner, c2.id, { effective_from: "2026-02-01" });
    expect(nv.version).toBeGreaterThan(1);
    const back = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [c2.id])).rows[0];
    expect(back.workflow_status).toBe("draft"); // reset to draft, never 'final' with a draft head
    const r = await C.checkContractReadiness(h.db, owner, c2.id, "finalize");
    expect(r.approvals_obtained).toBe(0);
  });
});
