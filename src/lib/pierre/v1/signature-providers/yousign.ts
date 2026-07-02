// src/lib/pierre/v1/signature-providers/yousign.ts
// PHASE 8.3-B3-R1 — concrete Yousign (API v3) adapter behind the provider-neutral contract.
// REAL request shaping per the official Yousign v3 API: JSON create with `external_id` +
// `ordered_signers`, multipart/form-data document upload (FormData — never a base64 JSON
// envelope, never a manual boundary), signers with full identity + a real signature field,
// mapped signature levels, exact download endpoints (`version=completed`,
// `audit_trails/download?merge=true`) with Content-Type validation, and `external_id[eq]`
// idempotency lookup. Timeout + AbortController + bounded transient retry (idempotent GETs
// only) + redaction + correlation id + identifiable UA. No secret is ever logged.

import { createHmac, timingSafeEqual, createHash } from "crypto";
import {
  type SignatureProvider, type CreateSignatureRequestInput, type ProviderSignatureRequest,
  type UploadSignatureDocumentInput, type ProviderDocument, type AddSignatureRecipientInput,
  type ProviderRecipient, type ActivateSignatureRequestInput, type CancelSignatureRequestInput,
  type SignatureEvidenceArtifact, type VerifySignatureWebhookInput, type VerifiedSignatureWebhook,
  type ProviderRequestStatus, type ProviderRecipientStatus, SignatureProviderError,
} from "../signature-provider";
import { resolveYousignSignerSecurity, normalizePhoneNumber, type ProviderSecurityCapabilities } from "../signature-security";

export type FetchResponse = { status: number; ok: boolean; headers: { get(name: string): string | null }; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> };
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string | Buffer | FormData; signal?: AbortSignal }) => Promise<FetchResponse>;
export type YousignConfig = { apiUrl: string; apiKey: string; webhookSecret: string; fetch?: FetchLike; timeoutMs?: number; maxRetries?: number; webhookMaxAgeSeconds?: number; aesEnabled?: boolean; qesEnabled?: boolean; phoneCountryHint?: string | null };

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const STATUS_MAP: Record<string, ProviderRequestStatus> = { draft: "draft", ongoing: "ongoing", done: "done", declined: "declined", rejected: "declined", expired: "expired", canceled: "cancelled", cancelled: "cancelled", error: "failed", approval: "ongoing" };
const RECIP_MAP: Record<string, ProviderRecipientStatus> = { initiated: "pending", notified: "sent", processing: "sent", delivered: "delivered", link_opened: "viewed", signed: "signed", done: "signed", declined: "declined", error: "declined", expired: "expired" };

export class YousignSignatureProvider implements SignatureProvider {
  readonly providerKey = "yousign";
  private cfg: { apiUrl: string; apiKey: string; webhookSecret: string; timeoutMs: number; maxRetries: number; webhookMaxAgeSeconds: number; fetch: FetchLike; capabilities: ProviderSecurityCapabilities; phoneCountryHint: string | null };
  constructor(config: YousignConfig) {
    if (!config.apiUrl || !config.apiKey) throw new SignatureProviderError("yousign not configured", "unconfigured", false);
    this.cfg = { apiUrl: config.apiUrl.replace(/\/$/, ""), apiKey: config.apiKey, webhookSecret: config.webhookSecret, timeoutMs: config.timeoutMs ?? 15000, maxRetries: config.maxRetries ?? 2, webhookMaxAgeSeconds: config.webhookMaxAgeSeconds ?? 300, fetch: config.fetch ?? (globalThis.fetch as unknown as FetchLike), capabilities: { aes_enabled: config.aesEnabled ?? false, qes_enabled: config.qesEnabled ?? false }, phoneCountryHint: config.phoneCountryHint ?? null };
  }

  private baseHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.cfg.apiKey}`, accept: "application/json", "user-agent": "CloneStore-Pierre/8.3-B3", "x-correlation-id": createHash("sha1").update(`${this.cfg.apiUrl}:${this.providerKey}`).digest("hex").slice(0, 16) };
  }
  private async exec<T>(method: string, path: string, init: { headers: Record<string, string>; body?: string | Buffer | FormData }, opts: { raw?: boolean; expectPdf?: boolean } = {}): Promise<T> {
    const url = `${this.cfg.apiUrl}${path}`;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
      try {
        const res = await this.cfg.fetch(url, { method, headers: init.headers, body: init.body, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 429 || res.status >= 500) { lastErr = new SignatureProviderError(`yousign ${res.status}`, res.status === 429 ? "rate_limited" : "provider_5xx", true); if (attempt < this.cfg.maxRetries && method === "GET") continue; throw lastErr; }
        // A 4xx carries the provider's `invalid_params` diagnosis (field name + reason) — keep enough
        // of the redacted body to see the exact rejected field (never a secret; redact() strips keys).
        if (!res.ok) { const t = await res.text().catch(() => ""); throw new SignatureProviderError(`yousign ${res.status} ${redact(t).slice(0, 400)}`, "provider_4xx", false); }
        if (opts.raw) {
          const ct = res.headers.get("content-type") ?? "";
          const buf = Buffer.from(await res.arrayBuffer());
          if (opts.expectPdf && !/application\/pdf|application\/zip|octet-stream/i.test(ct)) throw new SignatureProviderError(`unexpected download content-type: ${ct}`, "bad_download", false);
          if (opts.expectPdf && /pdf/i.test(ct) && buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new SignatureProviderError("download is not a real PDF", "bad_download", false);
          return buf as unknown as T;
        }
        return (await res.json()) as T;
      } catch (e) {
        clearTimeout(timer);
        const transient = (e instanceof SignatureProviderError && e.retriable) || (e as { name?: string })?.name === "AbortError";
        if (transient && attempt < this.cfg.maxRetries && method === "GET") { lastErr = e; continue; }
        throw e instanceof SignatureProviderError ? e : new SignatureProviderError(`yousign request failed: ${redact(String((e as Error)?.message ?? e))}`, "network", true);
      }
    }
    throw lastErr instanceof Error ? lastErr : new SignatureProviderError("yousign exhausted retries", "exhausted", true);
  }
  private json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = this.baseHeaders(); if (body !== undefined) headers["content-type"] = "application/json";
    return this.exec<T>(method, path, { headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async createRequest(input: CreateSignatureRequestInput): Promise<ProviderSignatureRequest> {
    const r = await this.json<{ id: string; status: string }>("POST", "/signature_requests", {
      name: input.name, delivery_mode: "email", timezone: "Europe/Paris",
      ordered_signers: input.ordered ?? true, external_id: conformExternalId(input.external_id ?? input.idempotency_key ?? undefined),
    });
    return { provider_request_id: r.id, status: STATUS_MAP[r.status] ?? "draft", provider: this.providerKey };
  }

  async findRequestByIdempotencyKey(key: string): Promise<ProviderSignatureRequest | null> {
    // Official idempotency lookup: filter by external_id. The SAME conforming transform as
    // createRequest so the anchor stored on the provider is the one we query back (R1.5 resume).
    const r = await this.json<{ data?: Array<{ id: string; status: string }> }>("GET", `/signature_requests?external_id[eq]=${encodeURIComponent(conformExternalId(key) ?? "")}&limit=1`);
    const first = r.data?.[0];
    return first ? { provider_request_id: first.id, status: STATUS_MAP[first.status] ?? "draft", provider: this.providerKey } : null;
  }

  async uploadDocument(input: UploadSignatureDocumentInput): Promise<ProviderDocument> {
    // REAL multipart/form-data. We never set the boundary manually and never base64-wrap.
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.bytes)], { type: "application/pdf" }), input.filename);
    form.append("nature", "signable_document");
    const r = await this.exec<{ id: string }>("POST", `/signature_requests/${input.provider_request_id}/documents`, { headers: this.baseHeaders(), body: form });
    return { provider_document_id: r.id, sha256: input.content_hash };
  }

  async addRecipient(input: AddSignatureRecipientInput): Promise<ProviderRecipient> {
    if (!input.provider_document_id) throw new SignatureProviderError("a signer requires the provider document id", "missing_document", false);
    if (!input.fields || input.fields.length === 0) throw new SignatureProviderError("a signer requires at least one signature field", "missing_fields", false);
    // R2.1/R2.2 — resolve the EXACT SES/AES/QES security FAIL-CLOSED, BEFORE any HTTP call. An
    // unsupported combination (QES+OTP, AES without phone/capability, otp_sms without phone, …)
    // throws here so the provider is never sent an invalid payload.
    const sec = resolveYousignSignerSecurity({
      signature_level: input.signature_level ?? "simple",
      requested_authentication_mode: input.auth_method ?? null,
      phone_number: input.phone_number ?? null,
      provider_capabilities: this.cfg.capabilities,
    });
    const info: Record<string, unknown> = { first_name: input.first_name ?? splitName(input.name).first, last_name: input.last_name ?? splitName(input.name).last, email: input.email, locale: input.locale ?? "fr" };
    // include the phone ONLY when present/required — never invented; normalized to E.164.
    if (sec.phone_number_required || (input.phone_number && String(input.phone_number).trim().length > 0)) {
      info.phone_number = normalizePhoneNumber(input.phone_number, this.cfg.phoneCountryHint);
    }
    const body: Record<string, unknown> = {
      info, signature_level: sec.provider_signature_level,
      fields: input.fields.map((f) => ({ type: f.type, document_id: f.document_id, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height })),
    };
    // QES omits the authentication mode entirely; SES/AES include the exact resolved mode.
    if (sec.provider_authentication_mode !== null) body.signature_authentication_mode = sec.provider_authentication_mode;
    const r = await this.json<{ id: string; status?: string }>("POST", `/signature_requests/${input.provider_request_id}/signers`, body);
    return { provider_recipient_id: r.id, email: input.email, role: input.role, status: RECIP_MAP[r.status ?? "initiated"] ?? "pending", signing_order: input.signing_order };
  }

  async activateRequest(input: ActivateSignatureRequestInput): Promise<ProviderSignatureRequest> {
    const r = await this.json<{ id?: string; status: string }>("POST", `/signature_requests/${input.provider_request_id}/activate`);
    return { provider_request_id: r.id ?? input.provider_request_id, status: STATUS_MAP[r.status] ?? "ongoing", provider: this.providerKey };
  }
  async getRequest(id: string): Promise<ProviderSignatureRequest> {
    const r = await this.json<{ id: string; status: string }>("GET", `/signature_requests/${id}`);
    return { provider_request_id: r.id, status: STATUS_MAP[r.status] ?? "failed", provider: this.providerKey };
  }
  async listRecipients(id: string): Promise<ProviderRecipient[]> {
    const r = await this.json<{ data?: Array<{ id: string; info?: { email?: string }; status?: string }> } | Array<{ id: string; info?: { email?: string }; status?: string }>>("GET", `/signature_requests/${id}/signers`);
    const list = Array.isArray(r) ? r : (r.data ?? []);
    return list.map((s, i) => ({ provider_recipient_id: s.id, email: s.info?.email ?? "", role: "signer", status: RECIP_MAP[s.status ?? "initiated"] ?? "pending", signing_order: i + 1 }));
  }
  async cancelRequest(input: CancelSignatureRequestInput): Promise<void> {
    await this.json<unknown>("POST", `/signature_requests/${input.provider_request_id}/cancel`, { reason: input.reason ?? "cancelled_by_clonestore" });
  }
  async downloadSignedDocument(id: string): Promise<Buffer> {
    return this.exec<Buffer>("GET", `/signature_requests/${id}/documents/download?version=completed`, { headers: { ...this.baseHeaders(), accept: "application/pdf" } }, { raw: true, expectPdf: true });
  }
  async downloadEvidence(id: string): Promise<SignatureEvidenceArtifact[]> {
    const signed = await this.downloadSignedDocument(id);
    const audit = await this.exec<Buffer>("GET", `/signature_requests/${id}/audit_trails/download?merge=true`, { headers: { ...this.baseHeaders(), accept: "application/pdf" } }, { raw: true, expectPdf: true });
    return [
      { type: "signed_document", filename: `${id}-signed.pdf`, bytes: signed, mime: "application/pdf", sha256: sha(signed), provider_timestamp: null },
      { type: "audit_trail", filename: `${id}-audit.pdf`, bytes: audit, mime: "application/pdf", sha256: sha(audit), provider_timestamp: null },
    ];
  }
  async verifyWebhook(input: VerifySignatureWebhookInput): Promise<VerifiedSignatureWebhook> {
    const body = Buffer.isBuffer(input.raw_body) ? input.raw_body : Buffer.from(input.raw_body, "utf8");
    const expected = createHmac("sha256", this.cfg.webhookSecret).update(body).digest("hex");
    const provided = (input.signature_header ?? "").replace(/^sha256=/, "");
    const a = Buffer.from(expected), b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SignatureProviderError("invalid yousign signature", "invalid_signature", false);
    // R1.9 — anti-replay on the issued-at HEADER (independent of any optional payload field).
    if (input.issued_at_header == null) throw new SignatureProviderError("missing issued-at header", "missing_issued_at", false);
    const issued = Number(input.issued_at_header);
    if (!Number.isFinite(issued)) throw new SignatureProviderError("invalid issued-at header", "bad_issued_at", false);
    const nowS = input.now_seconds ?? Math.floor(Date.now() / 1000);
    if (issued < nowS - this.cfg.webhookMaxAgeSeconds) throw new SignatureProviderError("webhook outside the replay window", "replay", false);
    if (issued > nowS + 120) throw new SignatureProviderError("webhook issued in the future", "future", false);
    const p = JSON.parse(body.toString("utf8")) as { event_id?: string; event_name?: string; data?: { signature_request?: { id?: string } }; sent_at?: string };
    return { provider: this.providerKey, event_id: p.event_id ?? sha(body).slice(0, 24), event_type: p.event_name ?? "", provider_request_id: p.data?.signature_request?.id ?? null, event_time: new Date(issued * 1000).toISOString(), payload_hash: sha(body) };
  }
}

// P8.7.4 ROOT CAUSE — Yousign v3 rejects the create payload with 400 `parameters_not_valid` when
// `external_id` is not provider-conformant. The governed layer builds a rich anchor
// (`clonestore:<company>:<request>:<hash>` — ~101 chars, contains colons), which Yousign refuses.
// We conform it HERE, at the provider boundary (the constraint is Yousign-specific), to a bounded,
// safe-charset, DETERMINISTIC token so the official `external_id[eq]` idempotency lookup still
// resolves the same request on a timeout/retry. A value that is already short and safe passes
// through unchanged; anything else collapses to a stable `cs-<sha256[:32]>` (35 chars, [a-z0-9-]).
const EXTERNAL_ID_SAFE = /[^A-Za-z0-9_-]/g;
const EXTERNAL_ID_MAX = 40;
export function conformExternalId(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  const cleaned = s.replace(EXTERNAL_ID_SAFE, "-");
  if (cleaned === s && cleaned.length <= EXTERNAL_ID_MAX) return cleaned;
  return `cs-${createHash("sha256").update(s).digest("hex").slice(0, 32)}`;
}

function splitName(name: string): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/); if (parts.length <= 1) return { first: parts[0] ?? "", last: parts[0] ?? "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
function redact(s: string): string {
  return s.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").replace(/("?(api[_-]?key|secret|token|authorization)"?\s*[:=]\s*)"?[^",\s]+/gi, '$1[redacted]');
}
