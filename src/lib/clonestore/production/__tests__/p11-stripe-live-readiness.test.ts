// src/lib/clonestore/production/__tests__/p11-stripe-live-readiness.test.ts
// P11 §9 — Stripe LIVE readiness (fail-closed, no secrets, real price-verification logic).
import { describe, it, expect } from "vitest";
import { evaluateStripeLiveReadiness, verifyStripePrice, EXPECTED_LIVE_PRICE_CRITERIA } from "../p11-stripe-live-readiness";

const LIVE_ENV = {
  STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf",
  STRIPE_COUNTRY_PRICING_ENABLED: "true", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_x", CLONESTORE_PUBLIC_APP_URL: "https://x",
};

describe("P11 Stripe live readiness", () => {
  it("missing live key (test mode) blocks production", () => {
    const r = evaluateStripeLiveReadiness({ ...LIVE_ENV, STRIPE_SECRET_KEY: "sk_test_x" });
    expect(r.mode).toBe("test");
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => /sk_live_|LIVE/i.test(b))).toBe(true);
  });

  it("missing EUR price blocks", () => {
    const r = evaluateStripeLiveReadiness({ ...LIVE_ENV, STRIPE_PRICE_PIERRE_EUR_MONTHLY: "" });
    expect(r.eurPriceConfigured).toBe(false);
    expect(r.blockers.some((b) => b.includes("EUR"))).toBe(true);
  });

  it("missing CHF price blocks (never falls back to EUR)", () => {
    const r = evaluateStripeLiveReadiness({ ...LIVE_ENV, STRIPE_PRICE_PIERRE_CHF_MONTHLY: "" });
    expect(r.chfPriceConfigured).toBe(false);
    expect(r.blockers.some((b) => b.includes("CHF"))).toBe(true);
  });

  it("missing webhook secret blocks", () => {
    const r = evaluateStripeLiveReadiness({ ...LIVE_ENV, STRIPE_WEBHOOK_SECRET: "" });
    expect(r.webhookConfigured).toBe(false);
    expect(r.blockers.some((b) => /WEBHOOK/i.test(b))).toBe(true);
  });

  it("country-pricing flag off blocks", () => {
    const r = evaluateStripeLiveReadiness({ ...LIVE_ENV, STRIPE_COUNTRY_PRICING_ENABLED: "" });
    expect(r.countryPricingFlag).toBe(false);
    expect(r.blockers.some((b) => /COUNTRY_PRICING/i.test(b))).toBe(true);
  });

  it("live key + both prices + webhook + flag → still NOT ready (live API not verified by P11)", () => {
    const r = evaluateStripeLiveReadiness(LIVE_ENV);
    expect(r.mode).toBe("live");
    expect(r.liveApiVerified).toBe(false);
    expect(r.ready).toBe(false); // live API verification blocker remains until owner dry-run
    expect(r.blockers.some((b) => /API Stripe LIVE NON attestée/i.test(b))).toBe(true);
  });

  it("never exposes secret values", () => {
    const r = evaluateStripeLiveReadiness(LIVE_ENV);
    const blob = JSON.stringify(r);
    expect(blob).not.toContain("sk_live_x");
    expect(blob).not.toContain("whsec_x");
    expect(blob).not.toContain("pk_live_x");
    expect(blob).not.toContain("price_eur"); // price ids not echoed
    expect(blob).not.toContain("price_chf");
  });

  it("verifyStripePrice: EUR must be active, eur, 44900, monthly", () => {
    expect(EXPECTED_LIVE_PRICE_CRITERIA.EUR.unitAmount).toBe(44900);
    expect(EXPECTED_LIVE_PRICE_CRITERIA.CHF.unitAmount).toBe(49900);
    const good = verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "EUR");
    expect(good.ok).toBe(true);
    const wrongAmount = verifyStripePrice({ active: true, currency: "eur", unit_amount: 39900, recurring: { interval: "month" } }, "EUR");
    expect(wrongAmount.ok).toBe(false);
    const wrongCurrency = verifyStripePrice({ active: true, currency: "chf", unit_amount: 44900, recurring: { interval: "month" } }, "EUR");
    expect(wrongCurrency.ok).toBe(false);
    const inactive = verifyStripePrice({ active: false, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "EUR");
    expect(inactive.ok).toBe(false);
    const oneOff = verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: null }, "EUR");
    expect(oneOff.ok).toBe(false); // not monthly
    const withTrial = verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month", trial_period_days: 30 } }, "EUR");
    expect(withTrial.ok).toBe(false); // unexpected trial on the price
  });

  it("verifyStripePrice: CHF must be active, chf, 49900, monthly", () => {
    const good = verifyStripePrice({ active: true, currency: "chf", unit_amount: 49900, recurring: { interval: "month" } }, "CHF");
    expect(good.ok).toBe(true);
    expect(verifyStripePrice(null, "CHF").ok).toBe(false);
  });
});
