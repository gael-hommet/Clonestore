// src/lib/clonechat/intelligence/c1/clonechat-product-knowledge.ts
// C1 — Connaissance produit CloneStore : ce que c'est, pour qui, pourquoi, comment
// c'est différent — avec l'état honnête (démo/réservation ouvertes, paiement fermé).

import type { AnswerMode } from "./clonechat-knowledge-types";

export const PRODUCT_IDENTITY = Object.freeze({
  name: "CloneStore",
  oneLiner: "CloneStore est la boutique d'employés IA d'entreprise : des employés IA opérationnels, gouvernés et tracés — le premier est Pierre, employé IA RH.",
  whatItIs: [
    "Une marketplace d'employés IA (le premier : Pierre, RH).",
    "Un espace connecté CloneOS : cockpit global, cockpit Pierre, CloneRoom.",
    "Une discipline : gouvernance, validation humaine, traçabilité, isolation par entreprise.",
  ],
  whatItIsNot: [
    "Un chatbot ou un assistant générique.",
    "Un logiciel de paie ou un cabinet juridique.",
    "Un produit déployé en production — l'ouverture payante attend les preuves externes.",
  ],
  differentiators: [
    "Un employé suit une mission ; un assistant ne fait que répondre.",
    "Tout est tracé : vous pouvez toujours reconstituer qui a fait quoi, quand, pourquoi.",
    "Les décisions sensibles restent sous validation humaine, par construction.",
    "La mémoire d'entreprise est durable et isolée — vous ne réexpliquez pas tout à chaque fois.",
  ],
  honestCurrentState: [
    "Version de lancement prête et démontrable (démo immersive, réservation fondateur).",
    "Le paiement en ligne n'est pas encore ouvert.",
    "Les activations externes (signature, envoi d'e-mails, voix, téléphonie, connecteurs) restent en préparation.",
  ],
});

/** Réponse canonique « Qu'est-ce que CloneStore ? » adaptée au mode. */
export function explainCloneStore(mode: AnswerMode): string {
  const base =
    `${PRODUCT_IDENTITY.oneLiner} ` +
    "Concrètement : vous confiez une demande, elle devient une mission structurée, préparée et tracée dans votre cockpit — et les décisions sensibles restent sous votre validation.";
  if (mode === "prospect" || mode === "visitor") {
    return (
      base +
      " La meilleure façon de comprendre : la démo immersive (/demo) ou la page de référence (/comprendre-clonestore)."
    );
  }
  if (mode === "founder" || mode === "internal") {
    return (
      base +
      " État interne : version de lancement prête ; paiement en ligne fermé ; activations externes en attente de vérification ; production non autorisée (plancher P10)."
    );
  }
  return base + " Votre espace : /cockpit pour piloter, /questions pour toute aide.";
}

export const PRODUCT_FAQ: readonly { readonly q: string; readonly a: string }[] = Object.freeze([
  {
    q: "Qu'est-ce qu'un employé IA ?",
    a: "Un employé IA prend en charge un périmètre de travail réel (missions, documents, suivis) avec des règles, des validations et une trace — là où un assistant se contente de répondre à des questions.",
  },
  {
    q: "Quelle est la différence avec ChatGPT ?",
    a: "ChatGPT vous aide à écrire. Un employé CloneStore vous aide à faire avancer le travail : il suit des missions dans la durée, connaît votre entreprise, trace tout, et demande votre validation sur le sensible.",
  },
  {
    q: "Est-ce disponible aujourd'hui ?",
    a: "La démo et la réservation fondateur sont ouvertes dès maintenant. Le paiement en ligne n'est pas encore ouvert : l'activation payante suivra les vérifications externes.",
  },
  {
    q: "Qui voit mes données ?",
    a: "Chaque entreprise est isolée : votre contexte, vos documents et votre mémoire restent dans votre périmètre, avec permissions fail-closed et audit.",
  },
]);
