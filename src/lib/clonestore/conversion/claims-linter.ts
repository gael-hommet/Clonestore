// BLOC 3 — Linter pur de claims sur surfaces marketing.
//
// Détecte les formulations interdites tant qu'une preuve produit n'est pas validée.
// Pas de promesse "deux minutes", pas de ROI inventé, pas de fake certification,
// pas de "garantie", pas de "100% automatique", pas de claim pending présentée
// comme vérité, pas de témoignage / faux logo / faux client.

import { CLAIMS_REGISTRY } from "./claims-registry";
import type { Surface } from "./claims-registry";

// Motifs interdits sur TOUTES les surfaces activables (regex insensibles à la casse).
const FORBIDDEN_GENERIC: readonly { pattern: RegExp; code: string; message: string }[] = [
  {
    pattern: /\b(en|sous)\s*(une|1|2|deux|3|trois|cinq|5|dix|10)\s*minute/i,
    code: "FAKE_DURATION_PROMISE",
    message: "Promesse temporelle non prouvée par un benchmark conservé.",
  },
  {
    pattern: /\bgarantie?\b/i,
    code: "FAKE_GUARANTEE",
    message: "Aucune garantie autorisée sans pièce contractuelle vérifiée.",
  },
  {
    pattern: /\b100\s*%?\s*automatique\b/i,
    code: "FAKE_FULL_AUTOMATION",
    message: "Pierre n'est pas 100% automatique : validation humaine obligatoire.",
  },
  {
    pattern: /\b(\d{1,3}(?:[,.]\d+)?)\s*%\s+(?:de\s+)?(?:productiv|gain|économ|économie)/i,
    code: "FAKE_ROI",
    message: "ROI chiffré sans modèle justifié et hypothèses visibles.",
  },
  {
    pattern: /\b(?:certifié|ISO\s*\d{3,5}|RGPD\s+certifié|HDS\b)/i,
    code: "FAKE_CERTIFICATION",
    message: "Certification déclarée sans preuve dans le contrat — interdit.",
  },
  {
    pattern: /\b(?:nos|de)\s+clients?\s+(?:disent|nous\s+disent|témoignent)/i,
    code: "FAKE_TESTIMONIAL_LEADIN",
    message: "Témoignage client invoqué sans pièce vérifiable — interdit.",
  },
  {
    pattern: /\b(?:offre|prix)\s+limit[ée]e?\b/i,
    code: "FAKE_SCARCITY",
    message: "Faux badge d'urgence — interdit.",
  },
  {
    pattern: /\bavocat\s+intégré\b/i,
    code: "FAKE_LEGAL_CAPABILITY",
    message: "Pierre n'est pas avocat — claim interdite.",
  },
  {
    pattern: /\bsignature\s+(?:juridiquement|légalement)\s+contraignante\b/i,
    code: "FAKE_BINDING_SIGNATURE",
    message: "Pierre ne signe pas de document contractuel.",
  },
];

// Tarif autorisé : 449 € HT/mois. Un autre tarif marketing visible est un drift.
const PRICE_PATTERN = /\b(\d{2,4})\s*€\s*(HT\s*)?\/?\s*mois\b/i;

export interface LintIssue {
  surface: Surface;
  code: string;
  message: string;
  excerpt: string;
}

export interface LintReport {
  ok: boolean;
  issues: readonly LintIssue[];
}

export interface LintInput {
  surface: Surface;
  /** Texte combiné de la surface (titres, sous-titres, FAQ, CTA, etc.). */
  text: string;
  /** Liste des claim ids effectivement référencées par la surface (pour audit pending). */
  referencedClaimIds?: readonly string[];
}

export function lintSurfaceCopy(input: LintInput): LintReport {
  const issues: LintIssue[] = [];
  const text = input.text ?? "";
  for (const rule of FORBIDDEN_GENERIC) {
    const match = text.match(rule.pattern);
    if (match) {
      issues.push({
        surface: input.surface,
        code: rule.code,
        message: rule.message,
        excerpt: excerpt(text, match.index ?? 0),
      });
    }
  }
  // Cohérence prix : si un montant /mois apparaît, il doit être 449 €.
  let priceMatch: RegExpExecArray | null;
  const priceRe = new RegExp(PRICE_PATTERN, "gi");
  while ((priceMatch = priceRe.exec(text)) !== null) {
    const cents = Number(priceMatch[1]);
    if (Number.isFinite(cents) && cents !== 449) {
      issues.push({
        surface: input.surface,
        code: "PRICE_DRIFT",
        message: `Tarif marketing divergent du contrat (${cents} € au lieu de 449 €).`,
        excerpt: excerpt(text, priceMatch.index),
      });
    }
  }
  // Claims pending référencées sur surface activable.
  for (const claimId of input.referencedClaimIds ?? []) {
    const claim = (CLAIMS_REGISTRY as Record<string, { status: string; allowedSurfaces: readonly Surface[] }>)[claimId];
    if (!claim) {
      issues.push({
        surface: input.surface,
        code: "CLAIM_UNKNOWN",
        message: `Claim référencée mais inconnue: ${claimId}`,
        excerpt: claimId,
      });
      continue;
    }
    if (!claim.allowedSurfaces.includes(input.surface)) {
      issues.push({
        surface: input.surface,
        code: "CLAIM_NOT_ALLOWED_ON_SURFACE",
        message: `Claim ${claimId} non autorisée sur la surface ${input.surface}.`,
        excerpt: claimId,
      });
    }
    if (claim.status === "PROHIBITED_ON_SURFACE") {
      issues.push({
        surface: input.surface,
        code: "CLAIM_PROHIBITED",
        message: `Claim ${claimId} interdite sur les surfaces marketing.`,
        excerpt: claimId,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
