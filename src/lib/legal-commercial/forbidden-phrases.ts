// B47 — Forbidden Phrases Detector
// Detects legally/commercially dangerous phrases in any text output.
// Pure: no Supabase, no Next, no async. No throw.

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeForPhraseCheck(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Forbidden phrase lists ────────────────────────────────────────────────────

export const forbiddenMarketingPhrases: string[] = [
  "conformite garantie",
  "conformite legale garantie",
  "remplace toute l'equipe rh juridiquement",
  "zero erreur",
  "sans erreur",
  "garanti sans faute",
  "juridiquement autonome",
  "outil juridique complet",
  "licenciement automatique",
  "licencie automatiquement",
  "paie officielle autonome",
  "plus besoin de responsable rh dans tous les cas",
  "supprime tout risque",
  "risque zero",
  "zero risque",
  "conforme rgpd a 100%",
  "conforme rgpd sans revue",
];

export const forbiddenLegalPhrases: string[] = [
  "remplace un avocat",
  "remplace l'avocat",
  "remplace le juriste",
  "remplace un juriste",
  "service juridique autonome",
  "conseil juridique autonome",
  "garantit la conformite legale",
  "garantit la conformite",
  "conforme a 100%",
  "garantit zéro erreur",
  "garantit zero erreur",
  "aucun risque legal",
  "supprime le risque prudhommal",
  "supprime tout risque prudhommal",
  "zero risque prudhommal",
  "aucun risque prudhommal",
  "decision juridique definitive",
  "decision legale definitive",
];

export const forbiddenPayrollPhrases: string[] = [
  "remplace la dsn",
  "remplace un logiciel de paie",
  "remplace le logiciel de paie",
  "logiciel de paie officiel",
  "paie officielle",
  "genere la dsn",
  "produit les bulletins officiels",
  "bulletins de paie officiels",
  "garantit le bulletin exact",
  "bulletin certifie",
  "remplace l'expert paie",
  "paie autonome",
];

export const forbiddenHrDecisionPhrases: string[] = [
  "prend seul les decisions",
  "decide seul du licenciement",
  "licencie automatiquement",
  "envoie la sanction automatiquement",
  "envoie le licenciement automatiquement",
  "decision disciplinaire autonome",
  "sanctions automatiques",
  "licenciement automatique",
  "rupture automatique",
  "rupture conventionnelle autonome",
];

export const forbiddenAiOverclaimPhrases: string[] = [
  "zero erreur",
  "sans aucune erreur",
  "intelligence artificielle parfaite",
  "ia infaillible",
  "resultats garantis",
  "performance garantie",
  "ia autonome complete",
  "remplace completement l'humain",
  "aucune supervision requise",
  "sans supervision",
  "decision autonome complete",
];

// ── All forbidden phrases combined ───────────────────────────────────────────

export const ALL_FORBIDDEN_PHRASES = [
  ...forbiddenMarketingPhrases,
  ...forbiddenLegalPhrases,
  ...forbiddenPayrollPhrases,
  ...forbiddenHrDecisionPhrases,
  ...forbiddenAiOverclaimPhrases,
];

// ── Detection functions ───────────────────────────────────────────────────────

export function findForbiddenPhrases(text: string): string[] {
  const normalized = normalizeForPhraseCheck(text);
  const found: string[] = [];
  for (const phrase of ALL_FORBIDDEN_PHRASES) {
    if (normalized.includes(normalizeForPhraseCheck(phrase))) {
      found.push(phrase);
    }
  }
  return [...new Set(found)];
}

export function findForbiddenPhrasesInCategory(
  text: string,
  category: "marketing" | "legal" | "payroll" | "hr_decision" | "ai_overclaim",
): string[] {
  const normalized = normalizeForPhraseCheck(text);
  const list =
    category === "marketing" ? forbiddenMarketingPhrases :
    category === "legal" ? forbiddenLegalPhrases :
    category === "payroll" ? forbiddenPayrollPhrases :
    category === "hr_decision" ? forbiddenHrDecisionPhrases :
    forbiddenAiOverclaimPhrases;

  return list
    .filter((phrase) => normalized.includes(normalizeForPhraseCheck(phrase)))
    .filter((_, i, a) => a.indexOf(_) === i);
}

export function assertNoForbiddenLegalCommercialPhrases(text: string): { ok: boolean; violations: string[] } {
  const violations = findForbiddenPhrases(text);
  return { ok: violations.length === 0, violations };
}

export function hasForbiddenPhrase(text: string): boolean {
  return findForbiddenPhrases(text).length > 0;
}
