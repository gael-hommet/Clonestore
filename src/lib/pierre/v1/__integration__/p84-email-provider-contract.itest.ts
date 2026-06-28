// PHASE 8.4.11/8.4.12 — strict HTTP contract of the REAL Resend adapter against a local mock that
// reproduces the official Resend REST API (POST /emails, Bearer auth, Idempotency-Key header, JSON
// body, { id } response) and the official Svix webhook signature scheme. No mock-permissive shapes.
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { ResendEmailProvider, type FetchLike, type FetchResponse } from "../communication-providers/resend";
import { EmailProviderError } from "../communication-provider";

const KEY = "re_live_SECRET_must_not_leak_123456";

function mock(handler: (call: { method: string; url: string; headers: Record<string, string>; body?: string }) => { status?: number; json?: unknown; text?: string }) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string>; body?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { method: init.method, url, headers: init.headers, body: init.body }; calls.push(call);
    const r = handler(call); const status = r.status ?? 200;
    const res: FetchResponse = { status, ok: status >= 200 && status < 300, headers: { get: () => "application/json" }, json: async () => r.json ?? {}, text: async () => r.text ?? JSON.stringify(r.json ?? {}) };
    return res;
  };
  return { fetch, calls };
}
function prov(fetch: FetchLike) { return new ResendEmailProvider({ apiKey: KEY, fetch }); }

describe("P8.4.12 Resend HTTP contract", () => {
  it("sendEmail → POST /emails with Bearer auth, Idempotency-Key, exact JSON body; returns the message id", async () => {
    const m = mock(() => ({ json: { id: "resend_msg_abc" } }));
    const r = await prov(m.fetch).sendEmail({ idempotencyKey: "communication:c:d:hash", from: "CloneStore <hr@clonestore.pro>", replyTo: "support@clonestore.pro", to: "ada@acme.test", subject: "Sujet", plainText: "Texte brut", html: "<p>HTML</p>", tags: { delivery_id: "d1", event_kind: "document.approved" } });
    expect(r.providerMessageId).toBe("resend_msg_abc");
    const c = m.calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://api.resend.com/emails");
    expect(c.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(c.headers["content-type"]).toBe("application/json");
    expect(c.headers["idempotency-key"]).toBe("communication:c:d:hash");
    const body = JSON.parse(c.body as string);
    expect(body).toMatchObject({ from: "CloneStore <hr@clonestore.pro>", to: "ada@acme.test", subject: "Sujet", html: "<p>HTML</p>", text: "Texte brut", reply_to: "support@clonestore.pro" });
    expect(body.tags).toEqual([{ name: "delivery_id", value: "d1" }, { name: "event_kind", value: "document.approved" }]);
  });
  it("a 429 is retriable; a 5xx is retriable; a 4xx is final; the api key never leaks in the error", async () => {
    await expect(prov(mock(() => ({ status: 429, text: "rate" })).fetch).sendEmail(baseSend())).rejects.toMatchObject({ code: "rate_limited", retriable: true });
    await expect(prov(mock(() => ({ status: 503, text: "down" })).fetch).sendEmail(baseSend())).rejects.toMatchObject({ code: "provider_5xx", retriable: true });
    let msg = "";
    try { await prov(mock(() => ({ status: 422, text: `invalid for ${KEY}` })).fetch).sendEmail(baseSend()); } catch (e) { msg = (e as EmailProviderError).message; }
    expect(msg).not.toContain(KEY);
    expect(msg).toContain("re_[redacted]");
  });
  it("a response without a message id is refused", async () => {
    await expect(prov(mock(() => ({ json: {} })).fetch).sendEmail(baseSend())).rejects.toThrow(/missing message id/i);
  });
  it("verifyWebhook validates the official Svix signature + timestamp; rejects a tampered body / bad signature / stale timestamp", async () => {
    const secret = "whsec_" + Buffer.from("svix-secret-bytes").toString("base64");
    const p = prov(mock(() => ({ json: {} })).fetch);
    const body = Buffer.from(JSON.stringify({ type: "email.delivered", created_at: "2026-06-28T00:00:00Z", data: { email_id: "resend_msg_abc" } }), "utf8");
    const id = "msg_2abc"; const ts = "2000000";
    const sign = (b: Buffer, sid: string, sts: string) => createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${sid}.${sts}.${b.toString("utf8")}`).digest("base64");
    const good = sign(body, id, ts);
    const v = await p.verifyWebhook({ rawBody: body, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${good}` }, secret, nowSeconds: 2000010 });
    expect(v.event_type).toBe("email.delivered");
    expect(v.provider_message_id).toBe("resend_msg_abc");
    expect(v.event_id).toBe(id);
    // bad signature
    await expect(p.verifyWebhook({ rawBody: body, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": "v1,AAAA" }, secret, nowSeconds: 2000010 })).rejects.toThrow(/signature/i);
    // tampered body
    const tampered = Buffer.from(JSON.stringify({ type: "email.delivered", data: { email_id: "evil" } }), "utf8");
    await expect(p.verifyWebhook({ rawBody: tampered, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${good}` }, secret, nowSeconds: 2000010 })).rejects.toThrow(/signature/i);
    // stale timestamp (replay window)
    await expect(p.verifyWebhook({ rawBody: body, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${good}` }, secret, nowSeconds: 2000000 + 100000 })).rejects.toThrow(/tolerance|replay/i);
    // missing headers
    await expect(p.verifyWebhook({ rawBody: body, headers: {}, secret, nowSeconds: 2000010 })).rejects.toThrow(/headers/i);
  });
});

function baseSend() { return { idempotencyKey: "k", from: "a@b.c", to: "d@e.f", subject: "s", plainText: "t", html: "<p>h</p>", tags: {} }; }
