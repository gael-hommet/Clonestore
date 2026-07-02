// Guided Tour — Tour authentifié « Mon CloneStore » (P9.2, Étape 9).
//
// Réutilise le MOTEUR P9.1 (aucun second moteur). Distinct du tour public
// (public-discovery) : id, version et clés de progression séparés → aucune
// collision. Ancré sur la home /profile (single-page), il explique l'espace
// client une fois connecté. Copy sans emoji, courte, premium.

import type { Tour } from "../types";

export const MY_CLONESTORE_TOUR_ID = "my-clonestore";

export const MY_CLONESTORE_WELCOME = {
  eyebrow: "Visite guidée",
  title: "Bienvenue dans votre espace",
  body: "On vous montre l'essentiel de Mon CloneStore en moins d'une minute.",
  accept: "Faire le tour",
  decline: "Plus tard",
  dismissLabel: "Fermer l'invitation",
} as const;

export const MY_CLONESTORE_TOUR: Tour = {
  id: MY_CLONESTORE_TOUR_ID,
  version: 1,
  name: "Découverte Mon CloneStore",
  description: "Tour authentifié de l'espace client : démarrage, empreinte, employés, cockpit, compte.",
  steps: [
    {
      id: "accueil",
      targetId: "mycs-header",
      route: "/profile",
      title: "Votre espace",
      body: "Mon CloneStore réunit vos employés IA, l'empreinte de votre entreprise et votre compte, au même endroit.",
      placement: "bottom",
      spotlightPadding: 14,
    },
    {
      id: "demarrage",
      targetId: "mycs-startup",
      route: "/profile",
      title: "Votre prochaine action",
      body: "Le bloc Démarrage vous indique toujours quoi faire ensuite pour avancer, en quelques minutes.",
      placement: "bottom",
      spotlightPadding: 12,
    },
    {
      id: "empreinte",
      targetId: "mycs-company",
      route: "/profile",
      title: "L'empreinte de votre entreprise",
      body: "Plus Pierre connaît votre contexte, plus il travaille juste. Vous complétez à votre rythme.",
      placement: "top",
      spotlightPadding: 12,
    },
    {
      id: "employes",
      targetId: "mycs-employees",
      route: "/profile",
      title: "Vos employés IA",
      body: "Ici, uniquement les employés réellement rattachés à votre compte, avec leur statut d'accès.",
      placement: "top",
      spotlightPadding: 12,
    },
    {
      id: "cockpit",
      targetId: "mycs-cockpit",
      route: "/profile",
      title: "L'accès au cockpit",
      body: "Quand Pierre est actif et prêt, ce bouton ouvre son cockpit opérationnel pour piloter les missions.",
      placement: "left",
      spotlightPadding: 10,
    },
    {
      id: "compte",
      targetId: "mycs-account",
      route: "/profile",
      title: "Votre compte",
      body: "Vos raccourcis vers l'empreinte, la facturation et le support — tout ce qui est réellement disponible.",
      placement: "top",
      spotlightPadding: 12,
    },
  ],
};
