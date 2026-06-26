// src/lib/pierre/v1/signature-webhooks.ts
// PHASE 8.3-B2F §3 — signature webhook RUNTIME path. A public webhook request is verified
// (HMAC), size-bounded and provider-checked HERE, then handed to the governed SECURITY
// DEFINER function `pierre_rt_ingest_signature_webhook` through a DB client bound to the
// minimal-privilege `pierre_rt_webhook_ingress` role. The handler never uses the service
// role, never the general application role, and never trusts a tenant claimed in the body —
// the tenant is derived server-side from the referenced signature request.

import { createHmac, timingSafeEqual, createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class WebhookError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); this.name = "WebhookError"; }
}
export class WebhookSignatureError extends WebhookError { constructor(m = "invalid webhook signature") { super(m, "webhook_signature_invalid", 401); this.name = "WebhookSignatureError"; } }
export class WebhookPayloadError extends WebhookError { constructor(m: string) { super(m, "webhook_payload_invalid", 413); this.name = "WebhookPayloadError"; } }
export class WebhookProviderError extends WebhookError { constructor(m: string) { super(m, "webhook_provider_invalid", 400); this.name = "WebhookProviderError"; } }

export const WEBHOOK_PROVIDERS = ["docuseal", "dropbox_sign", "yousign", "hellosign", "internal_sandbox", "local_sandbox", "fake_provider"] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];
export const MAX_WEBHOOK_PAYLOAD_BYTES = 1024 * 1024; // 1 MiB — mirrors the DB cap

// Per-provider allow-list of event types we accept (governs what may enter the pipeline).
const SANDBOX_EVENTS = new Set(["signature.created", "signature.completed", "signature.declined", "signature.expired"]);
// B3 canonical-style events used by the deterministic FakeSignatureProvider.
const FAKE_EVENTS = new Set(["request.created", "request.activated", "recipient.sent", "recipient.delivered", "recipient.viewed", "recipient.signed", "request.completed", "request.declined", "request.expired", "request.cancelled", "request.failed"]);
const PROVIDER_EVENT_TYPES: Record<WebhookProvider, ReadonlySet<string>> = {
  internal_sandbox: SANDBOX_EVENTS,
  local_sandbox: SANDBOX_EVENTS,
  fake_provider: FAKE_EVENTS,
  docuseal: new Set(["form.completed", "form.declined", "form.expired"]),
  dropbox_sign: new Set(["signature_request_signed", "signature_request_declined", "signature_request_canceled"]),
  yousign: new Set(["signature_request.activated", "signature_request.done", "signature_request.declined", "signature_request.rejected", "signature_request.expired", "signature_request.canceled", "signer.notified", "signer.link_opened", "signer.done", "signer.signed", "signer.declined", "signer.error"]),
  hellosign: new Set(["signature_request_signed", "signature_request_declined"]),
};

export function isAllowedProvider(p: string): p is WebhookProvider {
  return (WEBHOOK_PROVIDERS as readonly string[]).includes(p);
}

/** Constant-time HMAC-SHA256 verification of the RAW request body. */
export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | null | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  // accept "sha256=<hex>" or bare hex
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export function webhookPayloadHash(rawBody: string | Buffer): string {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  return createHash("sha256").update(body).digest("hex");
}

export function getWebhookDatabaseUrl(): string | null {
  return process.env.CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL ?? null;
}

/**
 * Build a DB executor bound to the minimal-privilege webhook role. Fail-closed: if the
 * dedicated webhook DSN is not configured, this throws — a webhook is NEVER served with the
 * service role or the general application role. (Lazy pg import: the route is the only
 * runtime caller; tests inject their own executor.)
 */
export async function createWebhookExecutor(): Promise<SqlExecutor> {
  const url = getWebhookDatabaseUrl();
  if (!url) throw new WebhookError("webhook database is not configured (CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL)", "webhook_db_unconfigured", 503);
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: url, max: 2 });
  return createPgExecutor(pool as never);
}

export type WebhookIngestInput = {
  provider: string;
  event_id: string;
  event_type: string;
  raw_body: string | Buffer;
  signature_header?: string | null;
  secret?: string | null;              // provider HMAC secret (from env, never logged)
  signature_request_id?: string | null;
  event_time?: string | null;          // ISO8601 from the provider, for the replay window
  correlation_id?: string | null;
};
export type WebhookIngestResult = { webhook_id: string; status: "received" | "duplicate"; company_id: string | null };

/**
 * Verify + ingest a signature webhook through the governed DB function. `db` MUST be an
 * executor bound to the pierre_rt_webhook_ingress role (the only role allowed to call the
 * function). Throws a typed WebhookError on any rejection.
 */
export async function ingestSignatureWebhook(db: SqlExecutor, input: WebhookIngestInput): Promise<WebhookIngestResult> {
  if (!isAllowedProvider(input.provider)) throw new WebhookProviderError(`provider not allowed: ${input.provider}`);
  if (!input.event_id || input.event_id.length === 0) throw new WebhookProviderError("event id required");
  const allowedTypes = PROVIDER_EVENT_TYPES[input.provider];
  if (!input.event_type || !allowedTypes.has(input.event_type)) throw new WebhookProviderError(`event type not allowed for ${input.provider}: ${input.event_type}`);

  const body = Buffer.isBuffer(input.raw_body) ? input.raw_body : Buffer.from(input.raw_body, "utf8");
  if (body.length === 0) throw new WebhookPayloadError("empty webhook payload");
  if (body.length > MAX_WEBHOOK_PAYLOAD_BYTES) throw new WebhookPayloadError(`payload too large: ${body.length} bytes`);

  // Signature is REQUIRED: an unsigned or wrongly-signed request is refused before any DB write.
  if (!verifyWebhookSignature(body, input.signature_header, input.secret ?? "")) throw new WebhookSignatureError();

  const payloadHash = webhookPayloadHash(body);
  try {
    const { rows } = await db.query<{ webhook_id: string; status: string; company: string | null }>(
      `select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.provider, input.event_id, input.event_type, payloadHash, body.length, input.signature_request_id ?? null, input.event_time ?? null, true, input.correlation_id ?? null],
    );
    const r = rows[0];
    return { webhook_id: r.webhook_id, status: r.status as "received" | "duplicate", company_id: r.company };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/different payload/.test(msg)) throw new WebhookError("event replay with different payload", "webhook_replay_conflict", 409);
    if (/replay window/.test(msg)) throw new WebhookPayloadError("event outside the replay window");
    if (/payload size/.test(msg)) throw new WebhookPayloadError("payload size rejected by the governed function");
    if (/not allowed|not verified|required/.test(msg)) throw new WebhookProviderError(msg);
    throw e;
  }
}
