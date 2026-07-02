// src/lib/pierre/v1/hr-canon/country-packs/source-contract.ts
// PHASE 8.10 — the enforcement layer for "never invent law". It provides the ONLY sanctioned way
// to author a country rule (defaults to SOURCE_REQUIRED with a null value) and a validator that
// rejects any rule claiming to be sourced/verified without a real citation (and a reviewer for
// VERIFIED). A rule with a non-null value MUST be at least SOURCED_UNVERIFIED with a citation.

import type { CountryRule, RequiredSourceType, RuleVerificationStatus } from "./types";

/** Author a rule that is explicitly NOT YET sourced — the safe default for P8.10 scaffolding. */
export function sourceRequired(key: string, label: string, requiredSourceTypes: RequiredSourceType[], notes?: string): CountryRule {
  return { key, label, status: "SOURCE_REQUIRED", requiredSourceTypes, value: null, notes };
}

/** Author a rule that has a candidate but needs qualified legal review before any reliance. */
export function legalReviewRequired(key: string, label: string, requiredSourceTypes: RequiredSourceType[], candidate: CountryRule["value"], sourceCitation: string, notes?: string): CountryRule {
  return { key, label, status: "LEGAL_REVIEW_REQUIRED", requiredSourceTypes, value: candidate, sourceCitation, notes };
}

const STATUSES: readonly RuleVerificationStatus[] = ["SOURCE_REQUIRED", "LEGAL_REVIEW_REQUIRED", "SOURCED_UNVERIFIED", "VERIFIED"];

/** Validate a rule's source contract. Returns error strings (empty = ok). */
export function validateRuleSource(rule: CountryRule): string[] {
  const e: string[] = [];
  if (!STATUSES.includes(rule.status)) e.push(`${rule.key}: bad status '${rule.status}'`);
  if (rule.requiredSourceTypes.length === 0) e.push(`${rule.key}: requiredSourceTypes must be non-empty`);
  if (rule.status === "SOURCE_REQUIRED" && rule.value !== null) e.push(`${rule.key}: SOURCE_REQUIRED must have null value (no invented rule)`);
  if ((rule.status === "SOURCED_UNVERIFIED" || rule.status === "VERIFIED" || rule.status === "LEGAL_REVIEW_REQUIRED") && !rule.sourceCitation)
    e.push(`${rule.key}: status '${rule.status}' requires a sourceCitation`);
  if (rule.status === "VERIFIED" && !rule.reviewedBy) e.push(`${rule.key}: VERIFIED requires reviewedBy`);
  // a non-null value can only exist once at least a citation backs it
  if (rule.value !== null && rule.status === "SOURCE_REQUIRED") e.push(`${rule.key}: non-null value without a source`);
  return e;
}

/** Is this rule safe to rely on operationally? Only VERIFIED rules are. */
export function isRuleReliable(rule: CountryRule): boolean { return rule.status === "VERIFIED"; }
