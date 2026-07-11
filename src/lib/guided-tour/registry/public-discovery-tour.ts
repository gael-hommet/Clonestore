// Guided Tour — Tour public de découverte (P9.1, parcours MULTI-PAGE).
//
// Séquence commerciale et conviviale qui TRAVERSE réellement plusieurs pages
// publiques du site, sans jamais les redessiner. Cible uniquement des attributs
// `data-tour-id` stables. Copy : sans emoji, phrases courtes, ton humain, premium
// — un clin d'œil discret autorisé, pas de jargon.
//
// Routes réellement traversées : / → /agents → /agents/pierre → /assistant
// (workspace CloneChat réel, mode orientation publique) → /demo/pierre → /login
// (entrée publique vers My CloneStore) → retour / (finale centrée). Toutes
// publiques : jamais d'espace authentifié inaccessible au visiteur.

import type { Tour } from "../types";

export const PUBLIC_DISCOVERY_TOUR_ID = "public-discovery";

/** Copy de l'invitation discrète (overlay de bienvenue, 1ʳᵉ visite). */
export const PUBLIC_DISCOVERY_WELCOME = {
  eyebrow: "Découverte",
  title: "Première visite ?",
  body: "On vous montre l’essentiel de CloneStore en moins d’une minute.",
  accept: "Faire le tour",
  decline: "Plus tard",
  dismissLabel: "Fermer l’invitation",
} as const;

export const PUBLIC_DISCOVERY_TOUR: Tour = {
  // v2 : passage au parcours multi-page (invalide l'ancienne progression v1).
  id: PUBLIC_DISCOVERY_TOUR_ID,
  version: 2,
  name: "Découverte CloneStore",
  description:
    "Tour public multi-page des espaces essentiels de CloneStore pour un visiteur non-client.",
  steps: [
    {
      id: "clonestore",
      targetId: "homepage-primary",
      route: "/",
      title: "Bienvenue chez CloneStore",
      body: "CloneStore installe de vrais employés IA spécialisés, capables de prendre en charge une fonction entière de l’entreprise.",
      placement: "bottom",
      spotlightPadding: 16,
    },
    {
      id: "boutique",
      targetId: "boutique-entry",
      route: "/agents",
      title: "La boutique",
      body: "C’est ici qu’on choisit un employé IA selon le besoin de l’entreprise. On commence par les postes déjà ouverts.",
      placement: "bottom",
      spotlightPadding: 14,
    },
    {
      id: "pierre",
      targetId: "pierre-page-entry",
      route: "/agents/pierre",
      title: "Pierre, aux RH",
      body: "Pierre ne se contente pas de conseiller : il prend en charge la fonction RH, de la demande jusqu’au document produit.",
      placement: "bottom",
      spotlightPadding: 14,
    },
    {
      id: "clonechat",
      targetId: "clonechat-entry",
      route: "/assistant",
      title: "CloneChat",
      body: "Le point de contact naturel avec les employés IA : posez une question, orientez-vous, et une fois connecté, agissez avec Pierre sous votre validation.",
      placement: "bottom",
      spotlightPadding: 14,
    },
    {
      id: "demo",
      targetId: "demo-entry",
      route: "/demo/pierre",
      title: "La démonstration",
      body: "Voyez Pierre travailler pour de vrai avant d’acheter. Sans engagement, et sans mauvaise surprise.",
      placement: "bottom",
      spotlightPadding: 12,
    },
    {
      id: "my-clonestore",
      targetId: "client-space-entry",
      route: "/login",
      title: "Mon CloneStore",
      body: "Une fois client, l’entreprise retrouve ses employés IA, ses missions, ses documents et ses échanges dans un seul espace.",
      placement: "bottom",
      spotlightPadding: 14,
    },
    {
      id: "next",
      targetId: null,
      route: "/",
      title: "À vous de jouer",
      body: "Vous avez l’essentiel. Ouvrez la boutique, lancez la démonstration, ou continuez tranquillement votre visite.",
      placement: "center",
      actions: [
        {
          label: "Découvrir la boutique",
          behavior: "navigate",
          href: "/agents",
          variant: "primary",
        },
        {
          label: "Lancer la démo",
          behavior: "navigate",
          href: "/demo/pierre",
          variant: "secondary",
        },
        { label: "Continuer la visite", behavior: "finish", variant: "ghost" },
      ],
    },
  ],
};
