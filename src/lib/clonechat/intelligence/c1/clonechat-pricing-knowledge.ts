// src/lib/clonechat/intelligence/c1/clonechat-pricing-knowledge.ts
// C1 — Connaissance prix & pays, DÉRIVÉE du module réel P10 (jamais de chiffres inventés) :
// FR/BE/LU = 449 EUR/mois, CH = 499 CHF/mois. Règles : un utilisateur suisse voit/paiera
// l'offre suisse ; pays inconnu → on demande le pays (jamais l'offre la moins chère) ;
// paiement en ligne fermé tant que les preuves externes manquent ; pas d'essai gratuit,
// pas de bêta — démo interactive + réservation fondateur.

import {
  SUPPORTED_LAUNCH_COUNTRIES,
  normalizeCountry,
  pricingForCountry,
  publicPricingCatalog,
  type LaunchCountry,
} from "@/lib/clonestore/pricing/country-pricing";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import type { CountryPricingKnowledge } from "./clonechat-knowledge-types";

export const LAUNCH_COUNTRIES: readonly LaunchCountry[] = SUPPORTED_LAUNCH_COUNTRIES;

/** Connaissance pricing par pays — construite depuis le module P10 réel. */
export function pricingKnowledgeForCountry(country: string): CountryPricingKnowledge | null {
  const res = pricingForCountry(country);
  if (res.status !== "ok") return null;
  const p = res.pricing;
  return Object.freeze({
    country: p.country,
    currency: p.currency,
    amount: p.amount,
    display: p.display,
    group: p.group,
  });
}

export function allLaunchPricing(): readonly CountryPricingKnowledge[] {
  return LAUNCH_COUNTRIES.map((c) => pricingKnowledgeForCountry(c)).filter(
    (x): x is CountryPricingKnowledge => x !== null,
  );
}

export const PRICING_RULES: readonly string[] = Object.freeze([
  "France, Belgique, Luxembourg : 449 € / mois (offre EUR).",
  "Suisse : 499 CHF / mois — un utilisateur suisse voit et paiera l'offre suisse, jamais l'offre EUR.",
  "Pays non déterminé → on demande le pays ; jamais d'offre par défaut « la moins chère ».",
  "Le lancement public payant est fermé tant que les preuves externes (paiement, légal/fiscal) ne sont pas réunies.",
  "La démo, la réservation et l'accès fondateur sont ouverts — aucun paiement demandé.",
  "Pas d'essai gratuit. Pas de bêta. Démo interactive / lancement premium.",
]);

// ── Réponses canoniques ───────────────────────────────────────────────────────
export function answerHowMuch(): string {
  const catalog = publicPricingCatalog();
  const eur = catalog.find((c) => c.currency === "EUR");
  const chf = catalog.find((c) => c.currency === "CHF");
  return (
    `Pierre coûte ${eur ? eur.display : "449 € / mois"} en France, Belgique et Luxembourg, ` +
    `et ${chf ? chf.display : "499 CHF / mois"} en Suisse. ` +
    "Abonnement mensuel (pas d'essai gratuit) — la démo immersive vous montre le vrai produit avant de décider."
  );
}

export function answerWhy449(): string {
  return (
    "449 € / mois, c'est le prix d'un employé IA RH opérationnel : missions suivies, documents et relances préparés, " +
    "cockpit tracé, mémoire d'entreprise — chaque mois, sans fatigue ni turnover. " +
    "Pierre peut revenir moins cher que d'embaucher ou de maintenir une capacité d'exécution RH. " +
    "Et le vrai comparatif n'est pas le prix d'un outil : c'est le coût des heures RH répétitives qu'il absorbe."
  );
}

export function answerWhyCHF(): string {
  const ch = pricingKnowledgeForCountry("CH");
  return (
    `En Suisse, l'offre est ${ch ? ch.display : "499 CHF / mois"} : une offre dédiée, facturée en francs suisses, ` +
    "alignée sur le marché suisse. Un client suisse voit et paiera toujours l'offre suisse — c'est une règle produit, " +
    "vérifiée jusque dans la chaîne de paiement (une tentative CH en euros est bloquée)."
  );
}

export function answerCanIPayNow(env: Env = process.env): string {
  const mode = resolvePaymentMode(env);
  if (mode === "live") {
    // Jamais atteignable tant que le plancher P10 est false — garde honnête.
    return "Le paiement est ouvert dans votre espace — suivez le parcours de réservation.";
  }
  return (
    "Pas encore : le paiement en ligne n'est pas ouvert à ce jour. " +
    "Vous pouvez réserver Pierre dès maintenant (/reserver/pierre) : la réservation fondateur ne demande aucun paiement " +
    "et conserve le prix fondateur. Vous serez prévenu à l'ouverture."
  );
}

export function answerCanIReserve(): string {
  return (
    "Oui : la réservation fondateur est ouverte sur /reserver/pierre. Aucun paiement aujourd'hui — " +
    "vous réservez votre place et le prix fondateur de 449 € HT/mois reste acquis tant que votre abonnement restera actif."
  );
}

export function answerFreeTrial(): string {
  return (
    "Il n'y a pas d'essai gratuit, ni de bêta. À la place : une démo interactive qui montre le vrai produit (/demo), " +
    "et la réservation fondateur sans paiement (/reserver/pierre). C'est un choix de lancement premium assumé."
  );
}

export function answerCountryAvailability(countryInput: string | null): string {
  if (countryInput) {
    const normalized = normalizeCountry(countryInput);
    const k = normalized ? pricingKnowledgeForCountry(normalized) : null;
    if (k) {
      return (
        `Oui — CloneStore lance dans 4 pays : France, Belgique, Luxembourg et Suisse. ` +
        `Pour ${countryLabel(k.country)} : ${k.display}. ` +
        "Le paiement en ligne n'est pas encore ouvert ; la réservation fondateur est disponible dès maintenant."
      );
    }
    return (
      "Le lancement couvre la France, la Belgique, le Luxembourg et la Suisse. " +
      `« ${countryInput} » n'en fait pas partie aujourd'hui — laissez-nous vos coordonnées via /questions pour être prévenu.`
    );
  }
  return (
    "CloneStore lance dans 4 pays : France, Belgique et Luxembourg (449 € / mois) et Suisse (499 CHF / mois). " +
    "Dites-moi votre pays pour une réponse précise."
  );
}

function countryLabel(code: string): string {
  switch (code) {
    case "FR":
      return "la France";
    case "BE":
      return "la Belgique";
    case "LU":
      return "le Luxembourg";
    case "CH":
      return "la Suisse";
    default:
      return code;
  }
}
