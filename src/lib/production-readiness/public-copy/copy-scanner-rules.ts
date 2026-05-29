// P-FINAL 01 — Phase 8 — Copy scanner rules: forbidden patterns and required disclaimers.
// Pure: no Supabase, no Next, no async, no throw.

import type { CopyRule, DisclaimerRequirement, CopyContext } from "./copy-scanner-types";

// Forbidden patterns — these must NEVER appear in public-facing copy
export const FORBIDDEN_COPY_RULES: CopyRule[] = [
  {
    id: "pierre_garantit_conformite",
    pattern: /pierre garantit/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre ne garantit rien — aucune garantie de conformité, de résultat ou d'absence d'erreur",
    suggested_fix: "Remplacer par 'Pierre peut aider à' ou 'Pierre prépare des brouillons soumis à validation humaine'",
  },
  {
    id: "remplace_avocat",
    pattern: /remplace (un |l')?avocat/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre ne remplace pas un avocat — jamais",
    suggested_fix: "Pierre ne remplace pas un avocat. La validation juridique reste obligatoire.",
  },
  {
    id: "remplace_expert_comptable",
    pattern: /remplace (un |l')?expert.comptable/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre ne remplace pas un expert-comptable",
    suggested_fix: "Indiquer que Pierre prépare des éléments soumis à validation par l'expert-comptable",
  },
  {
    id: "zero_erreur",
    pattern: /zéro erreur|aucune erreur garantie|sans erreur/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Aucune garantie d'absence d'erreur ne peut être promise",
    suggested_fix: "Supprimer. Pierre prépare des brouillons qui nécessitent une relecture humaine.",
  },
  {
    id: "essai_gratuit_7_jours",
    pattern: /essai gratuit de 7 jours|7.day free trial|7-day trial/i,
    severity: "blocking",
    applies_to: ["homepage", "pricing", "demo"],
    explanation: "Le trial gratuit de 7 jours open-bar est interdit",
    suggested_fix: "Proposer une démo illustrative sans essai gratuit production open-bar",
  },
  {
    id: "essai_gratuit_illimite",
    pattern: /essai gratuit illimité|free trial unlimited|open.bar/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Aucun essai gratuit open-bar autorisé",
    suggested_fix: "Démo illustrative uniquement — pas d'essai production gratuit",
  },
  {
    id: "conforme_a_la_loi",
    pattern: /conforme (à|a) la loi|légalement conforme|compliance garantie/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Aucune garantie de conformité légale ne peut être affirmée",
    suggested_fix: "La validation humaine et juridique reste obligatoire pour toute conformité réglementaire",
  },
  {
    id: "decisions_autonomes",
    pattern: /décision(s)? autonome(s)?|agit (de façon|en toute) autonome|Pierre décide/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre ne prend jamais de décisions autonomes — tout est soumis à validation humaine",
    suggested_fix: "Pierre propose des brouillons et suggestions soumis à approbation humaine obligatoire",
  },
  {
    id: "envoie_emails_seul",
    pattern: /envoie (des )?emails (de façon )?automatiquement|sends emails automatically/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre ne peut pas envoyer d'emails de façon autonome",
    suggested_fix: "Pierre prépare des brouillons d'emails soumis à validation avant envoi",
  },
  {
    id: "resultats_garantis",
    pattern: /résultats garantis|guaranteed results|succès garanti/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Aucun résultat garanti — Pierre est un outil d'assistance",
    suggested_fix: "Supprimer. Exprimer les bénéfices en termes de gains de temps estimatifs",
  },
  {
    id: "satisfaction_garantie",
    pattern: /satisfait ou remboursé|satisfaction (100%|totale) garantie/i,
    severity: "blocking",
    applies_to: ["homepage", "pricing"],
    explanation: "Garantie de remboursement non prévue dans la politique commerciale standard",
    suggested_fix: "Se référer à la politique de remboursement dans les CGV",
  },
  {
    id: "logiciel_paie_officiel",
    pattern: /logiciel de paie (officiel|certifié)|génère des bulletins de salaire/i,
    severity: "blocking",
    applies_to: "all",
    explanation: "Pierre n'est pas un logiciel de paie officiel",
    suggested_fix: "Pierre prépare des éléments de pré-paie préparatoires — non substituable à un logiciel de paie certifié",
  },
];

// Required disclaimers — certain contexts must include these
export const REQUIRED_DISCLAIMERS: DisclaimerRequirement[] = [
  {
    id: "validation_humaine_required",
    text_pattern: "validation humaine",
    applies_to: ["homepage", "pricing", "cockpit"],
    description: "Toute communication produit doit mentionner que la validation humaine est obligatoire",
    required: true,
  },
  {
    id: "not_legal_advice",
    text_pattern: "ne remplace pas",
    applies_to: ["legal_cgu", "legal_cgv"],
    description: "Les pages légales doivent mentionner que le service ne remplace pas un avocat/juriste",
    required: true,
  },
  {
    id: "demo_illustrative",
    text_pattern: "illustrative",
    applies_to: ["demo"],
    description: "La page démo doit indiquer qu'elle est illustrative",
    required: true,
  },
];

export function getForbiddenRulesForContext(context: CopyContext): CopyRule[] {
  return FORBIDDEN_COPY_RULES.filter(
    (rule) => rule.applies_to === "all" || (rule.applies_to as CopyContext[]).includes(context)
  );
}

export function getRequiredDisclaimersForContext(context: CopyContext): DisclaimerRequirement[] {
  return REQUIRED_DISCLAIMERS.filter(
    (d) => d.applies_to === "all" || (d.applies_to as CopyContext[]).includes(context)
  );
}

export function getBlockingRulesCount(): number {
  return FORBIDDEN_COPY_RULES.filter((r) => r.severity === "blocking").length;
}
