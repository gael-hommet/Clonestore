// PHASE 8.3-B3-R1.2 / R1.5 — the provisioning state machine is durable and RESUMABLE. If
// submission crashes after the provider request was created + the document uploaded (but before
// activation), a re-submit RESUMES from the last persisted step: it never creates a second
// provider request and never uploads the document twice; the provider_document_id is persisted.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import * as S from "../signatures";

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

describe("B3-R1.2/R1.5 provisioning resume (no double create / upload)", () => {
  it("a crash before activation RESUMES: one create, one upload, persisted document id, then activated", async () => {
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    // count the irreversible provider side-effects
    let creates = 0, uploads = 0;
    const origCreate = provider.createRequest.bind(provider);
    const origUpload = provider.uploadDocument.bind(provider);
    provider.createRequest = async (i) => { creates += 1; return origCreate(i); };
    provider.uploadDocument = async (i) => { uploads += 1; return origUpload(i); };
    // make the FIRST activation crash (simulating a process crash right before activation)
    const origActivate = provider.activateRequest.bind(provider);
    let failOnce = true;
    provider.activateRequest = async (i) => { if (failOnce) { failOnce = false; throw new Error("crash before activation"); } return origActivate(i); };

    await expect(S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps())).rejects.toThrow(/crash before activation/);

    // the state machine persisted the partial progress
    const mid = (await h.db.query<{ provider_request_id: string; provider_document_id: string | null; provisioning_step: string; status: string }>(`select provider_request_id, provider_document_id, provisioning_step, status from pierre_rt_signature_requests where company_id=$1 and document_version_id=(select document_version_id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1) order by created_at desc limit 1`, [h.companyA])).rows[0];
    expect(mid.provider_request_id).toBeTruthy();
    expect(mid.provider_document_id).toBeTruthy(); // R1.2 — document id durably persisted
    expect(mid.provisioning_step).toBe("recipients_created");
    expect(mid.status).not.toBe("submitted");

    // RESUME: a second submit completes without re-creating or re-uploading
    const res = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
    expect(res.idempotent).toBe(false);
    expect(res.provider_request_id).toBe(mid.provider_request_id); // same request — never recreated
    expect(creates).toBe(1); // R1.5 — exactly one provider request created
    expect(uploads).toBe(1); // R1.2 — exactly one document upload

    const fin = (await h.db.query<{ provisioning_step: string; status: string }>(`select provisioning_step, status from pierre_rt_signature_requests where company_id=$1 and id=$2`, [h.companyA, res.signature_request_id])).rows[0];
    expect(fin.provisioning_step).toBe("activated");
    expect(fin.status).toBe("submitted");
  });

  it("a fully-activated request is idempotent (a re-submit creates/uploads nothing more)", async () => {
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    let creates = 0, uploads = 0;
    const origCreate = provider.createRequest.bind(provider); provider.createRequest = async (i) => { creates += 1; return origCreate(i); };
    const origUpload = provider.uploadDocument.bind(provider); provider.uploadDocument = async (i) => { uploads += 1; return origUpload(i); };
    const first = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
    const again = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
    expect(again.idempotent).toBe(true);
    expect(again.provider_request_id).toBe(first.provider_request_id);
    expect(creates).toBe(1);
    expect(uploads).toBe(1);
  });
});
