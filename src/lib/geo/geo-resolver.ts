// src/lib/geo/geo-resolver.ts
// P18 — the SERVER-AUTHORITATIVE geo resolver. Given a legal country (read from the server-stored
// pierre_rt_companies.registration_country), it returns the full CountryProfile + the authoritative
// pricing region / currency / amount + the subdivision (canton/region) requirement. Fail-closed:
// an unknown or unsupported country NEVER falls back to France — it returns country_required /
// unsupported. The client can never impose any of these values.

import type {
  CountryProfile, GeoCountryCode, GeoResolution, ResolvedGeoContext, SubdivisionRequirement,
} from "./types";
import { COUNTRY_PROFILES, SUPPORTED_GEO_COUNTRIES } from "./country-profiles";
import { normalizeCountry } from "../clonestore/pricing/country-pricing";
import { currencyForPricingRegion, amountMinorForPricingRegion } from "./pricing-region";

const normStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Resolve the central profile for a legal country. Fail-closed (never France for unknown). Pure. */
export function resolveCountryProfile(legalCountry: unknown): GeoResolution {
  const c = normalizeCountry(legalCountry);
  if (!c) return { status: "country_required" };
  if (!(SUPPORTED_GEO_COUNTRIES as readonly string[]).includes(c)) return { status: "unsupported", country: c };
  return { status: "ok", profile: COUNTRY_PROFILES[c as GeoCountryCode] };
}

/** Convenience: the profile or null (fail-closed). Pure. */
export function countryProfileOrNull(legalCountry: unknown): CountryProfile | null {
  const r = resolveCountryProfile(legalCountry);
  return r.status === "ok" ? r.profile : null;
}

/**
 * Resolve whether a subdivision (Swiss canton / Belgian region) is required, satisfied, or invalid.
 * `forRuleThatDependsOnSubdivision` = true when the current operation resolves a rule known to vary by
 * subdivision. In that case, a subdivision-capable country with no valid code → REQUIRED (Pierre must
 * ask or refuse). A generic geo resolution (pricing/locale only) never requires a subdivision. Pure.
 */
export function resolveSubdivisionRequirement(
  profile: CountryProfile,
  subdivisionCode: unknown,
  forRuleThatDependsOnSubdivision = false,
): SubdivisionRequirement {
  const code = normStr(subdivisionCode);
  const spec = profile.subdivision;

  if (spec.kind === "none" || !spec.contextRequiredForRules) {
    return code ? { status: "satisfied", code: code.toUpperCase() } : { status: "not_required" };
  }
  // subdivision-capable country (CH cantons, BE regions)
  if (code) {
    const up = code.toUpperCase();
    if (spec.iso3166_2Prefix && !up.startsWith(spec.iso3166_2Prefix)) {
      return { status: "required", kind: spec.kind, reason: `Code de subdivision invalide pour ${profile.countryCode} (préfixe attendu ${spec.iso3166_2Prefix}).` };
    }
    return { status: "satisfied", code: up };
  }
  if (forRuleThatDependsOnSubdivision) {
    return { status: "required", kind: spec.kind, reason: `Le ${spec.label.toLowerCase()} est requis pour une règle qui en dépend en ${profile.countryCode} — sans lui, Pierre refuse d'affirmer la règle.` };
  }
  return { status: "not_required" };
}

export type GeoContextInput = {
  readonly legalCountry: unknown;
  readonly subdivisionCode?: unknown;
  readonly forRuleThatDependsOnSubdivision?: boolean;
};

export type GeoContextResolution =
  | { readonly status: "ok"; readonly context: ResolvedGeoContext }
  | { readonly status: "country_required" }
  | { readonly status: "unsupported"; readonly country: string };

/**
 * Resolve the full server-authoritative geo context for an entity. Pricing region / currency / amount
 * are derived from the legal country (never the client). Fail-closed for unknown / unsupported. Pure.
 */
export function resolveGeoContext(input: GeoContextInput): GeoContextResolution {
  const r = resolveCountryProfile(input.legalCountry);
  if (r.status !== "ok") return r;
  const profile = r.profile;
  const subdivision = resolveSubdivisionRequirement(profile, input.subdivisionCode, !!input.forRuleThatDependsOnSubdivision);
  return {
    status: "ok",
    context: {
      profile,
      pricingRegion: profile.pricingRegion,
      currency: currencyForPricingRegion(profile.pricingRegion),
      priceAmountMinor: amountMinorForPricingRegion(profile.pricingRegion),
      subdivision,
    },
  };
}

/** Minimal server company shape needed to resolve geo (subset of pierre_rt_companies). */
export type CompanyGeoInput = {
  readonly registration_country?: string | null;
  readonly canton?: string | null;
  readonly subdivision?: string | null;
};

/** Resolve geo for a stored company row. The legal country comes ONLY from the server record. Pure. */
export function resolveGeoForCompany(company: CompanyGeoInput, forRuleThatDependsOnSubdivision = false): GeoContextResolution {
  return resolveGeoContext({
    legalCountry: company.registration_country ?? null,
    subdivisionCode: company.canton ?? company.subdivision ?? null,
    forRuleThatDependsOnSubdivision,
  });
}
