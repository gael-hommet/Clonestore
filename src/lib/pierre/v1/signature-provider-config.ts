// src/lib/pierre/v1/signature-provider-config.ts
// PHASE 8.3-B3-R1.8 — resolve the active SignatureProvider, FAIL-CLOSED in production. The
// Fake is NEVER available in a production runtime; the webhook provider is NEVER chosen freely
// by a request header in production — it must match the configured live provider. No secret is
// ever logged.

import { FakeSignatureProvider, type SignatureProvider } from "./signature-provider";
import { YousignSignatureProvider } from "./signature-providers/yousign";

const LIVE_PROVIDERS = new Set(["yousign"]);
const NON_LIVE = new Set(["fake", "fake_provider", "local_sandbox", "internal_sandbox"]);

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && process.env.PIERRE_RUNTIME_ENV !== "local";
}
export function signatureProviderKey(): string | null {
  return process.env.CLONESTORE_SIGNATURE_PROVIDER ?? null;
}
export function getSignatureWebhookSecret(): string | null {
  return process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET ?? null;
}
export function isLiveSignatureConfigured(): boolean {
  const key = signatureProviderKey();
  return !!(key && LIVE_PROVIDERS.has(key) && process.env.CLONESTORE_SIGNATURE_API_URL && process.env.CLONESTORE_SIGNATURE_API_KEY && process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET);
}

function buildYousign(): SignatureProvider {
  const apiUrl = process.env.CLONESTORE_SIGNATURE_API_URL, apiKey = process.env.CLONESTORE_SIGNATURE_API_KEY, webhookSecret = process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET;
  if (!apiUrl || !apiKey || !webhookSecret) throw new Error("CLONESTORE_SIGNATURE_PROVIDER=yousign requires API_URL + API_KEY + WEBHOOK_SECRET");
  return new YousignSignatureProvider({ apiUrl, apiKey, webhookSecret });
}

/**
 * Resolve the provider. Tests inject their own. In a PRODUCTION runtime: only a fully-configured
 * live provider is allowed; a missing/`fake`/`local_sandbox` provider throws (fail-closed). In
 * test/dev: an explicit live key builds the real adapter (creds required); otherwise the Fake.
 */
export function resolveSignatureProvider(injected?: SignatureProvider): SignatureProvider {
  if (injected) return injected;
  const key = signatureProviderKey();
  if (isProductionRuntime()) {
    if (!key || NON_LIVE.has(key) || !LIVE_PROVIDERS.has(key)) throw new Error("production signature provider is not configured (live provider required; the Fake is never available in production)");
    return buildYousign();
  }
  if (key && LIVE_PROVIDERS.has(key)) return buildYousign();
  return new FakeSignatureProvider({ providerKey: "fake_provider" });
}

/**
 * Resolve the webhook provider. In production it MUST match the configured provider — a
 * request header can never select it; the Fake is never accepted. In test/dev the header is
 * honoured so the deterministic Fake can be exercised.
 */
export function resolveWebhookProvider(headerProvider: string | null): string {
  const configured = signatureProviderKey();
  if (isProductionRuntime()) {
    if (!configured || !LIVE_PROVIDERS.has(configured)) throw new Error("webhook received but no live signature provider is configured");
    if (headerProvider && headerProvider !== configured) throw new Error("webhook provider does not match the configured provider");
    return configured;
  }
  return (headerProvider ?? configured ?? "fake_provider").trim();
}
