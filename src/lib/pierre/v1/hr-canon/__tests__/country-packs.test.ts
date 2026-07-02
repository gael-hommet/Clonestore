// src/lib/pierre/v1/hr-canon/__tests__/country-packs.test.ts
// PHASE 8.10 — the country-pack architecture is real (resolver, precedence, pack validity) and the
// "never invent law" guarantee holds: every rule is SOURCE_REQUIRED with a null value, the source
// contract rejects invented rules, and jurisdiction resolution fails closed on unknown countries.

import { describe, it, expect } from "vitest";
import {
  COUNTRY_PACKS, COUNTRY_REGISTRY, validateAllPacks, validatePack,
  resolveJurisdiction, resolvePack, normalizeCountry, SUPPORTED_JURISDICTIONS,
  REQUIRED_RULE_FAMILY_KEYS, validateRuleSource, resolvePrecedence,
} from "../country-packs";

describe("country packs", () => {
  it("all four packs are valid (required families present, no source-contract breach)", () => {
    const r = validateAllPacks();
    if (!r.ok) console.error(JSON.stringify(r.packs.filter((p) => !p.ok), null, 1));
    expect(r.ok).toBe(true);
    expect(r.packs.map((p) => p.jurisdiction).sort()).toEqual(["BE", "CH", "FR", "LU"]);
  });

  it("NEVER INVENT LAW: every rule is SOURCE_REQUIRED with a null value at P8.10", () => {
    for (const pack of COUNTRY_PACKS) {
      const v = validatePack(pack);
      expect(v.sourceErrors, pack.jurisdiction).toEqual([]);
      expect(v.verifiedCount, pack.jurisdiction).toBe(0);
      expect(v.sourceRequiredCount, pack.jurisdiction).toBe(v.ruleCount);
      for (const fam of pack.families) for (const rule of fam.rules) expect(rule.value, `${pack.jurisdiction}.${rule.key}`).toBeNull();
    }
  });

  it("every pack declares all required rule families", () => {
    for (const pack of COUNTRY_PACKS) {
      const present = new Set(pack.families.map((f) => f.family));
      for (const req of REQUIRED_RULE_FAMILY_KEYS) expect(present.has(req), `${pack.jurisdiction} missing ${req}`).toBe(true);
    }
  });

  it("source contract rejects an invented rule (non-null value without a source)", () => {
    const invented = { key: "x", label: "x", status: "SOURCE_REQUIRED" as const, requiredSourceTypes: ["primary_legislation" as const], value: 25 };
    expect(validateRuleSource(invented).length).toBeGreaterThan(0);
    // and a VERIFIED rule without a reviewer is rejected
    const unreviewed = { key: "y", label: "y", status: "VERIFIED" as const, requiredSourceTypes: ["primary_legislation" as const], value: 25, sourceCitation: "cite" };
    expect(validateRuleSource(unreviewed).some((e) => e.includes("reviewedBy"))).toBe(true);
  });

  it("jurisdiction resolver normalizes + prefers site country + fails closed", () => {
    expect(normalizeCountry("France")).toBe("FR");
    expect(normalizeCountry("SUISSE")).toBe("CH");
    expect(normalizeCountry("Neverland")).toBeNull();
    // site country wins over company country
    const ctx = resolveJurisdiction({ companyCountry: "FR", siteCountry: "BE" });
    expect(ctx.jurisdiction).toBe("BE");
    expect(resolvePack(ctx, COUNTRY_REGISTRY)?.jurisdiction).toBe("BE");
    // unknown → null pack (fail closed, never guess)
    const unknown = resolveJurisdiction({ companyCountry: "US" });
    expect(unknown.jurisdiction).toBeNull();
    expect(resolvePack(unknown, COUNTRY_REGISTRY)).toBeNull();
  });

  it("supports exactly FR/BE/LU/CH", () => {
    expect([...SUPPORTED_JURISDICTIONS].sort()).toEqual(["BE", "CH", "FR", "LU"]);
  });

  it("precedence: highest-authority layer wins; favourability can override when the country rule allows", () => {
    const values = [
      { layer: "individual_contract" as const, value: 30, moreFavourableToEmployee: true },
      { layer: "statutory" as const, value: 25 },
    ];
    expect(resolvePrecedence(values).winner?.layer).toBe("statutory");
    expect(resolvePrecedence(values, { favourabilityApplies: true }).winner?.layer).toBe("individual_contract");
  });
});
