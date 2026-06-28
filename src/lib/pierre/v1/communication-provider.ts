// src/lib/pierre/v1/communication-provider.ts
// PHASE 8.4.11 — provider-neutral email delivery contract + a deterministic Fake for tests. The
// Fake is NEVER selectable in production and is NEVER a live proof.

import { createHmac, createHash, timingSafeEqual } from "crypto";

export class EmailProviderError extends Error {
  constructor(message: string, public code: string, public retriable: boolean, public httpStatus?: number) { super(message); this.name = "EmailProviderError"; }
}

export type EmailSendInput = {
  idempotencyKey: string;
  from: string;
  replyTo?: string | null;
  to: string;
  subject: string;
  plainText: string;
  html: string;
  tags: Record<string, string>;
};
export type EmailSendResult = { providerMessageId: string; providerStatus: string };
export type ProviderMessageStatus = { providerMessageId: string; status: string };
export type VerifiedProviderEvent = { provider: string; event_id: string; event_type: string; provider_message_id: string | null; payload_hash: string; occurred_at: string | null };

export interface EmailDeliveryProvider {
  readonly providerKey: string;
  sendEmail(input: EmailSendInput): Promise<EmailSendResult>;
  getMessage?(providerMessageId: string): Promise<ProviderMessageStatus>;
  verifyWebhook(input: { rawBody: Buffer; headers: Record<string, string | null | undefined>; secret: string; nowSeconds?: number }): Promise<VerifiedProviderEvent>;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export type FakeEmailOptions = { providerKey?: string; failNextSend?: boolean; rateLimitNextSend?: boolean; timeoutAfterSend?: boolean; timeoutBeforeSend?: boolean };

/** Deterministic in-memory email provider for tests ONLY. Models idempotency by content. */
export class FakeEmailProvider implements EmailDeliveryProvider {
  readonly providerKey: string;
  opts: FakeEmailOptions;
  sent: Array<{ input: EmailSendInput; providerMessageId: string }> = [];
  private byIdem = new Map<string, { providerMessageId: string; contentHash: string }>();
  private seq = 0;
  constructor(opts: FakeEmailOptions = {}) { this.providerKey = opts.providerKey ?? "fake_email"; this.opts = opts; }

  async sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
    const contentHash = sha(Buffer.from(`${input.to}|${input.subject}|${input.plainText}|${input.html}`));
    // official idempotency: same key + same content → same logical message; different content → conflict
    const prior = this.byIdem.get(input.idempotencyKey);
    if (prior) {
      if (prior.contentHash !== contentHash) throw new EmailProviderError("idempotency key reused with different content", "idempotency_conflict", false, 409);
      return { providerMessageId: prior.providerMessageId, providerStatus: "submitted" };
    }
    if (this.opts.timeoutBeforeSend) { this.opts.timeoutBeforeSend = false; throw new EmailProviderError("network timeout before send", "timeout", true); }
    if (this.opts.rateLimitNextSend) { this.opts.rateLimitNextSend = false; throw new EmailProviderError("rate limited", "rate_limited", true, 429); }
    if (this.opts.failNextSend) { this.opts.failNextSend = false; throw new EmailProviderError("provider 503", "provider_unavailable", true, 503); }
    const providerMessageId = `fake_msg_${(++this.seq).toString().padStart(6, "0")}`;
    this.byIdem.set(input.idempotencyKey, { providerMessageId, contentHash });
    this.sent.push({ input, providerMessageId });
    // a timeout AFTER the provider accepted the send: ambiguous — the caller never got the id.
    if (this.opts.timeoutAfterSend) { this.opts.timeoutAfterSend = false; throw new EmailProviderError("network timeout after send", "timeout", true); }
    return { providerMessageId, providerStatus: "submitted" };
  }

  async getMessage(providerMessageId: string): Promise<ProviderMessageStatus> {
    const hit = this.sent.find((s) => s.providerMessageId === providerMessageId);
    return { providerMessageId, status: hit ? "submitted" : "unknown" };
  }

  /** Look up a previously-sent message by idempotency key (timeout recovery, no double send). */
  async findByIdempotencyKey(key: string): Promise<EmailSendResult | null> {
    const hit = this.byIdem.get(key);
    return hit ? { providerMessageId: hit.providerMessageId, providerStatus: "submitted" } : null;
  }

  async verifyWebhook(input: { rawBody: Buffer; headers: Record<string, string | null | undefined>; secret: string; nowSeconds?: number }): Promise<VerifiedProviderEvent> {
    const sig = input.headers["x-fake-signature"];
    const expected = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
    if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new EmailProviderError("invalid webhook signature", "invalid_signature", false);
    const p = JSON.parse(input.rawBody.toString("utf8")) as { type?: string; data?: { id?: string }; created_at?: string; event_id?: string };
    return { provider: this.providerKey, event_id: p.event_id ?? sha(input.rawBody).slice(0, 24), event_type: p.type ?? "", provider_message_id: p.data?.id ?? null, payload_hash: sha(input.rawBody), occurred_at: p.created_at ?? null };
  }

  __makeWebhookBody(obj: { type: string; data: { id: string }; event_id?: string; created_at?: string }, secret: string): { body: string; signature: string } {
    const body = JSON.stringify(obj);
    return { body, signature: createHmac("sha256", secret).update(body).digest("hex") };
  }
}
