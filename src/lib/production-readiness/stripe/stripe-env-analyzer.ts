// P-FINAL 01 — Phase 5 — Stripe environment analyzer.
// Detects test vs live keys without calling Stripe API.
// Pure: no Stripe SDK, no Next, no async, no throw.

import type { StripeEnvironment, StripeEnvAnalysis } from "./stripe-readiness-types";

// Stripe key prefixes (as per Stripe docs):
// sk_live_ → live secret key
// sk_test_ → test secret key
// pk_live_ → live publishable key
// pk_test_ → test publishable key
// whsec_   → webhook secret (no live/test distinction in prefix)

export function detectStripeEnvironment(
  secretKey: string | undefined
): StripeEnvironment {
  if (!secretKey) return "unknown";
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

export function isLiveKey(key: string | undefined, type: "secret" | "publishable"): boolean {
  if (!key) return false;
  if (type === "secret") return key.startsWith("sk_live_");
  if (type === "publishable") return key.startsWith("pk_live_");
  return false;
}

export function isTestKey(key: string | undefined, type: "secret" | "publishable"): boolean {
  if (!key) return false;
  if (type === "secret") return key.startsWith("sk_test_");
  if (type === "publishable") return key.startsWith("pk_test_");
  return false;
}

export function analyzeStripeEnv(envVars: Record<string, string | undefined>): StripeEnvAnalysis {
  const secretKey = envVars["STRIPE_SECRET_KEY"];
  const publishableKey =
    envVars["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ??
    envVars["STRIPE_PUBLISHABLE_KEY"];
  const webhookSecret = envVars["STRIPE_WEBHOOK_SECRET"];
  const priceId =
    envVars["NEXT_PUBLIC_STRIPE_PRICE_ID"] ??
    envVars["STRIPE_PRICE_ID"];

  const secret_key_is_live = isLiveKey(secretKey, "secret");
  const publishable_key_is_live = isLiveKey(publishableKey, "publishable");
  const secret_key_is_test = isTestKey(secretKey, "secret");
  const publishable_key_is_test = isTestKey(publishableKey, "publishable");

  const all_live_keys = secret_key_is_live && publishable_key_is_live;
  const all_test_keys = secret_key_is_test && publishable_key_is_test;

  // Key mismatch: one is live and one is test
  const key_mismatch =
    !!secretKey &&
    !!publishableKey &&
    ((secret_key_is_live && publishable_key_is_test) ||
      (secret_key_is_test && publishable_key_is_live));

  return {
    environment: detectStripeEnvironment(secretKey),
    has_secret_key: !!secretKey,
    has_publishable_key: !!publishableKey,
    has_webhook_secret: !!webhookSecret,
    has_price_id: !!priceId,
    secret_key_is_live,
    publishable_key_is_live,
    all_live_keys,
    all_test_keys,
    key_mismatch,
  };
}
