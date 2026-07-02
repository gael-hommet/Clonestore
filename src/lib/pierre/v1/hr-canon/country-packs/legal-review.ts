// src/lib/pierre/v1/hr-canon/country-packs/legal-review.ts
// PHASE 8.12 — the legal-review contract. THE hard gate on "never invent law": a candidate rule can
// only become VERIFIED via an attestation by a NAMED, QUALIFIED HUMAN reviewer. An AI / model /
// automated actor can NEVER be the reviewer — attempts are rejected. This file produces the review
// PACKET a human needs and validates attestations; it can raise a rule to VERIFIED only with a valid
// human attestation. No attestation exists in this environment → nothing becomes VERIFIED.

import type { CountryRule } from "./types";
import type { HrOfficialLegalSource } from "./source-registry";

// Reviewers Pierre/Claude must refuse to accept as legal reviewers.
const FORBIDDEN_REVIEWER_PATTERNS = [/\bclaude\b/i, /\bgpt\b/i, /\bllm\b/i, /\bai\b/i, /\bmodel\b/i, /\bpierre\b/i, /\bbot\b/i, /\bautomat/i, /\bsystem\b/i];

export type ReviewPacket = {
  ruleKey: string;
  jurisdiction: string;
  ruleFamily: string;
  candidateValue: CountryRule["value"];
  officialSources: { id: string; authority: string; officialUrl: string; retrievalStatus: string }[];
  requiredSourceTypes: string[];
  question: string;               // what the human must confirm
  status: "AWAITING_SOURCING" | "AWAITING_HUMAN_REVIEW";
};

export type HumanAttestation = {
  reviewerName: string;
  reviewerQualification: string;  // e.g. "avocat en droit social, Barreau de Paris"
  reviewerContact: string;
  attestedAt: string;             // ISO
  statement: string;
  signatureRef: string;           // a real signed artifact reference
};

/** Build the review packet a qualified human needs to review a candidate rule. */
export function buildReviewPacket(rule: CountryRule, jurisdiction: string, ruleFamily: string, sources: HrOfficialLegalSource[]): ReviewPacket {
  const anyRetrieved = sources.some((s) => s.retrievalStatus !== "POINTER_ONLY");
  return {
    ruleKey: rule.key, jurisdiction, ruleFamily, candidateValue: rule.value,
    officialSources: sources.map((s) => ({ id: s.id, authority: s.authority, officialUrl: s.officialUrl, retrievalStatus: s.retrievalStatus })),
    requiredSourceTypes: rule.requiredSourceTypes,
    question: `Confirm the ${ruleFamily} rule value for ${jurisdiction} against the official sources, or provide the correct value + citation.`,
    status: anyRetrieved ? "AWAITING_HUMAN_REVIEW" : "AWAITING_SOURCING",
  };
}

export function isValidHumanReviewer(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  return !FORBIDDEN_REVIEWER_PATTERNS.some((re) => re.test(name));
}

export type AttestationCheck = { ok: boolean; errors: string[] };
export function validateAttestation(a: HumanAttestation): AttestationCheck {
  const errors: string[] = [];
  if (!isValidHumanReviewer(a.reviewerName)) errors.push("reviewer must be a named human (an AI/model/system can never be the legal reviewer)");
  if (!a.reviewerQualification || a.reviewerQualification.trim().length < 3) errors.push("reviewerQualification required");
  if (!a.attestedAt || Number.isNaN(Date.parse(a.attestedAt))) errors.push("attestedAt must be an ISO instant");
  if (!a.signatureRef) errors.push("signatureRef (a real signed artifact) required");
  return { ok: errors.length === 0, errors };
}

/** Attempt to raise a rule to VERIFIED. ONLY succeeds with a valid HUMAN attestation + a citation +
 *  a non-null value. Returns the (possibly unchanged) rule + whether it was verified. */
export function verifyRuleWithAttestation(rule: CountryRule, citation: string, value: CountryRule["value"], attestation: HumanAttestation): { rule: CountryRule; verified: boolean; errors: string[] } {
  const check = validateAttestation(attestation);
  const errors = [...check.errors];
  if (value === null || value === undefined) errors.push("a VERIFIED rule must carry a non-null value");
  if (!citation) errors.push("a VERIFIED rule must carry a sourceCitation");
  if (errors.length > 0) return { rule, verified: false, errors };
  return { rule: { ...rule, status: "VERIFIED", value, sourceCitation: citation, reviewedBy: `${attestation.reviewerName} (${attestation.reviewerQualification})` }, verified: true, errors: [] };
}
