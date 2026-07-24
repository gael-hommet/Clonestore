// src/lib/clonestore/pricing/__tests__/pricing-flags-revealed-default.test.ts
// PAYMENT PATH CLOSURE (2026-07-24) — isCountryPricingEnabled() est désormais RÉVÉLÉE PAR
// DÉFAUT (même pattern que isCloneChatEnabled/C1.2) : absente/vide → true ; seul un arrêt
// d'urgence explicite la désactive.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCountryPricingEnabled } from "@/lib/clonestore/pricing/pricing-flags";

const ORIGINAL = process.env.STRIPE_COUNTRY_PRICING_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STRIPE_COUNTRY_PRICING_ENABLED;
  else process.env.STRIPE_COUNTRY_PRICING_ENABLED = ORIGINAL;
});

describe("isCountryPricingEnabled — révélé par défaut", () => {
  it("variable absente -> true (révélé)", () => {
    delete process.env.STRIPE_COUNTRY_PRICING_ENABLED;
    expect(isCountryPricingEnabled()).toBe(true);
  });

  it("variable vide -> true (révélé)", () => {
    process.env.STRIPE_COUNTRY_PRICING_ENABLED = "";
    expect(isCountryPricingEnabled()).toBe(true);
  });

  for (const off of ["false", "0", "off", "disabled", "no", "FALSE", "Off"]) {
    it(`arrêt d'urgence explicite "${off}" -> false`, () => {
      process.env.STRIPE_COUNTRY_PRICING_ENABLED = off;
      expect(isCountryPricingEnabled()).toBe(false);
    });
  }

  it("valeur explicite true -> true", () => {
    process.env.STRIPE_COUNTRY_PRICING_ENABLED = "true";
    expect(isCountryPricingEnabled()).toBe(true);
  });
});
