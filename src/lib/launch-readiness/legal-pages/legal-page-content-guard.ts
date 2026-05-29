// P-FINAL 01 — Phase 2 — Content guard: checks for forbidden claims and required disclaimers.
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalPageId, LegalPageCheck } from "./types";
import { getLegalPageDefinition } from "./legal-page-registry";

export interface ContentGuardResult {
  page_id: LegalPageId;
  forbidden_found: string[];
  required_missing: string[];
  passes: boolean;
  checks: LegalPageCheck[];
}

export function runContentGuard(
  page_id: LegalPageId,
  content: string
): ContentGuardResult {
  const def = getLegalPageDefinition(page_id);
  const normalizedContent = content.toLowerCase();

  const forbidden_found: string[] = [];
  const required_missing: string[] = [];
  const checks: LegalPageCheck[] = [];

  // Check for forbidden claims
  for (const forbidden of def.forbidden_claims) {
    const found = normalizedContent.includes(forbidden.toLowerCase());
    if (found) {
      forbidden_found.push(forbidden);
    }
    checks.push({
      id: `content_guard_forbidden_${forbidden.replace(/\s+/g, "_").slice(0, 40)}`,
      page_id,
      label: `Claim interdit absent : "${forbidden}"`,
      description: `Le contenu de la page ne doit pas contenir la formule "${forbidden}"`,
      severity: "blocking",
      passes: !found,
      is_manual: false,
      detail: found ? `Formule interdite détectée dans le contenu` : undefined,
    });
  }

  // Check for required disclaimers
  for (const disclaimer of def.required_disclaimers) {
    const present = normalizedContent.includes(disclaimer.toLowerCase());
    if (!present) {
      required_missing.push(disclaimer);
    }
    checks.push({
      id: `content_guard_disclaimer_${disclaimer.replace(/\s+/g, "_").slice(0, 40)}`,
      page_id,
      label: `Disclaimer requis présent : "${disclaimer}"`,
      description: `Le contenu de la page doit contenir la mention "${disclaimer}"`,
      severity: "warning",
      passes: present,
      is_manual: false,
      detail: !present ? `Mention requise non trouvée dans le contenu` : undefined,
    });
  }

  const passes = forbidden_found.length === 0;

  return {
    page_id,
    forbidden_found,
    required_missing,
    passes,
    checks,
  };
}

export function hasForbiddenClaims(page_id: LegalPageId, content: string): boolean {
  return runContentGuard(page_id, content).forbidden_found.length > 0;
}

export function hasRequiredDisclaimers(page_id: LegalPageId, content: string): boolean {
  return runContentGuard(page_id, content).required_missing.length === 0;
}

// Checks specific to Pierre's hard limits — used across all legal pages
export const PIERRE_HARD_LIMIT_FORBIDDEN = [
  "Pierre garantit la conformité",
  "Pierre remplace un avocat",
  "Pierre est un logiciel de paie",
  "Pierre prend des décisions de licenciement de façon autonome",
  "zéro erreur garantie",
  "résultats garantis",
  "Pierre est juriste",
  "Pierre est expert-comptable",
] as const;

export const PIERRE_HARD_LIMIT_REQUIRED = [
  "validation humaine",
] as const;

export function checkPierreHardLimitsInContent(content: string): {
  violations: string[];
  passes: boolean;
} {
  const normalized = content.toLowerCase();
  const violations = PIERRE_HARD_LIMIT_FORBIDDEN.filter((forbidden) =>
    normalized.includes(forbidden.toLowerCase())
  );
  return {
    violations,
    passes: violations.length === 0,
  };
}
