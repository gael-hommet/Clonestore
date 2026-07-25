// src/lib/pierre/v1/cognitive-runtime/amount-resolution.ts
// PHASE 8.14 — deterministic, FAIL-CLOSED money parsing (owner §7). Compensation is legally + financially
// sensitive, so this refuses anything ambiguous rather than guess. Handles FR/EU and dot conventions:
//   "2500" "2 500" "2500,50" "2500.50" "2.500,50" "€2500" "2500 EUR" "2 500,00 €" "CHF 4200".
// Returns integer cents to avoid float drift. Ambiguous separator patterns → status "ambiguous", null.

import type { ResolvedAmountReference } from "./types";

function currencyOf(t: string): "EUR" | "CHF" | null {
  if (/€|\beur(os?)?\b/i.test(t)) return "EUR";
  if (/\bchf\b|\bfr\b(?!\w)|francs?\s+suisses?/i.test(t)) return "CHF";
  return null;
}

/** Parse a single amount expression. Pure, fail-closed. Default currency EUR when a number is clear but
 *  no symbol is present (the product is FR-first); callers may override by requiring an explicit symbol. */
export function resolveAmount(original: string, opts?: { requireCurrency?: boolean }): ResolvedAmountReference {
  const raw = (original ?? "").trim();
  const fail = (status: "ambiguous" | "not_found" | "unresolved", reason: string): ResolvedAmountReference =>
    ({ status, original: raw, amountCents: null, currency: null, reason });
  if (!raw) return fail("not_found", "empty");

  const currency = currencyOf(raw);
  if (opts?.requireCurrency && !currency) return fail("unresolved", "currency_required");

  // Extract the numeric token (digits, spaces, dots, commas). Reject if none.
  const numMatch = raw.match(/(\d[\d\s.,]*\d|\d)/);
  if (!numMatch) return fail("not_found", "no_number");
  const tok = numMatch[1].replace(/\s/g, ""); // group separators as spaces are safe to drop

  const hasDot = tok.includes(".");
  const hasComma = tok.includes(",");
  let normalized: string;

  if (hasDot && hasComma) {
    // The LAST separator is the decimal one (EU: "2.500,50"; US: "2,500.50").
    const lastDot = tok.lastIndexOf(".");
    const lastComma = tok.lastIndexOf(",");
    const decSep = lastDot > lastComma ? "." : ",";
    const grpSep = decSep === "." ? "," : ".";
    normalized = tok.split(grpSep).join("").replace(decSep, ".");
  } else if (hasComma) {
    // Only commas. "2500,50" → decimal. "2,500" is ambiguous (could be 2500 or 2.5) → fail-closed
    // UNLESS it clearly has exactly 2 decimals or is a thousands grouping "2,500,000".
    const parts = tok.split(",");
    if (parts.length === 2 && parts[1].length === 2) normalized = `${parts[0]}.${parts[1]}`;      // decimal comma
    else if (parts.every((p, i) => (i === 0 ? p.length >= 1 && p.length <= 3 : p.length === 3))) normalized = parts.join(""); // thousands
    else return fail("ambiguous", "comma_ambiguous");
  } else if (hasDot) {
    const parts = tok.split(".");
    if (parts.length === 2 && parts[1].length === 2) normalized = `${parts[0]}.${parts[1]}`;       // decimal dot
    else if (parts.every((p, i) => (i === 0 ? p.length >= 1 && p.length <= 3 : p.length === 3))) normalized = parts.join(""); // thousands
    else return fail("ambiguous", "dot_ambiguous");
  } else {
    normalized = tok; // pure integer
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return fail("unresolved", "not_finite");
  const amountCents = Math.round(value * 100);
  return { status: "resolved", original: raw, amountCents, currency: currency ?? "EUR", reason: currency ? "explicit_currency" : "default_eur" };
}
