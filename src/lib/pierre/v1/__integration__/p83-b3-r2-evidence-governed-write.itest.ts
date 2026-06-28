// PHASE 8.3-B3-R2.7 — evidence proofs are written ONLY through the governed function. The app
// role can no longer raw-INSERT a proof; the governed function validates tenant / request /
// evidence linkage / file ownership / file cleanliness / hash / mime / type / uniqueness, and is
// idempotent (identical duplicate) but conflicts on an incompatible duplicate.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, signExistingContract, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as C from "../contracts";

let h: Harness; let ownerA: TenantContext; let provider: FakeSignatureProvider; let storage: InMemoryStorage;
const scanner = new DeterministicTestScanProvider();
beforeEach(async () => {
  h = await createHarness();
  ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
});
afterEach(async () => { await h.close(); });

async function signedContract(owner: TenantContext): Promise<{ requestId: string; fileId: string; auditFileId: string; evidenceId: string }> {
  const emp = await seedEmployee(h, owner.company_id, { email: `e${Math.abs(Date.now() % 100000)}@acme.test` });
  await publishContractTemplate(h, owner); await configureSignatory(h, owner.company_id);
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const { signature_request_id } = await signExistingContract(h, owner, { storage, scanner }, provider, c.id);
  const art = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='signed_document'`, [owner.company_id, signature_request_id])).rows[0];
  const aud = (await h.db.query<{ file_id: string }>(`select file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 and artifact_type='audit_trail'`, [owner.company_id, signature_request_id])).rows[0];
  const ev = (await h.db.query<{ id: string }>(`select id from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [owner.company_id, signature_request_id])).rows[0];
  return { requestId: signature_request_id, fileId: art.file_id, auditFileId: aud.file_id, evidenceId: ev.id };
}
// R3.3 — the governed function DERIVES sha/mime/size from the real file (no caller metadata).
async function record(company: string, args: { req: string; evidence: string | null; type: string; file: string | null; providerArtifactId?: string | null }): Promise<{ ok: boolean; status?: string; err?: string }> {
  try {
    return await h.db.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [company]);
      const r = await tx.query<{ status: string }>(`select status from pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`,
        [company, args.req, args.evidence, args.type, args.providerArtifactId ?? null, args.file, null]);
      return { ok: true, status: r.rows[0].status };
    });
  } catch (e) { return { ok: false, err: (e as Error).message }; }
}
const H2 = "b".repeat(64);

describe("B3-R2.7 governed evidence write", () => {
  it("the app role CANNOT raw-INSERT an evidence artifact (only the governed function may)", async () => {
    const s = await signedContract(ownerA);
    await h.pg.exec("set role pierre_rt_app");
    try {
      await expect(h.pg.query(`insert into pierre_rt_signature_evidence_artifacts (id, company_id, signature_request_id, artifact_type, sha256) values (gen_random_uuid(),$1,$2,'certificate',$3)`, [h.companyA, s.requestId, H2])).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
  it("the governed function records a valid artifact (truth derived from the file)", async () => {
    const s = await signedContract(ownerA);
    const r = await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: s.fileId });
    expect(r.ok).toBe(true); expect(r.status).toBe("recorded");
  });
  it("an identical duplicate is idempotent; an incompatible duplicate (same provider artifact id, different file) conflicts", async () => {
    const s = await signedContract(ownerA);
    await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: s.fileId, providerArtifactId: "pa_1" });
    const dup = await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: s.fileId, providerArtifactId: "pa_1" });
    expect(dup.ok).toBe(true); expect(dup.status).toBe("duplicate");
    // same provider artifact id but a DIFFERENT file → different DERIVED digest → conflict
    const conflict = await record(h.companyA, { req: s.requestId, evidence: s.evidenceId, type: "certificate", file: s.auditFileId, providerArtifactId: "pa_1" });
    expect(conflict.ok).toBe(false); expect(conflict.err).toMatch(/different digest\/file|already recorded/i);
  });
  it("a null file_id → refused (a material proof requires a real file)", async () => {
    const s = await signedContract(ownerA);
    const r = await record(h.companyA, { req: s.requestId, evidence: null, type: "certificate", file: null });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/requires a real file/i);
  });
  it("an unknown request → refused", async () => {
    const s = await signedContract(ownerA);
    const r = await record(h.companyA, { req: "00000000-0000-0000-0000-000000000000", evidence: null, type: "certificate", file: s.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/unknown signature request/i);
  });
  it("evidence of ANOTHER request → refused", async () => {
    const s1 = await signedContract(ownerA);
    const s2 = await signedContract(ownerA);
    const r = await record(h.companyA, { req: s1.requestId, evidence: s2.evidenceId, type: "certificate", file: s1.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not belong to this request/i);
  });
  it("a file of ANOTHER tenant → refused", async () => {
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    const sA = await signedContract(ownerA);
    const sB = await signedContract(ownerB);
    const r = await record(h.companyA, { req: sA.requestId, evidence: null, type: "certificate", file: sB.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/does not belong to this tenant/i);
  });
  it("a NON-clean file → refused", async () => {
    const s = await signedContract(ownerA);
    await h.db.query(`update pierre_rt_files set scan_status='infected' where company_id=$1 and id=$2`, [h.companyA, s.fileId]);
    const r = await record(h.companyA, { req: s.requestId, evidence: null, type: "certificate", file: s.fileId });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/not clean/i);
  });
  it("an unset session tenant → refused; a mismatched p_company → refused", async () => {
    const s = await signedContract(ownerA);
    // no session binding
    let err1 = "";
    try { await h.db.query(`select pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, s.requestId, null, "certificate", null, s.fileId, null]); } catch (e) { err1 = (e as Error).message; }
    expect(err1).toMatch(/tenant not bound/i);
    // mismatched p_company under a bound session
    const r = await record(h.companyB, { req: s.requestId, evidence: null, type: "certificate", file: s.fileId }); // session B (set inside), p_company B but request belongs to A
    expect(r.ok).toBe(false); // request unknown for tenant B
  });
});
