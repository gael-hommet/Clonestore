// src/lib/pierre/v1/signature-provider-config.ts
// PHASE 8.3-B3-R1.8 — resolve the active SignatureProvider, FAIL-CLOSED in production. The
// Fake is NEVER available in a production runtime; the webhook provider is NEVER chosen freely
// by a request header in production — it must match the configured live provider. No secret is
// ever logged.

import { FakeSignatureProvider, type SignatureProvider } from "./signature-provider";
import { YousignSignatureProvider } from "./signature-providers/yousign";

const LIVE_PROVIDERS = new Set(["yousign"]);
const NON_LIVE = new Set(["fake", "fake_provider", "local_sandbox", "internal_sandbox"]);

/** NODE_ENV=production is the HARD gate. No other env (incl. PIERRE_RUNTIME_ENV=local) can
 *  re-enable the Fake/sandbox once NODE_ENV is production (R2.5). */
export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}
/** A "production runtime" in the broader operational sense (prod NODE_ENV and not a declared
 *  local runtime). The Fake gate uses isProductionNodeEnv(), NOT this — this is only for
 *  operational hints that legitimately relax under PIERRE_RUNTIME_ENV=local. */
export function isProductionRuntime(): boolean {
  return isProductionNodeEnv() && process.env.PIERRE_RUNTIME_ENV !== "local";
}
/** The Fake/sandbox is available ONLY in a non-production NODE_ENV. */
function nonLiveAllowed(): boolean {
  return !isProductionNodeEnv();
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
/** R2.1 — provider security capabilities are OFF by default; AES/QES need explicit opt-in. */
export function signatureCapabilities(): { aesEnabled: boolean; qesEnabled: boolean } {
  return {
    aesEnabled: process.env.CLONESTORE_SIGNATURE_AES_ENABLED === "true",
    qesEnabled: process.env.CLONESTORE_SIGNATURE_QES_ENABLED === "true",
  };
}

function buildYousign(): SignatureProvider {
  const apiUrl = process.env.CLONESTORE_SIGNATURE_API_URL, apiKey = process.env.CLONESTORE_SIGNATURE_API_KEY, webhookSecret = process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET;
  if (!apiUrl || !apiKey || !webhookSecret) throw new Error("CLONESTORE_SIGNATURE_PROVIDER=yousign requires API_URL + API_KEY + WEBHOOK_SECRET");
  const caps = signatureCapabilities();
  return new YousignSignatureProvider({ apiUrl, apiKey, webhookSecret, aesEnabled: caps.aesEnabled, qesEnabled: caps.qesEnabled });
}

/**
 * Resolve the provider. Tests inject their own. Under NODE_ENV=production the Fake/sandbox is
 * NEVER available (a missing/`fake`/`local_sandbox` provider throws, fail-closed) — no env
 * combination re-enables it. In non-production NODE_ENV: an explicit live key builds the real
 * adapter (creds required); otherwise the Fake.
 */
export function resolveSignatureProvider(injected?: SignatureProvider): SignatureProvider {
  if (injected) return injected;
  const key = signatureProviderKey();
  if (key && LIVE_PROVIDERS.has(key)) return buildYousign();
  if (!nonLiveAllowed()) throw new Error("production signature provider is not configured (live provider required; the Fake is never available under NODE_ENV=production)");
  if (key && NON_LIVE.has(key)) return new FakeSignatureProvider({ providerKey: "fake_provider" });
  return new FakeSignatureProvider({ providerKey: "fake_provider" });
}

/**
 * Resolve the webhook provider. Under NODE_ENV=production it MUST match the configured live
 * provider — a request header can never select it; the Fake is never accepted. In non-production
 * NODE_ENV the header is honoured so the deterministic Fake can be exercised.
 */
export function resolveWebhookProvider(headerProvider: string | null): string {
  const configured = signatureProviderKey();
  if (isProductionNodeEnv()) {
    if (!configured || !LIVE_PROVIDERS.has(configured)) throw new Error("webhook received but no live signature provider is configured");
    if (headerProvider && headerProvider !== configured) throw new Error("webhook provider does not match the configured provider");
    return configured;
  }
  return (headerProvider ?? configured ?? "fake_provider").trim();
}
