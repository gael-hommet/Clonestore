// src/lib/pierre/v1/final-certification/country-readiness.ts
// PHASE 8.13 — DIMENSION B: country PRODUCTION AUTHORIZATION. A country is launch-grade ONLY when its
// rules are officially sourced + archived + human-reviewed (VERIFIED) + it has live providers/paths +
// an owner sign-off. This dimension is SEPARATE from functional completeness. Honest here: 0/4
// launch-grade (0 VERIFIED rules, 0 live providers, no owner sign-off).
import type { CountryReadiness } from "./types";
import type { Jurisdiction } from "../hr-canon/country-packs/types";
import { COUNTRY_REGISTRY, OFFICIAL_SOURCES } from "../hr-canon/country-packs";
import { providerReadiness } from "./provider-readiness";

// Owner sign-off would come from a signed artifact; none exists in this environment.
function ownerSignOff(_country: Jurisdiction): boolean { return false; }

export function countryReadiness(env: NodeJS.ProcessEnv = process.env): { countries: CountryReadiness[]; launchGradeCount: number } {
  const providersLive = providerReadiness(env).liveGrade;
  const countries: CountryReadiness[] = (["FR", "BE", "LU", "CH"] as const).map((c) => {
    const pack = COUNTRY_REGISTRY[c];
    let rulesTotal = 0, rulesVerified = 0;
    for (const f of pack.families) for (const r of f.rules) { rulesTotal++; if (r.status === "VERIFIED") rulesVerified++; }
    const sources = OFFICIAL_SOURCES.filter((s) => s.jurisdiction === c).length;
    const signOff = ownerSignOff(c);
    const blockers: string[] = [];
    if (rulesVerified < rulesTotal) blockers.push(`${rulesTotal - rulesVerified} rules not VERIFIED (qualified human legal review required)`);
    if (providersLive === 0) blockers.push("no live provider integration");
    if (!signOff) blockers.push("no owner sign-off");
    const launchGrade = rulesTotal > 0 && rulesVerified === rulesTotal && providersLive > 0 && signOff;
    return { country: c, officialSources: sources, rulesTotal, rulesVerified, reviewPackets: rulesTotal, providersLive, ownerSignOff: signOff, launchGrade, blockers };
  });
  return { countries, launchGradeCount: countries.filter((c) => c.launchGrade).length };
}
