// src/lib/clonechat/public-answer/public-output-guard.ts
// C1.8 A2 — GARDE DE SORTIE de la voie publique (fail-closed).
//
// Trois familles de défauts ne doivent JAMAIS atteindre un visiteur, quelle que soit la voie
// (déterministe ou modèle) :
//   1. la feuille de route et le vocabulaire internes (noms de phases, jargon de chantier) ;
//   2. les placeholders techniques et les suffixes parasites ;
//   3. la pression commerciale sur un incident, un litige ou un refus.
// La garde ne « nettoie » pas au petit bonheur : quand elle détecte une violation, elle SIGNALE,
// et l'appelant recompose une réponse sûre. Un texte muet vaut mieux qu'un texte qui trahit.

/** Jargon interne : noms de phases, blocs de chantier, couches techniques non publiques. */
export const INTERNAL_TOKEN_RX =
  /\bP\d{1,2}(?:\.\d+)*[A-Z]?\b|\bT1\/T2\b|\bT1\b|\bT2\b|\bC1(?:\.\d+)+\b|\bB\d{2}\b|feuille\s+de\s+route\s+interne|prochaines?\s+phases?\s*:|c[âa]blage\s+UI|vérité\s+interne|blocages?\s+externes?\s+exacts|PRODUCTION_AUTHORIZED|CloneChat\s+est\s+une\s+étape|mode\s+«?\s*(?:disabled|test)\s*»?|distDir|vitest|tsc\b/i;

/** Placeholders techniques et interpolations ratées. */
export const PLACEHOLDER_RX =
  /\((?:unknown|undefined|null|none|n\/a)\)|\{\{[^}]*\}\}|\$\{[^}]*\}|\[object\s+Object\]|\bundefined\b|\bNaN\b/i;

/** Suffixe parasite « entreprise » servi sur une question publique. */
export const PARASITE_RX =
  /le\s+travail\s+rh\s+exige\s+une\s+entreprise\s+authentifiée|aucune\s+entreprise\s+active|activez\s+une\s+entreprise|rejoindre\s+une\s+entreprise/i;

/** Gabarit de dérobade générique — interdit sur la voie publique. */
export const DODGE_RX =
  /je\s+préfère\s+ne\s+pas\s+improviser|pas\s+de\s+réponse\s+canonique|réponse\s+canonique\s+fiable|quelle\s+page\s+cherchez[- ]vous|les\s+pages\s+clés\s*:/i;

/** Argumentaire commercial : montants, réservation, démo poussée comme action principale. */
export const COMMERCIAL_RX =
  /\b\d{3}\s*(?:€|eur|euros|chf)\b|\bréserv[a-z]*\b|\bprix\s+fondateur\b|\bdémo\s+immersive\b|\babonnement\s+mensuel\b|\bvoir\s+la\s+démo\b/i;

export interface PublicGuardVerdict {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

export interface PublicGuardInput {
  readonly text: string;
  readonly ctaRoute: string | null;
  readonly linkRoutes: readonly string[];
  /** true si la situation interdit toute pression commerciale (incident, litige, pays non couvert). */
  readonly commercialForbidden: boolean;
}

const COMMERCIAL_ROUTES = new Set(["/reserver/pierre", "/demo", "/demo/pierre"]);

/** Contrôle fail-closed d'une réponse publique avant émission. */
export function checkPublicOutput(input: PublicGuardInput): PublicGuardVerdict {
  const v: string[] = [];
  if (INTERNAL_TOKEN_RX.test(input.text)) v.push("INTERNAL_ROADMAP_LEAK");
  if (PLACEHOLDER_RX.test(input.text)) v.push("PLACEHOLDER");
  if (PARASITE_RX.test(input.text)) v.push("PARASITIC_COMPANY_REQUIREMENT");
  if (DODGE_RX.test(input.text)) v.push("GENERIC_DODGE");
  if (input.commercialForbidden) {
    if (COMMERCIAL_RX.test(input.text)) v.push("COMMERCIAL_PRESSURE_TEXT");
    const routes = [input.ctaRoute, ...input.linkRoutes].filter((r): r is string => r !== null);
    if (routes.some((r) => COMMERCIAL_ROUTES.has(r))) v.push("COMMERCIAL_PRESSURE_CTA");
  }
  return { ok: v.length === 0, violations: Object.freeze(v) };
}

/** Réponse de repli sûre quand la garde a refusé une composition (ne doit jamais arriver). */
export const PUBLIC_GUARD_FALLBACK =
  "Je préfère ne pas répondre de travers : dites-moi en une phrase ce que vous cherchez — Pierre, l'offre, une page du site, ou un problème à régler — et je vous oriente au bon endroit.";

/**
 * Nettoyage minimal applicable au texte d'une voie NON déterministe (modèle) : on ne réécrit pas
 * le fond, on retire les fragments qui ne doivent jamais être publics. Si le texte reste en
 * violation après nettoyage, l'appelant doit lui substituer une réponse sûre.
 */
export function sanitizePublicText(text: string): string {
  return text
    .replace(/\s*Le travail RH exige une entreprise authentifiée[^.]*\.\s*/gi, " ")
    .replace(/\((?:unknown|undefined|null|none|n\/a)\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
