// src/lib/pierre/v1/hr-country-execution/required-rules.ts
// PHASE 8.12 — compute the country rules a mission pack REQUIRES, and gather the corresponding rules
// from the resolved country pack. Dynamic: driven by the pack's countryRuleRequirements (from the
// canon), never a hardcoded list.

import type { HrMissionPackDefinition } from "../hr-mission-packs/types";
import type { CountryPack, CountryRule, Jurisdiction } from "../hr-canon/country-packs/types";
import { COUNTRY_REGISTRY } from "../hr-canon/country-packs";

export function requiredRuleFamilies(pack: HrMissionPackDefinition): string[] {
  return pack.countryRuleRequirements.filter((r) => r.required).map((r) => r.ruleFamily);
}

export type ResolvedFamily = { family: string; rules: { rule: CountryRule; family: string }[]; found: boolean };

/** Gather the country pack's rules for each required family (all sub-rules of that family). */
export function resolveRequiredRules(pack: HrMissionPackDefinition, jurisdiction: Jurisdiction): { pack: CountryPack | null; families: ResolvedFamily[] } {
  const countryPack = COUNTRY_REGISTRY[jurisdiction] ?? null;
  const families: ResolvedFamily[] = [];
  for (const fam of requiredRuleFamilies(pack)) {
    const inst = countryPack?.families.find((f) => f.family === fam);
    families.push({ family: fam, found: !!inst, rules: (inst?.rules ?? []).map((rule) => ({ rule, family: fam })) });
  }
  return { pack: countryPack, families };
}
