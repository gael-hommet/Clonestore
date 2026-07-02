// Guided Tour — Tour CloneChat (P9.4, Section 12). Réutilise le moteur P9.1.
// Distinct des tours public / My CloneStore / cockpit (id/version/clés séparés →
// aucune collision). Ancré sur /assistant. Copy courte, humaine, sans emoji.

import type { Tour } from "../types";

export const CLONECHAT_TOUR_ID = "clonechat";

export const CLONECHAT_WELCOME = {
  eyebrow: "Visite guidée",
  title: "CloneChat, votre assistant",
  body: "En moins d'une minute, découvrez comment dialoguer avec CloneStore et agir en toute confiance.",
  accept: "Faire le tour",
  decline: "Plus tard",
  dismissLabel: "Fermer l'invitation",
} as const;

const ROUTE = "/assistant";

export const CLONECHAT_TOUR: Tour = {
  id: CLONECHAT_TOUR_ID,
  version: 1,
  name: "Découverte de CloneChat",
  description: "Tour de l'assistant conversationnel : dialogue, contexte réel, actions gouvernées, passage au cockpit.",
  steps: [
    { id: "header", targetId: "clonechat-header", route: ROUTE, title: "Votre assistant CloneStore", body: "CloneChat comprend vos demandes, connaît votre espace une fois connecté, et vous oriente toujours honnêtement.", placement: "bottom", spotlightPadding: 12 },
    { id: "thread", targetId: "clonechat-thread", route: ROUTE, title: "Un vrai dialogue", body: "Vos échanges apparaissent ici, avec des cartes réelles : missions, validations, salariés, documents.", placement: "top", spotlightPadding: 10 },
    { id: "input", targetId: "clonechat-input", route: ROUTE, title: "Demandez naturellement", body: "Écrivez comme vous parlez : « où en est Pierre ? », « prépare un contrat pour Marie ». Rien de sensible n'est fait sans votre confirmation.", placement: "top", spotlightPadding: 10 },
    { id: "cockpit", targetId: "clonechat-cockpit-link", route: ROUTE, title: "Passez au cockpit", body: "À tout moment, ouvrez le cockpit de Pierre pour le détail complet d'une mission ou d'une validation.", placement: "bottom", spotlightPadding: 10 },
  ],
};
