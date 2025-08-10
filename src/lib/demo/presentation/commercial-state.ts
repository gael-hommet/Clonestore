// /demo — État commercial dynamique (avant / après lancement)
//
// Source de vérité pour les dates et le tarif fondateur affichés dans la
// présentation publique /demo. Fonctions PURES, sans effet de bord, sûres en
// SSR comme en client. Aucune donnée personnelle, aucun appel réseau.
//
// Dates verrouillées par le master prompt (source de vérité UNIQUE du lancement) :
//   • Lancement officiel : 8 septembre 2026 (précédemment prévu en août 2026)
//   • Fermeture accès fondateur : 30 septembre 2026 à 23 h 59 (heure de Paris)
//   • Tarif fondateur : 449 € HT / mois, conservé sans limite tant que
//     l'abonnement reste actif.
// Avant le 8 septembre 2026 : réservations ouvertes / pré-lancement. Le 8 septembre 2026 :
// lancement officiel. Ne jamais présenter CloneStore comme officiellement lancé avant cette date.

export type CommercialPhase = "before_launch" | "launched";

/** 8 septembre 2026 — LANCEMENT OFFICIEL de CloneStore / Pierre (heure de Paris, UTC+2). Date de
 *  lancement précédemment prévue en août 2026, officiellement reportée au 8 septembre 2026. */
export const DEMO_LAUNCH_ISO = "2026-09-08T00:00:00+02:00";

/** 30 septembre 2026 à 23 h 59 — fermeture de la fenêtre fondateur (heure de Paris), maintenue après le lancement officiel du 8 septembre 2026. */
export const FOUNDER_CLOSE_ISO = "2026-09-30T23:59:00+02:00";

export const DEMO_LAUNCH_LABEL = "8 septembre 2026";
export const FOUNDER_CLOSE_LABEL = "30 septembre 2026 à 23 h 59, heure de Paris";

export const FOUNDER_PRICE = "449 € HT";
export const FOUNDER_PRICE_MONTHLY = "449 € HT/mois";
export const FOUNDER_PRICE_MONTHLY_LONG = "449 € HT par mois";

/** Règle tarifaire verrouillée — identique avant et après le lancement. */
export const FOUNDER_PRICE_RULE =
  "Le tarif fondateur de 449 € HT par mois est conservé sans limite de durée tant que l'abonnement reste actif.";

export interface FounderCommercialCopy {
  phase: CommercialPhase;
  /** Phrase de disponibilité (E2.10). */
  availability: string;
  /** Libellé du CTA secondaire (reste visuellement inférieur). */
  secondaryCta: string;
  /** Note d'accès fondateur (2 lignes). */
  accessNote: string[];
  /** Règle tarifaire (toujours affichée). */
  priceRule: string;
}

/** Détermine la phase commerciale à partir d'une date (par défaut : maintenant). */
export function getCommercialPhase(now: Date = new Date()): CommercialPhase {
  return now.getTime() >= new Date(DEMO_LAUNCH_ISO).getTime()
    ? "launched"
    : "before_launch";
}

/**
 * Renvoie l'ensemble des libellés commerciaux verrouillés selon la phase.
 * Tous les textes proviennent mot pour mot du master prompt (§21).
 */
export function getFounderCommercialCopy(
  phase: CommercialPhase = getCommercialPhase(),
): FounderCommercialCopy {
  if (phase === "launched") {
    return {
      phase,
      availability: "Pierre est disponible pour votre entreprise.",
      secondaryCta: "Déjà convaincu ? Activer Pierre à 449 € HT/mois",
      accessNote: [
        `Accès fondateur disponible jusqu'au ${FOUNDER_CLOSE_LABEL}.`,
        "Tarif conservé tant que l'abonnement reste actif.",
      ],
      priceRule: FOUNDER_PRICE_RULE,
    };
  }

  return {
    phase,
    availability: `Lancement officiel le ${DEMO_LAUNCH_LABEL}.`,
    secondaryCta: "Déjà convaincu ? Réserver Pierre à 449 € HT/mois",
    accessNote: [
      "Accès fondateur : 449 € HT/mois",
      "Aucun paiement avant l'ouverture des activations.",
    ],
    priceRule: FOUNDER_PRICE_RULE,
  };
}
