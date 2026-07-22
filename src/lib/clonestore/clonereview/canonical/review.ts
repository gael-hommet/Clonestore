// src/lib/clonestore/clonereview/canonical/review.ts
// P19 — CLONEREVIEW: the quality gate before an important output (document, email, summary, call script,
// sensitive reply, mission result). It answers "is this good enough to present or use?" — a DIFFERENT question
// from CloneGuard ("is it allowed?"). A text can be allowed by Guard yet fail Review (low quality), and can be
// high quality yet blocked by Guard. Review never replaces Guard or a legal validation. Pure, deterministic.

export type ReviewStatus = "pass" | "revise" | "human_review_required" | "block";
export type ReviewSeverity = "low" | "medium" | "high";
export type ReviewIssue = { readonly code: string; readonly severity: ReviewSeverity; readonly message: string };

export type ReviewInput = {
  readonly kind: "document" | "email" | "summary" | "call_script" | "sensitive_reply" | "mission_result";
  readonly text: string;
  readonly requiredMentions?: readonly string[];   // must appear (e.g. company name, recipient)
  readonly forbiddenClaims?: readonly string[];     // must NOT appear (e.g. "signé", "envoyé" on a draft)
  readonly minLength?: number;
};

export type ReviewResult = {
  readonly version: "cr-1";
  readonly score: number;                 // 0..100
  readonly status: ReviewStatus;
  readonly issues: readonly ReviewIssue[];
  readonly explain: string;
};

const SEV_WEIGHT: Record<ReviewSeverity, number> = { low: 8, medium: 20, high: 45 };

export function reviewOutput(input: ReviewInput): ReviewResult {
  const issues: ReviewIssue[] = [];
  const text = (input.text ?? "").trim();
  const minLen = input.minLength ?? (input.kind === "summary" ? 20 : 40);

  if (text.length === 0) {
    return { version: "cr-1", score: 0, status: "block", issues: [{ code: "empty", severity: "high", message: "Sortie vide." }], explain: "Contenu vide — blocage." };
  }
  if (text.length < minLen) {
    issues.push({ code: "too_short", severity: "medium", message: `Contenu trop court (${text.length} < ${minLen}).` });
  }
  // Unfilled template placeholders — a common real defect.
  if (/\{\{[^}]+\}\}/.test(text) || /\[[A-ZÉÀ][^\]]{1,30}\]/.test(text)) {
    issues.push({ code: "unfilled_placeholder", severity: "high", message: "Champs de modèle non remplis (placeholders restants)." });
  }
  // Missing required mentions.
  const lower = text.toLowerCase();
  for (const m of input.requiredMentions ?? []) {
    if (m && !lower.includes(m.toLowerCase())) issues.push({ code: "missing_mention", severity: "medium", message: `Mention requise absente : « ${m} ».` });
  }
  // Forbidden claims (e.g. presenting a draft as sent/signed).
  for (const f of input.forbiddenClaims ?? []) {
    if (f && lower.includes(f.toLowerCase())) issues.push({ code: "forbidden_claim", severity: "high", message: `Affirmation interdite présente : « ${f} ».` });
  }
  // Naive contradiction signal (both an affirmation and its negation of availability).
  if (/\bdisponible\b/.test(lower) && /\bindisponible\b/.test(lower)) {
    issues.push({ code: "contradiction", severity: "medium", message: "Contradiction potentielle (disponible/indisponible)." });
  }

  const penalty = issues.reduce((s, i) => s + SEV_WEIGHT[i.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const hasHigh = issues.some((i) => i.severity === "high");
  const hasMedium = issues.some((i) => i.severity === "medium");

  // A high issue blocks (or escalates for sensitive kinds). ANY medium issue, or a low score, forbids "pass".
  let status: ReviewStatus;
  if (hasHigh) status = input.kind === "sensitive_reply" || input.kind === "call_script" ? "human_review_required" : "block";
  else if (hasMedium || score < 80) status = "revise";
  else status = "pass";

  return {
    version: "cr-1", score, status, issues,
    explain: status === "pass" ? "Qualité suffisante." : `Statut ${status} — ${issues.length} problème(s), score ${score}.`,
  };
}
