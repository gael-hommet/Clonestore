// B47 — Marketing Guardrails
// Validates Pierre/CloneStore marketing copy for legal safety.
// Pure: no Supabase, no Next, no async. No throw.

import type { MarketingGuardrailResult } from "./types";
import { findForbiddenPhrases, normalizeForPhraseCheck } from "./forbidden-phrases";

// ── Allowed positioning statements ───────────────────────────────────────────

const PIERRE_ALLOWED_POSITIONING: string[] = [
  "poste RH opérationnel automatisé",
  "employé IA RH",
  "automatise la charge RH opérationnelle",
  "prépare, structure, suit, relance, documente",
  "prépare, structure, suit, relance et documente",
  "gagner du temps et de l'argent",
  "l'humain garde la responsabilité finale",
  "gagne du temps et de l'argent",
  "disponible 24h/24",
  "missions RH opérationnelles",
  "traçabilité et continuité",
  "structuration des missions",
  "documents RH sous validation humaine",
  "meilleur sur vitesse, mémoire, volume, continuité et suivi",
];

const PIERRE_FORBIDDEN_POSITIONING: string[] = [
  "remplace toute l'equipe rh juridiquement",
  "zero erreur",
  "conformite garantie",
  "licenciement automatique",
  "paie officielle autonome",
  "plus besoin de responsable rh dans tous les cas",
  "outil juridique complet",
  "juridiquement autonome",
  "remplace un avocat",
  "supprime tout risque",
];

const CLONESTORE_FORBIDDEN_POSITIONING: string[] = [
  "juridiquement autonome",
  "zero risque",
  "conforme a 100%",
  "sans intervention humaine",
  "aucune supervision requise",
  "decide seul",
  "logiciel de paie officiel",
];

// ── Validator ─────────────────────────────────────────────────────────────────

export function validatePierreMarketingCopy(text: string): MarketingGuardrailResult {
  const normalized = normalizeForPhraseCheck(text);
  const forbidden_phrases_found = findForbiddenPhrases(text);
  const warnings: string[] = [];

  const forbidden_positioning = PIERRE_FORBIDDEN_POSITIONING.filter((p) =>
    normalized.includes(normalizeForPhraseCheck(p)),
  );

  if (forbidden_positioning.length > 0) {
    forbidden_phrases_found.push(...forbidden_positioning);
  }

  // Soft warnings for strong claims without disclaimers
  if (normalized.includes("remplace") && !normalized.includes("responsabilite")) {
    warnings.push("Phrase avec 'remplace' sans mention de responsabilité humaine — ajouter un disclaimer.");
  }
  if (normalized.includes("automatique") && !normalized.includes("validation")) {
    warnings.push("Automatisation sans mention de validation humaine — préciser les cas sensibles.");
  }

  const ok = forbidden_phrases_found.length === 0;
  return {
    ok,
    forbidden_phrases_found: [...new Set(forbidden_phrases_found)],
    warnings,
    safe_rewrite: ok ? null : rewriteMarketingCopySafely(text),
    allowed_positioning: PIERRE_ALLOWED_POSITIONING,
  };
}

export function validateCloneStoreMarketingCopy(text: string): MarketingGuardrailResult {
  const normalized = normalizeForPhraseCheck(text);
  const forbidden_phrases_found = findForbiddenPhrases(text);

  const forbidden_positioning = CLONESTORE_FORBIDDEN_POSITIONING.filter((p) =>
    normalized.includes(normalizeForPhraseCheck(p)),
  );

  if (forbidden_positioning.length > 0) {
    forbidden_phrases_found.push(...forbidden_positioning);
  }

  const ok = forbidden_phrases_found.length === 0;
  return {
    ok,
    forbidden_phrases_found: [...new Set(forbidden_phrases_found)],
    warnings: [],
    safe_rewrite: ok ? null : rewriteMarketingCopySafely(text),
    allowed_positioning: PIERRE_ALLOWED_POSITIONING,
  };
}

export function rewriteMarketingCopySafely(text: string): string {
  return text
    .replace(/garantit\s+la\s+conformit[eé]/gi, "intègre des mécanismes de conformité")
    .replace(/zéro\s+erreur/gi, "contrôles qualité intégrés")
    .replace(/zero\s+erreur/gi, "contrôles qualité intégrés")
    .replace(/licenciement\s+automatique/gi, "préparation de dossier de licenciement, sous validation humaine")
    .replace(/paie\s+officielle\s+autonome/gi, "préparation de pré-paie, à valider par un expert paie")
    .replace(/remplace\s+(un\s+)?avocat/gi, "assiste les équipes RH opérationnellement")
    .replace(/juridiquement\s+autonome/gi, "assisté par l'humain pour les décisions juridiques")
    .replace(/conformité\s+garantie/gi, "intégration de mécanismes de contrôle")
    .replace(/supprime\s+tout\s+risque/gi, "améliore la traçabilité et réduit les risques opérationnels");
}

export function getPierrePositioningStatements(): string[] {
  return [...PIERRE_ALLOWED_POSITIONING];
}

export function getPierreForbiddenPositioningStatements(): string[] {
  return [...PIERRE_FORBIDDEN_POSITIONING];
}
