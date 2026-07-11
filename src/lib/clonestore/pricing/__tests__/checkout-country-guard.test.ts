// src/lib/clonestore/pricing/__tests__/checkout-country-guard.test.ts
// P10 §9 — guard de checkout SERVEUR-AUTORITATIF : anti-abus prix/pays.
import { describe, it, expect } from "vitest";
import { evaluateCheckoutCountryGuard, type CheckoutGuardInput } from "../checkout-country-guard";

const STRIPE_OK = { eurConfigured: true, chfConfigured: true };
const base = (over: Partial<CheckoutGuardInput> = {}): CheckoutGuardInput => ({ stripe: STRIPE_OK, ...over });

describe("P10 checkout country guard (server-authoritative)", () => {
  it("CH + requested EUR price → forced to CHF (CH can NEVER buy EUR)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "CH", requestedPriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" }));
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY"); // server forces CHF
    expect(d.currency).toBe("CHF");
    expect(d.ok).toBe(true); // proceeds, but with the CORRECT (CHF) price
    expect(d.ignoredClientPrice).toBe(true);
    expect(d.warnings.join(" ")).toContain("CH_REQUIRES_CHF_PRICE");
  });

  it("FR + requested CHF price → forced to EUR (FR/BE/LU can NEVER buy CHF)", () => {
    for (const c of ["FR", "BE", "LU"]) {
      const d = evaluateCheckoutCountryGuard(base({ selectedCountry: c, requestedPriceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY" }));
      expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_EUR_MONTHLY");
      expect(d.currency).toBe("EUR");
      expect(d.warnings.join(" ")).toContain("EUR_COUNTRY_REQUIRES_EUR_PRICE");
    }
  });

  it("verified company CH + selected FR → COMPANY_COUNTRY_CONFLICT, review, forced CHF", () => {
    const d = evaluateCheckoutCountryGuard(base({ companyCountry: "CH", selectedCountry: "FR" }));
    expect(d.ok).toBe(false);
    expect(d.reviewRequired).toBe(true);
    expect(d.code).toBe("COMPANY_COUNTRY_CONFLICT");
    expect(d.resolvedCountry).toBe("CH");
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY"); // correct price offered
  });

  it("billing country CH + selected FR → BILLING_COUNTRY_CONFLICT (review)", () => {
    const d = evaluateCheckoutCountryGuard(base({ billingCountry: "CH", selectedCountry: "FR" }));
    expect(d.code).toBe("BILLING_COUNTRY_CONFLICT");
    expect(d.reviewRequired).toBe(true);
    expect(d.resolvedCountry).toBe("CH");
  });

  it("CHEAP-direction geo conflict (IP CH, selected FR, no verified company) → REVIEW, not silent EUR", () => {
    // Anti-abus : un client suisse (IP) ne peut pas glisser silencieusement vers l'EUR moins cher.
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "FR", geoCountry: "CH" }));
    expect(d.ok).toBe(false);
    expect(d.reviewRequired).toBe(true);
    expect(d.code).toBe("GEO_WEAK_CONFLICT");
    expect(d.warnings.join(" ")).toContain("GEO_WEAK_CONFLICT");
  });

  it("non-abuse geo conflict (same currency, e.g. IP BE / selected FR) → allowed, logged (rule 6)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "FR", geoCountry: "BE" }));
    expect(d.ok).toBe(true); // both EUR — no revenue abuse; a legitimate user is not hard-blocked
    expect(d.resolvedCountry).toBe("FR");
    expect(d.warnings.join(" ")).toContain("GEO_WEAK_CONFLICT");
  });

  it("reverse geo conflict (IP FR, selected CH → MORE expensive) → allowed, logged (not fraud)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "CH", geoCountry: "FR" }));
    expect(d.ok).toBe(true);
    expect(d.resolvedCountry).toBe("CH");
    expect(d.currency).toBe("CHF");
  });

  it("verified company confirming the EUR country overrides the cheap-direction geo review", () => {
    // Verified FR company + selected FR + IP CH → strong signal confirms FR → allowed (no review).
    const d = evaluateCheckoutCountryGuard(base({ companyCountry: "FR", selectedCountry: "FR", geoCountry: "CH" }));
    expect(d.ok).toBe(true);
    expect(d.resolvedCountry).toBe("FR");
  });

  it("client-supplied priceId / currency are IGNORED (server derives price)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "CH", requestedPriceId: "price_hacked_eur", requestedCurrency: "EUR" }));
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(d.ignoredClientPrice).toBe(true);
    expect(d.warnings.join(" ")).toContain("CURRENCY_MISMATCH");
  });

  it("no country signal at all → COUNTRY_REQUIRED (blocked, no price)", () => {
    const d = evaluateCheckoutCountryGuard(base({}));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("COUNTRY_REQUIRED");
    expect(d.resolvedPriceKey).toBeNull();
  });

  it("unsupported country → COUNTRY_NOT_SUPPORTED (blocked)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "US" }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("COUNTRY_NOT_SUPPORTED");
  });

  it("Stripe CHF not configured → STRIPE_PRICE_NOT_CONFIGURED for CH (fail-closed, no EUR fallback)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "CH", stripe: { eurConfigured: true, chfConfigured: false } }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY"); // never the EUR key
  });

  it("Stripe EUR not configured → STRIPE_PRICE_NOT_CONFIGURED for FR (no CHF fallback)", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "FR", stripe: { eurConfigured: false, chfConfigured: true } }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_EUR_MONTHLY");
  });

  it("requireProduction + not ready → PRODUCTION_DISABLED", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "FR", requireProduction: true, productionReady: false }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("PRODUCTION_DISABLED");
  });

  it("happy path: selected FR, all configured → ALLOWED with EUR price", () => {
    const d = evaluateCheckoutCountryGuard(base({ selectedCountry: "FR" }));
    expect(d.ok).toBe(true);
    expect(d.code).toBe("ALLOWED");
    expect(d.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_EUR_MONTHLY");
    expect(d.currency).toBe("EUR");
  });
});
