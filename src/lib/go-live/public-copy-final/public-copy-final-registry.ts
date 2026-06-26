// GO-LIVE 03 — Public Copy Final Registry
// Canonical list of all forbidden phrases and allowed patterns for public copy.
// Extends production-readiness/public-copy with GO-LIVE 03 specific rules.
// Pure: no Supabase, no Next, no async, no throw.

import type { CopyFinalRule, CopyFinalAllowedPattern } from "./types";

export const COPY_FINAL_FORBIDDEN_RULES: CopyFinalRule[] = [
  {
    id: "zero_erreur",
    pattern: /zéro erreur|aucune erreur garantie|sans erreur|error-free/i,
    severity: "blocking",
    explanation: "Aucune garantie d'absence d'erreur ne peut être promise",
    suggested_fix: "Supprimer. Pierre prépare des brouillons qui nécessitent relecture humaine.",
    applies_to: "all",
  },
  {
    id: "conformite_garantie",
    pattern: /conformité garantie|légalement conforme|compliant garanti|conforme à la loi/i,
    severity: "blocking",
    explanation: "Aucune garantie de conformité légale ne peut être affirmée",
    suggested_fix: "La validation humaine et juridique reste obligatoire pour toute conformité.",
    applies_to: "all",
  },
  {
    id: "remplace_avocat",
    pattern: /remplace (un |l')?avocat|remplace (un |le )?juriste/i,
    severity: "blocking",
    explanation: "Pierre ne remplace jamais un avocat ou un juriste",
    suggested_fix: "Pierre prépare des brouillons — validation juridique humaine obligatoire.",
    applies_to: "all",
  },
  {
    id: "dsn_autonome",
    pattern: /DSN autonome|soumet (des )?DSN automatiquement|déclaration sociale.*autonome/i,
    severity: "blocking",
    explanation: "Pierre ne soumet pas de DSN — ce n'est pas un logiciel de paie certifié",
    suggested_fix: "Pierre prépare des éléments de pré-paie, non substituables à un logiciel certifié.",
    applies_to: "all",
  },
  {
    id: "paie_officielle_autonome",
    pattern: /bulletins? de paie officiels?|logiciel de paie (officiel|certifié)|génère des bulletins/i,
    severity: "blocking",
    explanation: "Pierre ne génère pas de bulletins de paie officiels",
    suggested_fix: "Pierre prépare des éléments de pré-paie préparatoires soumis à validation.",
    applies_to: "all",
  },
  {
    id: "licenciement_automatique",
    pattern: /licenciement automatique|licencie (les employés )?automatiquement|décision.*licenciement.*autonome/i,
    severity: "blocking",
    explanation: "Pierre ne peut jamais licencier automatiquement — décision humaine obligatoire",
    suggested_fix: "Pierre prépare des courriers de licenciement soumis à validation humaine.",
    applies_to: "all",
  },
  {
    id: "rh_juridiquement_autonome",
    pattern: /RH juridiquement autonome|expert.juridique (RH )?autonome|remplace (un )?professionnel RH/i,
    severity: "blocking",
    explanation: "Pierre ne peut pas agir de façon juridiquement autonome en RH",
    suggested_fix: "Pierre assiste et structure — validation humaine finale obligatoire.",
    applies_to: "all",
  },
  {
    id: "remplace_responsabilite_humaine",
    pattern: /remplace (toute )?responsabilité humaine|élimine le risque humain|aucune intervention humaine/i,
    severity: "blocking",
    explanation: "Pierre ne remplace pas la responsabilité humaine",
    suggested_fix: "La responsabilité humaine reste entière pour toute décision officielle.",
    applies_to: "all",
  },
  {
    id: "essai_gratuit_open_bar",
    pattern: /essai gratuit (de )?7 jours|7.day free trial|trial gratuit|open.bar/i,
    severity: "blocking",
    explanation: "Aucun essai production gratuit open-bar autorisé",
    suggested_fix: "Démo illustrative disponible — sans accès production gratuit.",
    applies_to: ["homepage", "pricing", "checkout"],
  },
  {
    id: "cout_ia_illimite",
    pattern: /coût IA illimité|IA illimitée|IA sans limite de coût|appels IA illimités/i,
    severity: "blocking",
    explanation: "L'IA a des limites de coût — aucune promesse d'illimité",
    suggested_fix: "Pierre est soumis à des limites d'usage IA définies dans l'abonnement.",
    applies_to: "all",
  },
  {
    id: "donnees_100_protegees",
    pattern: /données 100% protégées sans réserve|sécurité absolue|aucune faille possible/i,
    severity: "blocking",
    explanation: "Aucune garantie de sécurité absolue ne peut être affirmée",
    suggested_fix: "CloneStore met en œuvre des mesures de sécurité adaptées sans garantie absolue.",
    applies_to: "all",
  },
  {
    id: "public_launch_ready_sans_preuve",
    pattern: /public launch (activé|ready|enabled) sans preuve|B48_PUBLIC_LAUNCH_ENABLED.*true/i,
    severity: "blocking",
    explanation: "Le public launch ne peut pas être déclaré sans preuves validées",
    suggested_fix: "Remplir go-live-proofs.local.json avec preuves réelles avant activation.",
    applies_to: "all",
  },
];

export const COPY_FINAL_ALLOWED_PATTERNS: CopyFinalAllowedPattern[] = [
  {
    id: "gagner_temps_argent",
    pattern: /gagner du temps|économiser du temps|réduire les coûts/i,
    description: "Bénéfices estimatifs autorisés",
  },
  {
    id: "poste_rh_operationnel",
    pattern: /poste RH opérationnel automatisé/i,
    description: "Description du poste Pierre autorisée",
  },
  {
    id: "employe_ia_rh",
    pattern: /employé IA RH/i,
    description: "Terminologie Pierre autorisée",
  },
  {
    id: "automatise_charge_rh",
    pattern: /automatise (la charge|une large part du travail) RH opérationnel/i,
    description: "Description de la valeur Pierre autorisée",
  },
  {
    id: "prepare_structure_suit",
    pattern: /prépare|structure|suit|relance|documente|trace/i,
    description: "Verbes d'action opérationnels autorisés",
  },
  {
    id: "validation_humaine_finale",
    pattern: /validation humaine (finale|obligatoire)/i,
    description: "Disclaimer de validation humaine autorisé et recommandé",
  },
  {
    id: "demo_gratuite_illustrative",
    pattern: /démo (gratuite )?(illustrative|sans données réelles)/i,
    description: "Démo illustrative autorisée",
  },
  {
    id: "pierre_449_mois",
    pattern: /Pierre.*449.*\/mois|449.*€.*\/mois/i,
    description: "Prix Pierre 449€/mois autorisé",
  },
];

export function getForbiddenRulesForContext(context: string): CopyFinalRule[] {
  return COPY_FINAL_FORBIDDEN_RULES.filter(
    (rule) => rule.applies_to === "all" || (rule.applies_to as string[]).includes(context)
  );
}

export function getAllForbiddenRules(): CopyFinalRule[] {
  return [...COPY_FINAL_FORBIDDEN_RULES];
}

export function getAllowedPatterns(): CopyFinalAllowedPattern[] {
  return [...COPY_FINAL_ALLOWED_PATTERNS];
}

export function getBlockingRuleIds(): string[] {
  return COPY_FINAL_FORBIDDEN_RULES.filter((r) => r.severity === "blocking").map((r) => r.id);
}
