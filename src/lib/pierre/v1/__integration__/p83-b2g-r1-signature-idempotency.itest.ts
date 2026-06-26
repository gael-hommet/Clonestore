// PHASE 8.3-B2G-R1.6 — prepareContractSignature is truly idempotent: the same key returns the
// same request (no second recipient set), even after the contract is already ready_for_signature.
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
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

async function ready(): Promise<string> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  await C.finalizeContract(h.db, owner, c.id);
  return c.id;
}

describe("R1.6 signature preparation idempotency", () => {
  it("the same key returns the same request (no duplicate request or recipients) even after ready_for_signature", async () => {
    const id = await ready();
    const a = await C.prepareContractSignature(h.db, owner, id, { idempotency_key: "K" });
    expect(a.idempotent).toBe(false);
    // contract is now ready_for_signature; a second call with the same key returns the same request
    const b = await C.prepareContractSignature(h.db, owner, id, { idempotency_key: "K" });
    expect(b.idempotent).toBe(true);
    expect(b.signature_request_id).toBe(a.signature_request_id);
    expect(b.recipients.length).toBe(2);
    const reqs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_requests where company_id=$1`, [h.companyA])).rows[0].n;
    const recs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_recipients where company_id=$1`, [h.companyA])).rows[0].n;
    expect(reqs).toBe(1);
    expect(recs).toBe(2); // not duplicated
  });

  it("the default (no explicit key) is also idempotent across calls", async () => {
    const id = await ready();
    const a = await C.prepareContractSignature(h.db, owner, id);
    const b = await C.prepareContractSignature(h.db, owner, id);
    expect(b.signature_request_id).toBe(a.signature_request_id);
    expect(b.idempotent).toBe(true);
  });

  it("the same key with DIFFERENT content is a conflict", async () => {
    const id = await ready();
    await C.prepareContractSignature(h.db, owner, id, { idempotency_key: "K2" });
    // tamper the request's recorded content hash → a reuse of the key with different content conflicts
    await h.db.query(`update pierre_rt_signature_requests set approved_content_hash='different-hash' where company_id=$1 and idempotency_key='K2'`, [h.companyA]);
    await expect(C.prepareContractSignature(h.db, owner, id, { idempotency_key: "K2" })).rejects.toMatchObject({ code: "conflict" });
  });
});
