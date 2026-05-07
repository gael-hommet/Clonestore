import {
  PIERRE_BLOCKED_SCOPE_KEYWORDS,
  PIERRE_VALIDATION_KEYWORDS,
} from "./constants";
import type { PierreCompanyMemoryLike, PierreTone } from "./types";

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pierreTextIncludesAny(text: string, needles: readonly string[]): boolean {
  const normalized = normalize(text);
  return needles.some((needle) => normalized.includes(normalize(needle)));
}

export function pierreNeedsHumanValidation(text: string): boolean {
  return pierreTextIncludesAny(text, PIERRE_VALIDATION_KEYWORDS);
}

export function pierreIsBlockedRequest(text: string): boolean {
  return pierreTextIncludesAny(text, PIERRE_BLOCKED_SCOPE_KEYWORDS);
}

export function pierreResolvePreferredTone(
  companyMemory?: PierreCompanyMemoryLike | null
): PierreTone {
  const tone = String(companyMemory?.tone ?? "").toLowerCase().trim();

  switch (tone) {
    case "professional":
    case "neutral":
    case "human":
    case "warm":
    case "direct":
    case "firm":
    case "formal":
      return tone;
    default:
      return "professional";
  }
}