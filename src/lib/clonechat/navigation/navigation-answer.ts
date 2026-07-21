// src/lib/clonechat/navigation/navigation-answer.ts
// C1.8 REOUVERT §10 — RÉPONSE DIRECTE pour une intention de NAVIGATION claire.
//
// Pour « où acheter Pierre ? », la bonne réponse n'est ni une liste de pages, ni une clarification,
// ni un renvoi au support : c'est UNE phrase utile + UN CTA vers la bonne page. Ce module produit
// cette réponse déterministe. Il n'est appelé QUE pour les intentions de navigation à confiance
// suffisante (voir `qualifiesForDirectAnswer`) : les questions substantielles (prix chiffré,
// capacités, support) gardent le chemin groundé/modèle.

import type { NavResolution, NavIntent } from "./intent-taxonomy";

/**
 * Intentions où « aller à la page X » EST la réponse complète — aucune substance n'est attendue.
 * On EXCLUT volontairement `discover_*` (l'utilisateur veut une vraie explication : le chemin
 * groundé/modèle garde la main, on ne fait qu'y corriger le CTA), et `pierre_pricing` (le prix
 * chiffré vient du chemin groundé). Le court-circuit ne s'applique donc qu'aux vraies navigations.
 */
const DIRECT_NAV_INTENTS: ReadonlySet<NavIntent> = new Set<NavIntent>([
  "purchase_pierre", "reserve_pierre", "login_help", "signup_help", "navigate_to_page",
]);

/** Une intention de navigation claire mérite-t-elle une réponse directe déterministe ? */
export function qualifiesForDirectAnswer(nav: NavResolution): boolean {
  return (
    !nav.clarification_required &&
    nav.route !== null &&
    nav.cta !== null &&
    DIRECT_NAV_INTENTS.has(nav.intent) &&
    (nav.confidence === "certain" || nav.confidence === "high")
  );
}

/**
 * Phrase directe par intention. Toujours : une action utile en première phrase, le nom de la page,
 * jamais une liste, jamais « quelle page cherchez-vous ? », jamais le support, jamais un
 * avertissement d'entreprise.
 */
export function directNavigationAnswer(nav: NavResolution): string {
  const label = nav.cta?.label ?? "la page";
  switch (nav.intent) {
    case "purchase_pierre":
    case "reserve_pierre":
      return "Pour obtenir Pierre, rendez-vous sur la page Réserver Pierre. Vous y réservez le prix fondateur et lancez l'activation.";
    case "request_pierre_demo":
      return "Pour voir Pierre en action, ouvrez la démo Pierre.";
    case "request_general_demo":
      return "Pour découvrir CloneStore en action, ouvrez la démo.";
    case "discover_pierre":
      return "Pierre est votre employé IA RH. Pour tout savoir sur ce qu'il fait et ses limites, ouvrez sa page.";
    case "discover_clonestore":
      return "CloneStore est la boutique d'employés IA d'entreprise. Pour comprendre la méthode et l'offre, ouvrez la page dédiée.";
    case "login_help":
      return "Pour accéder à votre espace, rendez-vous sur la page Connexion.";
    case "signup_help":
      return "Pour créer votre compte, rendez-vous sur la page Créer un compte.";
    case "partner_program":
      return "Pour rejoindre le programme partenaires, ouvrez la page des Partenaires Fondateurs.";
    case "legal_information":
      return "Voici les conditions demandées : ouvrez la page correspondante.";
    case "privacy_information":
      return "Pour notre politique de confidentialité (RGPD), ouvrez la page dédiée.";
    case "navigate_to_page":
      return `Voici où aller : ${label}.`;
    default:
      return `Voici où aller : ${label}.`;
  }
}
