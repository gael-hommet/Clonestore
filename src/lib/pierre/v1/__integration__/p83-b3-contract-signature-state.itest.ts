// PHASE 8.3-B3 — full governed e-signature lifecycle (with the deterministic Fake provider):
// ready → submit → provider activation → completed webhook → governed finalization → signed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract, ingestWebhookEvent } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  provider = new FakeSignatureProvider({ providerKey: "fake_provider", secret: "wh-secret" });
  emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test" });
  await publishContractTemplate(h, owner);
  await configureSignatory(h, h.companyA);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });

describe("B3 contract signature lifecycle", () => {
  it("submits to the provider, then signs only after the signed document + evidence are retrieved", async () => {
    const id = await readyForSignatureContract(h, owner, sd, emp);
    // submit → provider request created + activated, contract submitted
    const sub = await S.submitContractToSignatureProvider(h.db, owner, id, {}, deps());
    expect(sub.provider_request_id).toBeTruthy();
    expect(sub.status).toBe("ongoing");
    const afterSubmit = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [id])).rows[0].ws;
    expect(afterSubmit).toBe("submitted");
    const sr = (await h.db.query<{ id: string; provider_request_id: string }>(`select id, provider_request_id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1`, [h.companyA])).rows[0];

    // the provider completes (all recipients sign)
    provider.__sign(sr.provider_request_id);
    // a verified webhook arrives → enqueued event
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "evt-done", eventType: "request.completed", requestId: sr.id });
    // the governed worker processes it → finalization downloads signed doc + evidence → signed
    const res = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(res.finalized).toBe(1);

    const c = (await h.db.query<{ ws: string; signed_at: string | null }>(`select workflow_status ws, signed_at from pierre_rt_employee_contracts where id=$1`, [id])).rows[0];
    expect(c.ws).toBe("signed");
    expect(c.signed_at).toBeTruthy();
    const sr2 = (await h.db.query<{ status: string; signed_document_version_id: string | null }>(`select status, signed_document_version_id from pierre_rt_signature_requests where id=$1`, [sr.id])).rows[0];
    expect(sr2.status).toBe("completed");
    expect(sr2.signed_document_version_id).toBeTruthy();
    // evidence stored + the signed document version is clean
    const ev = (await h.db.query<{ integrity_verified: boolean; content_hash_signed: string }>(`select integrity_verified, content_hash_signed from pierre_rt_signature_evidence where signature_request_id=$1`, [sr.id])).rows[0];
    expect(ev.integrity_verified).toBe(true);
    expect(ev.content_hash_signed).toMatch(/^[a-f0-9]{64}$/);
    const signedFile = (await h.db.query<{ upload_status: string; scan_status: string }>(`select f.upload_status, f.scan_status from pierre_rt_document_versions dv join pierre_rt_files f on f.id=dv.rendered_pdf_file_id where dv.id=$1`, [sr2.signed_document_version_id])).rows[0];
    expect([signedFile.upload_status, signedFile.scan_status]).toEqual(["clean", "clean"]);
  });

  it("a provider 'completed' does NOT sign the contract if the signed document cannot be retrieved", async () => {
    const id = await readyForSignatureContract(h, owner, sd, emp);
    const sub = await S.submitContractToSignatureProvider(h.db, owner, id, {}, deps());
    const sr = (await h.db.query<{ id: string }>(`select id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1`, [h.companyA])).rows[0];
    // provider says completed via webhook, but we DON'T call __sign → no signed document available
    await ingestWebhookEvent(h, h.companyA, { provider: "fake_provider", eventId: "evt-done", eventType: "request.completed", requestId: sr.id });
    const res = await S.processPendingSignatureEvents(h.db, owner, {}, deps());
    expect(res.finalized).toBe(0); // finalization failed → not signed
    const c = (await h.db.query<{ ws: string }>(`select workflow_status ws from pierre_rt_employee_contracts where id=$1`, [id])).rows[0].ws;
    expect(c).not.toBe("signed");
    const sr2 = (await h.db.query<{ status: string; reconcile_status: string }>(`select status, reconcile_status from pierre_rt_signature_requests where id=$1`, [sr.id])).rows[0];
    expect(sr2.reconcile_status).toBe("needs_finalization");
    void sub;
  });
});
