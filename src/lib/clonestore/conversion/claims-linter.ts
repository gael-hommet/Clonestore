// BLOC 3 — Claim linter conforme `services/conversion/claims.py:lint_content`.
//
// Refus de motifs interdits (testimonial/logo/certif/ROI/etc.) et de prix
// divergent. Deux modes :
//   mode='shadow'           : autorise les claims pending (previews internes)
//   mode='real_activation'  : refuse toute claim non REAL_ACTIVATABLE (fail closed)

import {
  CLAIM_IDS,
  ClaimId,
  PIERRE_PRICE_EUR,
} from "./contract";
import { isActivatable, isShadowAllowed } from "./claims-registry";

export type LintMode = "shadow" | "real_activation";

interface ForbiddenPattern {
  code: string;
  pattern: RegExp;
}

// Cf. claims.py:_FORBIDDEN_PATTERNS (réimplémentation 1:1).
const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  { code: "fake_testimonial", pattern: /«[^»]{0,120}»\s*[—-]\s*\w+|"[^"]{0,120}"\s*[—-]\s*(DRH|CEO|client)/gi },
  {
    code: "fake_customer_logo",
    pattern:
      /(ils nous font confiance|nos clients|déjà adopté par|trusted by|rejoint par|utilisé par .* entreprises)/gi,
  },
  { code: "fake_user_count", pattern: /\b(\d[\d\s.,]{2,})\s*(clients|entreprises|utilisateurs|DRH)\b/gi },
  { code: "fake_certification", pattern: /\b(certifié|certification|ISO\s?\d+|SOC\s?2|agréé)\b/gi },
  {
    code: "guaranteed_roi",
    pattern:
      /(ROI garanti|garantie de résultat|économisez\s+\d|gagnez\s+\d+\s*(h|heures|%)|\d+\s*%\s*(de\s+)?(gain|économie|temps|productivité))/gi,
  },
  {
    code: "dept_replacement_guarantee",
    pattern: /(remplace(z)?\s+(votre|le)\s+département|supprime(z)?\s+votre\s+équipe RH)/gi,
  },
  {
    code: "fully_autonomous",
    pattern: /(100\s*%\s*autonome|totalement autonome|sans aucune intervention|aucune supervision)/gi,
  },
  { code: "zero_error", pattern: /(z[ée]ro erreur|sans erreur|jamais d'erreur|infaillible)/gi },
  { code: "rgpd_final_legal", pattern: /(100\s*%\s*conforme RGPD|conformité RGPD garantie|validé juridiquement)/gi },
  {
    code: "artificial_urgency",
    pattern: /(offre limitée|plus que \d+ places|derniers jours|expire dans|dépêchez|seulement aujourd'hui)/gi,
  },
  {
    code: "invented_discount",
    pattern: /(-\s?\d+\s*%|remise|réduction|promo|gratuit pendant|essai gratuit|7 jours)/gi,
  },
];

const PRICE_RE = /(?<!\d)(\d{2,4})\s*(?:€|eur)\s*(?:\/?\s*mois|\/?\s*mo)\b/gi;

export interface LintInput {
  surface?: string;
  text: string;
  claimIds?: readonly string[];
  mode?: LintMode;
}

/** Retourne une liste de codes de violations ([] = clean). */
export function lintContent(input: LintInput): string[] {
  const issues: string[] = [];
  const text = input.text ?? "";
  const mode = input.mode ?? "shadow";

  for (const { code, pattern } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0; // reset les regex /g
    if (pattern.test(text)) issues.push(code);
  }

  PRICE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRICE_RE.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n !== PIERRE_PRICE_EUR) {
      issues.push(`wrong_price:${m[1]}`);
    }
  }

  for (const cid of input.claimIds ?? []) {
    if (!(CLAIM_IDS as readonly string[]).includes(cid)) {
      issues.push(`unknown_claim:${cid}`);
      continue;
    }
    const permitted = mode === "shadow" ? isShadowAllowed : isActivatable;
    if (!permitted(cid as ClaimId)) {
      const label = mode === "real_activation" ? "non_activatable_claim" : "non_shadow_claim";
      issues.push(`${label}:${cid}`);
    }
  }
  return issues;
}

export type LintReport = {
  ok: boolean;
  issues: readonly string[];
};

/** Helper wrapper qui renvoie un rapport. */
export function lintReport(input: LintInput): LintReport {
  const issues = lintContent(input);
  return { ok: issues.length === 0, issues };
}
