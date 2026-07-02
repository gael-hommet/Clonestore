// Guided Tour — Tour authentifié « Cockpit Pierre » (P9.3, Section 14).
//
// Réutilise le MOTEUR P9.1 (aucun second moteur). Distinct des tours public et
// My CloneStore (id/version/clés de progression séparés → aucune collision).
// Ancré sur /agents/pierre/use ; cible le header + les onglets internes, toujours
// présents quelle que soit la vue active. Copy courte, humaine, sans emoji.

import type { Tour } from "../types";

export const PIERRE_COCKPIT_TOUR_ID = "pierre-cockpit";

export const PIERRE_COCKPIT_WELCOME = {
  eyebrow: "Visite guidée",
  title: "Le cockpit de Pierre",
  body: "En moins d'une minute, découvrez comment suivre le travail de Pierre et prendre vos décisions.",
  accept: "Faire le tour",
  decline: "Plus tard",
  dismissLabel: "Fermer l'invitation",
} as const;

const ROUTE = "/agents/pierre/use";

export const PIERRE_COCKPIT_TOUR: Tour = {
  id: PIERRE_COCKPIT_TOUR_ID,
  version: 1,
  name: "Découverte du cockpit Pierre",
  description: "Tour authentifié du cockpit opérationnel : état, attention, missions, validations, documents, salariés, activité, configuration.",
  steps: [
    {
      id: "etat",
      targetId: "pierre-cockpit-header",
      route: ROUTE,
      title: "L'état de Pierre",
      body: "En un coup d'œil : ce que fait Pierre, s'il attend une décision de votre part, et la dernière actualisation.",
      placement: "bottom",
      spotlightPadding: 12,
    },
    {
      id: "attention",
      targetId: "pierre-attention",
      route: ROUTE,
      title: "À traiter maintenant",
      body: "La vue d'ensemble met en avant ce qui attend VOTRE action : validations, informations manquantes, incidents.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "missions",
      targetId: "pierre-missions",
      route: ROUTE,
      title: "Les missions",
      body: "Retrouvez tout ce que vous avez confié à Pierre, avec recherche, filtres et détail complet.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "validations",
      targetId: "pierre-validations",
      route: ROUTE,
      title: "Vos validations",
      body: "Pierre ne fait rien de sensible sans votre accord. Approuvez, refusez ou demandez des modifications ici.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "documents",
      targetId: "pierre-documents",
      route: ROUTE,
      title: "Les documents",
      body: "Les contrats, attestations et communications préparés par Pierre, au fil des missions.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "salaries",
      targetId: "pierre-employees",
      route: ROUTE,
      title: "Vos salariés",
      body: "Un accès rapide aux salariés suivis. Le dossier complet vit dans Employee 360.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "activite",
      targetId: "pierre-activity",
      route: ROUTE,
      title: "L'activité",
      body: "L'historique lisible de ce que Pierre a fait, étape par étape, sans jargon technique.",
      placement: "bottom",
      spotlightPadding: 10,
    },
    {
      id: "configuration",
      targetId: "pierre-settings",
      route: ROUTE,
      title: "Configurer Pierre",
      body: "Ton, autonomie, identité d'envoi : ajustez le comportement de Pierre quand vous le souhaitez.",
      placement: "bottom",
      spotlightPadding: 10,
    },
  ],
};
