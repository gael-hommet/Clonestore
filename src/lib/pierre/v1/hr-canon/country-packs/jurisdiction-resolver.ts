// src/lib/pierre/v1/hr-canon/country-packs/jurisdiction-resolver.ts
// PHASE 8.10 — resolve which country pack governs an HR context. Inputs come from real tenancy
// fields (a company's registration_country, an employee's work site country). Fail-closed: an
// unknown/unsupported jurisdiction resolves to null (Pierre must then treat country-dependent
// rules as SOURCE_REQUIRED and require configuration — never guess).

import type { CountryPack, Jurisdiction, JurisdictionContext } from "./types";

export const SUPPORTED_JURISDICTIONS: readonly Jurisdiction[] = ["FR", "BE", "LU", "CH"];

export function normalizeCountry(raw: string | null | undefined): Jurisdiction | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  const alias: Record<string, Jurisdiction> = {
    FR: "FR", FRA: "FR", FRANCE: "FR",
    BE: "BE", BEL: "BE", BELGIUM: "BE", BELGIQUE: "BE",
    LU: "LU", LUX: "LU", LUXEMBOURG: "LU",
    CH: "CH", CHE: "CH", SWITZERLAND: "CH", SUISSE: "CH", SCHWEIZ: "CH",
  };
  return alias[up] ?? null;
}

export type ResolveInput = {
  companyCountry?: string | null;
  siteCountry?: string | null;   // work site takes precedence over company registration
  subRegion?: string | null;     // e.g. Swiss canton
  collectiveAgreement?: string | null;
};

/** Resolve the jurisdiction context. Site country wins over company country when present. */
export function resolveJurisdiction(input: ResolveInput): JurisdictionContext {
  const j = normalizeCountry(input.siteCountry) ?? normalizeCountry(input.companyCountry);
  return {
    jurisdiction: j,
    subRegion: input.subRegion ?? undefined,
    collectiveAgreement: input.collectiveAgreement ?? null,
  };
}

/** Look up the pack for a resolved context from a registry map. Null if unsupported. */
export function resolvePack(ctx: JurisdictionContext, registry: Record<Jurisdiction, CountryPack>): CountryPack | null {
  if (!ctx.jurisdiction) return null;
  return registry[ctx.jurisdiction] ?? null;
}
