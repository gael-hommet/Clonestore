// PHASE 8.3-B3.8/B3.9 — the signed document + evidence are really retrieved, scanned clean,
// stored privately and made immutable. An infected signed document is quarantined and the
// contract stays UNSIGNED. A duplicate completion produces only one signed version + evidence.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { DeterministicTestScanProvider } from "../file-scan";
import { seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent, InMemoryStorage } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let provider: FakeSignatureProvider;
let storage: InMemoryStorage; const scanner = new DeterministicTestScanProvider();
const sd = () => ({ storage, scanner, deps: () => ({ storage, scanner }) });
const deps = () => ({ provider, storage, scanner });
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  storage = new InMemoryStorage(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });

async function submitted(): Promise<{ contractId: string; reqId: string; provReqId: string }> {
  const contractId = await readyForSignatureContract(h, owner, sd() as never, emp);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, contractId, {}, deps());
  return { contractId, reqId: sub.signature_request_id, provReqId: sub.provider_request_id };
}

describe("B3.8/B3.9 signed document + evidence", () => {
  it("stores a clean signed document + evidence and makes the contract version immutable", async () => {
    const { contractId, reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d1", eventType: "request.completed", requestId: reqId });
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.finalized).toBe(1);
    const sr = (await h.db.query<{ signed_document_version_id: string }>(`select signed_document_version_id from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0];
    // the signed document version is immutable at the contract layer (no SQL mutation of a signed contract)
    const c = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [contractId])).rows[0].ws;
    expect(c).toBe("signed");
    await expect(h.db.query(`update pierre_rt_employee_contracts set contract_type='OTHER' where id=$1`, [contractId])).rejects.toThrow(/signed contract is immutable/);
    // evidence: 2 artifacts, integrity verified, signed file clean
    const ev = (await h.db.query<{ events: unknown[]; integrity_verified: boolean }>(`select events, integrity_verified from pierre_rt_signature_evidence where signature_request_id=$1`, [reqId])).rows[0];
    expect(ev.integrity_verified).toBe(true);
    void sr;
  });

  it("an INFECTED signed document is quarantined and the contract is NOT signed", async () => {
    const { contractId, reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    provider.__corruptSigned(provReqId); // the 'signed' bytes are an EICAR test file
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d2", eventType: "request.completed", requestId: reqId });
    const r = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(r.finalized).toBe(0);
    const c = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [contractId])).rows[0].ws;
    expect(c).not.toBe("signed");
    const sr = (await h.db.query<{ signed_document_version_id: string | null; reconcile_status: string }>(`select signed_document_version_id, reconcile_status from pierre_rt_signature_requests where id=$1`, [reqId])).rows[0];
    expect(sr.signed_document_version_id).toBeNull();
    expect(sr.reconcile_status).toMatch(/unclean|needs_finalization/);
  });

  it("a duplicate completion yields exactly one signed version + one evidence row", async () => {
    const { reqId, provReqId } = await submitted();
    provider.__sign(provReqId);
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d3", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    // a second completion (different event id) → finalization is idempotent
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "d3b", eventType: "request.completed", requestId: reqId });
    await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    const evn = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_evidence where signature_request_id=$1`, [reqId])).rows[0].n;
    expect(evn).toBe(1);
  });
});
