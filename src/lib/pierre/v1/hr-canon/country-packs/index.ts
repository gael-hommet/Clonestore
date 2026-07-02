// src/lib/pierre/v1/hr-canon/country-packs/index.ts
// PHASE 8.10 — country-pack public API + pack validator. Aggregates FR/BE/LU/CH and validates
// each pack against the source contract (no invented rules) and family completeness.

import type { CountryPack, Jurisdiction } from "./types";
import { REQUIRED_RULE_FAMILY_KEYS } from "./rule-families";
import { validateRuleSource } from "./source-contract";
import type { CountryRegistry } from "./registry";
import { FRANCE_PACK } from "./france";
import { BELGIUM_PACK } from "./belgium";
import { LUXEMBOURG_PACK } from "./luxembourg";
import { SWITZERLAND_PACK } from "./switzerland";

export * from "./types";
export * from "./rule-families";
export * from "./source-contract";
export * from "./precedence";
export * from "./jurisdiction-resolver";
export * from "./registry";
// ── P8.12 sourcing + rule engine ──
export * from "./source-registry";
export * from "./source-snapshot";
export * from "./source-freshness";
export * from "./legal-review";
export * from "./rule-evaluator";
export * from "./rule-snapshot";
export * from "./rule-conflicts";
export * from "./rule-diff";

export const COUNTRY_REGISTRY: CountryRegistry = {
  FR: FRANCE_PACK,
  BE: BELGIUM_PACK,
  LU: LUXEMBOURG_PACK,
  CH: SWITZERLAND_PACK,
};

export const COUNTRY_PACKS: readonly CountryPack[] = [FRANCE_PACK, BELGIUM_PACK, LUXEMBOURG_PACK, SWITZERLAND_PACK];

export type PackValidation = {
  jurisdiction: Jurisdiction;
  ok: boolean;
  missingRequiredFamilies: string[];
  sourceErrors: string[];
  ruleCount: number;
  sourceRequiredCount: number;
  verifiedCount: number;
};

/** Validate a pack: all required families present + every rule honours the source contract. */
export function validatePack(pack: CountryPack): PackValidation {
  const presentFamilies = new Set(pack.families.map((f) => f.family));
  const missingRequiredFamilies = REQUIRED_RULE_FAMILY_KEYS.filter((k) => !presentFamilies.has(k));
  const sourceErrors: string[] = [];
  let ruleCount = 0, sourceRequiredCount = 0, verifiedCount = 0;
  for (const fam of pack.families) {
    for (const rule of fam.rules) {
      ruleCount++;
      if (rule.status === "SOURCE_REQUIRED") sourceRequiredCount++;
      if (rule.status === "VERIFIED") verifiedCount++;
      sourceErrors.push(...validateRuleSource(rule));
    }
  }
  return {
    jurisdiction: pack.jurisdiction,
    ok: missingRequiredFamilies.length === 0 && sourceErrors.length === 0,
    missingRequiredFamilies, sourceErrors, ruleCount, sourceRequiredCount, verifiedCount,
  };
}

export function validateAllPacks(): { ok: boolean; packs: PackValidation[] } {
  const packs = COUNTRY_PACKS.map(validatePack);
  return { ok: packs.every((p) => p.ok), packs };
}
