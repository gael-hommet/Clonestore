// src/lib/clonechat/intelligence/c1/clonechat-claims-policy.ts
// C1 — Politique de claims : ce que CloneChat a le DROIT de dire, et ce qu'il ne doit
// JAMAIS revendiquer. Réutilise les linters réels existants (P14 evaluateClaimSafety pour
// les claims commerciaux, P15.1 verifyNoLiveClaim pour la copie) + motifs C1 fail-closed.
// Interdits absolus : voix live, téléphonie live, signature live, e-mail envoyé
// automatiquement, paiement/Stripe live, production live, remplacement total de la RH,
// garantie de conformité, DRH autonome, paie/DSN complète, zéro validation humaine,
// essai gratuit / bêta / fausse urgence.

import {
  evaluateClaimSafety,
  ALLOWED_STRONG_CLAIMS,
  ALLOWED_CAUTION_CLAIMS,
} from "@/lib/clonestore/founder-acceptance/pierre-commercial-truth-matrix";
import { verifyNoLiveClaim } from "@/lib/clonestore/production/p15-1-prelaunch";

// ── Motifs C1 interdits (formulation AFFIRMATIVE, après neutralisation des négations) ──
export interface ForbiddenClaimRule {
  readonly id: string;
  readonly pattern: RegExp;
}

export const C1_FORBIDDEN_CLAIM_RULES: readonly ForbiddenClaimRule[] = Object.freeze([
  // Voix
  { id: "live_voice", pattern: /voix\s+(live|en\s+direct)|live\s+voice|voix\s+opérationnelle\s+(?:dès\s+)?(?:maintenant|aujourd)/i },
  // Téléphonie / appels sortants
  { id: "live_telephony", pattern: /téléphonie\s+(live|activée|opérationnelle)|live\s+(telephony|phone\s+calls?)|appels?\s+(?:téléphoniques?\s+)?(réels|sortants?\s+(?:live|activés?))|vous\s+appelle\s+(?:réellement|par\s+téléphone)/i },
  // Signature
  { id: "live_signature", pattern: /signature\s+(live|automatique)|live\s+signature|yousign\s+(live|activé|vérifié)|sign(?:e|é)e?\s+automatiquement|signature\s+(?:est\s+)?envoyée\s+automatiquement/i },
  // E-mail
  { id: "live_email", pattern: /e?-?mails?\s+(?:sont\s+)?envoyés?\s+automatiquement|envoi\s+automatique\s+d['’]e?-?mails?|envoie\s+(?:vos|les|des)\s+e?-?mails?\s+(?:automatiquement|tout\s+seul)|sends?\s+emails?\s+automatically|live\s+e?-?mail/i },
  // Stripe / paiement
  { id: "live_stripe", pattern: /stripe\s+(live|activé|vérifié)|live\s+stripe|paiement\s+(live|activé)|paiement\s+en\s+ligne\s+(?:est\s+)?(ouvert|disponible|activé)|payments?\s+(?:are\s+)?(live|open)|vous\s+pouvez\s+payer\s+(?:dès\s+)?maintenant/i },
  // Production
  { id: "live_production", pattern: /production\s+(live|activée|autorisée|ouverte)|est\s+en\s+production|in\s+(live\s+)?production\b|déployé\s+en\s+production/i },
  // Remplacement total de la RH
  { id: "replaces_hr", pattern: /remplace\s+(?:toute\s+|totalement\s+|entièrement\s+)?(?:la\s+|votre\s+|l['’]équipe\s+)?(rh|drh|fonction\s+rh|service\s+rh|ressources\s+humaines)|replaces?\s+(?:your\s+|the\s+)?(hr|human\s+resources)/i },
  // Garantie de conformité légale
  { id: "legal_guarantee", pattern: /garantit?\s+la\s+conformité|conformité\s+(?:légale\s+)?(?:est\s+)?garantie|juridiquement\s+garanti|guarantees?\s+(?:legal\s+)?compliance|legally\s+guaranteed/i },
  // DRH autonome
  { id: "autonomous_drh", pattern: /drh\s+autonome|autonomous\s+(hr\s+director|drh)/i },
  // Paie / DSN
  { id: "full_payroll", pattern: /(?:moteur|logiciel)\s+de\s+paie\s+complet|gère\s+la\s+paie\s+complète|génère\s+(?:les\s+bulletins|la\s+dsn)|dsn\s+(complète|générée)|full\s+payroll|runs?\s+payroll/i },
  // Zéro validation humaine
  { id: "no_human_validation", pattern: /aucune\s+validation\s+humaine\s+(?:requise|nécessaire)|sans\s+(?:aucune\s+)?validation\s+humaine|100\s*%\s*autonome|no\s+human\s+validation/i },
  // Essai gratuit / bêta (offre inexistante — jamais promise)
  { id: "free_trial_or_beta", pattern: /essai\s+gratuit|free\s+trial|(?:version|accès)\s+bêta|beta\s+(access|version)/i },
  // Fausse urgence / fausse rareté (doctrine de vente)
  { id: "fake_urgency", pattern: /dernière\s+chance|offre\s+limitée|plus\s+que\s+\d+\s+(places?|jours?)|expire\s+(ce\s+soir|demain)|only\s+\d+\s+(left|spots)/i },
]);

// ── Neutralisation des négations (une phrase qui NIE l'interdit est honnête) ──
const NEGATION_SEGMENTS: readonly RegExp[] = [
  /n['’]est\s+pas[^.,;:!?]*/gi,
  /n['’]y\s+a\s+pas[^.,;:!?]*/gi,
  /ne\s+(?:sont|sera|seront)\s+pas[^.,;:!?]*/gi,
  /ne\s+\w+\s+pas[^.,;:!?]*/gi,
  /pas\s+(?:encore|de|d['’])[^.,;:!?]*/gi,
  /jamais[^.,;:!?]*/gi,
  /aucune?\s[^.,;:!?]*/gi,
  /sans\s+revendi[^.,;:!?]*/gi,
  /non\s*[—:–-][^.,;:!?]*/gi,
  /\bnot\s+(?:yet\s+)?[^.,;:!?]*/gi,
  /\bno\s+[^.,;:!?]*/gi,
  /\bnever\b[^.,;:!?]*/gi,
];

/** Retire les segments explicitement négatifs pour ne tester que l'affirmatif. */
export function affirmativeText(text: string): string {
  let out = text;
  for (const seg of NEGATION_SEGMENTS) out = out.replace(seg, " ");
  return out;
}

// ── Vérification d'un texte de réponse (fail-closed) ──────────────────────────
export interface ClaimViolation {
  readonly source: "c1_pattern" | "p15_1_prelaunch";
  readonly ruleId: string;
  readonly matched: string;
}

export interface AnswerTextSafety {
  readonly safe: boolean;
  readonly violations: readonly ClaimViolation[];
}

export function checkAnswerTextSafety(text: string): AnswerTextSafety {
  const violations: ClaimViolation[] = [];
  const affirmative = affirmativeText(text);
  for (const rule of C1_FORBIDDEN_CLAIM_RULES) {
    if (rule.pattern.test(affirmative)) {
      violations.push({ source: "c1_pattern", ruleId: rule.id, matched: rule.pattern.source });
    }
  }
  // Linter P15.1 réel (copie pré-lancement) — appliqué au texte BRUT, comme sur le site.
  const live = verifyNoLiveClaim(text);
  if (!live.safe) {
    violations.push({ source: "p15_1_prelaunch", ruleId: "p15_1_live_claim", matched: live.matched ?? "unknown" });
  }
  return { safe: violations.length === 0, violations };
}

/** Texte de repli sûr si une réponse composée violait la politique (ne doit jamais arriver). */
export const SAFE_REFUSAL_TEXT =
  "Je préfère ne pas affirmer cela : cette formulation dépasse ce qui est prouvé aujourd'hui. " +
  "Voici la version honnête : la préparation est prête et gouvernée, les activations externes " +
  "(paiement en ligne, signature, envoi automatique, voix, téléphonie) restent en attente de vérification. " +
  "Une revue humaine peut vous répondre précisément.";

export interface GuardedAnswer {
  readonly safeText: string;
  readonly safe: boolean;
  readonly violations: readonly ClaimViolation[];
}

/** Garde-fou final du moteur : toute réponse passe ici avant d'être renvoyée. */
export function guardAnswerText(text: string): GuardedAnswer {
  const check = checkAnswerTextSafety(text);
  if (check.safe) return { safeText: text, safe: true, violations: [] };
  return { safeText: SAFE_REFUSAL_TEXT, safe: false, violations: check.violations };
}

// ── Claims commerciaux (courts) — jugés par le linter P14 réel ────────────────
export type CommercialClaimVerdict = ReturnType<typeof evaluateClaimSafety>;

export function evaluateCommercialClaim(claim: string): CommercialClaimVerdict {
  return evaluateClaimSafety(claim);
}

/** Claims canoniques que CloneChat peut utiliser (vérifiés non-interdits par P14). */
export const CANONICAL_ALLOWED_CLAIMS: readonly string[] = Object.freeze([
  ...ALLOWED_STRONG_CLAIMS,
  ...ALLOWED_CAUTION_CLAIMS,
]);

// ── Batterie de probes interdits (tests + command center) ─────────────────────
export const FORBIDDEN_CLAIM_PROBES: readonly string[] = Object.freeze([
  "La voix live est disponible dès aujourd'hui.",
  "CloneCall passe des appels téléphoniques réels.",
  "La signature est envoyée automatiquement via Yousign.",
  "Les e-mails sont envoyés automatiquement par Pierre.",
  "Le paiement en ligne est ouvert, vous pouvez payer maintenant.",
  "CloneStore est en production.",
  "Pierre remplace toute la RH.",
  "La conformité légale est garantie.",
  "Pierre est un DRH autonome.",
  "Pierre gère la paie complète et génère la DSN.",
  "Pierre fonctionne sans validation humaine.",
  "Profitez de l'essai gratuit.",
  "Dernière chance : offre limitée à 3 places.",
]);

/** true si TOUS les probes interdits sont bloqués par la garde (fail-closed attendu). */
export function allForbiddenProbesBlocked(): boolean {
  return FORBIDDEN_CLAIM_PROBES.every((probe) => !checkAnswerTextSafety(probe).safe);
}

/** Comportements de vente interdits (doctrine — exposés pour tests et audit). */
export const FORBIDDEN_SALES_BEHAVIOURS: readonly string[] = Object.freeze([
  "Fausse urgence",
  "Fausse rareté",
  "Garantie légale",
  "« Remplace totalement la RH »",
  "« Voix / appels / signature / e-mail live prêts »",
  "Annoncer un lancement payé tant que bloqué",
]);
