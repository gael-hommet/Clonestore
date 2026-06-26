// PHASE 8.3-B3-R1.7 — exact official Yousign v3 event names map to canonical events; an unknown
// or guessed name stays unknown (never silently coerced). Real payload fixtures verify the
// adapter extracts the event name + signature_request id from the official body shape.
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { mapProviderEventToCanonical } from "../signature-events";
import { YousignSignatureProvider } from "../signature-providers/yousign";

const OFFICIAL: Record<string, string> = {
  "signature_request.activated": "request.activated",
  "signature_request.done": "request.completed",
  "signature_request.declined": "request.declined",
  "signature_request.rejected": "request.declined",
  "signature_request.expired": "request.expired",
  "signature_request.canceled": "request.cancelled",
  "signer.notified": "recipient.sent",
  "signer.link_opened": "recipient.viewed",
  "signer.done": "recipient.signed",
  "signer.signed": "recipient.signed",
  "signer.declined": "request.declined",
  "signer.error": "request.failed",
};

describe("B3-R1.7 Yousign event names", () => {
  it("every official Yousign v3 event name maps to its canonical event", () => {
    for (const [official, canonical] of Object.entries(OFFICIAL)) {
      expect(mapProviderEventToCanonical("yousign", official)).toBe(canonical);
    }
  });

  it("guessed / non-official names stay UNKNOWN (mapped to null)", () => {
    for (const bogus of ["signature_request.completed", "signature_request.signed", "request.done", "signer.completed", "signature.done", ""]) {
      expect(mapProviderEventToCanonical("yousign", bogus)).toBeNull();
    }
  });

  it("the adapter extracts event_name + signature_request.id from a real Yousign webhook body", async () => {
    const WH = "whsec_test";
    const p = new YousignSignatureProvider({ apiUrl: "https://api.yousign.test", apiKey: "k", webhookSecret: WH, fetch: (async () => ({ status: 200, ok: true, headers: { get: () => "application/json" }, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" })) as never });
    // a real-shaped Yousign v3 webhook envelope
    const body = Buffer.from(JSON.stringify({ event_id: "e_abc", event_name: "signature_request.done", data: { signature_request: { id: "sr_official_123", status: "done" } } }), "utf8");
    const sig = createHmac("sha256", WH).update(body).digest("hex");
    const now = 2_000_000;
    const v = await p.verifyWebhook({ raw_body: body, signature_header: `sha256=${sig}`, secret: WH, issued_at_header: String(now), now_seconds: now });
    expect(v.provider).toBe("yousign");
    expect(v.event_type).toBe("signature_request.done");
    expect(v.provider_request_id).toBe("sr_official_123");
    expect(v.event_id).toBe("e_abc");
    expect(mapProviderEventToCanonical(v.provider, v.event_type)).toBe("request.completed");
  });
});
