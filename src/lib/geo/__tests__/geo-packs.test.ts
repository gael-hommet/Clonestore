// src/lib/geo/__tests__/geo-packs.test.ts
// P18 — GEO PACKS: the central country contract is real (4 profiles), the server is authoritative over
// legal country / pricing region / currency / price, client manipulations are ignored or recalculated,
// unknown/unsupported countries fail closed (never France), no French rule leaks into CH/BE/LU, and the
// coherence invariants reject tampered records.

import { describe, it, expect } from "vitest";
import {
  COUNTRY_PROFILES, SUPPORTED_GEO_COUNTRIES,
  resolveCountryProfile, resolveGeoContext, resolveGeoForCompany, resolveSubdivisionRequirement,
  resolvePricingRegionServerAuthoritative, pricingRegionForCountry, ALL_PRICING_REGIONS,
  capabilityStatusForCountry, capabilityMatrixForCountry,
  checkGeoInvariants, formatMoneyMinor,
} from "../index";
import type { GeoCountryCode } from "../types";

const IANA_TZ = /^[A-Za-z]+\/[A-Za-z_]+$/;

describe("P18 geo contract — registry", () => {
  it("registers exactly FR/BE/LU/CH with unique codes and 1:1 pricing regions", () => {
    expect(SUPPORTED_GEO_COUNTRIES.slice().sort()).toEqual(["BE", "CH", "FR", "LU"]);
    const codes = SUPPORTED_GEO_COUNTRIES.map((c) => COUNTRY_PROFILES[c].countryCode);
    expect(new Set(codes).size).toBe(4);
    const regions = SUPPORTED_GEO_COUNTRIES.map((c) => COUNTRY_PROFILES[c].pricingRegion);
    expect(new Set(regions).size).toBe(4);
    expect(regions.slice().sort()).toEqual(ALL_PRICING_REGIONS.slice().sort());
  });

  it("each profile is internally coherent (version, jurisdiction, timezone, currency, price, sources)", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      const p = COUNTRY_PROFILES[code];
      expect(p.legalJurisdiction, code).toBe(p.countryCode);
      expect(p.version, code).toBeGreaterThan(0);
      expect(p.timezone, code).toMatch(IANA_TZ);
      expect(p.phoneCountryCode, code).toMatch(/^\+\d+$/);
      expect(p.fallbackPolicy, code).toBe("FAIL_CLOSED_REQUIRE_SELECTION");
      // pricing coherence
      if (code === "CH") { expect(p.currency).toBe("CHF"); expect(p.priceAmount).toBe(499); expect(p.priceAmountMinor).toBe(49900); }
      else { expect(p.currency).toBe("EUR"); expect(p.priceAmount).toBe(449); expect(p.priceAmountMinor).toBe(44900); }
      // critical structural facts must carry official-source references
      expect(p.officialSourceReferences.length, code).toBeGreaterThan(0);
      expect(p.companyIdentifierTypes.length, code).toBeGreaterThan(0);
      // supported locale must be non-empty and default must be in it
      expect(p.supportedLocales, code).toContain(p.defaultLocale);
    }
  });

  it("distinguishes legal country, UI locale and currency (BE/LU french UI, distinct currency handled)", () => {
    // Belgium & Luxembourg default to a French locale but keep their own jurisdiction & EUR.
    expect(COUNTRY_PROFILES.BE.defaultLocale).toBe("fr-BE");
    expect(COUNTRY_PROFILES.LU.defaultLocale).toBe("fr-LU");
    expect(COUNTRY_PROFILES.CH.defaultLocale).toBe("fr-CH");
    // planned (not-yet-delivered) locales are declared explicitly, never silently missing
    expect(COUNTRY_PROFILES.CH.plannedLocales).toContain("de-CH");
    expect(COUNTRY_PROFILES.BE.plannedLocales).toContain("nl-BE");
  });
});

describe("P18 geo — company identifier formats (structural, sourced)", () => {
  const patternFor = (code: GeoCountryCode, key: string): RegExp => {
    const id = COUNTRY_PROFILES[code].companyIdentifierTypes.find((i) => i.key === key);
    if (!id?.pattern) throw new Error(`no pattern for ${code}/${key}`);
    return new RegExp(id.pattern);
  };

  it("BE enterprise number & VAT accept BOTH the 0-series and the post-2023 1-series", () => {
    const bce = patternFor("BE", "bce");
    expect(bce.test("0999999999")).toBe(true);
    expect(bce.test("1000000000")).toBe(true);   // series 1 (rolled out as series 0 was exhausted)
    expect(bce.test("2999999999")).toBe(false);
    expect(bce.test("099999999")).toBe(false);    // 9 digits — too short
    const vat = patternFor("BE", "vat_be");
    expect(vat.test("BE0999999999")).toBe(true);
    expect(vat.test("BE1000000000")).toBe(true);   // regression guard: must not reject series 1
    expect(vat.test("BE2999999999")).toBe(false);
    expect(vat.test("BE099999999")).toBe(false);
  });

  it("FR SIREN / CH IDE / LU RCS structural patterns validate real vs malformed ids", () => {
    expect(patternFor("FR", "siren").test("552100554")).toBe(true);
    expect(patternFor("FR", "siren").test("55210055")).toBe(false);   // 8 digits
    expect(patternFor("CH", "ide").test("CHE-123.456.789")).toBe(true);
    expect(patternFor("CH", "ide").test("CHE123456789")).toBe(true);
    expect(patternFor("CH", "ide").test("CH-123.456.789")).toBe(false);
    expect(patternFor("LU", "rcsl").test("B123456")).toBe(true);
    expect(patternFor("LU", "rcsl").test("123456")).toBe(false);      // missing registry letter
  });
});

describe("P18 geo — server-authoritative resolution", () => {
  it("resolves each supported country", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      const r = resolveCountryProfile(code);
      expect(r.status).toBe("ok");
      if (r.status === "ok") expect(r.profile.countryCode).toBe(code);
    }
    // alias / dirty input still resolves via the pricing-canon normalizer
    expect(resolveCountryProfile("Suisse").status).toBe("ok");
    expect(resolveCountryProfile(" france ").status).toBe("ok");
  });

  it("FAILS CLOSED for absent / unsupported country — never France", () => {
    expect(resolveCountryProfile(null).status).toBe("country_required");
    expect(resolveCountryProfile("").status).toBe("country_required");
    const us = resolveCountryProfile("US");
    expect(us.status).toBe("unsupported");
    // the resolution must NOT be FR
    expect(JSON.stringify(us)).not.toContain('"FR"');
  });

  it("Swiss canton is required for a subdivision-dependent rule, satisfied when provided", () => {
    const ch = COUNTRY_PROFILES.CH;
    expect(resolveSubdivisionRequirement(ch, null, true).status).toBe("required");
    expect(resolveSubdivisionRequirement(ch, "CH-VD", true).status).toBe("satisfied");
    // a generic (non-rule) resolution never demands a canton
    expect(resolveSubdivisionRequirement(ch, null, false).status).toBe("not_required");
    // invalid canton prefix is not silently accepted
    expect(resolveSubdivisionRequirement(ch, "FR-75", true).status).toBe("required");
    // France never needs a subdivision
    expect(resolveSubdivisionRequirement(COUNTRY_PROFILES.FR, null, true).status).toBe("not_required");
  });

  it("resolves geo for a stored company row (legal country from the server record only)", () => {
    const r = resolveGeoForCompany({ registration_country: "CH", canton: "CH-GE" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.context.pricingRegion).toBe("CH_CHF");
      expect(r.context.currency).toBe("CHF");
      expect(r.context.priceAmountMinor).toBe(49900);
    }
    // no country on the record → fail-closed
    expect(resolveGeoForCompany({ registration_country: null }).status).toBe("country_required");
  });
});

describe("P18 geo — pricing regions & anti-manipulation", () => {
  it("maps each country to the correct region/amount/currency", () => {
    expect(pricingRegionForCountry("FR")).toBe("FR_EUR");
    expect(pricingRegionForCountry("BE")).toBe("BE_EUR");
    expect(pricingRegionForCountry("LU")).toBe("LU_EUR");
    expect(pricingRegionForCountry("CH")).toBe("CH_CHF");
    expect(pricingRegionForCountry("US")).toBeNull();
  });

  it("FR=449 EUR, BE=449 EUR, LU=449 EUR, CH=499 CHF (server-derived)", () => {
    for (const [c, amt, cur] of [["FR", 44900, "EUR"], ["BE", 44900, "EUR"], ["LU", 44900, "EUR"], ["CH", 49900, "CHF"]] as const) {
      const r = resolvePricingRegionServerAuthoritative(c);
      expect(r.ok, c).toBe(true);
      expect(r.amountMinor, c).toBe(amt);
      expect(r.currency, c).toBe(cur);
    }
  });

  it("Swiss company sending FR_EUR is ignored & recomputed to CH_CHF", () => {
    const r = resolvePricingRegionServerAuthoritative("CH", { pricingRegion: "FR_EUR", currency: "EUR", amountMinor: 44900 });
    expect(r.pricingRegion).toBe("CH_CHF");
    expect(r.currency).toBe("CHF");
    expect(r.amountMinor).toBe(49900);
    expect(r.overridesApplied).toContain("REGION_MISMATCH");
    expect(r.overridesApplied).toContain("CURRENCY_MISMATCH");
    expect(r.overridesApplied).toContain("AMOUNT_MISMATCH");
  });

  it("French company sending CH_CHF / 499 is ignored & recomputed to FR_EUR / 449", () => {
    const r = resolvePricingRegionServerAuthoritative("FR", { pricingRegion: "CH_CHF", currency: "CHF", amountMinor: 49900 });
    expect(r.pricingRegion).toBe("FR_EUR");
    expect(r.currency).toBe("EUR");
    expect(r.amountMinor).toBe(44900);
    expect(r.overridesApplied).toContain("REGION_MISMATCH");
  });

  it("absent country never yields the cheapest offer — fail-closed to country_required", () => {
    const r = resolvePricingRegionServerAuthoritative(null, { pricingRegion: "FR_EUR" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("COUNTRY_REQUIRED");
    expect(r.pricingRegion).toBeNull();
    expect(r.overridesApplied).toContain("REGION_IGNORED");
  });

  it("unsupported country is refused", () => {
    const r = resolvePricingRegionServerAuthoritative("US", { amountMinor: 100 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("COUNTRY_NOT_SUPPORTED");
  });
});

describe("P18 geo — capabilities (no French rule leaks into CH/BE/LU)", () => {
  it("country-legal capabilities are fail-closed everywhere (0 VERIFIED rules today)", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      const trial = capabilityStatusForCountry(code, "trial_period");
      expect(["DISABLED_UNTIL_VERIFIED", "COUNTRY_VERIFIED", "CONTEXT_REQUIRED"]).toContain(trial.disposition);
      // with 0 VERIFIED rules it must NOT be operationally verified
      expect(trial.disposition).not.toBe("COUNTRY_VERIFIED");
    }
  });

  it("no FR rule is applied to a Swiss/Belgian/Lux context — working_time stays disabled/context", () => {
    for (const code of ["CH", "BE", "LU"] as GeoCountryCode[]) {
      const wt = capabilityStatusForCountry(code, "working_time");
      expect(wt.disposition).not.toBe("COUNTRY_VERIFIED");
      expect(wt.disposition).not.toBe("SHARED_VERIFIED");
    }
    // France's own working_time also isn't VERIFIED (honest: 0 verified rules)
    expect(capabilityStatusForCountry("FR", "working_time").disposition).not.toBe("COUNTRY_VERIFIED");
  });

  it("final dismissal decision is HUMAN_ONLY in every country", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      expect(capabilityStatusForCountry(code, "dismissal_decision").disposition).toBe("HUMAN_ONLY");
    }
  });

  it("full payroll is OUT_OF_SCOPE (MUST_NOT) everywhere", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      expect(capabilityStatusForCountry(code, "payroll").disposition).toBe("OUT_OF_SCOPE");
    }
  });

  it("documents require human validation (draft only) — never silently 'ready'", () => {
    const contractFR = capabilityStatusForCountry("FR", "employment_contract");
    expect(["HUMAN_VALIDATION_REQUIRED", "COUNTRY_VERIFIED"]).toContain(contractFR.disposition);
    // shared mechanics are safe universally
    expect(capabilityStatusForCountry("BE", "history").disposition).toBe("SHARED_VERIFIED");
    expect(capabilityStatusForCountry("CH", "permissions").disposition).toBe("SHARED_VERIFIED");
  });

  it("matrix covers all capabilities for all countries", () => {
    for (const code of SUPPORTED_GEO_COUNTRIES) {
      const m = capabilityMatrixForCountry(code);
      expect(m.length).toBeGreaterThanOrEqual(28);
      expect(m.every((r) => r.country === code)).toBe(true);
    }
  });
});

describe("P18 geo — server invariants", () => {
  it("passes for a coherent French company", () => {
    const r = checkGeoInvariants({ registrationCountry: "FR", storedCurrency: "EUR", storedPricingRegion: "FR_EUR", storedAmountMinor: 44900 });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("rejects a tampered record: CH company stored with EUR / FR_EUR / 44900", () => {
    const r = checkGeoInvariants({ registrationCountry: "CH", storedCurrency: "EUR", storedPricingRegion: "FR_EUR", storedAmountMinor: 44900 });
    expect(r.ok).toBe(false);
    const codes = r.violations.map((v) => v.code);
    expect(codes).toContain("COUNTRY_CURRENCY_COHERENT");
    expect(codes).toContain("PRICING_REGION_COHERENT");
    expect(codes).toContain("COUNTRY_PRICE_COHERENT");
  });

  it("absent country is the first violation — no France fallback", () => {
    const r = checkGeoInvariants({ registrationCountry: null });
    expect(r.ok).toBe(false);
    expect(r.violations[0].code).toBe("COUNTRY_PRESENT");
    expect(r.profile).toBeNull();
  });

  it("unsupported country is refused", () => {
    const r = checkGeoInvariants({ registrationCountry: "US" });
    expect(r.ok).toBe(false);
    expect(r.violations[0].code).toBe("COUNTRY_SUPPORTED");
  });

  it("Swiss company missing canton for a subdivision-dependent rule → violation", () => {
    const r = checkGeoInvariants({ registrationCountry: "CH", canton: null, forRuleThatDependsOnSubdivision: true });
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain("SUBDIVISION_CONTEXT_PRESENT");
    // with the canton provided it passes that invariant
    const ok = checkGeoInvariants({ registrationCountry: "CH", canton: "CH-ZH", forRuleThatDependsOnSubdivision: true });
    expect(ok.violations.map((v) => v.code)).not.toContain("SUBDIVISION_CONTEXT_PRESENT");
  });

  it("a capability out of scope in the country is flagged", () => {
    const r = checkGeoInvariants({ registrationCountry: "FR", capabilityKey: "payroll" });
    expect(r.violations.map((v) => v.code)).toContain("CAPABILITY_ALLOWED_IN_COUNTRY");
  });
});

describe("P18 geo — formatting keeps currency tied to legal country, not UI locale", () => {
  it("formats CH price in CHF and FR/BE/LU in EUR", () => {
    expect(formatMoneyMinor(COUNTRY_PROFILES.CH, 49900)).toMatch(/49|499/);
    expect(formatMoneyMinor(COUNTRY_PROFILES.CH, 49900).toUpperCase()).toContain("CHF");
    // Belgium uses a French locale but EUR currency
    expect(formatMoneyMinor(COUNTRY_PROFILES.BE, 44900)).toMatch(/449/);
    expect(formatMoneyMinor(COUNTRY_PROFILES.BE, 44900)).toContain("€");
  });
});
