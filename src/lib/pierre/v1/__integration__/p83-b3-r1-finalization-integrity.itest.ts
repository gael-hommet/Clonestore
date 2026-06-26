// PHASE 8.3-B3-R1.11 / R1.13 — REAL integrity verification before integrity_verified=true, and the
// normalized append-only evidence-artifacts ledger. A lying hash, a wrong provider request id, a
// recipient/evidence belonging to ANOTHER request, a fake or empty PDF — each is REFUSED (no signed
// version, no false contract.signed). The happy path records one verified artifact per stored file.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent } from "./b3-helpers";
import { FakeSignatureProvider, type SignatureProvider } from "../signature-provider";
import { sha256 } from "../renderers";
import * as S from "../signatures";

const PDF_A = Buffer.from("%PDF-1.4\nSIGNED\n%%EOF\n", "latin1");
const PDF_B = Buffer.from("%PDF-1.4\nAUDIT\n%%EOF\n", "latin1");

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });

async function submitted(): Promise<{ reqId: string; provReqId: string }> {
  const cid = await readyForSignatureContract(h, owner, sd, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
  return { reqId: sub.signature_request_id, provReqId: sub.provider_request_id };
}

// Drive a contract all the way to a finalized (signed) state through the REAL Fake flow.
async function signedThroughRealFlow(): Promise<string> {
  const { reqId, provReqId } = await submitted();
  provider.__sign(provReqId);
  await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: `done-${reqId.slice(0, 8)}`, eventType: "request.completed", requestId: reqId });
  await S.processPendingSignatureEvents(h.db, owner, {}, deps());
  return reqId;
}

// A provider stub returning crafted (possibly lying) finalization data.
function stub(o: { status?: string; prRequestId?: string; recipients?: Array<{ status: string; provider_request_id?: string }>; signed?: Buffer; evidence?: Array<{ type: string; bytes: Buffer; sha256: string; mime: string; provider_request_id?: string }> }): SignatureProvider {
  return {
    providerKey: "fake_provider",
    async getRequest(id: string) { return { provider_request_id: o.prRequestId ?? id, status: o.status ?? "done", provider: "fake_provider" }; },
    async listRecipients() { return (o.recipients ?? [{ status: "signed" }]); },
    async downloadSignedDocument() { return o.signed ?? PDF_A; },
    async downloadEvidence() { return o.evidence ?? [{ type: "signed_document", bytes: PDF_A, sha256: sha256(PDF_A), mime: "application/pdf" }, { type: "audit_trail", bytes: PDF_B, sha256: sha256(PDF_B), mime: "application/pdf" }]; },
  } as unknown as SignatureProvider;
}

async function expectRefused(reqId: string, stubProvider: SignatureProvider, re: RegExp) {
  await expect(S.finalizeSignedContract(h.db, owner, reqId, { provider: stubProvider, storage: sd.storage, scanner: sd.scanner })).rejects.toThrow(re);
  // no signed version, request not completed
  const sr = (await h.db.query<{ signed_document_version_id: string | null; status: string }>(`select signed_document_version_id, status from pierre_rt_signature_requests where company_id=$1 and id=$2`, [h.companyA, reqId])).rows[0];
  expect(sr.signed_document_version_id).toBeNull();
  expect(sr.status).not.toBe("completed");
}

describe("B3-R1.11 real integrity verification (refusals)", () => {
  it("a fake (non-%PDF) signed document is refused", async () => {
    const { reqId } = await submitted();
    await expectRefused(reqId, stub({ signed: Buffer.from("NOT A PDF") }), /not a real PDF/i);
  });
  it("an empty signed document is refused", async () => {
    const { reqId } = await submitted();
    await expectRefused(reqId, stub({ signed: Buffer.alloc(0) }), /empty/i);
  });
  it("a lying evidence hash (sha256 ≠ bytes) is refused", async () => {
    const { reqId } = await submitted();
    const ev = [{ type: "signed_document", bytes: PDF_A, sha256: sha256(PDF_A), mime: "application/pdf" }, { type: "audit_trail", bytes: PDF_B, sha256: "deadbeefdeadbeef", mime: "application/pdf" }];
    await expectRefused(reqId, stub({ evidence: ev }), /lying hash|does not match/i);
  });
  it("a wrong provider request id is refused", async () => {
    const { reqId } = await submitted();
    await expectRefused(reqId, stub({ prRequestId: "some-other-provider-request" }), /provider request id mismatch|another request/i);
  });
  it("a recipient belonging to ANOTHER provider request is refused", async () => {
    const { reqId, provReqId } = await submitted();
    await expectRefused(reqId, stub({ prRequestId: provReqId, recipients: [{ status: "signed", provider_request_id: "another-request" }] }), /another provider request/i);
  });
  it("evidence belonging to ANOTHER provider request is refused", async () => {
    const { reqId, provReqId } = await submitted();
    const ev = [{ type: "signed_document", bytes: PDF_A, sha256: sha256(PDF_A), mime: "application/pdf", provider_request_id: "another-request" }, { type: "audit_trail", bytes: PDF_B, sha256: sha256(PDF_B), mime: "application/pdf" }];
    await expectRefused(reqId, stub({ prRequestId: provReqId, evidence: ev }), /another provider request/i);
  });
  it("not all recipients signed is refused", async () => {
    const { reqId } = await submitted();
    await expectRefused(reqId, stub({ recipients: [{ status: "signed" }, { status: "pending" }] }), /not all recipients|every required signer/i);
  });
});

describe("B3-R1.13 evidence-artifacts ledger (happy path)", () => {
  it("a real signature records one verified artifact per stored file + integrity_verified=true", async () => {
    const signature_request_id = await signedThroughRealFlow();

    const integrity = (await h.db.query<{ integrity_verified: boolean }>(`select integrity_verified from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [h.companyA, signature_request_id])).rows[0];
    expect(integrity.integrity_verified).toBe(true);

    const arts = (await h.db.query<{ artifact_type: string; sha256: string; mime_type: string; verification_status: string; file_id: string | null }>(`select artifact_type, sha256, mime_type, verification_status, file_id from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2 order by artifact_type`, [h.companyA, signature_request_id])).rows;
    expect(arts.length).toBeGreaterThanOrEqual(2);
    expect(arts.map((a) => a.artifact_type)).toContain("signed_document");
    expect(arts.map((a) => a.artifact_type)).toContain("audit_trail");
    for (const a of arts) {
      expect(a.verification_status).toBe("verified");
      expect(a.mime_type).toBe("application/pdf");
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(a.file_id).toBeTruthy();
    }
  });

  it("the artifacts table is append-only (update/delete are rejected)", async () => {
    const signature_request_id = await signedThroughRealFlow();
    await expect(h.db.query(`update pierre_rt_signature_evidence_artifacts set verification_status='failed' where company_id=$1 and signature_request_id=$2`, [h.companyA, signature_request_id])).rejects.toThrow(/append-only/i);
    await expect(h.db.query(`delete from pierre_rt_signature_evidence_artifacts where company_id=$1 and signature_request_id=$2`, [h.companyA, signature_request_id])).rejects.toThrow(/append-only/i);
  });
});
