// PHASE 8.3-B3-R1.12 — B3 storage compensation. If finalization fails AFTER the signed document
// and/or evidence have been stored (failpoints: after_signed_store, after_evidence_store,
// before_commit), the stored objects are deleted (no clean orphan), no signed version is created,
// no false contract.signed is recorded, the primary error is preserved, and the compensation is
// audited. Compensation is resilient even when a delete itself fails.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider; let mem: InMemoryStorage;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  // finalize stores the signed doc + evidence into an OBSERVABLE in-memory store (so we can prove
  // compensation deleted exactly what it wrote). The earlier render/upload uses sd.storage.
  mem = new InMemoryStorage();
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const baseDeps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });
const finalizeDeps = () => ({ provider, storage: mem, scanner: sd.scanner });
const storeSize = () => (mem as unknown as { store: Map<string, Buffer> }).store.size;

async function readySubmittedSigned(): Promise<string> {
  const cid = await readyForSignatureContract(h, owner, sd, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, baseDeps());
  provider.__sign(sub.provider_request_id);
  return sub.signature_request_id;
}
async function assertNoFalseSigned(reqId: string) {
  const sr = (await h.db.query<{ signed_document_version_id: string | null; status: string }>(`select signed_document_version_id, status from pierre_rt_signature_requests where company_id=$1 and id=$2`, [h.companyA, reqId])).rows[0];
  expect(sr.signed_document_version_id).toBeNull(); // no orphan signed version
  expect(sr.status).not.toBe("completed");
  const comp = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1 and action='signature.finalization_compensated'`, [h.companyA])).rows[0].n;
  expect(comp).toBeGreaterThanOrEqual(1); // the compensation incident is audited
}

describe("B3-R1.12 storage compensation", () => {
  for (const fp of ["after_signed_store", "after_evidence_store", "before_commit"] as const) {
    it(`failpoint '${fp}' → objects compensated, no orphan, no false signed`, async () => {
      const reqId = await readySubmittedSigned();
      const before = storeSize();
      await expect(S.finalizeSignedContract(h.db, owner, reqId, { ...finalizeDeps(), __failpoint: fp })).rejects.toThrow();
      // net-zero new storage objects survive (everything stored was deleted)
      expect(storeSize()).toBe(before);
      await assertNoFalseSigned(reqId);
    });
  }

  it("compensation is resilient: a failing deleteObject still completes the audit + preserves the primary error", async () => {
    const reqId = await readySubmittedSigned();
    // storage whose deleteObject throws — compensation must swallow it and still audit + rethrow primary
    const brittle = Object.create(mem);
    brittle.deleteObject = async () => { throw new Error("storage offline"); };
    let msg = "";
    try { await S.finalizeSignedContract(h.db, owner, reqId, { provider, storage: brittle, scanner: sd.scanner, __failpoint: "before_commit" }); }
    catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/before_commit/); // the PRIMARY error is preserved (not the storage error)
    await assertNoFalseSigned(reqId);
  });

  it("a successful finalization (no failpoint) leaves NO compensation incident", async () => {
    const reqId = await readySubmittedSigned();
    const r = await S.finalizeSignedContract(h.db, owner, reqId, finalizeDeps());
    expect(r.signed_document_version_id).toBeTruthy();
    const comp = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1 and action='signature.finalization_compensated'`, [h.companyA])).rows[0].n;
    expect(comp).toBe(0);
  });
});
