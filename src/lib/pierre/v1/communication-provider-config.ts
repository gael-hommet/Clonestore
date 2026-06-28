// src/lib/pierre/v1/communication-provider-config.ts
// PHASE 8.4.12 — resolve the active email provider, FAIL-CLOSED in production. Under
// NODE_ENV=production the Fake/mock/sandbox is NEVER available; a missing provider/key/from/public
// URL throws. Reuses the existing CloneStore env conventions (RESEND_API_KEY,
// CLONESTORE_FOUNDER_EMAIL_FROM, CLONESTORE_PUBLIC_APP_URL). No secret is ever logged.

import { FakeEmailProvider, type EmailDeliveryProvider } from "./communication-provider";
import { ResendEmailProvider } from "./communication-providers/resend";

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}
export function communicationProviderKey(): string | null {
  return process.env.CLONESTORE_COMMUNICATION_PROVIDER ?? process.env.EMAIL_PROVIDER ?? null;
}
export function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}
export function emailFrom(): string | null {
  return process.env.CLONESTORE_EMAIL_FROM ?? process.env.CLONESTORE_FOUNDER_EMAIL_FROM ?? process.env.RESEND_DEFAULT_FROM ?? null;
}
export function emailReplyTo(): string | null {
  return process.env.CLONESTORE_EMAIL_REPLY_TO ?? null;
}
export function communicationWebhookSecret(): string | null {
  return process.env.CLONESTORE_EMAIL_WEBHOOK_SECRET ?? null;
}
export function publicAppBase(): string | null {
  return process.env.CLONESTORE_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
}
export function secureLinkSecret(): string | null {
  return process.env.CLONESTORE_COMMUNICATION_LINK_SECRET ?? process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET ?? null;
}

const LIVE_PROVIDERS = new Set(["resend"]);

/** Is a fully-configured live email provider available? (provider + key + from + public url) */
export function isLiveCommunicationConfigured(): boolean {
  const key = communicationProviderKey();
  return !!(key && LIVE_PROVIDERS.has(key) && resendApiKey() && emailFrom() && publicAppBase());
}

function buildResend(): EmailDeliveryProvider {
  const key = resendApiKey();
  if (!key) throw new Error("CLONESTORE_COMMUNICATION_PROVIDER=resend requires RESEND_API_KEY");
  if (!emailFrom()) throw new Error("a live email provider requires an email FROM (CLONESTORE_FOUNDER_EMAIL_FROM)");
  if (!publicAppBase()) throw new Error("a live email provider requires CLONESTORE_PUBLIC_APP_URL");
  return new ResendEmailProvider({ apiKey: key });
}

export function isTestNodeEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/**
 * Resolve the email provider. Tests inject their own (or run under NODE_ENV=test). A fully-configured
 * live key ALWAYS builds the real Resend adapter. Otherwise:
 *  - NODE_ENV=production → THROWS (the Fake is never available; fail-closed).
 *  - NODE_ENV=test (or explicit injection) → the deterministic Fake.
 *  - R1.15 — any other env (development, staging, …) WITHOUT a live provider → THROWS. The Fake is
 *    never used implicitly in development: a "sent" email must be a REAL send, never a silent fake.
 */
export function resolveEmailProvider(injected?: EmailDeliveryProvider): EmailDeliveryProvider {
  if (injected) return injected;
  const key = communicationProviderKey();
  if (key && LIVE_PROVIDERS.has(key) && resendApiKey() && emailFrom() && publicAppBase()) return buildResend();
  if (isProductionNodeEnv()) throw new Error("production email provider is not configured (a live provider + key + from + public url are required; the Fake is never available under NODE_ENV=production)");
  if (isTestNodeEnv()) return new FakeEmailProvider({ providerKey: "fake_email" });
  throw new Error("no email provider configured: a live provider (CLONESTORE_COMMUNICATION_PROVIDER + RESEND_API_KEY + FROM + public url) is required outside tests; the Fake is available ONLY under NODE_ENV=test or via explicit test injection (never an implicit development fake)");
}
