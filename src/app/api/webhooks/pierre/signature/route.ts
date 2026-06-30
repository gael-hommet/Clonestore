// src/app/api/webhooks/pierre/signature/route.ts
// PHASE 8.3-B3.5 — public signature webhook ingress. The provider verifies the HMAC and parses
// the payload; ingestion goes through the governed SECURITY DEFINER functions via a client
// bound to the minimal-privilege `pierre_rt_webhook_ingress` role (NEVER the service role,
// NEVER the general application role, no raw business writes). The tenant is resolved
// server-side from (provider, provider_request_id) — never from anything the caller sends.
import { NextResponse } from "next/server";
import { createWebhookExecutor, WebhookError } from "@/lib/pierre/v1/signature-webhooks";
import { receiveSignatureWebhook } from "@/lib/pierre/v1/signatures";
import { getSignatureWebhookSecret, resolveWebhookProvider, isLiveSignatureConfigured, isProductionNodeEnv } from "@/lib/pierre/v1/signature-provider-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Fail-CLOSED (not a 500 crash) when no live signature provider is configured in production: an
    // unconfigured provider is an expected "service unavailable" state → 503, consistent with the
    // missing-secret branch below and the communications webhook. resolveWebhookProvider would otherwise
    // throw a plain Error here, which the catch turns into a 500.
    if (isProductionNodeEnv() && !isLiveSignatureConfigured()) {
      return NextResponse.json({ error: { code: "webhook_unconfigured", message: "signature provider not configured" } }, { status: 503 });
    }
    // R1.8 — the provider is NEVER freely chosen by the request header in production: it must
    // match the configured live provider (resolveWebhookProvider fails-closed). The header is
    // only honoured in test/dev.
    const provider = resolveWebhookProvider(req.headers.get("x-webhook-provider"));
    const signature = req.headers.get("x-webhook-signature") ?? req.headers.get("x-yousign-signature-256");
    const issuedAt = req.headers.get("x-yousign-issued-at"); // R1.9 — anti-replay timestamp
    const secret = getSignatureWebhookSecret();
    if (!secret) return NextResponse.json({ error: { code: "webhook_unconfigured", message: "signature webhook secret not configured" } }, { status: 503 });
    const rawBody = await req.text();
    const db = await createWebhookExecutor();
    const result = await receiveSignatureWebhook(db, { provider, raw_body: rawBody, signature_header: signature, secret, issued_at_header: issuedAt });
    return NextResponse.json({ ok: true, status: result.status }, { status: 200 });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    const e = err as { code?: string; message?: string };
    if (e?.code === "invalid_signature") return NextResponse.json({ error: { code: "webhook_signature_invalid", message: "invalid signature" } }, { status: 401 });
    return NextResponse.json({ error: { code: "internal", message: "webhook processing failed" } }, { status: 500 });
  }
}
