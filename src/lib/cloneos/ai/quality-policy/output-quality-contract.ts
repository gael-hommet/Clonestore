// src/lib/cloneos/ai/quality-policy/output-quality-contract.ts
// B38D — Generic output quality contracts by OutputQualityLevel.
// These are platform-wide contracts. Pierre-specific deliverable contracts
// live in src/lib/pierre/quality/pierre-deliverable-contract.ts.
// Pure: no async, no env, no side effects.

import type { OutputQualityLevel, OutputQualityContract } from "./types";

// ── Forbidden phrases (anti "ancien ChatGPT") ─────────────────────────────────
// Any output containing these phrases fails quality validation for client-visible+.

export const FORBIDDEN_GENERIC_PHRASES: readonly string[] = [
  "Voici un modèle",
  "Voici un exemple",
  "N'hésitez pas à adapter",
  "Cordialement, [Votre nom]",
  "Signature : [Nom]",
  "[À compléter]",
  "[Insérez ici]",
  "Lorem ipsum",
  "This is a template",
  "Replace with your",
  "Insert here",
  "Your company name",
  "Nom de l'entreprise",
  "[date]",
  "[nom]",
  "[prénom]",
];

// ── Output quality contracts ──────────────────────────────────────────────────

const OUTPUT_QUALITY_CONTRACTS: Record<OutputQualityLevel, OutputQualityContract> = {

  basic_internal: {
    level: "basic_internal",
    label: "Interne basique",
    must_include: [
      "Contenu factuel et précis",
      "Format concis",
    ],
    must_never_include: [
      "Promesse juridique",
      "Décision autonome sensible",
    ],
    tone_rules: [
      "Neutre et factuel",
      "Pas besoin de politesse formelle",
    ],
    formatting_rules: [
      "Texte simple ou JSON structuré",
      "Aucune mise en page premium requise",
    ],
    requires_human_validation: false,
    premium_model_recommended: false,
    document_style_required_later: false,
  },

  operational: {
    level: "operational",
    label: "Opérationnel",
    must_include: [
      "Tâches actionables clairement formulées",
      "Risques identifiés si présents",
      "Prochaines actions recommandées",
      "Format structuré (sections ou JSON)",
    ],
    must_never_include: [
      "Phrases génériques sans contenu",
      "Décision juridique autonome",
      "Variables non résolues visibles",
    ],
    tone_rules: [
      "Direct et professionnel",
      "Pas de politesse excessive",
      "Orienté résultat",
    ],
    formatting_rules: [
      "Sections claires",
      "Listes à puces si plusieurs éléments",
      "Pas de markdown brut si export",
    ],
    requires_human_validation: false,
    premium_model_recommended: false,
    document_style_required_later: false,
  },

  client_visible: {
    level: "client_visible",
    label: "Visible client",
    must_include: [
      "Ton professionnel et soigné",
      "Formulation naturelle, pas robotique",
      "Variables correctement résolues",
      "Structure lisible et aérée",
    ],
    must_never_include: [
      ...FORBIDDEN_GENERIC_PHRASES.slice(0, 6),
      "Markdown brut non rendu si export",
      "Variable manquante non signalée",
      "Décision juridique définitive",
    ],
    tone_rules: [
      "Professionnel et chaleureux selon contexte",
      "Adapté au niveau dirigeant RH",
      "Pas de jargon technique excessif",
    ],
    formatting_rules: [
      "Paragraphes bien structurés",
      "En-tête si applicable",
      "Validation recommandée si sensible",
    ],
    requires_human_validation: false,
    premium_model_recommended: false,
    document_style_required_later: false,
  },

  premium_client_visible: {
    level: "premium_client_visible",
    label: "Premium visible client",
    must_include: [
      "Structure haut de gamme avec sections nommées",
      "Lisibilité niveau dirigeant",
      "Conclusion ou action claire en fin de document",
      "Formulation naturelle et fluide",
      "Variables résolues ou explicitement listées",
    ],
    must_never_include: [
      ...FORBIDDEN_GENERIC_PHRASES,
      "Markdown brut non rendu si export PDF",
      "Phrase de remplissage sans valeur",
      "Décision juridique définitive sans validation",
      "Autonomie sur action sensible",
    ],
    tone_rules: [
      "Niveau dirigeant et DRH",
      "Formel mais naturel — jamais robotique",
      "Adapté au contexte entreprise client",
      "Ton cohérent du début à la fin",
    ],
    formatting_rules: [
      "Sections clairement titrées",
      "Paragraphes courts et percutants",
      "Tables si données chiffrées",
      "Aucun placeholder visible",
      "Validation humaine recommandée pour documents contractuels",
    ],
    requires_human_validation: false,
    premium_model_recommended: true,
    document_style_required_later: true,
  },

  official_document: {
    level: "official_document",
    label: "Document officiel",
    must_include: [
      "Validation humaine obligatoire avant diffusion",
      "Variables manquantes explicitement listées",
      "Style entreprise client requis (B45)",
      "Mentions légales non inventées",
      "Référence au modèle/template source si disponible",
    ],
    must_never_include: [
      ...FORBIDDEN_GENERIC_PHRASES,
      "Envoi automatique sans validation",
      "Mention juridique inventée",
      "Signature automatique",
      "Décision définitive sans approbation",
      "Markdown brut dans export final",
    ],
    tone_rules: [
      "Formel et précis",
      "Niveau juridique/RH — jamais approximatif",
      "Style entreprise client si disponible",
    ],
    formatting_rules: [
      "En-tête et pied de page selon charte entreprise (B45)",
      "Sections conformes au type de document",
      "Variables restantes signalées explicitement",
      "Format export conforme (pas de markdown brut dans PDF)",
    ],
    requires_human_validation: true,
    premium_model_recommended: true,
    document_style_required_later: true,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getOutputQualityContract(level: OutputQualityLevel): OutputQualityContract {
  return OUTPUT_QUALITY_CONTRACTS[level];
}

export function getAllOutputQualityContracts(): OutputQualityContract[] {
  return Object.values(OUTPUT_QUALITY_CONTRACTS);
}

export function validateOutputQualityLevel(
  content: string,
  level: OutputQualityLevel,
): { valid: boolean; violations: string[] } {
  const contract = OUTPUT_QUALITY_CONTRACTS[level];
  const violations: string[] = [];

  for (const forbidden of contract.must_never_include) {
    if (content.toLowerCase().includes(forbidden.toLowerCase())) {
      violations.push(`Forbidden phrase detected: "${forbidden}"`);
    }
  }

  return { valid: violations.length === 0, violations };
}

export function containsForbiddenGenericPhrase(content: string): boolean {
  return FORBIDDEN_GENERIC_PHRASES.some((phrase) =>
    content.toLowerCase().includes(phrase.toLowerCase()),
  );
}
