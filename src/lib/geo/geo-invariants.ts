// src/lib/geo/geo-invariants.ts
// P18 — server invariants that a resolved geo context (and a stored company record) MUST satisfy. These
// are the guardrails the critical routes assert: legal country present, country supported, pack version
// known, country↔currency↔price coherent, entity↔jurisdiction coherent, capability allowed in country,
// and subdivision (canton/region) context present when a rule depends on it. Any stored value that
// contradicts the server-derived truth is a violation (a tampered / stale / incoherent record), never
// silently accepted. Pure & testable.

import type { CountryProfile } from "./types";
import { resolveCountryProfile, resolveSubdivisionRequirement } from "./geo-resolver";
import { currencyForPricingRegion, amountMinorForPricingRegion, pricingRegionForCountry } from "./pricing-region";
import { capabilityStatusForCountry, type CountryCapabilityStatus } from "./capabilities";

export type GeoInvariantCode =
  | "COUNTRY_PRESENT"
  | "COUNTRY_SUPPORTED"
  | "PACK_VERSION_KNOWN"
  | "COUNTRY_CURRENCY_COHERENT"
  | "COUNTRY_PRICE_COHERENT"
  | "PRICING_REGION_COHERENT"
  | "ENTITY_JURISDICTION_COHERENT"
  | "CAPABILITY_ALLOWED_IN_COUNTRY"
  | "SUBDIVISION_CONTEXT_PRESENT";

export type GeoInvariantViolation = { readonly code: GeoInvariantCode; readonly message: string };

export type GeoInvariantInput = {
  readonly registrationCountry?: string | null;
  /** stored per-company fields (pierre_rt_companies) that must stay coherent with the legal country. */
  readonly storedCurrency?: string | null;
  readonly storedPricingRegion?: string | null;
  readonly storedAmountMinor?: number | null;
  readonly canton?: string | null;
  /** a capability being attempted (optional) — checked against the country capability map. */
  readonly capabilityKey?: string | null;
  /** true when the current operation resolves a rule that varies by subdivision. */
  readonly forRuleThatDependsOnSubdivision?: boolean;
};

export type GeoInvariantResult = {
  readonly ok: boolean;
  readonly violations: readonly GeoInvariantViolation[];
  readonly profile: CountryProfile | null;
  readonly capabilityStatus: CountryCapabilityStatus | null;
};

/**
 * Assert the geo invariants for a company record + optional attempted capability. Fail-closed: an
 * unresolved/unsupported country is itself the first violation (no France fallback). Pure.
 */
export function checkGeoInvariants(input: GeoInvariantInput): GeoInvariantResult {
  const violations: GeoInvariantViolation[] = [];
  const r = resolveCountryProfile(input.registrationCountry);

  if (r.status === "country_required") {
    violations.push({ code: "COUNTRY_PRESENT", message: "Pays légal absent : la région tarifaire, la devise et les règles ne peuvent pas être résolues (aucun repli France)." });
    return { ok: false, violations, profile: null, capabilityStatus: null };
  }
  if (r.status === "unsupported") {
    violations.push({ code: "COUNTRY_SUPPORTED", message: `Pays « ${r.country} » non supporté (FR, BE, LU, CH uniquement).` });
    return { ok: false, violations, profile: null, capabilityStatus: null };
  }

  const profile = r.profile;

  // pack version known
  if (!(typeof profile.version === "number" && profile.version > 0)) {
    violations.push({ code: "PACK_VERSION_KNOWN", message: `Version du pack pays inconnue pour ${profile.countryCode}.` });
  }

  // entity ↔ jurisdiction coherence
  if (profile.legalJurisdiction !== profile.countryCode) {
    violations.push({ code: "ENTITY_JURISDICTION_COHERENT", message: `Incohérence entité/juridiction (${profile.countryCode} ≠ ${profile.legalJurisdiction}).` });
  }

  // country ↔ currency / price / region coherence (stored fields must match the server-derived truth)
  const region = pricingRegionForCountry(profile.countryCode)!;
  const canonCurrency = currencyForPricingRegion(region);
  const canonAmountMinor = amountMinorForPricingRegion(region);

  if (input.storedCurrency != null && String(input.storedCurrency).toUpperCase() !== canonCurrency) {
    violations.push({ code: "COUNTRY_CURRENCY_COHERENT", message: `Devise stockée « ${input.storedCurrency} » incohérente avec ${profile.countryCode} (attendu ${canonCurrency}).` });
  }
  if (input.storedPricingRegion != null && String(input.storedPricingRegion) !== region) {
    violations.push({ code: "PRICING_REGION_COHERENT", message: `Région tarifaire stockée « ${input.storedPricingRegion} » incohérente avec ${profile.countryCode} (attendu ${region}).` });
  }
  if (input.storedAmountMinor != null && Number(input.storedAmountMinor) !== canonAmountMinor) {
    violations.push({ code: "COUNTRY_PRICE_COHERENT", message: `Montant stocké « ${input.storedAmountMinor} » incohérent avec ${profile.countryCode} (attendu ${canonAmountMinor}).` });
  }

  // subdivision context present when a subdivision-dependent rule is being resolved
  const sub = resolveSubdivisionRequirement(profile, input.canton, !!input.forRuleThatDependsOnSubdivision);
  if (sub.status === "required") {
    violations.push({ code: "SUBDIVISION_CONTEXT_PRESENT", message: sub.reason });
  }

  // capability allowed in this country (optional)
  let capabilityStatus: CountryCapabilityStatus | null = null;
  if (input.capabilityKey) {
    capabilityStatus = capabilityStatusForCountry(profile.countryCode, input.capabilityKey);
    if (capabilityStatus.disposition === "OUT_OF_SCOPE" || capabilityStatus.disposition === "DISABLED_UNTIL_VERIFIED") {
      violations.push({ code: "CAPABILITY_ALLOWED_IN_COUNTRY", message: `Capacité « ${input.capabilityKey} » non disponible en ${profile.countryCode} (${capabilityStatus.disposition}).` });
    }
  }

  return { ok: violations.length === 0, violations, profile, capabilityStatus };
}
