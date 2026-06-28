// src/lib/pierre/v1/signature-provider.ts
// PHASE 8.3-B3.1 — provider-neutral e-signature abstraction. No Next.js, no business tables,
// no secret leakage. A concrete adapter (e.g. Yousign) implements this; a deterministic
// FakeSignatureProvider drives the tests. The Fake is NEVER a live provider.

import { createHash, createHmac, timingSafeEqual } from "crypto";

export type ProviderRequestStatus = "draft" | "ongoing" | "done" | "declined" | "expired" | "cancelled" | "failed";
export type ProviderRecipientStatus = "pending" | "sent" | "delivered" | "viewed" | "signed" | "declined" | "expired";
export type SignatureLevel = "acknowledgement" | "simple" | "advanced_provider_managed" | "qualified_provider_managed";

// `external_id` is the deterministic idempotency anchor (Yousign filter external_id[eq]).
export type CreateSignatureRequestInput = { name: string; signature_level: SignatureLevel; expiry_days?: number; correlation_id?: string | null; idempotency_key?: string | null; external_id?: string | null; ordered?: boolean };
export type ProviderSignatureRequest = { provider_request_id: string; status: ProviderRequestStatus; provider: string };
export type UploadSignatureDocumentInput = { provider_request_id: string; filename: string; bytes: Buffer; content_hash: string };
export type ProviderDocument = { provider_document_id: string; sha256: string };
export type SignatureFieldPlacement = { type: "signature"; document_id: string; page: number; x: number; y: number; width: number; height: number };
export type AddSignatureRecipientInput = {
  provider_request_id: string; email: string; name: string; first_name?: string; last_name?: string; role: string;
  signing_order: number; locale?: string; signature_level?: SignatureLevel; auth_method?: string;
  provider_document_id?: string; fields?: SignatureFieldPlacement[];
  /** R2.2 — real, tenant-safe phone (E.164). Required for otp_sms / AES; null otherwise. */
  phone_number?: string | null;
};
export type ProviderRecipient = { provider_recipient_id: string; email: string; role: string; status: ProviderRecipientStatus; signing_order: number };
export type ActivateSignatureRequestInput = { provider_request_id: string };
export type CancelSignatureRequestInput = { provider_request_id: string; reason?: string };
export type SignatureEvidenceArtifact = { type: "signed_document" | "audit_trail" | "certificate" | "evidence_file"; filename: string; bytes: Buffer; mime: string; sha256: string; provider_timestamp?: string | null };
export type VerifySignatureWebhookInput = { raw_body: string | Buffer; signature_header?: string | null; secret: string; issued_at_header?: string | null; now_seconds?: number };
export type VerifiedSignatureWebhook = { provider: string; event_id: string; event_type: string; provider_request_id: string | null; event_time: string | null; payload_hash: string };

export class SignatureProviderError extends Error {
  constructor(message: string, public code: string, public retriable: boolean) { super(message); this.name = "SignatureProviderError"; }
}

export interface SignatureProvider {
  readonly providerKey: string;
  createRequest(input: CreateSignatureRequestInput): Promise<ProviderSignatureRequest>;
  uploadDocument(input: UploadSignatureDocumentInput): Promise<ProviderDocument>;
  addRecipient(input: AddSignatureRecipientInput): Promise<ProviderRecipient>;
  activateRequest(input: ActivateSignatureRequestInput): Promise<ProviderSignatureRequest>;
  getRequest(providerRequestId: string): Promise<ProviderSignatureRequest>;
  listRecipients(providerRequestId: string): Promise<ProviderRecipient[]>;
  cancelRequest(input: CancelSignatureRequestInput): Promise<void>;
  downloadSignedDocument(providerRequestId: string): Promise<Buffer>;
  downloadEvidence(providerRequestId: string): Promise<SignatureEvidenceArtifact[]>;
  verifyWebhook(input: VerifySignatureWebhookInput): Promise<VerifiedSignatureWebhook>;
  /** Look up a request by the idempotency/correlation key (for timeout-safe retries). */
  findRequestByIdempotencyKey?(key: string): Promise<ProviderSignatureRequest | null>;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// ── Deterministic Fake (tests only) ──────────────────────────────────────────────
type FakeReq = {
  id: string; status: ProviderRequestStatus; name: string; level: SignatureLevel; idem: string | null;
  document?: { id: string; bytes: Buffer; sha256: string; filename: string };
  recipients: ProviderRecipient[];
  signedBytes?: Buffer;
};

export type FakeProviderOptions = { providerKey?: string; secret?: string; failNextCreate?: boolean; timeoutAfterCreate?: boolean };

/**
 * In-memory, deterministic signature provider for integration tests. It models the full
 * lifecycle and lets a test drive completion via `__sign`. It is never presented as live.
 */
export class FakeSignatureProvider implements SignatureProvider {
  readonly providerKey: string;
  private secret: string;
  private reqs = new Map<string, FakeReq>();
  private byIdem = new Map<string, string>();
  private seq = 0;
  opts: FakeProviderOptions;
  constructor(opts: FakeProviderOptions = {}) { this.providerKey = opts.providerKey ?? "fake_provider"; this.secret = opts.secret ?? "fake-secret"; this.opts = opts; }
  private nid(p: string): string { this.seq += 1; return `${p}_${this.seq.toString().padStart(6, "0")}`; }

  async createRequest(input: CreateSignatureRequestInput): Promise<ProviderSignatureRequest> {
    // external_id is the deterministic idempotency anchor (mirrors Yousign's external_id[eq]);
    // fall back to the legacy idempotency_key when no external_id is supplied.
    const anchor = input.external_id ?? input.idempotency_key ?? null;
    if (anchor && this.byIdem.has(anchor)) {
      const ex = this.reqs.get(this.byIdem.get(anchor)!)!;
      return { provider_request_id: ex.id, status: ex.status, provider: this.providerKey };
    }
    if (this.opts.failNextCreate) { this.opts.failNextCreate = false; throw new SignatureProviderError("provider 503", "provider_unavailable", true); }
    const id = this.nid("req");
    this.reqs.set(id, { id, status: "draft", name: input.name, level: input.signature_level, idem: anchor, recipients: [] });
    if (anchor) this.byIdem.set(anchor, id);
    // Simulate a timeout where the provider DID create the request but the caller never got the response.
    if (this.opts.timeoutAfterCreate) { this.opts.timeoutAfterCreate = false; throw new SignatureProviderError("network timeout", "timeout", true); }
    return { provider_request_id: id, status: "draft", provider: this.providerKey };
  }
  async findRequestByIdempotencyKey(key: string): Promise<ProviderSignatureRequest | null> {
    const id = this.byIdem.get(key); if (!id) return null; const r = this.reqs.get(id)!;
    return { provider_request_id: r.id, status: r.status, provider: this.providerKey };
  }
  private req(id: string): FakeReq { const r = this.reqs.get(id); if (!r) throw new SignatureProviderError("request not found", "not_found", false); return r; }
  async uploadDocument(input: UploadSignatureDocumentInput): Promise<ProviderDocument> {
    const r = this.req(input.provider_request_id);
    const id = this.nid("doc");
    r.document = { id, bytes: Buffer.from(input.bytes), sha256: sha(input.bytes), filename: input.filename };
    return { provider_document_id: id, sha256: r.document.sha256 };
  }
  async addRecipient(input: AddSignatureRecipientInput): Promise<ProviderRecipient> {
    const r = this.req(input.provider_request_id);
    const rec: ProviderRecipient = { provider_recipient_id: this.nid("rcp"), email: input.email, role: input.role, status: "pending", signing_order: input.signing_order };
    r.recipients.push(rec);
    return rec;
  }
  async activateRequest(input: ActivateSignatureRequestInput): Promise<ProviderSignatureRequest> {
    const r = this.req(input.provider_request_id);
    if (!r.document) throw new SignatureProviderError("no document", "no_document", false);
    if (r.recipients.length === 0) throw new SignatureProviderError("no recipients", "no_recipients", false);
    r.status = "ongoing"; for (const rec of r.recipients) rec.status = "sent";
    return { provider_request_id: r.id, status: r.status, provider: this.providerKey };
  }
  async getRequest(id: string): Promise<ProviderSignatureRequest> { const r = this.req(id); return { provider_request_id: r.id, status: r.status, provider: this.providerKey }; }
  async listRecipients(id: string): Promise<ProviderRecipient[]> { return this.req(id).recipients.map((x) => ({ ...x })); }
  async cancelRequest(input: CancelSignatureRequestInput): Promise<void> { const r = this.req(input.provider_request_id); if (r.status === "done") throw new SignatureProviderError("already completed", "completed", false); r.status = "cancelled"; }
  async downloadSignedDocument(id: string): Promise<Buffer> {
    const r = this.req(id);
    if (r.status !== "done" || !r.signedBytes) throw new SignatureProviderError("not completed", "not_completed", true);
    return Buffer.from(r.signedBytes);
  }
  async downloadEvidence(id: string): Promise<SignatureEvidenceArtifact[]> {
    const r = this.req(id);
    if (r.status !== "done" || !r.signedBytes) throw new SignatureProviderError("no evidence yet", "no_evidence", true);
    // Real provider audit trails are PDFs — emit a minimal valid PDF embedding the audit summary.
    const summary = JSON.stringify({ request: r.id, recipients: r.recipients.map((x) => ({ role: x.role, status: x.status })), level: r.level });
    const audit = Buffer.from(`%PDF-1.4\n% audit-trail\n1 0 obj<< /Type /Catalog >>endobj\n% ${summary.replace(/[()\\]/g, "")}\ntrailer<< /Root 1 0 R >>\n%%EOF`, "latin1");
    return [
      { type: "signed_document", filename: `${r.id}-signed.pdf`, bytes: Buffer.from(r.signedBytes), mime: "application/pdf", sha256: sha(r.signedBytes), provider_timestamp: null },
      { type: "audit_trail", filename: `${r.id}-audit.pdf`, bytes: audit, mime: "application/pdf", sha256: sha(audit), provider_timestamp: null },
    ];
  }
  async verifyWebhook(input: VerifySignatureWebhookInput): Promise<VerifiedSignatureWebhook> {
    const body = Buffer.isBuffer(input.raw_body) ? input.raw_body : Buffer.from(input.raw_body, "utf8");
    const expected = createHmac("sha256", input.secret).update(body).digest("hex");
    const provided = (input.signature_header ?? "").replace(/^sha256=/, "");
    const a = Buffer.from(expected), b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SignatureProviderError("invalid signature", "invalid_signature", false);
    const parsed = JSON.parse(body.toString("utf8")) as { event_id: string; event_type: string; request_id?: string; event_time?: string };
    return { provider: this.providerKey, event_id: parsed.event_id, event_type: parsed.event_type, provider_request_id: parsed.request_id ?? null, event_time: parsed.event_time ?? null, payload_hash: sha(body) };
  }

  // ── TEST DRIVERS (not part of the SignatureProvider contract) ──
  /** Mark all recipients signed and complete the request with a real signed document. */
  __sign(providerRequestId: string): Buffer {
    const r = this.req(providerRequestId);
    for (const rec of r.recipients) rec.status = "signed";
    r.status = "done";
    r.signedBytes = Buffer.concat([r.document!.bytes, Buffer.from("\n%SIGNED-BY-FAKE-PROVIDER\n", "latin1")]);
    return r.signedBytes;
  }
  __decline(id: string): void { const r = this.req(id); r.status = "declined"; if (r.recipients[0]) r.recipients[0].status = "declined"; }
  /** Make the "signed" document an EICAR test file (to prove a non-clean artifact is refused). */
  __corruptSigned(id: string): void { this.req(id).signedBytes = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"); }
  __makeWebhookBody(obj: { event_id: string; event_type: string; request_id?: string; event_time?: string }): { body: string; signature: string } {
    const body = JSON.stringify(obj);
    return { body, signature: "sha256=" + createHmac("sha256", this.secret).update(body).digest("hex") };
  }
}
