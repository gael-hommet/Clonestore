// src/lib/clonestore/pricing/__tests__/country-pricing.test.ts
// P10 §9 — tests du CANON de tarification par pays (module pur).
import { describe, it, expect } from "vitest";
import {
  normalizeCountry, isSupportedLaunchCountry, pricingForCountry, defaultPricingForUnknownCountry,
  countryGroupFor, currencyForCountry, stripePriceEnvKeyForCountry,
  isCountryCurrencyCompatible, isCountryPriceCompatible, canCountryBuyPrice, explainCountryPriceDecision,
} from "../country-pricing";

describe("P10 country pricing canon", () => {
  it("FR / BE / LU → 449 EUR (EUR_LAUNCH, EUR price key)", () => {
    for (const c of ["FR", "BE", "LU"]) {
      const r = pricingForCountry(c);
      expect(r.status).toBe("ok");
      if (r.status !== "ok") throw new Error("unreachable");
      expect(r.pricing.amount).toBe(449);
      expect(r.pricing.currency).toBe("EUR");
      expect(r.pricing.group).toBe("EUR_LAUNCH");
      expect(r.pricing.stripePriceKey).toBe("STRIPE_PRICE_PIERRE_EUR_MONTHLY");
      expect(r.pricing.display).toBe("449 € / mois");
    }
  });

  it("CH → 499 CHF (CHF_LAUNCH, CHF price key)", () => {
    const r = pricingForCountry("CH");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") throw new Error("unreachable");
    expect(r.pricing.amount).toBe(499);
    expect(r.pricing.currency).toBe("CHF");
    expect(r.pricing.group).toBe("CHF_LAUNCH");
    expect(r.pricing.stripePriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(r.pricing.display).toBe("499 CHF / mois");
  });

  it("unparseable/absent country → country_required (NEVER the cheapest offer)", () => {
    for (const c of [undefined, null, "", "garbage!!", 42, {}]) {
      const r = pricingForCountry(c);
      expect(r.status).toBe("country_required");
    }
    expect(defaultPricingForUnknownCountry().status).toBe("country_required");
  });

  it("valid ISO but outside launch perimeter (US/ZZ) → unsupported, never a fake price", () => {
    for (const c of ["US", "ZZ", "de", "gb"]) {
      const r = pricingForCountry(c);
      expect(r.status).toBe("unsupported");
      // critically: NEVER falls through to an 'ok' pricing (no cheapest-price abuse)
      expect(r.status).not.toBe("ok");
    }
  });

  it("lowercase / messy / full-name input normalizes correctly", () => {
    expect(normalizeCountry(" fr ")).toBe("FR");
    expect(normalizeCountry("France")).toBe("FR");
    expect(normalizeCountry("SUISSE")).toBe("CH");
    expect(normalizeCountry("switzerland")).toBe("CH");
    expect(normalizeCountry("Belgique")).toBe("BE");
    expect(normalizeCountry("luxembourg")).toBe("LU");
    expect(normalizeCountry("  ch  ")).toBe("CH");
    expect(isSupportedLaunchCountry("suisse")).toBe(true);
    expect(isSupportedLaunchCountry("germany")).toBe(false); // normalizes? no alias → null → unsupported
    expect(normalizeCountry("garbage!!")).toBeNull();
  });

  it("CH cannot buy the EUR price (currency + price key incompatible)", () => {
    expect(isCountryCurrencyCompatible("CH", "EUR")).toBe(false);
    expect(isCountryPriceCompatible("CH", "STRIPE_PRICE_PIERRE_EUR_MONTHLY")).toBe(false);
    expect(canCountryBuyPrice("CH", "STRIPE_PRICE_PIERRE_EUR_MONTHLY")).toBe(false);
    const d = explainCountryPriceDecision({ country: "CH", priceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("CH_REQUIRES_CHF_PRICE");
    // and CH CAN buy its own CHF price
    expect(canCountryBuyPrice("CH", "STRIPE_PRICE_PIERRE_CHF_MONTHLY")).toBe(true);
  });

  it("FR / BE / LU cannot buy the CHF price", () => {
    for (const c of ["FR", "BE", "LU"]) {
      expect(isCountryCurrencyCompatible(c, "CHF")).toBe(false);
      expect(isCountryPriceCompatible(c, "STRIPE_PRICE_PIERRE_CHF_MONTHLY")).toBe(false);
      expect(canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_CHF_MONTHLY")).toBe(false);
      const d = explainCountryPriceDecision({ country: c, priceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY" });
      expect(d.allowed).toBe(false);
      expect(d.code).toBe("EUR_COUNTRY_REQUIRES_EUR_PRICE");
      // and each CAN buy the EUR price
      expect(canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_EUR_MONTHLY")).toBe(true);
    }
  });

  it("group / currency / price-key helpers are consistent and null-safe", () => {
    expect(countryGroupFor("FR")).toBe("EUR_LAUNCH");
    expect(countryGroupFor("CH")).toBe("CHF_LAUNCH");
    expect(countryGroupFor("US")).toBeNull();
    expect(currencyForCountry("BE")).toBe("EUR");
    expect(currencyForCountry("CH")).toBe("CHF");
    expect(currencyForCountry("ZZ")).toBeNull();
    expect(stripePriceEnvKeyForCountry("LU")).toBe("STRIPE_PRICE_PIERRE_EUR_MONTHLY");
    expect(stripePriceEnvKeyForCountry("CH")).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(stripePriceEnvKeyForCountry(null)).toBeNull();
  });

  it("explainCountryPriceDecision: unknown → COUNTRY_REQUIRED, unsupported → COUNTRY_NOT_SUPPORTED, match → ALLOWED", () => {
    expect(explainCountryPriceDecision({ country: null }).code).toBe("COUNTRY_REQUIRED");
    expect(explainCountryPriceDecision({ country: "US" }).code).toBe("COUNTRY_NOT_SUPPORTED");
    const ok = explainCountryPriceDecision({ country: "FR", priceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" });
    expect(ok.allowed).toBe(true);
    expect(ok.code).toBe("ALLOWED");
    expect(ok.expectedCurrency).toBe("EUR");
  });
});
