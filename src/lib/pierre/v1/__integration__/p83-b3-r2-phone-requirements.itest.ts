// PHASE 8.3-B3-R2.2 — real, tenant-safe phone handling. The phone is read from the tenant's own
// records (employee / company signatory) — never invented, never another tenant's. It is
// normalized to E.164 only when safe, and an absent phone where required (otp_sms / AES) fails
// CLOSED before any provider call.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory, readyForSignatureContract } from "./b3-helpers";
import { FakeSignatureProvider } from "../signature-provider";
import { normalizePhoneNumber, SignerSecurityError } from "../signature-security";
import * as S from "../signatures";

describe("B3-R2.2 phone normalization (pure)", () => {
  it("already-E.164 is kept", () => { expect(normalizePhoneNumber("+33612345678")).toBe("+33612345678"); expect(normalizePhoneNumber("+41791234567")).toBe("+41791234567"); });
  it("spaces / separators are stripped", () => { expect(normalizePhoneNumber("+33 6 12 34 56 78")).toBe("+33612345678"); });
  it("00 international prefix → +", () => { expect(normalizePhoneNumber("0033612345678")).toBe("+33612345678"); });
  it("national 0X with a known country → +CC", () => { expect(normalizePhoneNumber("0612345678", "FR")).toBe("+33612345678"); });
  it("missing phone → refused", () => { expect(() => normalizePhoneNumber(null)).toThrow(/required but missing/i); expect(() => normalizePhoneNumber("")).toThrow(SignerSecurityError); });
  it("invalid E.164 → refused", () => { expect(() => normalizePhoneNumber("+0")).toThrow(/valid E\.164/i); expect(() => normalizePhoneNumber("+33abc")).toThrow(SignerSecurityError); });
  it("national number with NO usable country → refused (not silently invented)", () => { expect(() => normalizePhoneNumber("0612345678")).toThrow(/country is not supported/i); });
});

let h: Harness; let owner: TenantContext; let sd: ReturnType<typeof storageDeps>; let provider: FakeSignatureProvider;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps(); provider = new FakeSignatureProvider({ providerKey: "fake_provider" });
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); vi.unstubAllEnvs(); });
const deps = () => ({ provider, storage: sd.storage, scanner: sd.scanner });

describe("B3-R2.2 tenant-safe phone plumbing", () => {
  it("the recipient's phone comes from the tenant's OWN employee (never another tenant's)", async () => {
    // a different tenant has a different phone — it must never be used here
    await h.db.query(`update pierre_rt_companies set signatory_phone='+33100000000' where id=$1`, [h.companyA]);
    const emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test", phone: "+33611111111" });
    await seedEmployee(h, h.companyB, { email: "evil@b.test", phone: "+33699999999" }); // other tenant
    await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    const recs = (await h.db.query<{ role: string; phone_number: string | null }>(`select role, phone_number from pierre_rt_signature_recipients sr join pierre_rt_signature_requests r on r.id=sr.signature_request_id where r.company_id=$1 order by signing_order`, [h.companyA])).rows;
    const employee = recs.find((r) => r.role === "employee");
    expect(employee?.phone_number).toBe("+33611111111"); // the tenant's employee phone
    expect(recs.some((r) => r.phone_number === "+33699999999")).toBe(false); // never the other tenant's
  });

  it("AES with the employee's phone present submits OK; AES without a phone fails CLOSED before activation", async () => {
    vi.stubEnv("CLONESTORE_SIGNATURE_AES_ENABLED", "true");
    const emp = await seedEmployee(h, h.companyA, { email: "ada@acme.test", phone: "+33611111111" });
    await h.db.query(`update pierre_rt_companies set signatory_phone='+33100000000' where id=$1`, [h.companyA]);
    await publishContractTemplate(h, owner); await configureSignatory(h, h.companyA);
    const cid = await readyForSignatureContract(h, owner, sd, emp);
    // force the request to the AES tier
    await h.db.query(`update pierre_rt_signature_requests set signature_level='advanced_provider_managed' where company_id=$1 and document_version_id=(select document_version_id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1)`, [h.companyA]);
    const res = await S.submitContractToSignatureProvider(h.db, owner, cid, {}, deps());
    expect(res.status).toBeTruthy(); // AES accepted (both signers have phones + capability on)

    // now an employee WITHOUT a phone at the AES tier → fail-closed
    const emp2 = await seedEmployee(h, h.companyA, { email: "noeph@acme.test", phone: null });
    const cid2 = await readyForSignatureContract(h, owner, sd, emp2);
    await h.db.query(`update pierre_rt_signature_requests set signature_level='advanced_provider_managed' where company_id=$1 and id=(select id from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1)`, [h.companyA]);
    await expect(S.submitContractToSignatureProvider(h.db, owner, cid2, {}, deps())).rejects.toThrow(/phone/i);
  });
});
