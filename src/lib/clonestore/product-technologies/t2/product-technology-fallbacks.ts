// src/lib/clonestore/product-technologies/t2/product-technology-fallbacks.ts
// T2 — Fallbacks sûrs des 14 technologies produit : quand une capacité n'est pas live,
// la techno PRÉPARE (ou refuse) et l'humain complète. Aucune techno ne bloque le produit.

import { isProductTechnologyId, type ProductTechnologyId } from "./product-technology-types";

export const PRODUCT_TECHNOLOGY_FALLBACKS: Readonly<Record<ProductTechnologyId, string>> = Object.freeze({
  cloneos: "Plan de mission proposé localement — la gouvernance (Guard/Policy/Trust) et l'humain décident ; aucune exécution.",
  cloneadn: "Profil d'entreprise proposé — enrichissements soumis à validation ; jamais de mutation silencieuse.",
  cloneguard: "En cas de doute : require_validation ou refus — jamais un passage silencieux.",
  clonetrace: "Trace locale toujours disponible (événement + pointeur de reprise) — aucun provider requis.",
  clonevoice: "L'entrée texte reste la source de vérité (aucun provider vocal) — transcription fournie par l'humain.",
  clonepolicy: "Règles sûres par défaut : validation requise pour tout envoi/signature ; autonomie plafonnée.",
  clonecontinuum: "État de continuité local + recommandation de réveil — aucun cron live, l'humain relance.",
  clonetrust: "Autonomie minimale par défaut (prepare_only) ; sensible/critique → human_only.",
  clonereview: "Relecture locale best-effort — la revue humaine reste requise pour tout livrable.",
  clonesignals: "Candidats de déclencheurs proposés — aucun scheduler live, l'humain arme les rappels.",
  clonelearn: "Apprentissages PROPOSÉS uniquement — aucune mutation de CloneADN sans validation.",
  clonebrief: "Brief construit uniquement sur les faits fournis — préparé ≠ fait, blocages jamais masqués.",
  clonecall: "Session d'appel locale sur transcript texte — aucune téléphonie live, aucun appel sortant réel.",
  cloneroom: "Coordination par CloneOS uniquement — pas de pair-à-pair anarchique ; l'humain garde la main.",
});

export const UNKNOWN_PRODUCT_TECHNOLOGY_FALLBACK = "Technologie produit inconnue — refus fail-closed.";

export function getProductTechnologyFallbackText(id: string): string {
  return isProductTechnologyId(id) ? PRODUCT_TECHNOLOGY_FALLBACKS[id] : UNKNOWN_PRODUCT_TECHNOLOGY_FALLBACK;
}

export function allProductTechnologiesHaveSafeFallback(): boolean {
  return Object.values(PRODUCT_TECHNOLOGY_FALLBACKS).every((f) => typeof f === "string" && f.trim().length > 0);
}
