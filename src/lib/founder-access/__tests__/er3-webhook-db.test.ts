// E-R3 §1 — webhook DB dédiée fail-closed en production (sans fallback privilégié).
import { describe, it, expect, afterEach } from "vitest";

const saved = { ...process.env };
afterEach(() => {
  process.env.NODE_ENV = saved.NODE_ENV;
  if (saved.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL === undefined) delete process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
  else process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL = saved.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
});

describe("§1 — getStripeWebhookDb fail-closed", () => {
  it("production sans URL dédiée → lève WebhookDatabaseNotConfiguredError", async () => {
    const { getStripeWebhookDb, WebhookDatabaseNotConfiguredError } = await import("../webhook-db");
    process.env.NODE_ENV = "production";
    delete process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
    await expect(getStripeWebhookDb()).rejects.toBeInstanceOf(WebhookDatabaseNotConfiguredError);
  });

  it("isDedicatedWebhookDbConfigured reflète la variable", async () => {
    const { isDedicatedWebhookDbConfigured } = await import("../webhook-db");
    delete process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
    expect(isDedicatedWebhookDbConfigured()).toBe(false);
    process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL = "postgres://x";
    expect(isDedicatedWebhookDbConfigured()).toBe(true);
  });
});
