// PHASE 8.3-B3-R2.7 — the evidence-artifacts ledger has REAL composite tenant-safe foreign keys:
// (company_id, signature_request_id) → signature_requests, (company_id, evidence_id) →
// signature_evidence, (company_id, file_id) → files. A cross-tenant reference is impossible even
// with a known UUID (proven with raw superuser inserts that bypass the app-role revoke).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
import * as C from "../contracts";

let h: Harness; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
beforeEach(async () => { h = await createHarness(); storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" }); });
afterEach(async () => { await h.close(); });

async function signed(owner: TenantContext): Promise<{ requestId: string; fileId: string; evidenceId: string }> {
  const emp = await seedEmployee(h, owner.company_id, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  await publishContractTemplate(h, owner); await configureSignatory(h, owner.company_id);
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const { signature_request_id } = await signExistingContract(h, owner, { storage, scanner }, provider, c.id);
  const art = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='signed_document'`, [owner.company_id, signature_request_id])).rows[0];
  const ev = (await h.db.query<{ id: string }>(`select id from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [owner.company_id, signature_request_id])).rows[0];
  return { requestId: signature_request_id, fileId: art.file_id, evidenceId: ev.id };
}
// raw superuser insert (bypasses the app revoke) — exercises the composite FK directly
async function rawInsert(company: string, req: string, evidence: string | null, file: string | null): Promise<{ ok: boolean; err?: string }> {
  try {
    await h.pg.query(`insert into pierre_rt_signature_evidence_artifacts (id, company_id, signature_request_id, evidence_id, artifact_type, file_id, mime_type, sha256, size_bytes) values (gen_random_uuid(),$1,$2,$3,'certificate',$4,'application/pdf',$5,1)`, [company, req, evidence, file, "a".repeat(64)]);
    return { ok: true };
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}

describe("B3-R2.7 evidence composite FK integrity", () => {
  it("a valid same-tenant reference is accepted", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const a = await signed(ownerA);
    expect((await rawInsert(h.companyA, a.requestId, a.evidenceId, a.fileId)).ok).toBe(true);
  });
  it("a cross-tenant signature_request reference is REFUSED by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await signed(ownerA); const b = await signed(ownerB);
    const r = await rawInsert(h.companyA, b.requestId, null, null); // A claims B's request
    expect(r.ok).toBe(false); expect(r.err).toMatch(/foreign key|violates/i);
  });
  it("a cross-tenant evidence reference is REFUSED by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await signed(ownerA); const b = await signed(ownerB);
    const r = await rawInsert(h.companyA, a.requestId, b.evidenceId, null);
    expect(r.ok).toBe(false); expect(r.err).toMatch(/foreign key|violates/i);
  });
  it("a cross-tenant file reference is REFUSED by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const a = await signed(ownerA); const b = await signed(ownerB);
    const r = await rawInsert(h.companyA, a.requestId, null, b.fileId);
    expect(r.ok).toBe(false); expect(r.err).toMatch(/foreign key|violates/i);
  });
  it("an unknown request UUID is REFUSED by the FK", async () => {
    const ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
    await signed(ownerA);
    const r = await rawInsert(h.companyA, newUuid(), null, null);
    expect(r.ok).toBe(false); expect(r.err).toMatch(/foreign key|violates/i);
  });
});
