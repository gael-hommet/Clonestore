// PHASE 8.3-B3-R3.3 — a verified evidence proof is DERIVED from the real file. The governed
// function takes NO mime/sha/size from the caller (nothing to forge); it requires a real file_id,
// derives the digest/mime/size from pierre_rt_files, and only records `verified` after the file is
// clean, same-tenant and linked to this request.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";
import * as C from "../contracts";

let h: Harness; let ownerA: TenantContext; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
beforeEach(async () => {
  h = await createHarness();
  ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
});
afterEach(async () => { await h.close(); });

async function signed(owner: TenantContext): Promise<{ requestId: string; fileId: string; auditFileId: string; evidenceId: string }> {
  const emp = await seedEmployee(h, owner.company_id, { email: `e${newUuid().slice(0, 6)}@acme.test` });
  await publishContractTemplate(h, owner); await configureSignatory(h, owner.company_id);
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const { signature_request_id } = await signExistingContract(h, owner, { storage, scanner }, provider, c.id);
  const sd = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='signed_document'`, [owner.company_id, signature_request_id])).rows[0];
  const au = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='audit_trail'`, [owner.company_id, signature_request_id])).rows[0];
  const ev = (await h.db.query<{ id: string }>(`select id from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [owner.company_id, signature_request_id])).rows[0];
  return { requestId: signature_request_id, fileId: sd.file_id, auditFileId: au.file_id, evidenceId: ev.id };
}
async function record(company: string, args: { req: string; evidence: string | null; type: string; file: string | null }): Promise<{ ok: boolean; status?: string; err?: string }> {
  try {
    return await h.db.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [company]);
      const r = await tx.query<{ status: string }>(`select status from pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`, [company, args.req, args.evidence, args.type, null, args.file, null]);
      return { ok: true, status: r.rows[0].status };
    });
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}

describe("B3-R3.3 evidence proof derived from the real file", () => {
  it("a null file_id is refused (a material proof requires a real file)", async () => {
    const s = await signed(ownerA);
    const r = await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: null });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/requires a real file/i);
  });
  it("the recorded sha/mime/size are DERIVED from the file (caller supplies no metadata)", async () => {
    const s = await signed(ownerA);
    await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: s.fileId });
    const fileRow = (await h.db.query<{ sha256: string; detected_mime_type: string; size_bytes: string }>(`select sha256, detected_mime_type, size_bytes from pierre_rt_files where company_id=$1 and id=$2`, [h.companyA, s.fileId])).rows[0];
    const art = (await h.db.query<{ sha256: string; mime_type: string; size_bytes: number; verification_status: string }>(`select sha256, mime_type, size_bytes, verification_status from pierre_rt_signature_evidence_artifacts where company_id=$1 and artifact_type='certificate' and file_id=$2`, [h.companyA, s.fileId])).rows[0];
    expect(art.sha256).toBe(fileRow.sha256); // derived, not caller-chosen
    expect(art.mime_type).toBe(fileRow.detected_mime_type);
    expect(String(art.size_bytes)).toBe(String(fileRow.size_bytes));
    expect(art.verification_status).toBe("verified"); // only after all checks
  });
  it("a clean same-tenant file NOT linked to this request is refused", async () => {
    const s1 = await signed(ownerA);
    const s2 = await signed(ownerA); // s2's audit file is clean + tenant A, but not linked to s1
    const r = await record(h.companyA, { req: s1.requestId, evidence: null, type: "certificate", file: s2.auditFileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not linked to this signature request/i);
  });
  it("a file of ANOTHER tenant is refused", async () => {
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const sA = await signed(ownerA); const sB = await signed(ownerB);
    const r = await record(h.companyA, { req: sA.requestId, evidence: null, type: "certificate", file: sB.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not belong to this tenant/i);
  });
  it("a NON-clean file is refused", async () => {
    const s = await signed(ownerA);
    await h.db.query(`update pierre_rt_files set upload_status='quarantined' where company_id=$1 and id=$2`, [h.companyA, s.fileId]);
    const r = await record(h.companyA, { req: s.requestId, evidence: null, type: "certificate", file: s.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not clean/i);
  });
});
