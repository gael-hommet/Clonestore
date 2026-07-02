// src/lib/pierre/v1/provider-integrations/webhook-security.ts
// PHASE 8.12 — governed inbound webhook verification for providers. FAIL-CLOSED: without a configured
// secret, no webhook is trusted. Verifies an HMAC-SHA256 signature in constant time. (Mirrors the
// pattern already used for the communication/signature webhooks; reused here for new providers.)
import { createHmac, timingSafeEqual } from "crypto";
import type { ProviderAdapter } from "./types";

export type WebhookVerification = { verified: boolean; reason: string };

export function verifyProviderWebhook(adapter: ProviderAdapter, rawBody: Buffer, signatureHeader: string | null, env: NodeJS.ProcessEnv = process.env): WebhookVerification {
  if (!adapter.webhookSecretEnvVar) return { verified: false, reason: "provider declares no webhook secret" };
  const secret = env[adapter.webhookSecretEnvVar];
  if (!secret || String(secret).trim() === "") return { verified: false, reason: "webhook secret not configured (fail-closed)" };
  if (!signatureHeader) return { verified: false, reason: "missing signature header" };
  const expected = createHmac("sha256", String(secret)).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8"); const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return { verified: false, reason: "signature length mismatch" };
  return { verified: timingSafeEqual(a, b), reason: timingSafeEqual(a, b) ? "verified" : "signature mismatch" };
}
