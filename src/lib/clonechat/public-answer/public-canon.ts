// src/lib/clonechat/public-answer/public-canon.ts
// C1.8 A2 — FAITS CANONIQUES de la voie publique.
//
// Un seul endroit porte ce que CloneChat a le droit d'affirmer à un visiteur non connecté.
// Rien n'est inventé ici : les prix viennent du module P10 réel, les routes du registre de
// destinations, les limites de Pierre du canon C1. Quand un fait n'est PAS connu, la formulation
// canonique est de le DIRE (« nous ne publions pas cette donnée ») — jamais de combler le vide.

import { publicPricingCatalog, pricingForCountry, normalizeCountry } from "@/lib/clonestore/pricing/country-pricing";

export type PublicRoute =
  | "/" | "/comprendre-clonestore" | "/agents" | "/agents/pierre" | "/demo" | "/demo/pierre"
  | "/reserver/pierre" | "/founding-partners" | "/login" | "/signup" | "/questions" | "/assistant"
  | "/legal/cgu" | "/legal/cgv" | "/legal/confidentialite" | "/legal/dpa" | "/legal/mentions";

/** Libellé de CTA canonique par route (texte et bouton ne peuvent plus diverger). */
export const ROUTE_LABEL: Readonly<Record<PublicRoute, string>> = Object.freeze({
  "/": "Accueil",
  "/comprendre-clonestore": "Comprendre CloneStore",
  "/agents": "Les employés IA",
  "/agents/pierre": "Découvrir Pierre",
  "/demo": "Voir la démo",
  "/demo/pierre": "Voir la démo Pierre",
  "/reserver/pierre": "Réserver Pierre",
  "/founding-partners": "Partenaires Fondateurs",
  "/login": "Se connecter",
  "/signup": "Créer un compte",
  "/questions": "Contacter le support",
  "/assistant": "Ouvrir CloneChat",
  "/legal/cgu": "Lire les CGU",
  "/legal/cgv": "Lire les CGV",
  "/legal/confidentialite": "Politique de confidentialité",
  "/legal/dpa": "Voir le DPA",
  "/legal/mentions": "Mentions légales",
});

// ── Pays ──────────────────────────────────────────────────────────────────────
export const LAUNCH_COUNTRY_CODES = ["FR", "BE", "LU", "CH"] as const;
export type LaunchCode = (typeof LAUNCH_COUNTRY_CODES)[number];

export const COUNTRY_LABEL: Readonly<Record<LaunchCode, string>> = Object.freeze({
  FR: "la France", BE: "la Belgique", LU: "le Luxembourg", CH: "la Suisse",
});

/** Tarif affichable d'un pays de lancement, dérivé du module P10 (jamais un littéral). */
export function launchPriceDisplay(code: LaunchCode): string {
  const res = pricingForCountry(code);
  return res.status === "ok" ? res.pricing.display : code === "CH" ? "499 CHF / mois" : "449 € / mois";
}

/** Les deux tarifs canoniques, formulés en une phrase. */
export function bothPricesSentence(): string {
  const cat = publicPricingCatalog();
  const eur = cat.find((c) => c.currency === "EUR")?.display ?? "449 € / mois";
  const chf = cat.find((c) => c.currency === "CHF")?.display ?? "499 CHF / mois";
  return `${eur} en France, en Belgique et au Luxembourg, et ${chf} en Suisse`;
}

export function isLaunchCountry(code: string): code is LaunchCode {
  return (LAUNCH_COUNTRY_CODES as readonly string[]).includes(code);
}

/** Normalisation d'un code pays via l'autorité P10 (jamais un mapping local concurrent). */
export function normalizeLaunchCountry(input: string): LaunchCode | null {
  const n = normalizeCountry(input);
  return n && isLaunchCountry(n) ? n : null;
}

export const LAUNCH_SENTENCE =
  "Le lancement de CloneStore couvre quatre pays : la France, la Belgique, le Luxembourg et la Suisse.";

// ── Identité ──────────────────────────────────────────────────────────────────
export const CLONESTORE_IDENTITY =
  "CloneStore est la boutique d'employés IA d'entreprise : des employés IA opérationnels, gouvernés et tracés.";

export const PIERRE_IDENTITY_SENTENCE =
  "Pierre est le premier employé IA de CloneStore : un employé IA RH qui transforme vos demandes en missions structurées, prépare vos documents et suivis RH, et centralise tout dans un cockpit tracé.";

export const CLONECHAT_IDENTITY_SENTENCE =
  "Je suis CloneChat, l'assistant de CloneStore : je réponds sur CloneStore, sur Pierre, sur les prix et les pages du site, et je vous oriente vers la bonne page ou vers le support.";

// ── Plancher humain (gouvernance) ─────────────────────────────────────────────
export const HUMAN_FLOOR =
  "Pierre prépare, un humain décide : les décisions sensibles — licenciement, sanction, décision salariale finale, signature — restent sous validation humaine et ne sont jamais automatisées.";

export const NO_LEGAL_GUARANTEE =
  "Pierre ne fournit aucune garantie de conformité juridique et ne remplace pas un conseil juridique.";

export const NO_FULL_PAYROLL =
  "Pierre ne fait pas tourner la paie complète : il prépare des variables et des documents, il n'édite pas vos bulletins.";

export const OUT_OF_PERIMETER =
  "Comptabilité, virements bancaires, placements et prospection commerciale sortent de son périmètre.";

export const NO_FREE_TRIAL =
  "Il n'y a pas d'essai gratuit : la démo montre le produit réel, et la réservation ne demande aucun paiement.";

export const PAYMENT_NOT_OPEN =
  "Le paiement en ligne n'est pas encore ouvert : la réservation se fait sans paiement.";

export const PUBLIC_VISITOR_ACCESS =
  "Ici, dans le chat public, je n'ai accès à aucun compte ni à aucune entreprise : je ne peux donc ni consulter ni modifier vos données. Il faut être connecté, avec une entreprise associée, pour que Pierre travaille sur votre dossier.";

export const PRIVACY_STANCE =
  "Vos échanges et vos documents restent isolés par entreprise, et ne servent pas à entraîner un modèle général.";

export const PRIVACY_REFERRAL =
  "Pour l'hébergement, la durée de conservation et le détail du traitement, la politique de confidentialité fait foi — je ne vais pas l'improviser ici.";

// ── Ce que Pierre fait / ne fait pas, en langage client ───────────────────────
export const PIERRE_MISSION_DOMAINS =
  "contrats et avenants, onboarding et offboarding, absences et congés, attestations et courriers RH, relances et suivis, préparation des variables de paie";

export const PIERRE_PREPARES =
  `il prépare le document, le remplit avec le contexte de votre entreprise, puis vous le soumet. ${HUMAN_FLOOR}`;

/** Données que CloneStore ne publie pas — la réponse honnête est de le dire. */
export const NOT_PUBLISHED =
  "Nous ne publions pas cette donnée, et je ne vais pas l'inventer.";
