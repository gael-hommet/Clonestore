// src/lib/pierre/v1/communication-providers/resend.ts
// PHASE 8.4.12 — concrete Resend adapter behind the provider-neutral contract. Uses the official
// Resend REST contract (POST https://api.resend.com/emails, Bearer auth, Idempotency-Key header),
// and verifies inbound webhooks with the official Svix signature scheme Resend uses. No secret is
// ever logged. An injectable fetch makes the HTTP contract strictly testable.

import { createHmac, createHash, timingSafeEqual } from "crypto";
import { type EmailDeliveryProvider, type EmailSendInput, type EmailSendResult, type ProviderMessageStatus, type VerifiedProviderEvent, EmailProviderError } from "../communication-provider";

export type FetchResponse = { status: number; ok: boolean; headers: { get(name: string): string | null }; json(): Promise<unknown>; text(): Promise<string> };
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<FetchResponse>;
export type ResendConfig = { apiKey: string; apiUrl?: string; fetch?: FetchLike; timeoutMs?: number; webhookToleranceSeconds?: number };

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function redact(s: string): string { return s.replace(/re_[A-Za-z0-9_-]+/g, "re_[redacted]").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]"); }

export class ResendEmailProvider implements EmailDeliveryProvider {
  readonly providerKey = "resend";
  private cfg: { apiKey: string; apiUrl: string; fetch: FetchLike; timeoutMs: number; webhookToleranceSeconds: number };
  constructor(config: ResendConfig) {
    if (!config.apiKey) throw new EmailProviderError("resend not configured (api key)", "unconfigured", false);
    this.cfg = { apiKey: config.apiKey, apiUrl: (config.apiUrl ?? "https://api.resend.com").replace(/\/$/, ""), fetch: config.fetch ?? (globalThis.fetch as unknown as FetchLike), timeoutMs: config.timeoutMs ?? 15000, webhookToleranceSeconds: config.webhookToleranceSeconds ?? 300 };
  }

  async sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
    const body = JSON.stringify({
      from: input.from, to: input.to, subject: input.subject, html: input.html, text: input.plainText,
      reply_to: input.replyTo ?? undefined,
      tags: Object.entries(input.tags).map(([name, value]) => ({ name, value })),
    });
    // R1.9 — a REAL timeout via AbortController. A timeout is AMBIGUOUS (the request may have reached
    // Resend), so it is reported as `timeout` and NEVER blindly resent. A failure BEFORE the request
    // was sent (synchronous/connection error, not an abort) is a clean `network` retry (nothing sent).
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.cfg.timeoutMs);
    let res: FetchResponse;
    try {
      res = await this.cfg.fetch(`${this.cfg.apiUrl}/emails`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.cfg.apiKey}`, "content-type": "application/json", "idempotency-key": input.idempotencyKey },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      const name = (e as Error)?.name;
      if (timedOut || name === "AbortError" || name === "TimeoutError") {
        throw new EmailProviderError("resend request timed out (submission ambiguous; no blind resend)", "timeout", true);
      }
      throw new EmailProviderError(`resend request failed: ${redact(String((e as Error)?.message ?? e))}`, "network", true);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) throw new EmailProviderError("resend rate limited", "rate_limited", true, 429);
    if (res.status >= 500) throw new EmailProviderError(`resend ${res.status}`, "provider_5xx", true, res.status);
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new EmailProviderError(`resend ${res.status} ${redact(t).slice(0, 160)}`, "provider_4xx", false, res.status); }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new EmailProviderError("resend response missing message id", "bad_response", false, res.status);
    return { providerMessageId: json.id, providerStatus: "submitted" };
  }

  async getMessage(providerMessageId: string): Promise<ProviderMessageStatus> {
    const res = await this.cfg.fetch(`${this.cfg.apiUrl}/emails/${encodeURIComponent(providerMessageId)}`, { method: "GET", headers: { authorization: `Bearer ${this.cfg.apiKey}`, accept: "application/json" } });
    if (!res.ok) throw new EmailProviderError(`resend get ${res.status}`, res.status >= 500 ? "provider_5xx" : "provider_4xx", res.status >= 500, res.status);
    const json = (await res.json()) as { id?: string; last_event?: string };
    return { providerMessageId, status: json.last_event ?? "unknown" };
  }

  // Resend uses Svix-signed webhooks: signed content = `${svix-id}.${svix-timestamp}.${rawBody}`,
  // secret = base64 after the `whsec_` prefix, expected = base64(HMAC-SHA256), header svix-signature
  // is a space-separated list of `v1,<b64sig>`.
  async verifyWebhook(input: { rawBody: Buffer; headers: Record<string, string | null | undefined>; secret: string; nowSeconds?: number }): Promise<VerifiedProviderEvent> {
    const id = input.headers["svix-id"]; const ts = input.headers["svix-timestamp"]; const sigHeader = input.headers["svix-signature"];
    if (!id || !ts || !sigHeader) throw new EmailProviderError("missing svix webhook headers", "missing_headers", false);
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) throw new EmailProviderError("invalid webhook timestamp", "bad_timestamp", false);
    if (Math.abs(now - tsNum) > this.cfg.webhookToleranceSeconds) throw new EmailProviderError("webhook timestamp outside tolerance", "replay", false);
    const secretB64 = input.secret.startsWith("whsec_") ? input.secret.slice(6) : input.secret;
    let secretBytes: Buffer;
    try { secretBytes = Buffer.from(secretB64, "base64"); } catch { throw new EmailProviderError("invalid webhook secret", "unconfigured", false); }
    const signedContent = `${id}.${ts}.${input.rawBody.toString("utf8")}`;
    const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    const provided = String(sigHeader).split(" ").map((p) => (p.startsWith("v1,") ? p.slice(3) : p));
    const ok = provided.some((p) => { const a = Buffer.from(p), b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); });
    if (!ok) throw new EmailProviderError("invalid svix webhook signature", "invalid_signature", false);
    const p = JSON.parse(input.rawBody.toString("utf8")) as { type?: string; created_at?: string; data?: { email_id?: string } };
    return { provider: this.providerKey, event_id: String(id), event_type: p.type ?? "", provider_message_id: p.data?.email_id ?? null, payload_hash: sha(input.rawBody), occurred_at: p.created_at ?? null };
  }
}
