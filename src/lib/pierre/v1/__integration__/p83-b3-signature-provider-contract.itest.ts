// PHASE 8.3-B3.1 — the provider-neutral contract + the deterministic Fake behave correctly.
import { describe, it, expect } from "vitest";
import { FakeSignatureProvider } from "../signature-provider";
import { resolveSignatureProvider, isLiveSignatureConfigured } from "../signature-provider-config";

describe("B3.1 signature provider contract", () => {
  it("the Fake runs the full lifecycle deterministically", async () => {
    const p = new FakeSignatureProvider({ providerKey: "fake_provider" });
    const req = await p.createRequest({ name: "C", signature_level: "simple", idempotency_key: "k1" });
    expect(req.status).toBe("draft");
    await p.uploadDocument({ provider_request_id: req.provider_request_id, filename: "c.pdf", bytes: Buffer.from("%PDF-1.4\n%%EOF"), content_hash: "h" });
    const r1 = await p.addRecipient({ provider_request_id: req.provider_request_id, email: "a@b.c", name: "A", role: "employee", signing_order: 1 });
    expect(r1.provider_recipient_id).toBeTruthy();
    const act = await p.activateRequest({ provider_request_id: req.provider_request_id });
    expect(act.status).toBe("ongoing");
    // not completed yet → download refuses
    await expect(p.downloadSignedDocument(req.provider_request_id)).rejects.toThrow();
    p.__sign(req.provider_request_id);
    const recs = await p.listRecipients(req.provider_request_id);
    expect(recs.every((r) => r.status === "signed")).toBe(true);
    const signed = await p.downloadSignedDocument(req.provider_request_id);
    expect(signed.length).toBeGreaterThan(0);
    const ev = await p.downloadEvidence(req.provider_request_id);
    expect(ev.map((e) => e.type).sort()).toEqual(["audit_trail", "signed_document"]);
    for (const a of ev) expect(a.mime).toBe("application/pdf");
  });

  it("createRequest is idempotent on the idempotency key", async () => {
    const p = new FakeSignatureProvider();
    const a = await p.createRequest({ name: "C", signature_level: "simple", idempotency_key: "same" });
    const b = await p.createRequest({ name: "C", signature_level: "simple", idempotency_key: "same" });
    expect(b.provider_request_id).toBe(a.provider_request_id);
    const found = await p.findRequestByIdempotencyKey!("same");
    expect(found?.provider_request_id).toBe(a.provider_request_id);
  });

  it("verifyWebhook rejects a bad signature and parses a good one", async () => {
    const p = new FakeSignatureProvider({ secret: "s" });
    const { body, signature } = p.__makeWebhookBody({ event_id: "e1", event_type: "request.completed", request_id: "req_1" });
    await expect(p.verifyWebhook({ raw_body: body, signature_header: "sha256=deadbeef", secret: "s" })).rejects.toThrow(/invalid signature/);
    const v = await p.verifyWebhook({ raw_body: body, signature_header: signature, secret: "s" });
    expect(v).toMatchObject({ event_id: "e1", event_type: "request.completed", provider_request_id: "req_1" });
  });

  it("resolveSignatureProvider returns the Fake when not live-configured; live is fail-closed", () => {
    const prev = { ...process.env };
    delete process.env.CLONESTORE_SIGNATURE_PROVIDER; delete process.env.CLONESTORE_SIGNATURE_API_URL;
    expect(resolveSignatureProvider().providerKey).toBe("fake_provider");
    expect(isLiveSignatureConfigured()).toBe(false);
    process.env.CLONESTORE_SIGNATURE_PROVIDER = "yousign"; // but no creds → throws
    expect(() => resolveSignatureProvider()).toThrow(/requires/);
    Object.assign(process.env, prev); delete process.env.CLONESTORE_SIGNATURE_PROVIDER;
  });
});
