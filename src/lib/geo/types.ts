// src/lib/geo/types.ts
// P18 — GEO PACKS: the central, typed, versioned country contract. ONE place that binds, per legal
// country, the notions that were previously split across the P10 pricing canon
// (clonestore/pricing/country-pricing.ts) and the P8.10/8.12 HR canon
// (pierre/v1/hr-canon/country-packs). A CountryProfile does NOT duplicate those: pricing amounts are
// re-derived from the pricing canon, and HR legal rules stay in the HR canon behind its fail-closed
// execution gate. This module adds the missing central notions (locale, formats, timezone, phone,
// company-identifier types, subdivisions, terminology, document-template availability, compliance
// warnings, official-source references, version, status, fallback policy) and the server-authoritative
// resolver.
//
// ABSOLUTE INVARIANTS (mirrored from the existing canons — never weakened here):
//   * legal country, pricing region, currency and price are SERVER-authoritative — never taken from the client;
//   * an unknown / unsupported country is FAIL-CLOSED — never a silent fallback to France;
//   * NO HR legal rule value is asserted here (that lives in the HR canon, VERIFIED-gated);
//   * legal country, UI locale, currency and physical location are FOUR DISTINCT notions.

import type { Jurisdiction } from "../pierre/v1/hr-canon/country-packs/types";

/** The four legally-supported launch countries. Identical set to HR-canon Jurisdiction & pricing LaunchCountry. */
export type GeoCountryCode = "FR" | "BE" | "LU" | "CH";

/** Explicit per-country pricing regions (founder decision). 1:1 with country; distinct from the shared
 *  Stripe price key (FR/BE/LU share the EUR Stripe key but are three distinct pricing regions). */
export type PricingRegion = "FR_EUR" | "BE_EUR" | "LU_EUR" | "CH_CHF";

export type GeoCurrency = "EUR" | "CHF";

/** Pack-level maturity. ARCHITECTURE_READY = contract/pricing/formats real & server-authoritative, but
 *  legally-sensitive HR automation stays fail-closed until the HR canon has VERIFIED rules for it. */
export type GeoPackStatus = "ACTIVE" | "ARCHITECTURE_READY" | "DISABLED";

/** How a required subdivision (Swiss canton / Belgian region) participates in rule resolution. */
export type SubdivisionKind = "canton" | "region" | "none";

export type SubdivisionSpec = {
  readonly kind: SubdivisionKind;
  /** ISO 3166-2 prefix for validating subdivision codes, e.g. "CH-" or "BE-". */
  readonly iso3166_2Prefix: string | null;
  /** True when at least one HR rule family in this country can depend on the subdivision (e.g. cantonal
   *  Swiss rules). When true, Pierre must ASK for the subdivision or refuse to assert a canton-dependent
   *  rule — it must never guess. */
  readonly contextRequiredForRules: boolean;
  readonly label: string;
  readonly notes?: string;
};

/** A company identifier TYPE (administrative id format), NOT an HR legal rule. Its `format` is a public
 *  administrative fact sourced from the national business registry (see officialSourceReferences). */
export type CompanyIdentifierType = {
  readonly key: string;            // stable, e.g. "siren", "bce", "rcsl", "ide"
  readonly label: string;
  readonly required: boolean;      // required to fully identify a company in this country
  readonly formatHint: string;     // human-facing example / mask (never a legal assertion)
  readonly pattern?: string;       // optional RegExp source for structural validation
};

export type EmploymentTerminology = {
  readonly employer: string;
  readonly employee: string;
  readonly employmentContract: string;
  readonly amendment: string;         // avenant / Vertragsänderung ...
  readonly trialPeriod: string;
  readonly noticePeriod: string;
  readonly termination: string;
  readonly resignation: string;
  readonly dismissal: string;
};

export type GeoFormats = {
  readonly dateFormat: string;        // e.g. "dd/MM/yyyy"
  readonly timeFormat: string;        // e.g. "HH:mm"
  readonly numberDecimalSeparator: "," | ".";
  readonly numberGroupSeparator: string;   // e.g. " " (nbsp) or "'" for CH
  readonly currencyDisplay: string;   // e.g. "449 €" or "499 CHF" — canonical display for the price
  readonly addressFormat: readonly string[]; // ordered address lines template keys
};

/** Availability of a document template family for this country. NEVER "ready" unless legally reviewed. */
export type DocumentTemplateAvailability =
  | "AVAILABLE_VERIFIED"          // legally reviewed for this country — safe to finalize
  | "DRAFT_ONLY"                  // a clearly-marked draft may be produced; no legal finalization
  | "HUMAN_VALIDATION_REQUIRED"  // may be prepared but a human must validate before use
  | "DISABLED_UNTIL_VERIFIED";   // no generation until a sourced+reviewed template exists

export type DocumentTemplateRef = {
  readonly key: string;               // e.g. "employment_contract", "amendment", "exit_certificate"
  readonly label: string;
  readonly availability: DocumentTemplateAvailability;
  readonly notes?: string;
};

/** A pointer to an official source that backs a structural/administrative fact in this profile.
 *  Legal HR rules are sourced separately in the HR canon; these back identifier formats, currency,
 *  timezone, locales, subdivisions — the administrative scaffolding. */
export type OfficialSourceReference = {
  readonly topic: string;
  readonly authority: string;         // official body (INSEE, BCE/KBO, RCSL, OFS/IDE, IANA, ISO...)
  readonly title: string;
  readonly url: string;
  readonly consultedOn: string;       // ISO date
  readonly certainty: "OFFICIAL_FACT" | "OFFICIAL_ADMINISTRATIVE" | "STANDARD_REFERENCE";
};

/** The central country profile: everything the server needs to treat a legal entity consistently. */
export type CountryProfile = {
  readonly countryCode: GeoCountryCode;
  readonly legalJurisdiction: Jurisdiction;   // === countryCode, but conceptually the LAW that applies
  readonly displayName: string;
  readonly pricingRegion: PricingRegion;
  readonly currency: GeoCurrency;
  /** price fields are DERIVED from the pricing canon at build time (see country-profiles.ts) — the
   *  pricing canon (P10) remains the single source of price truth. */
  readonly priceAmount: number;        // 449 | 499 (major unit)
  readonly priceAmountMinor: number;   // 44900 | 49900 (cents / rappen)
  readonly priceDisplay: string;       // "449 € / mois" | "499 CHF / mois"
  readonly billingInterval: "month";

  readonly defaultLocale: string;             // e.g. "fr-FR", "fr-BE", "fr-LU", "fr-CH"
  readonly supportedLocales: readonly string[];
  /** locales whose translations are NOT yet delivered in this block — declared, never silently missing. */
  readonly plannedLocales: readonly string[];
  readonly timezone: string;                  // IANA tz, e.g. "Europe/Paris"
  readonly phoneCountryCode: string;          // "+33" ...
  readonly taxRegion: string;                 // e.g. "FR-EU-VAT", "CH-VAT" (label; not a tax computation)
  readonly formats: GeoFormats;

  readonly companyIdentifierTypes: readonly CompanyIdentifierType[];
  readonly requiredCompanyFields: readonly string[];
  readonly optionalCompanyFields: readonly string[];
  readonly subdivision: SubdivisionSpec;
  readonly employmentTerminology: EmploymentTerminology;

  readonly documentTemplates: readonly DocumentTemplateRef[];
  readonly complianceWarnings: readonly string[];
  readonly officialSourceReferences: readonly OfficialSourceReference[];

  readonly version: number;
  readonly effectiveFrom: string;             // ISO date this profile version is effective from
  readonly status: GeoPackStatus;
  /** what to do when this country is requested but not resolvable — always fail-closed, never FR. */
  readonly fallbackPolicy: "FAIL_CLOSED_REQUIRE_SELECTION";
};

// ── Server resolution results (discriminated unions — fail-closed by construction) ──────────────

export type GeoResolution =
  | { readonly status: "ok"; readonly profile: CountryProfile }
  | { readonly status: "country_required" }                              // no legal country → selection required
  | { readonly status: "unsupported"; readonly country: string };        // known country, outside launch scope

export type SubdivisionRequirement =
  | { readonly status: "not_required" }
  | { readonly status: "satisfied"; readonly code: string }
  | { readonly status: "required"; readonly kind: SubdivisionKind; readonly reason: string };

/** The pieces the server derives for a company. Currency/price/pricingRegion here are AUTHORITATIVE. */
export type ResolvedGeoContext = {
  readonly profile: CountryProfile;
  readonly pricingRegion: PricingRegion;
  readonly currency: GeoCurrency;
  readonly priceAmountMinor: number;
  readonly subdivision: SubdivisionRequirement;
};
