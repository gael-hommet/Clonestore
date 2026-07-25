/**
 * Constantes du bloc PWA (isolé — aucune dépendance P19).
 * Regroupe les textes exacts, clés de stockage et seuils d'engagement.
 */

/** Version PWA tracée sans secret (doit rester alignée avec public/sw.js). */
export const PWA_VERSION = "1.0.0";

/** Chemin du service worker (scope racine). */
export const SW_URL = "/sw.js";

/** Textes produit — repris à l'identique dans l'UI. */
export const PWA_COPY = {
  installCta: "Installer CloneStore",
  installSubtext: "Accédez à Pierre directement depuis votre écran d'accueil.",
  offline: "Connexion requise pour accéder à votre espace CloneStore.",
  updateTitle: "Nouvelle version disponible",
  updateCta: "Mettre à jour",
  onboarding: {
    step1: "Pierre est disponible sur votre téléphone.",
    step2: "Installez CloneStore pour retrouver votre cockpit en un geste.",
    step4: "Vous êtes prêt — retrouvez votre cockpit.",
  },
  iosSteps: [
    "Ouvrez le menu Partager",
    "Choisissez « Sur l'écran d'accueil »",
    "Confirmez",
  ] as const,
  iosOpenInSafari:
    "Sur iPhone/iPad, l'installation se fait depuis Safari. Ouvrez CloneStore dans Safari, puis suivez les étapes.",
} as const;

/** Clés localStorage (préfixe dédié pour ne rien collisionner). */
export const PWA_STORAGE = {
  visitCount: "cs.pwa.visitCount",
  dismissedAt: "cs.pwa.installDismissedAt",
  installedFlag: "cs.pwa.installed",
  onboardingSeen: "cs.pwa.onboardingSeen",
} as const;

/** Après un refus, on ne re-propose pas avant ce délai (14 jours). */
export const PWA_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/** Nombre minimal de visites avant une proposition non sollicitée. */
export const PWA_MIN_VISITS_FOR_INVITE = 2;
