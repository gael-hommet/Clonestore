// src/lib/geo/__tests__/geo-guards.test.ts
// P18 — the geo guards & routes: document-template availability (France templates never silently served
// to CH/BE/LU), jurisdiction-aware retention (French durations never applied to non-FR), the
// server-authoritative /api/geo/resolve route (client region/currency/amount ignored, fail-closed), and
// the /api/pricing/public fix (no silent France fallback when country pricing is disabled).

import { describe, it, expect } from "vitest";
import { decideDocument, documentTemplateFor } from "../document-availability";
import {
  getRetentionForJurisdiction, computeArchiveAtForJurisdiction, getRetentionPolicy,
} from "../../cloneos/files/retention";
import { GET as geoGET, POST as geoPOST } from "../../../app/api/geo/resolve/route";
import { GET as pricingGET } from "../../../app/api/pricing/public/route";

describe("P18 — document template availability (no FR template leak)", () => {
  it("FR employment contract is draft-only / human-validation (never silently 'ready')", () => {
    const d = decideDocument("FR", "employment_contract");
    expect(d.finalAllowed).toBe(false);
    expect(d.draftAllowed).toBe(true);
    expect(d.requiresHumanValidation).toBe(true);
  });

  it("BE/LU/CH employment contract is DISABLED_UNTIL_VERIFIED — no draft, no final, never the FR model", () => {
    for (const c of ["BE", "LU", "CH"]) {
      const d = decideDocument(c, "employment_contract");
      expect(d.availability).toBe("DISABLED_UNTIL_VERIFIED");
      expect(d.finalAllowed).toBe(false);
      expect(d.draftAllowed).toBe(false);
    }
  });

  it("fails closed for absent / unsupported country and unknown template", () => {
    expect(decideDocument(null, "employment_contract").availability).toBe("COUNTRY_REQUIRED");
    expect(decideDocument("US", "employment_contract").availability).toBe("COUNTRY_NOT_SUPPORTED");
    expect(decideDocument("FR", "nope").availability).toBe("TEMPLATE_UNKNOWN");
    expect(documentTemplateFor("US", "employment_contract")).toBeNull();
  });
});

describe("P18 — jurisdiction-aware retention (no French duration applied to CH/BE/LU)", () => {
  it("FR keeps the existing product canon (asserted duration)", () => {
    const fr = getRetentionForJurisdiction("contract", "FR");
    expect(fr.assertedDuration).toBe(true);
    expect(fr.retentionDays).toBe(getRetentionPolicy("contract").retention_days);
    expect(computeArchiveAtForJurisdiction("2020-01-01T00:00:00.000Z", "contract", "FR")).not.toBeNull();
  });

  it("CH/BE/LU/unknown assert NO duration and require human validation", () => {
    for (const j of ["CH", "BE", "LU", "US", null]) {
      const r = getRetentionForJurisdiction("contract", j as string | null);
      expect(r.assertedDuration, String(j)).toBe(false);
      expect(r.retentionDays, String(j)).toBeNull();
      expect(r.requiresHumanValidation, String(j)).toBe(true);
      // no French-based archival date is computed for a non-FR entity
      expect(computeArchiveAtForJurisdiction("2020-01-01T00:00:00.000Z", "contract", j as string | null)).toBeNull();
    }
  });

  it("legacy no-jurisdiction API is unchanged (backward compatible, FR)", () => {
    expect(getRetentionPolicy("contract").retention_days).toBe(365 * 5);
  });
});

describe("P18 — /api/geo/resolve server authority", () => {
  async function post(body: unknown) {
    const req = new Request("http://localhost/api/geo/resolve", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    const res = await geoPOST(req);
    return res.json() as Promise<Record<string, unknown>>;
  }

  it("resolves CH to CH_CHF/499 and IGNORES a client-forced FR_EUR/449", async () => {
    const j = await post({ country: "CH", pricingRegion: "FR_EUR", currency: "EUR", amountMinor: 44900 });
    const pricing = j.pricing as Record<string, unknown>;
    expect(pricing.pricingRegion).toBe("CH_CHF");
    expect(pricing.currency).toBe("CHF");
    expect(pricing.amountMinor).toBe(49900);
    expect(j.clientHintsIgnored).toEqual(expect.arrayContaining(["REGION_MISMATCH", "CURRENCY_MISMATCH", "AMOUNT_MISMATCH"]));
    // and the coherence invariants flag the tampered stored-like values
    const inv = j.invariants as Record<string, unknown>;
    expect(inv.ok).toBe(false);
  });

  it("resolves FR to FR_EUR/449 and IGNORES a client-forced CH_CHF", async () => {
    const j = await post({ country: "FR", pricingRegion: "CH_CHF", currency: "CHF", amountMinor: 49900 });
    const pricing = j.pricing as Record<string, unknown>;
    expect(pricing.pricingRegion).toBe("FR_EUR");
    expect(pricing.amountMinor).toBe(44900);
  });

  it("fails closed for absent and unsupported country (never France)", async () => {
    const absent = await post({ pricingRegion: "FR_EUR" });
    expect(absent.ok).toBe(false);
    expect((absent.pricing as Record<string, unknown>).code).toBe("COUNTRY_REQUIRED");
    expect(absent.legalCountry).toBeNull();
    const us = await post({ country: "US", amountMinor: 1 });
    expect(us.ok).toBe(false);
    expect((us.pricing as Record<string, unknown>).code).toBe("COUNTRY_NOT_SUPPORTED");
  });

  it("requires the canton for a subdivision-dependent Swiss rule (GET form)", async () => {
    const req = new Request("http://localhost/api/geo/resolve?country=CH&forRuleThatDependsOnSubdivision=true");
    const res = await geoGET(req);
    const j = (await res.json()) as Record<string, unknown>;
    const sub = j.subdivision as Record<string, unknown>;
    expect(sub.status).toBe("required");
    expect(sub.kind).toBe("canton");
  });

  it("BE/LU keep their jurisdiction under a French UI (locale independent of law)", async () => {
    const be = await post({ country: "BE" });
    const beProfile = be.profile as Record<string, unknown>;
    expect(beProfile.legalJurisdiction).toBe("BE");
    expect(beProfile.defaultLocale).toBe("fr-BE");
    expect((be.pricing as Record<string, unknown>).currency).toBe("EUR");
  });
});

describe("P18 — /api/pricing/public no silent France fallback", () => {
  it("with no geo/selection, requires country selection (never silent FR/449) and returns the full catalog", async () => {
    const req = new Request("http://localhost/api/pricing/public");
    const res = await pricingGET(req);
    const j = (await res.json()) as Record<string, unknown>;
    // no silent France resolution
    expect(j.resolvedCountry).toBeNull();
    expect(j.requiresCountrySelection).toBe(true);
    expect(j.price).toBeNull();
    // both offers are always visible via the catalog
    expect(Array.isArray(j.catalog)).toBe(true);
    expect((j.catalog as unknown[]).length).toBe(2);
  });

  it("an explicit Swiss selection resolves to the CHF offer", async () => {
    const req = new Request("http://localhost/api/pricing/public?country=CH");
    const res = await pricingGET(req);
    const j = (await res.json()) as Record<string, unknown>;
    expect(j.resolvedCountry).toBe("CH");
    const price = j.price as Record<string, unknown>;
    expect(price.currency).toBe("CHF");
    expect(price.amount).toBe(499);
  });
});
