// PHASE 8.3-B3-R1.15 — CONTRACTUAL tests of the REAL YousignSignatureProvider against a strict
// local HTTP mock reproducing the official Yousign API v3 (NOT the FakeSignatureProvider). Proves:
// JSON create with external_id + ordered_signers; multipart/form-data upload (real FormData, no
// base64 envelope, no manual boundary, file + nature parts); signers with full identity + a real
// signature field + MAPPED signature level (never hardcoded electronic_signature); idempotency via
// external_id[eq]; download version=completed (not signed) + audit_trails merge=true with
// Content-Type validation (reject HTML/JSON-as-PDF); transient retry on GET only; webhook HMAC +
// issued-at anti-replay; and NO secret leak in errors.
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { YousignSignatureProvider, type FetchLike, type FetchResponse } from "../signature-providers/yousign";
import { SignatureProviderError } from "../signature-provider";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const API = "https://api.yousign.test/v3";
const KEY = "ys_live_SECRETKEY_must_never_leak_1234567890";
const WH = "whsec_SECRET_webhook_value";

type Call = { method: string; url: string; headers: Record<string, string>; body?: string | Buffer | FormData };
type Resp = { status?: number; json?: unknown; pdf?: Buffer; contentType?: string; text?: string };

function mock(routes: (c: Call) => Resp) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call: Call = { method: init.method, url, headers: init.headers, body: init.body };
    calls.push(call);
    const r = routes(call);
    const status = r.status ?? 200;
    const ct = r.contentType ?? (r.pdf ? "application/pdf" : "application/json");
    const res: FetchResponse = {
      status, ok: status >= 200 && status < 300,
      headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? ct : null) },
      json: async () => r.json ?? {},
      arrayBuffer: async () => { const b = r.pdf ?? Buffer.from(JSON.stringify(r.json ?? {})); const u = new Uint8Array(b.byteLength); u.set(b); return u.buffer; },
      text: async () => r.text ?? (r.pdf ? "<binary>" : JSON.stringify(r.json ?? {})),
    };
    return res;
  };
  return { fetch, calls };
}

function provider(fetch: FetchLike, extra: Partial<{ maxRetries: number; webhookMaxAgeSeconds: number }> = {}) {
  return new YousignSignatureProvider({ apiUrl: API, apiKey: KEY, webhookSecret: WH, fetch, timeoutMs: 1000, maxRetries: extra.maxRetries ?? 2, webhookMaxAgeSeconds: extra.webhookMaxAgeSeconds ?? 300 });
}

describe("B3-R1.15 real Yousign v3 HTTP contract", () => {
  it("createRequest → POST /signature_requests with external_id + ordered_signers, Bearer auth, JSON body", async () => {
    const m = mock(() => ({ json: { id: "sr_1", status: "draft" } }));
    const p = provider(m.fetch);
    const r = await p.createRequest({ name: "Contrat X", signature_level: "simple", external_id: "clonestore:c:r:abc", ordered: true });
    expect(r.provider_request_id).toBe("sr_1");
    expect(r.status).toBe("draft");
    const c = m.calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe(`${API}/signature_requests`);
    expect(c.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(c.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(c.body as string);
    expect(body.external_id).toBe("clonestore:c:r:abc");
    expect(body.ordered_signers).toBe(true);
    expect(body.delivery_mode).toBe("email");
    // the body must NOT carry any base64 document envelope
    expect(JSON.stringify(body)).not.toMatch(/content_base64|base64/i);
  });

  it("findRequestByIdempotencyKey → GET /signature_requests?external_id[eq]=…", async () => {
    const m = mock(() => ({ json: { data: [{ id: "sr_existing", status: "ongoing" }] } }));
    const p = provider(m.fetch);
    const r = await p.findRequestByIdempotencyKey("clonestore:c:r:abc");
    expect(r?.provider_request_id).toBe("sr_existing");
    expect(m.calls[0].method).toBe("GET");
    expect(m.calls[0].url).toContain("/signature_requests?external_id[eq]=");
    expect(m.calls[0].url).toContain(encodeURIComponent("clonestore:c:r:abc"));
  });

  it("uploadDocument → REAL multipart/form-data: file + nature parts, no manual boundary, no base64", async () => {
    let seen: Call | null = null;
    const m = mock((c) => { if (c.url.endsWith("/documents")) seen = c; return { json: { id: "doc_42" } }; });
    const p = provider(m.fetch);
    const r = await p.uploadDocument({ provider_request_id: "sr_1", filename: "contract.pdf", bytes: PDF, content_hash: "deadbeef" });
    expect(r.provider_document_id).toBe("doc_42");
    expect(seen).not.toBeNull();
    const call = seen as unknown as Call;
    // body is a real FormData (not a JSON string with base64)
    expect(call.body instanceof FormData).toBe(true);
    const form = call.body as FormData;
    expect(form.get("nature")).toBe("signable_document");
    const file = form.get("file");
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe("application/pdf");
    expect((file as Blob).size).toBe(PDF.length);
    // we NEVER set the multipart boundary ourselves — fetch derives it from the FormData
    expect(call.headers["content-type"]).toBeUndefined();
    expect(typeof call.body).not.toBe("string");
  });

  it("addRecipient → full identity + a real signature field + MAPPED level; fail-closed without document id / fields", async () => {
    const m = mock(() => ({ json: { id: "signer_1", status: "initiated" } }));
    const p = provider(m.fetch);
    const field = { type: "signature" as const, document_id: "doc_42", page: 1, x: 70, y: 120, width: 180, height: 60 };
    const r = await p.addRecipient({ provider_request_id: "sr_1", email: "ada@acme.test", name: "Ada Lovelace", first_name: "Ada", last_name: "Lovelace", role: "employee", signing_order: 1, locale: "fr", signature_level: "qualified_provider_managed", auth_method: "otp_sms", provider_document_id: "doc_42", fields: [field] });
    expect(r.provider_recipient_id).toBe("signer_1");
    const body = JSON.parse(m.calls[0].body as string);
    expect(body.info).toMatchObject({ first_name: "Ada", last_name: "Lovelace", email: "ada@acme.test", locale: "fr" });
    // qualified → qualified_electronic_signature (NEVER hardcoded electronic_signature)
    expect(body.signature_level).toBe("qualified_electronic_signature");
    expect(body.signature_authentication_mode).toBe("otp_sms");
    expect(body.fields).toHaveLength(1);
    expect(body.fields[0]).toMatchObject({ type: "signature", document_id: "doc_42", page: 1 });
    // fail-closed: a signer with no document id or no fields is refused before any HTTP call
    await expect(p.addRecipient({ provider_request_id: "sr_1", email: "x@y.z", name: "X", role: "employee", signing_order: 1, fields: [field] } as never)).rejects.toThrow(/document id/i);
    await expect(p.addRecipient({ provider_request_id: "sr_1", email: "x@y.z", name: "X", role: "employee", signing_order: 1, provider_document_id: "doc_42" } as never)).rejects.toThrow(/signature field/i);
  });

  it("signature levels map distinctly (simple vs advanced vs qualified)", async () => {
    const seen: string[] = [];
    const m = mock((c) => { if (c.url.endsWith("/signers")) seen.push(JSON.parse(c.body as string).signature_level); return { json: { id: "s", status: "initiated" } }; });
    const p = provider(m.fetch);
    const f = [{ type: "signature" as const, document_id: "doc", page: 1, x: 1, y: 1, width: 1, height: 1 }];
    const base = { provider_request_id: "sr_1", email: "a@b.c", name: "A B", role: "employee", signing_order: 1, provider_document_id: "doc", fields: f };
    await p.addRecipient({ ...base, signature_level: "simple" });
    await p.addRecipient({ ...base, signature_level: "advanced_provider_managed" });
    await p.addRecipient({ ...base, signature_level: "qualified_provider_managed" });
    expect(seen).toEqual(["electronic_signature", "advanced_electronic_signature", "qualified_electronic_signature"]);
  });

  it("downloadSignedDocument → GET version=completed (NOT signed); rejects HTML/JSON-as-PDF + non-%PDF bytes", async () => {
    const m = mock(() => ({ pdf: PDF, contentType: "application/pdf" }));
    const p = provider(m.fetch);
    const bytes = await p.downloadSignedDocument("sr_1");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(m.calls[0].url).toContain("/documents/download?version=completed");
    expect(m.calls[0].url).not.toContain("version=signed");

    // an HTML/JSON error page masquerading as a download is refused
    const html = provider(mock(() => ({ contentType: "text/html", text: "<html>oops</html>", pdf: Buffer.from("<html>") })).fetch);
    await expect(html.downloadSignedDocument("sr_1")).rejects.toThrow(/content-type/i);
    // declared PDF but bytes are not a real PDF
    const liar = provider(mock(() => ({ contentType: "application/pdf", pdf: Buffer.from("NOTPDF") })).fetch);
    await expect(liar.downloadSignedDocument("sr_1")).rejects.toThrow(/not a real PDF/i);
  });

  it("downloadEvidence → signed (completed) + audit_trails/download?merge=true, both validated as PDF", async () => {
    const urls: string[] = [];
    const m = mock((c) => { urls.push(c.url); return { pdf: PDF, contentType: "application/pdf" }; });
    const p = provider(m.fetch);
    const ev = await p.downloadEvidence("sr_9");
    expect(ev.map((e) => e.type).sort()).toEqual(["audit_trail", "signed_document"]);
    expect(urls.some((u) => u.includes("/documents/download?version=completed"))).toBe(true);
    expect(urls.some((u) => u.includes("/audit_trails/download?merge=true"))).toBe(true);
    for (const e of ev) { expect(e.mime).toBe("application/pdf"); expect(e.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-"); }
  });

  it("transient 5xx/429 are retried on GET only; a 4xx is final", async () => {
    let n = 0;
    const getMock = mock(() => { n += 1; return n < 3 ? { status: 503, text: "upstream" } : { json: { id: "sr_1", status: "done" } }; });
    const p = provider(getMock.fetch, { maxRetries: 3 });
    const r = await p.getRequest("sr_1");
    expect(r.status).toBe("done");
    expect(n).toBe(3); // retried twice then succeeded

    // POST is NOT retried on 5xx
    let posts = 0;
    const postMock = mock(() => { posts += 1; return { status: 500, text: "boom" }; });
    await expect(provider(postMock.fetch, { maxRetries: 3 }).createRequest({ name: "x", signature_level: "simple", external_id: "k" })).rejects.toThrow();
    expect(posts).toBe(1);

    // a 4xx is final (no retry)
    let four = 0;
    const fourMock = mock(() => { four += 1; return { status: 422, text: "invalid" }; });
    await expect(provider(fourMock.fetch).getRequest("sr_1")).rejects.toThrow();
    expect(four).toBe(1);
  });

  it("verifyWebhook → HMAC + issued-at anti-replay (reject missing/invalid/too-old/too-future/modified body/malformed signature)", async () => {
    const p = provider(mock(() => ({ json: {} })).fetch, { webhookMaxAgeSeconds: 300 });
    const payload = JSON.stringify({ event_id: "evt_1", event_name: "signature_request.done", data: { signature_request: { id: "sr_1" } } });
    const body = Buffer.from(payload, "utf8");
    const good = createHmac("sha256", WH).update(body).digest("hex");
    const now = 1_000_000;

    const ok = await p.verifyWebhook({ raw_body: body, signature_header: `sha256=${good}`, secret: WH, issued_at_header: String(now - 10), now_seconds: now });
    expect(ok.event_type).toBe("signature_request.done");
    expect(ok.provider_request_id).toBe("sr_1");
    expect(ok.event_id).toBe("evt_1");

    // bad signature
    await expect(p.verifyWebhook({ raw_body: body, signature_header: "sha256=deadbeef", secret: WH, issued_at_header: String(now), now_seconds: now })).rejects.toThrow(/signature/i);
    // missing issued-at
    await expect(p.verifyWebhook({ raw_body: body, signature_header: `sha256=${good}`, secret: WH, issued_at_header: null, now_seconds: now })).rejects.toThrow(/issued-at/i);
    // too old (> 300s)
    await expect(p.verifyWebhook({ raw_body: body, signature_header: `sha256=${good}`, secret: WH, issued_at_header: String(now - 400), now_seconds: now })).rejects.toThrow(/replay/i);
    // too far in the future
    await expect(p.verifyWebhook({ raw_body: body, signature_header: `sha256=${good}`, secret: WH, issued_at_header: String(now + 600), now_seconds: now })).rejects.toThrow(/future/i);
    // modified body → HMAC no longer matches
    const tampered = Buffer.from(payload.replace("sr_1", "sr_evil"), "utf8");
    await expect(p.verifyWebhook({ raw_body: tampered, signature_header: `sha256=${good}`, secret: WH, issued_at_header: String(now), now_seconds: now })).rejects.toThrow(/signature/i);
    // malformed signature header (length mismatch)
    await expect(p.verifyWebhook({ raw_body: body, signature_header: "sha256=zz", secret: WH, issued_at_header: String(now), now_seconds: now })).rejects.toThrow(/signature/i);
  });

  it("no secret ever leaks into a thrown error (the key echoed by the provider is redacted)", async () => {
    // the provider echoes the bearer token in its 4xx body — the thrown message must redact it.
    const m = mock(() => ({ status: 400, text: `denied for Bearer ${KEY} and api_key=${KEY}` }));
    const p = provider(m.fetch);
    let msg = "";
    try { await p.createRequest({ name: "x", signature_level: "simple", external_id: "k" }); } catch (e) { msg = (e as SignatureProviderError).message; }
    expect(msg).not.toContain(KEY);
    expect(msg).toContain("[redacted]");
    // the webhook secret never appears in a verifyWebhook rejection
    let whMsg = "";
    try { await p.verifyWebhook({ raw_body: Buffer.from("{}"), signature_header: "sha256=bad", secret: WH, issued_at_header: "1" }); } catch (e) { whMsg = (e as Error).message; }
    expect(whMsg).not.toContain(WH);
  });

  it("a timeout AFTER createRequest is recovered by external_id[eq] (no second request created)", async () => {
    // first POST 'times out' (network), then the GET by external_id resolves the already-created id.
    let posts = 0;
    const m = mock((c) => {
      if (c.method === "POST" && c.url.endsWith("/signature_requests")) { posts += 1; return { status: 503, text: "timeout" }; }
      if (c.method === "GET" && c.url.includes("external_id[eq]=")) return { json: { data: [{ id: "sr_created_during_timeout", status: "draft" }] } };
      return { json: {} };
    });
    const p = provider(m.fetch, { maxRetries: 0 });
    let recovered: string | null = null;
    try { await p.createRequest({ name: "x", signature_level: "simple", external_id: "clonestore:c:r:zzz" }); }
    catch (e) {
      expect(e).toBeInstanceOf(SignatureProviderError);
      expect((e as SignatureProviderError).retriable).toBe(true);
      const found = await p.findRequestByIdempotencyKey("clonestore:c:r:zzz");
      recovered = found?.provider_request_id ?? null;
    }
    expect(recovered).toBe("sr_created_during_timeout");
    expect(posts).toBe(1); // never a second create
  });
});
