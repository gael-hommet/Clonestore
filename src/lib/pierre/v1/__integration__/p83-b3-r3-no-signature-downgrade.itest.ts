// PHASE 8.3-B3-R3.1 — a stronger signature requirement is NEVER silently executed as a weaker SES.
// When the required AES tier is infeasible (capability disabled / phone missing) the submission is
// REFUSED before ANY provider HTTP call (readiness blocked). When AES is feasible, the recipient is
// submitted at the AES tier (advanced_provider_managed) — never electronic_signature.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract } from "./b3-helpers";
import type { SignatureProvider, AddSignatureRecipientInput } from "../signature-provider";
import * as S from "../signatures";

// a provider that COUNTS HTTP-like calls and CAPTURES the recipient security it is asked to use.
function countingProvider() {
  const calls = { createRequest: 0, uploadDocument: 0, addRecipient: 0, activate: 0 };
  const recipients: AddSignatureRecipientInput[] = [];
  let seq = 0;
  const p = {
    providerKey: "fake_provider",
    async createRequest() { calls.createRequest++; return { provider_request_id: `req_${++seq}`, status: "draft", provider: "fake_provider" }; },
    async uploadDocument() { calls.uploadDocument++; return { provider_document_id: `doc_${++seq}`, sha256: "x" }; },
    async addRecipient(i: AddSignatureRecipientInput) { calls.addRecipient++; recipients.push(i); return { provider_recipient_id: `rcp_${++seq}`, email: i.email, role: i.role, status: "pending", signing_order: i.signing_order }; },
    async activateRequest() { calls.activate++; return { provider_request_id: `req_${seq}`, status: "ongoing", provider: "fake_provider" }; },
    async getRequest() { return { provider_request_id: "req", status: "ongoing", provider: "fake_provider" }; },
    async findRequestByIdempotencyKey() { return null; },
  } as unknown as SignatureProvider;
  return { provider: p, calls, recipients };
}

let h: Harness; let owner: TenantContext; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); vi.unstubAllEnvs(); });

async function readyAesContract(withPhones: boolean): Promise<string> {
  const emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test", phone: withPhones ? "+33611111111" : null });
  if (withPhones) await h.db.query(`update pierre_rt_companies set signatory_phone='+33100000000' where id=$1`, [h.companyA]);
  await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
  const cid = await readyForSignatureContract(h, owner, sd, emp);
  // force the request to the AES tier (simulating an APPRENTICESHIP-style policy)
  await h.db.query(`update pierre_rt_signature_requests set signature_level='advanced_provider_managed' where company_id=$1 and id=(select id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1)`, [h.companyA]);
  return cid;
}

describe("B3-R3.1 no signature downgrade", () => {
  it("AES required + capability DISABLED → readiness blocked, submission refused, NO provider HTTP", async () => {
    vi.stubEnv("CLONESTORE_SIGNATURE_AES_ENABLED", "false");
    const cid = await readyAesContract(true); // phones present, but capability off
    const readiness = await S.evaluateContractSignatureReadiness(h.db, owner, cid);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(",")).toMatch(/capability/i);
    const cp = countingProvider();
    await expect(S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider: cp.provider, storage: sd.storage, scanner: sd.scanner })).rejects.toThrow(/capability/i);
    expect(cp.calls.createRequest).toBe(0); // NO HTTP at all
    expect(cp.calls.uploadDocument).toBe(0);
    expect(cp.calls.addRecipient).toBe(0);
  });

  it("AES required + capability ENABLED but a phone MISSING → blocked, no HTTP", async () => {
    vi.stubEnv("CLONESTORE_SIGNATURE_AES_ENABLED", "true");
    const cid = await readyAesContract(false); // capability on, but the employee has no phone
    const readiness = await S.evaluateContractSignatureReadiness(h.db, owner, cid);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(",")).toMatch(/phone/i);
    const cp = countingProvider();
    await expect(S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider: cp.provider, storage: sd.storage, scanner: sd.scanner })).rejects.toThrow(/phone/i);
    expect(cp.calls.createRequest).toBe(0);
  });

  it("AES feasible → submitted at the AES tier (advanced_provider_managed), never electronic_signature", async () => {
    vi.stubEnv("CLONESTORE_SIGNATURE_AES_ENABLED", "true");
    const cid = await readyAesContract(true);
    const cp = countingProvider();
    await S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider: cp.provider, storage: sd.storage, scanner: sd.scanner });
    expect(cp.calls.addRecipient).toBeGreaterThan(0);
    for (const r of cp.recipients) {
      expect(r.signature_level).toBe("advanced_provider_managed"); // never downgraded
      expect(r.auth_method).toBe("otp_sms");
      expect(r.phone_number).toBeTruthy();
    }
  });

  it("a standard SES contract submits at the SES tier with no phone needed", async () => {
    const emp = await seedEmployee(h, h.companyA, { email: "ses@acme.test" });
    await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
    const cid = await readyForSignatureContract(h, owner, sd, emp); // CDI → simple
    const cp = countingProvider();
    await S.submitContractToSignatureProvider(h.db, owner, cid, {}, { provider: cp.provider, storage: sd.storage, scanner: sd.scanner });
    for (const r of cp.recipients) {
      expect(r.signature_level).toBe("simple");
      expect(r.auth_method).toBe("no_otp");
    }
  });
});
