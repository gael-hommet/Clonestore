// src/lib/clonestore/production/__tests__/p10-production-gate.test.ts
// P10 §10 — porte de production FAIL-CLOSED. PRODUCTION_AUTHORIZED reste false.
import { describe, it, expect } from "vitest";
import { evaluateP10ProductionGate, isP10ProductionAuthorized, PRODUCTION_AUTHORIZED } from "../p10-production-gate";

// Un env "parfait" (live + les deux prix + flag) NE DOIT PAS ouvrir la production :
// legal/provider/owner restent bloquants + PRODUCTION_AUTHORIZED=false.
const PERFECT_ENV = {
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur",
  STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf",
  STRIPE_COUNTRY_PRICING_ENABLED: "true",
};

describe("P10 production gate", () => {
  it("PRODUCTION_AUTHORIZED constant is false (never authorized by code)", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
  });

  it("even with a perfect Stripe env, production stays CLOSED (legal/provider/owner blockers)", () => {
    const v = evaluateP10ProductionGate(PERFECT_ENV);
    expect(v.ok).toBe(false);
    expect(v.productionAuthorized).toBe(false);
    expect(v.blockers.length).toBeGreaterThan(0);
    expect(v.blockers.some((b) => b.owner === "legal")).toBe(true);
    expect(v.blockers.some((b) => b.owner === "owner")).toBe(true);
    expect(isP10ProductionAuthorized(PERFECT_ENV)).toBe(false);
  });

  it("country pricing readiness auto-verifies the anti-abuse invariants (CH≠EUR, FR/BE/LU≠CHF)", () => {
    const v = evaluateP10ProductionGate(PERFECT_ENV);
    // The canon holds → no REGRESSION blockers in the country-pricing dimension.
    expect(v.countryPricingReadiness.blockers.filter((b) => b.includes("RÉGRESSION"))).toHaveLength(0);
    expect(v.countryPricingReadiness.ready).toBe(true); // canon healthy + flag on
  });

  it("missing CHF price → Stripe blocker (fail-closed, no EUR fallback)", () => {
    const env = { ...PERFECT_ENV, STRIPE_PRICE_PIERRE_CHF_MONTHLY: "" };
    const v = evaluateP10ProductionGate(env);
    expect(v.stripeReadiness.ready).toBe(false);
    expect(v.blockers.some((b) => b.id === "stripe_chf")).toBe(true);
  });

  it("missing EUR price (and no legacy) → Stripe blocker", () => {
    const env = { ...PERFECT_ENV, STRIPE_PRICE_PIERRE_EUR_MONTHLY: "" };
    const v = evaluateP10ProductionGate(env);
    expect(v.blockers.some((b) => b.id === "stripe_eur")).toBe(true);
  });

  it("test-mode Stripe key → live blocker (no test price in production)", () => {
    const env = { ...PERFECT_ENV, STRIPE_SECRET_KEY: "sk_test_x" };
    const v = evaluateP10ProductionGate(env);
    expect(v.stripeMode).toBe("test");
    expect(v.blockers.some((b) => b.id === "stripe_live")).toBe(true);
  });

  it("flag off → country pricing dimension not ready + a flag blocker", () => {
    const env = { ...PERFECT_ENV, STRIPE_COUNTRY_PRICING_ENABLED: "" };
    const v = evaluateP10ProductionGate(env);
    expect(v.countryPricingEnabled).toBe(false);
    expect(v.blockers.some((b) => b.id === "cp_flag")).toBe(true);
  });

  it("exposes all required readiness dimensions + requiredEnv", () => {
    const v = evaluateP10ProductionGate(PERFECT_ENV);
    expect(v.countryPricingReadiness).toBeDefined();
    expect(v.stripeReadiness).toBeDefined();
    expect(v.legalReadiness).toBeDefined();
    expect(v.providerReadiness).toBeDefined();
    expect(v.deploymentReadiness).toBeDefined();
    expect(v.requiredEnv.map((e) => e.name)).toContain("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(v.summary).toContain("NON autorisée");
  });
});
