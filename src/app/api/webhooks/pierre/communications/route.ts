// src/app/api/webhooks/pierre/communications/route.ts
// PHASE 8.4.18 — public email-provider (Resend/Svix) webhook ingress. The provider verifies the
// official signature + replay window; ingestion goes through the governed SECURITY DEFINER function
// via a client bound to the minimal-privilege webhook role (NEVER the service role, NEVER the app
// role). The tenant is derived from (provider, provider_message_id) — never from the payload.
import { NextResponse } from "next/server";
import { createCommunicationWebhookExecutor, CommunicationWebhookDbError } from "@/lib/pierre/v1/communication-webhook-db";
import { receiveCommunicationWebhook } from "@/lib/pierre/v1/communications";
import { communicationWebhookSecret } from "@/lib/pierre/v1/communication-provider-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = communicationWebhookSecret();
    if (!secret) return NextResponse.json({ error: { code: "webhook_unconfigured", message: "communication webhook secret not configured" } }, { status: 503 });
    const headers: Record<string, string | null> = {
      "svix-id": req.headers.get("svix-id"), "svix-timestamp": req.headers.get("svix-timestamp"), "svix-signature": req.headers.get("svix-signature"),
    };
    const rawBody = Buffer.from(await req.arrayBuffer());
    // R1.3 — the DEDICATED communication webhook role (never the signature ingress role, never the
    // service role). The state machine is applied separately by the tenant-bound worker.
    const db = await createCommunicationWebhookExecutor();
    const out = await receiveCommunicationWebhook(db, { rawBody, headers, secret });
    return NextResponse.json({ ok: true, status: out.status }, { status: 200 });
  } catch (err) {
    if (err instanceof CommunicationWebhookDbError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    const e = err as { code?: string; message?: string };
    if (e?.code === "invalid_signature" || e?.code === "missing_headers" || e?.code === "replay") return NextResponse.json({ error: { code: "webhook_signature_invalid", message: "invalid webhook" } }, { status: 401 });
    return NextResponse.json({ error: { code: "internal", message: "webhook processing failed" } }, { status: 500 });
  }
}
