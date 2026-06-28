// PHASE 8.3-B3-R2.1/R2.3 — the SES/AES/QES security matrix, proven both as a pure resolution and
// as the EXACT Yousign payload through a strict local HTTP mock. Unsupported combinations are
// REFUSED before any HTTP call (the mock fetch is never invoked); the accepted payloads carry the
// exact signature_level, the exact presence/absence of signature_authentication_mode, and the
// exact presence/absence of info.phone_number.
import { describe, it, expect } from "vitest";
import { resolveYousignSignerSecurity, SignerSecurityError } from "../signature-security";
import { YousignSignatureProvider, type FetchLike, type FetchResponse } from "../signature-providers/yousign";

const API = "https://api.yousign.test/v3", KEY = "ys_k", WH = "wh_s";
const FIELD = [{ type: "signature" as const, document_id: "doc", page: 1, x: 1, y: 1, width: 1, height: 1 }];
const CAPS = { aes_enabled: true, qes_enabled: true };

function mock() {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetch: FetchLike = async (url, init) => { calls.push({ url, body: init.body }); const res: FetchResponse = { status: 200, ok: true, headers: { get: () => "application/json" }, json: async () => ({ id: "signer_1", status: "initiated" }), arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" }; return res; };
  return { fetch, calls };
}
function prov(m: ReturnType<typeof mock>, caps: { aes?: boolean; qes?: boolean } = {}) {
  return new YousignSignatureProvider({ apiUrl: API, apiKey: KEY, webhookSecret: WH, fetch: m.fetch, aesEnabled: caps.aes ?? false, qesEnabled: caps.qes ?? false });
}
async function addSigner(m: ReturnType<typeof mock>, caps: { aes?: boolean; qes?: boolean }, input: { level: "simple" | "advanced_provider_managed" | "qualified_provider_managed"; auth?: string; phone?: string | null }) {
  const p = prov(m, caps);
  return p.addRecipient({ provider_request_id: "sr_1", email: "a@b.c", name: "A B", role: "employee", signing_order: 1, provider_document_id: "doc", fields: FIELD, signature_level: input.level, auth_method: input.auth, phone_number: input.phone ?? null });
}

describe("B3-R2.1 SES/AES/QES pure resolution (fail-closed)", () => {
  const caps = CAPS;
  it("SES + no_otp → accepted (electronic_signature, no phone)", () => {
    const r = resolveYousignSignerSecurity({ signature_level: "simple", requested_authentication_mode: "no_otp", phone_number: null, provider_capabilities: caps });
    expect(r).toMatchObject({ provider_signature_level: "electronic_signature", provider_authentication_mode: "no_otp", phone_number_required: false, capability_required: null });
  });
  it("SES + otp_email → accepted", () => {
    expect(resolveYousignSignerSecurity({ signature_level: "simple", requested_authentication_mode: "otp_email", phone_number: null, provider_capabilities: caps }).provider_authentication_mode).toBe("otp_email");
  });
  it("SES + otp_sms + phone → accepted (phone required)", () => {
    const r = resolveYousignSignerSecurity({ signature_level: "simple", requested_authentication_mode: "otp_sms", phone_number: "+33612345678", provider_capabilities: caps });
    expect(r.provider_authentication_mode).toBe("otp_sms"); expect(r.phone_number_required).toBe(true);
  });
  it("SES + otp_sms WITHOUT phone → refused", () => {
    expect(() => resolveYousignSignerSecurity({ signature_level: "simple", requested_authentication_mode: "otp_sms", phone_number: null, provider_capabilities: caps })).toThrow(SignerSecurityError);
  });

  it("AES + otp_sms + phone + capability → accepted", () => {
    const r = resolveYousignSignerSecurity({ signature_level: "advanced_provider_managed", requested_authentication_mode: "otp_sms", phone_number: "+33612345678", provider_capabilities: caps });
    expect(r).toMatchObject({ provider_signature_level: "advanced_electronic_signature", provider_authentication_mode: "otp_sms", phone_number_required: true, identity_verification_required: true, capability_required: "aes" });
  });
  it("AES + no_otp → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "advanced_provider_managed", requested_authentication_mode: "no_otp", phone_number: "+33612345678", provider_capabilities: caps })).toThrow(/AES requires otp_sms/i); });
  it("AES + otp_email → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "advanced_provider_managed", requested_authentication_mode: "otp_email", phone_number: "+33612345678", provider_capabilities: caps })).toThrow(/AES requires otp_sms/i); });
  it("AES without phone → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "advanced_provider_managed", requested_authentication_mode: "otp_sms", phone_number: null, provider_capabilities: caps })).toThrow(/phone/i); });
  it("AES without capability → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "advanced_provider_managed", requested_authentication_mode: "otp_sms", phone_number: "+33612345678", provider_capabilities: { aes_enabled: false, qes_enabled: true } })).toThrow(/capability/i); });

  it("QES + no auth + capability → accepted (mode omitted)", () => {
    const r = resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: null, phone_number: null, provider_capabilities: caps });
    expect(r).toMatchObject({ provider_signature_level: "qualified_electronic_signature", provider_authentication_mode: null, capability_required: "qes", identity_verification_required: true });
  });
  it("QES + otp_sms → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: "otp_sms", phone_number: "+33612345678", provider_capabilities: caps })).toThrow(/QES does not use an OTP/i); });
  it("QES + otp_email → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: "otp_email", phone_number: null, provider_capabilities: caps })).toThrow(/QES does not use an OTP/i); });
  it("QES + no_otp → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: "no_otp", phone_number: null, provider_capabilities: caps })).toThrow(/QES does not use an OTP/i); });
  it("QES without capability → refused", () => { expect(() => resolveYousignSignerSecurity({ signature_level: "qualified_provider_managed", requested_authentication_mode: null, phone_number: null, provider_capabilities: { aes_enabled: true, qes_enabled: false } })).toThrow(/capability/i); });
});

describe("B3-R2.3 exact Yousign payload via strict HTTP mock", () => {
  it("SES + no_otp → exact payload (electronic_signature, no_otp, NO phone field)", async () => {
    const m = mock(); await addSigner(m, {}, { level: "simple", auth: "no_otp" });
    const b = JSON.parse(m.calls[0].body as string);
    expect(b.signature_level).toBe("electronic_signature");
    expect(b.signature_authentication_mode).toBe("no_otp");
    expect("phone_number" in b.info).toBe(false);
  });
  it("SES + otp_sms + phone → exact payload (includes E.164 phone)", async () => {
    const m = mock(); await addSigner(m, {}, { level: "simple", auth: "otp_sms", phone: "+33612345678" });
    const b = JSON.parse(m.calls[0].body as string);
    expect(b.signature_authentication_mode).toBe("otp_sms");
    expect(b.info.phone_number).toBe("+33612345678");
  });
  it("AES (capability on) → advanced_electronic_signature + otp_sms + phone", async () => {
    const m = mock(); await addSigner(m, { aes: true }, { level: "advanced_provider_managed", auth: "otp_sms", phone: "+33612345678" });
    const b = JSON.parse(m.calls[0].body as string);
    expect(b.signature_level).toBe("advanced_electronic_signature");
    expect(b.signature_authentication_mode).toBe("otp_sms");
    expect(b.info.phone_number).toBe("+33612345678");
  });
  it("QES (capability on) → qualified_electronic_signature with the auth field OMITTED", async () => {
    const m = mock(); await addSigner(m, { qes: true }, { level: "qualified_provider_managed" });
    const b = JSON.parse(m.calls[0].body as string);
    expect(b.signature_level).toBe("qualified_electronic_signature");
    expect("signature_authentication_mode" in b).toBe(false); // never sent for QES
  });
  it("an unsupported combination is refused BEFORE any HTTP call (fetch never invoked)", async () => {
    const m = mock();
    await expect(addSigner(m, {}, { level: "qualified_provider_managed", auth: "otp_sms" })).rejects.toThrow(SignerSecurityError);
    await expect(addSigner(m, {}, { level: "advanced_provider_managed", auth: "otp_sms", phone: "+33612345678" })).rejects.toThrow(/capability/i); // AES off
    expect(m.calls.length).toBe(0); // NO signer HTTP call was made for either refusal
  });
});
