// src/app/api/pierre/v1/webhooks/signature/route.ts
// PHASE 8.3-B2F §3 — public signature-webhook ingress. The RAW body is HMAC-verified, the
// provider + event type are allow-listed, and ingestion goes through the governed DB
// function via a client bound to the minimal-privilege `pierre_rt_webhook_ingress` role
// (NEVER the service role, NEVER the general application role). The tenant is derived
// server-side from the referenced signature request — never from anything the caller sends.
import { NextResponse } from "next/server";
import { createWebhookExecutor, ingestSignatureWebhook, WebhookError } from "@/lib/pierre/v1/signature-webhooks";

export const runtime = "nodejs";

// Per-provider HMAC secret (from env, never logged). Distinct per provider.
function providerSecret(provider: string): string | null {
  const key = `PIERRE_WEBHOOK_SECRET_${provider.toUpperCase()}`;
  return process.env[key] ?? process.env.PIERRE_SIGNATURE_WEBHOOK_SECRET ?? null;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = (req.headers.get("x-webhook-provider") ?? url.searchParams.get("provider") ?? "").trim();
    const eventId = (req.headers.get("x-webhook-event-id") ?? "").trim();
    const eventType = (req.headers.get("x-webhook-event-type") ?? "").trim();
    const signatureRequestId = req.headers.get("x-signature-request-id");
    const eventTime = req.headers.get("x-webhook-timestamp");
    const correlationId = req.headers.get("x-correlation-id");
    const signature = req.headers.get("x-webhook-signature");
    const rawBody = await req.text();

    const secret = providerSecret(provider);
    if (!secret) {
      // No secret configured for this provider → cannot verify → refuse (fail-closed).
      return NextResponse.json({ error: { code: "webhook_unconfigured", message: "webhook secret not configured" } }, { status: 503 });
    }

    const db = await createWebhookExecutor();
    const result = await ingestSignatureWebhook(db, {
      provider, event_id: eventId, event_type: eventType, raw_body: rawBody,
      signature_header: signature, secret,
      signature_request_id: signatureRequestId, event_time: eventTime, correlation_id: correlationId,
    });
    return NextResponse.json({ ok: true, status: result.status, webhook_id: result.webhook_id }, { status: 200 });
  } catch (err) {
    if (err instanceof WebhookError) {
      // Never leak internals; only the stable code + a short message.
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    return NextResponse.json({ error: { code: "internal", message: "webhook processing failed" } }, { status: 500 });
  }
}
