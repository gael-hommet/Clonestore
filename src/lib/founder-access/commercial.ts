// Phase E — Founder Access : calendrier commercial verrouillé (Europe/Paris).
//
// Source de vérité unique des dates, du tarif et des libellés de CTA, dérivée des
// constantes déjà verrouillées dans la présentation /demo (réutilisées, non
// dupliquées). Fonctions PURES, sûres en SSR/edge/Node, sans effet de bord.

import {
  DEMO_LAUNCH_ISO,
  FOUNDER_CLOSE_ISO,
  DEMO_LAUNCH_LABEL,
  FOUNDER_CLOSE_LABEL,
  FOUNDER_PRICE,
  FOUNDER_PRICE_MONTHLY,
  FOUNDER_PRICE_RULE,
} from "@/lib/demo/presentation/commercial-state";

export {
  DEMO_LAUNCH_ISO,
  FOUNDER_CLOSE_ISO,
  DEMO_LAUNCH_LABEL,
  FOUNDER_CLOSE_LABEL,
  FOUNDER_PRICE,
  FOUNDER_PRICE_MONTHLY,
  FOUNDER_PRICE_RULE,
};

export const FOUNDER_SUBSCRIPTION_AMOUNT_CENTS = 44900; // 449,00 € HT
export const FOUNDER_CURRENCY = "EUR";

/** Trois phases commerciales : réservation, activation, fermeture. */
export type FounderPhase = "before_launch" | "launched" | "closed";

export function getFounderPhase(now: Date = new Date()): FounderPhase {
  const t = now.getTime();
  if (t >= new Date(FOUNDER_CLOSE_ISO).getTime()) return "closed";
  if (t >= new Date(DEMO_LAUNCH_ISO).getTime()) return "launched";
  return "before_launch";
}

export interface FounderCtaCopy {
  phase: FounderPhase;
  /** Libellé du CTA commercial principal. */
  primaryLabel: string;
  /** Sous-texte de réassurance (jamais de fausse urgence). */
  subtext: string;
  /** L'accès fondateur est-il encore ouvert à la réservation/activation ? */
  open: boolean;
  /** Route cible du CTA. */
  href: string;
}

/**
 * Libellés de CTA selon la phase. Avant lancement : réserver. Après lancement :
 * activer. Après fermeture : ne plus présenter l'accès fondateur comme disponible.
 */
export function getFounderCtaCopy(phase: FounderPhase = getFounderPhase()): FounderCtaCopy {
  if (phase === "closed") {
    return {
      phase,
      primaryLabel: "Découvrir les conditions actuelles",
      subtext: "L'accès fondateur est clôturé. Écrivez-nous pour connaître les conditions en vigueur.",
      open: false,
      href: "/questions",
    };
  }
  if (phase === "launched") {
    return {
      phase,
      primaryLabel: "Activer Pierre à 449 € HT/mois",
      subtext: "Activation immédiate. Tarif fondateur conservé tant que l'abonnement reste actif.",
      open: true,
      href: "/reserver/pierre",
    };
  }
  return {
    phase,
    primaryLabel: "Réserver Pierre à 449 € HT/mois",
    subtext: "Aucun paiement aujourd'hui. Nous vous préviendrons dès que Pierre pourra être activé.",
    open: true,
    href: "/reserver/pierre",
  };
}

/** Bloc de réassurance affiché dans le composant de réservation (§6). */
export const FOUNDER_REASSURANCE: readonly string[] = [
  "Aucun paiement aujourd'hui.",
  `Ouverture des activations le ${DEMO_LAUNCH_LABEL}.`,
  FOUNDER_PRICE_MONTHLY + ".",
  "Tarif conservé tant que l'abonnement reste actif après activation.",
];

/** Règle de réservation (ne jamais affirmer que l'email verrouille le prix). */
export const FOUNDER_RESERVATION_RULE =
  "La réservation ne déclenche aucun paiement et ne verrouille pas définitivement le tarif. " +
  "Le tarif fondateur est conservé lorsque l'abonnement est activé avant le " +
  FOUNDER_CLOSE_LABEL + ".";
