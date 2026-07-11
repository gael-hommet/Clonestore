// src/lib/clonestore/pricing/__tests__/public-pricing-resolver.test.ts
// P10 §9 — résolveur de tarification publique (précédence des signaux + confiance).
import { describe, it, expect } from "vitest";
import { resolvePublicPricing, parseAcceptLanguageCountry } from "../public-pricing-resolver";

describe("P10 public pricing resolver", () => {
  it("explicit selection CH → CHF 499 (confident, no selection required)", () => {
    const r = resolvePublicPricing({ selectedCountry: "CH" });
    expect(r.confidence).toBe("selected");
    expect(r.resolvedCountry).toBe("CH");
    expect(r.price?.currency).toBe("CHF");
    expect(r.price?.amount).toBe(499);
    expect(r.requiresCountrySelection).toBe(false);
    expect(r.requiresCheckoutRevalidation).toBe(true); // checkout is always authoritative
  });

  it("explicit selection FR → EUR 449", () => {
    const r = resolvePublicPricing({ selectedCountry: "France" });
    expect(r.resolvedCountry).toBe("FR");
    expect(r.price?.currency).toBe("EUR");
    expect(r.price?.amount).toBe(449);
  });

  it("verified company CH beats explicit selection FR (verified wins → CHF)", () => {
    const r = resolvePublicPricing({ companyCountry: "CH", selectedCountry: "FR" });
    expect(r.confidence).toBe("verified");
    expect(r.resolvedCountry).toBe("CH");
    expect(r.price?.currency).toBe("CHF");
  });

  it("explicit selection beats weak geo (selected FR wins over geo CH)", () => {
    const r = resolvePublicPricing({ selectedCountry: "FR", geoCountry: "CH" });
    expect(r.confidence).toBe("selected");
    expect(r.resolvedCountry).toBe("FR");
    expect(r.price?.currency).toBe("EUR");
  });

  it("geo CH suggests CHF but still requires checkout revalidation", () => {
    const r = resolvePublicPricing({ geoCountry: "CH" });
    expect(r.confidence).toBe("geo");
    expect(r.resolvedCountry).toBe("CH");
    expect(r.price?.currency).toBe("CHF");
    expect(r.requiresCountrySelection).toBe(false); // a concrete price is shown
    expect(r.requiresCheckoutRevalidation).toBe(true); // but checkout re-derives
  });

  it("weak Accept-Language hint → suggests country but REQUIRES explicit selection before checkout", () => {
    const r = resolvePublicPricing({ acceptLanguage: "fr-CH,fr;q=0.9" });
    expect(r.confidence).toBe("weak");
    expect(r.resolvedCountry).toBe("CH");
    expect(r.requiresCountrySelection).toBe(true); // must confirm
  });

  it("unknown (no signal) → country_required, NO price, selection required", () => {
    const r = resolvePublicPricing({});
    expect(r.confidence).toBe("unknown");
    expect(r.resolvedCountry).toBeNull();
    expect(r.price).toBeNull();
    expect(r.requiresCountrySelection).toBe(true);
    expect(r.auditReason).toBe("COUNTRY_REQUIRED");
  });

  it("verified company in an unsupported country → no price, selection required (waitlist)", () => {
    const r = resolvePublicPricing({ companyCountry: "US" });
    expect(r.supported).toBe(false);
    expect(r.price).toBeNull();
    expect(r.requiresCountrySelection).toBe(true);
    expect(r.auditReason).toBe("COUNTRY_NOT_SUPPORTED");
  });

  it("never fabricates a cheapest default for an unknown country", () => {
    const r = resolvePublicPricing({ selectedCountry: "ZZ", geoCountry: "" , acceptLanguage: "xx" });
    // ZZ is a valid ISO-2 shape but unsupported → not priced
    expect(r.price).toBeNull();
    expect(r.requiresCountrySelection).toBe(true);
  });

  it("parseAcceptLanguageCountry extracts region subtags, ignores languages without region", () => {
    expect(parseAcceptLanguageCountry("fr-CH,fr;q=0.9,en;q=0.8")).toBe("CH");
    expect(parseAcceptLanguageCountry("fr-FR")).toBe("FR");
    expect(parseAcceptLanguageCountry("fr")).toBeNull(); // no region
    expect(parseAcceptLanguageCountry("")).toBeNull();
    expect(parseAcceptLanguageCountry(null)).toBeNull();
    expect(parseAcceptLanguageCountry("de-DE")).toBe("DE"); // normalized but unsupported downstream
  });
});
