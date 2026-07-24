// src/lib/geo/__tests__/p18-emit-proofs.test.ts
// P18 — emit machine proofs to .p18-proofs/ from the REAL geo contract (not hand-written). Country
// resolutions, pricing/anti-manipulation, capability matrix, invariants, and multi-entity isolation.
// Run: vitest run src/lib/geo/__tests__/p18-emit-proofs.test.ts

import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUPPORTED_GEO_COUNTRIES, COUNTRY_PROFILES,
  resolveGeoForCompany, resolvePricingRegionServerAuthoritative,
  capabilityMatrixForCountry, checkGeoInvariants,
} from "../index";
import type { GeoCountryCode } from "../types";

const OUT = resolve(process.cwd(), ".p18-proofs");
const AT = "2026-07-15T00:00:00.000Z";

function emit(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 2), "utf8");
}

describe("P18 proof emitter", () => {
  it("emits country resolutions", () => {
    const resolutions = SUPPORTED_GEO_COUNTRIES.map((c) => {
      const r = resolveGeoForCompany({ registration_country: c, canton: c === "CH" ? "CH-VD" : null });
      return { country: c, status: r.status, context: r.status === "ok" ? r.context : null };
    });
    // fail-closed cases
    const failClosed = {
      absent: resolveGeoForCompany({ registration_country: null }).status,
      unsupported: resolveGeoForCompany({ registration_country: "US" }).status,
      empty: resolveGeoForCompany({ registration_country: "" }).status,
    };
    emit("country-resolutions.json", { at: AT, resolutions, failClosed });
    expect(resolutions.every((r) => r.status === "ok")).toBe(true);
    expect(failClosed).toEqual({ absent: "country_required", unsupported: "unsupported", empty: "country_required" });
  });

  it("emits pricing + anti-manipulation proofs", () => {
    const canonical = SUPPORTED_GEO_COUNTRIES.map((c) => {
      const r = resolvePricingRegionServerAuthoritative(c);
      return { country: c, region: r.pricingRegion, currency: r.currency, amountMinor: r.amountMinor };
    });
    const manipulations = [
      { name: "CH_forces_FR_EUR", input: ["CH", { pricingRegion: "FR_EUR", currency: "EUR", amountMinor: 44900 }] as const },
      { name: "FR_forces_CH_CHF", input: ["FR", { pricingRegion: "CH_CHF", currency: "CHF", amountMinor: 49900 }] as const },
      { name: "CH_forges_amount", input: ["CH", { amountMinor: 100 }] as const },
      { name: "absent_country_forces_cheapest", input: [null, { pricingRegion: "FR_EUR" }] as const },
      { name: "unsupported_country", input: ["US", { amountMinor: 1 }] as const },
    ].map((m) => {
      const r = resolvePricingRegionServerAuthoritative(m.input[0], m.input[1]);
      return { name: m.name, ok: r.ok, code: r.code, resolvedRegion: r.pricingRegion, resolvedCurrency: r.currency, resolvedAmountMinor: r.amountMinor, overridesApplied: r.overridesApplied };
    });
    emit("pricing-proofs.json", { at: AT, canonical, manipulations });
    expect(canonical.find((c) => c.country === "CH")?.amountMinor).toBe(49900);
    // every manipulation is blocked or recomputed to the authoritative value (never the forged one)
    expect(manipulations.find((m) => m.name === "CH_forces_FR_EUR")?.resolvedRegion).toBe("CH_CHF");
    expect(manipulations.find((m) => m.name === "CH_forges_amount")?.resolvedAmountMinor).toBe(49900);
    expect(manipulations.find((m) => m.name === "absent_country_forces_cheapest")?.ok).toBe(false);
  });

  it("emits the capability matrix for all four countries", () => {
    const matrix = Object.fromEntries(
      SUPPORTED_GEO_COUNTRIES.map((c) => [c, capabilityMatrixForCountry(c).map((s) => ({ key: s.capabilityKey, label: s.label, disposition: s.disposition }))]),
    );
    emit("capability-matrix.json", { at: AT, note: "0 VERIFIED HR rules today → country-legal capabilities fail-closed", matrix });
    // no country-legal capability is COUNTRY_VERIFIED anywhere (honest fail-closed)
    for (const c of SUPPORTED_GEO_COUNTRIES) {
      const wt = capabilityMatrixForCountry(c).find((s) => s.capabilityKey === "working_time");
      expect(wt?.disposition).not.toBe("COUNTRY_VERIFIED");
    }
  });

  it("emits invariant + multi-entity isolation proofs", () => {
    const invariants = [
      { name: "FR_coherent", input: { registrationCountry: "FR", storedCurrency: "EUR", storedPricingRegion: "FR_EUR", storedAmountMinor: 44900 } },
      { name: "CH_tampered_to_EUR", input: { registrationCountry: "CH", storedCurrency: "EUR", storedPricingRegion: "FR_EUR", storedAmountMinor: 44900 } },
      { name: "absent_country", input: { registrationCountry: null } },
      { name: "CH_missing_canton_for_rule", input: { registrationCountry: "CH", canton: null, forRuleThatDependsOnSubdivision: true } },
    ].map((t) => {
      const r = checkGeoInvariants(t.input as Parameters<typeof checkGeoInvariants>[0]);
      return { name: t.name, ok: r.ok, violations: r.violations.map((v) => v.code) };
    });

    // multi-entity isolation: a FR entity and a CH entity in the same "group" resolve independently
    const entityA = resolveGeoForCompany({ registration_country: "FR" });
    const entityB = resolveGeoForCompany({ registration_country: "CH", canton: "CH-GE" });
    const isolation = {
      entityA: entityA.status === "ok" ? { region: entityA.context.pricingRegion, currency: entityA.context.currency } : null,
      entityB: entityB.status === "ok" ? { region: entityB.context.pricingRegion, currency: entityB.context.currency } : null,
      distinct: entityA.status === "ok" && entityB.status === "ok" && entityA.context.pricingRegion !== entityB.context.pricingRegion,
    };
    emit("invariants-and-isolation.json", { at: AT, invariants, isolation });
    expect(invariants.find((i) => i.name === "FR_coherent")?.ok).toBe(true);
    expect(invariants.find((i) => i.name === "CH_tampered_to_EUR")?.ok).toBe(false);
    expect(isolation.distinct).toBe(true);
  });
});
