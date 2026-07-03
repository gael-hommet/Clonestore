// src/lib/pierre/v1/cognitive-runtime/learning-policy.ts
// PHASE 8.14 — safe learning from corrections (owner §16). Classifies a human correction into its scope
// and enforces the invariant: a correction NEVER silently becomes global law, and NOTHING learned for one
// company leaks to another. Pure + testable. Company-scoped preferences persist via operational memory /
// company config; canonical HR knowledge and official legal rules are NEVER mutated by a correction.

export type CorrectionScope =
  | "temporary_instruction"   // applies to this one operation only
  | "company_preference"      // reusable for THIS company (needs later governance to become policy)
  | "company_policy"          // approved company policy (explicit approval required to reach this)
  | "canonical_knowledge"     // NEVER writable from a correction
  | "legal_rule";             // NEVER writable from a correction

export type CorrectionInput = {
  readonly companyId: string;
  readonly text: string;
  readonly approvedByRole?: string | null;    // who approved it (governs promotion)
  readonly recurrenceCount?: number;          // how many times seen (a one-off is temporary)
};

export type CorrectionClassification = {
  readonly scope: CorrectionScope;
  readonly companyScoped: true;               // always company-scoped — no cross-tenant learning
  readonly promotableToPolicy: boolean;
  readonly writable: boolean;                 // may we persist it at all?
  readonly reason: string;
};

const LEGAL_HINT = /\b(loi|l[ée]gal|code du travail|convention collective|r[èe]glement|statut l[ée]gal)\b/i;

export function classifyCorrection(input: CorrectionInput): CorrectionClassification {
  const base = { companyScoped: true as const };
  // A correction can NEVER redefine canonical HR knowledge or legal rules.
  if (LEGAL_HINT.test(input.text)) {
    return { ...base, scope: "legal_rule", promotableToPolicy: false, writable: false, reason: "legal content is never learned from a correction (source-of-truth is the country-rule system)" };
  }
  const recurrence = input.recurrenceCount ?? 1;
  // Explicitly approved by a manager/admin + recurring → eligible to be a company policy.
  if (input.approvedByRole && /admin|owner|hr_manager/.test(input.approvedByRole) && recurrence >= 2) {
    return { ...base, scope: "company_policy", promotableToPolicy: false, writable: true, reason: "approved + recurring → company policy" };
  }
  // Recurring but not yet formally approved → a company preference (reusable, needs governance to promote).
  if (recurrence >= 2) {
    return { ...base, scope: "company_preference", promotableToPolicy: true, writable: true, reason: "recurring → company preference (promotion requires approval)" };
  }
  // One-off → temporary instruction, applies to this operation only.
  return { ...base, scope: "temporary_instruction", promotableToPolicy: false, writable: true, reason: "one-off → temporary" };
}

/** Neutralize a correction for reuse: strip any tenant identifiers so a stored preference cannot leak
 *  another company's data. (Company scoping is by the store key; this scrubs the free text.) */
export function neutralizeCorrection(text: string): string {
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>") // uuids
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "<email>")                                     // emails
    .trim();
}
