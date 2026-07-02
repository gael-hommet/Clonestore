// src/lib/pierre/v1/hr-canon/country-packs/types.ts
// PHASE 8.10 — country-pack type system. A country pack declares, per jurisdiction, the HR rule
// families that GOVERN capabilities in that country. CRITICAL INVARIANT: no legal rule value is
// invented from a model's memory. Every rule carries a verification status; anything not sourced
// from an authoritative reference stays SOURCE_REQUIRED / LEGAL_REVIEW_REQUIRED. P8.12 fills the
// values from verified sources; P8.10 only builds the architecture + honest scaffolding.

export type Jurisdiction = "FR" | "BE" | "LU" | "CH";
export type SubRegion = string; // e.g. a Swiss canton "CH-VD"; optional refinement

// The trust status of a rule value — the heart of the "never invent law" guarantee.
export type RuleVerificationStatus =
  | "SOURCE_REQUIRED"        // value not yet sourced — MUST NOT be relied on
  | "LEGAL_REVIEW_REQUIRED"  // a candidate exists but needs qualified legal review before use
  | "SOURCED_UNVERIFIED"     // sourced but not yet legally reviewed/confirmed
  | "VERIFIED";              // sourced + legally reviewed (only ever set with a real citation)

export type RequiredSourceType =
  | "primary_legislation"    // labour code / statute
  | "secondary_legislation"  // decree / regulation
  | "collective_agreement"   // sector / company CBA
  | "official_guidance"      // ministry / administration guidance
  | "case_law"
  | "provider_spec";         // e.g. payroll/social-security provider spec

// A single governed rule within a family.
export type CountryRule = {
  key: string;                 // stable within the family, e.g. "annual_paid_leave_days"
  label: string;
  status: RuleVerificationStatus;
  requiredSourceTypes: RequiredSourceType[];
  // value stays null until sourced+verified; typed loosely because rule shapes vary by family.
  value: string | number | boolean | Record<string, unknown> | null;
  sourceCitation?: string;     // set ONLY when SOURCED_* / VERIFIED, with a real reference
  reviewedBy?: string;         // set ONLY when VERIFIED
  notes?: string;
};

export type CountryRuleFamilyInstance = {
  family: string;              // must match a key in rule-families.ts
  rules: CountryRule[];
  notes?: string;
};

export type CountryPack = {
  jurisdiction: Jurisdiction;
  name: string;
  currency: string;
  language: string;
  version: number;
  status: "SCAFFOLD" | "PARTIAL" | "REVIEWED"; // pack-level maturity
  families: CountryRuleFamilyInstance[];
  disclaimer: string;
};

// Result of resolving which pack + precedence applies to a given HR context.
export type JurisdictionContext = {
  jurisdiction: Jurisdiction | null;
  subRegion?: SubRegion;
  collectiveAgreement?: string | null;
};
