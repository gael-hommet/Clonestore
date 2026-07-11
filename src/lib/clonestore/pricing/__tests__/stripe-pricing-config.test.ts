// src/lib/clonestore/pricing/__tests__/stripe-pricing-config.test.ts
// P10 §9 — garde-fous d'environnement Stripe : fail-closed + AUCUN repli inter-devise.
import { describe, it, expect } from "vitest";
import {
  detectStripeMode, readStripePriceConfig, resolveStripePriceIdForCountry, validateStripePricingConfig,
} from "../stripe-pricing-config";

const FULL_TEST_ENV = {
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur_123",
  STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf_456",
};

describe("P10 Stripe pricing config guardrails", () => {
  it("detects test/live/unknown mode from the secret key prefix", () => {
    expect(detectStripeMode({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe("test");
    expect(detectStripeMode({ STRIPE_SECRET_KEY: "sk_live_x" })).toBe("live");
    expect(detectStripeMode({ STRIPE_SECRET_KEY: "" })).toBe("unknown");
    expect(detectStripeMode({})).toBe("unknown");
  });

  it("resolves the correct country price id (CH→CHF id, FR→EUR id)", () => {
    const ch = resolveStripePriceIdForCountry("CH", FULL_TEST_ENV);
    expect(ch.ok).toBe(true);
    if (ch.ok) { expect(ch.priceId).toBe("price_chf_456"); expect(ch.currency).toBe("CHF"); }
    const fr = resolveStripePriceIdForCountry("FR", FULL_TEST_ENV);
    expect(fr.ok).toBe(true);
    if (fr.ok) { expect(fr.priceId).toBe("price_eur_123"); expect(fr.currency).toBe("EUR"); }
  });

  it("missing CHF Stripe price → fails closed, NO fallback to EUR", () => {
    const env = { ...FULL_TEST_ENV, STRIPE_PRICE_PIERRE_CHF_MONTHLY: "" };
    const ch = resolveStripePriceIdForCountry("CH", env);
    expect(ch.ok).toBe(false);
    if (!ch.ok) expect(ch.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    // critically: it did NOT return the EUR price id
    if (!ch.ok) expect(JSON.stringify(ch)).not.toContain("price_eur");
    const v = validateStripePricingConfig({ forProduction: false, env });
    expect(v.ok).toBe(false);
    expect(v.chfConfigured).toBe(false);
    expect(v.blockers.some((b) => b.includes("CHF"))).toBe(true);
  });

  it("missing EUR Stripe price → fails closed, NO fallback to CHF", () => {
    const env = { ...FULL_TEST_ENV, STRIPE_PRICE_PIERRE_EUR_MONTHLY: "" };
    const fr = resolveStripePriceIdForCountry("FR", env);
    expect(fr.ok).toBe(false);
    if (!fr.ok) expect(fr.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    if (!fr.ok) expect(JSON.stringify(fr)).not.toContain("price_chf");
    const v = validateStripePricingConfig({ forProduction: false, env });
    expect(v.ok).toBe(false);
    expect(v.eurConfigured).toBe(false);
  });

  it("unsupported country → COUNTRY_NOT_SUPPORTED (never a price)", () => {
    const us = resolveStripePriceIdForCountry("US", FULL_TEST_ENV);
    expect(us.ok).toBe(false);
    if (!us.ok) expect(us.code).toBe("COUNTRY_NOT_SUPPORTED");
  });

  it("production requires LIVE mode + all prices (test key blocks production)", () => {
    // test key, all prices → OK for non-prod, BLOCKED for prod
    expect(validateStripePricingConfig({ forProduction: false, env: FULL_TEST_ENV }).ok).toBe(true);
    const prod = validateStripePricingConfig({ forProduction: true, env: FULL_TEST_ENV });
    expect(prod.ok).toBe(false);
    expect(prod.mode).toBe("test");
    expect(prod.blockers.some((b) => /LIVE|production/i.test(b))).toBe(true);
  });

  it("live mode + all prices → production config ok (still gated elsewhere)", () => {
    const liveEnv = { ...FULL_TEST_ENV, STRIPE_SECRET_KEY: "sk_live_x" };
    const prod = validateStripePricingConfig({ forProduction: true, env: liveEnv });
    expect(prod.ok).toBe(true);
    expect(prod.mode).toBe("live");
    expect(prod.eurConfigured && prod.chfConfigured).toBe(true);
  });

  it("readStripePriceConfig never invents defaults", () => {
    const cfg = readStripePriceConfig({});
    expect(cfg.eurPriceId).toBeNull();
    expect(cfg.chfPriceId).toBeNull();
    expect(cfg.secretKeyPresent).toBe(false);
    expect(cfg.mode).toBe("unknown");
  });

  it("legacy STRIPE_PRICE_PIERRE acts as EUR alias (same-currency) but NEVER as a CHF alias", () => {
    // Only the legacy var set → EUR resolves via alias, CHF still fails closed.
    const legacyEnv = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PIERRE: "price_legacy_eur" };
    expect(readStripePriceConfig(legacyEnv).eurPriceId).toBe("price_legacy_eur");
    expect(readStripePriceConfig(legacyEnv).chfPriceId).toBeNull();
    const fr = resolveStripePriceIdForCountry("FR", legacyEnv);
    expect(fr.ok).toBe(true);
    if (fr.ok) expect(fr.priceId).toBe("price_legacy_eur");
    const ch = resolveStripePriceIdForCountry("CH", legacyEnv);
    expect(ch.ok).toBe(false); // CH has NO legacy alias → fail closed
    if (!ch.ok) { expect(ch.code).toBe("STRIPE_PRICE_NOT_CONFIGURED"); expect(JSON.stringify(ch)).not.toContain("price_legacy_eur"); }
    // Explicit _EUR_MONTHLY takes precedence over the legacy alias.
    expect(readStripePriceConfig({ ...legacyEnv, STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_new_eur" }).eurPriceId).toBe("price_new_eur");
  });
});
