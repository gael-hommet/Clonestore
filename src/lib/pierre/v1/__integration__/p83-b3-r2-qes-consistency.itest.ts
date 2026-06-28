// PHASE 8.3-B3-R2.1 — QES consistency. A QES request uses NO OTP authentication (the field is
// omitted), needs the QES capability, and may not be mixed with SES/AES signers in one request.
import { describe, it, expect } from "vitest";
import { resolveYousignSignerSecurity, assertRequestSecurityConsistency, SignerSecurityError } from "../signature-security";
import { YousignSignatureProvider, type FetchLike, type FetchResponse } from "../signature-providers/yousign";

const CAPS = { aes_enabled: true, qes_enabled: true };

describe("B3-R2.1 QES consistency", () => {
  it("QES never carries an OTP mode (no_otp/otp_email/otp_sms are all refused)", () => {
    for (const mode of ["no_otp", "otp_email", "otp_sms"]) {
      expect(() => resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: mode, phone_number: "+33612345678", provider_capabilities: CAPS })).toThrow(/QES does not use an OTP/i);
    }
  });
  it("a QES request may not mix in a SES or AES signer", () => {
    expect(() => assertRequestSecurityConsistency("qualified_provider_managed", ["qualified_provider_managed", "qualified_provider_managed"])).not.toThrow();
    expect(() => assertRequestSecurityConsistency("qualified_provider_managed", ["qualified_provider_managed", "simple"])).toThrow(/mixed signature tiers/i);
    expect(() => assertRequestSecurityConsistency("qualified_provider_managed", ["advanced_provider_managed"])).toThrow(SignerSecurityError);
  });
  it("SES and AES tiers are internally consistent too", () => {
    expect(() => assertRequestSecurityConsistency("simple", ["simple", "acknowledgement"])).not.toThrow(); // both SES
    expect(() => assertRequestSecurityConsistency("advanced_provider_managed", ["advanced_provider_managed"])).not.toThrow();
    expect(() => assertRequestSecurityConsistency("simple", ["advanced_provider_managed"])).toThrow(/mixed/i);
  });
  it("the QES payload OMITS signature_authentication_mode entirely (HTTP mock)", async () => {
    let body: Record<string, unknown> | null = null;
    const fetch: FetchLike = async (_u, init) => { body = JSON.parse(init.body as string); const res: FetchResponse = { status: 200, ok: true, headers: { get: () => "application/json" }, json: async () => ({ id: "s", status: "initiated" }), arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" }; return res; };
    const p = new YousignSignatureProvider({ apiUrl: "https://x", apiKey: "k", webhookSecret: "w", fetch, qesEnabled: true });
    await p.addRecipient({ provider_request_id: "sr", email: "a@b.c", name: "A B", role: "employee", signing_order: 1, signature_level: "qualified_provider_managed", provider_document_id: "doc", fields: [{ type: "signature", document_id: "doc", page: 1, x: 1, y: 1, width: 1, height: 1 }] });
    expect(body).not.toBeNull();
    const sent = body as unknown as Record<string, unknown>;
    expect("signature_authentication_mode" in sent).toBe(false);
    expect(sent.signature_level).toBe("qualified_electronic_signature");
  });
  it("QES without the capability is refused (before any HTTP call)", async () => {
    let called = 0;
    const fetch: FetchLike = async () => { called++; return { status: 200, ok: true, headers: { get: () => "application/json" }, json: async () => ({ id: "s" }), arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" }; };
    const p = new YousignSignatureProvider({ apiUrl: "https://x", apiKey: "k", webhookSecret: "w", fetch, qesEnabled: false });
    await expect(p.addRecipient({ provider_request_id: "sr", email: "a@b.c", name: "A B", role: "employee", signing_order: 1, signature_level: "qualified_provider_managed", provider_document_id: "doc", fields: [{ type: "signature", document_id: "doc", page: 1, x: 1, y: 1, width: 1, height: 1 }] })).rejects.toThrow(/capability/i);
    expect(called).toBe(0);
  });
});
