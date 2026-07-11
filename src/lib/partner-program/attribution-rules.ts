// Programme partenaires — règles d'attribution PURES (aucune I/O).
// Priorité des sources, fenêtres, détection d'auto-parrainage. Testable exhaustivement.

export type AttributionSource = "link" | "code" | "introduction" | "invitation" | "admin";

/** Priorité d'une source d'attribution (plus haut = plus fort). */
export function sourcePriority(source: AttributionSource): number {
  switch (source) {
    case "admin": return 100;
    case "introduction": return 80;
    case "invitation": return 60;
    case "code": return 40;
    case "link": return 20;
  }
}

/**
 * Une NOUVELLE attribution candidate peut-elle remplacer l'attribution PENDING courante ?
 *   • aucune attribution courante → oui ;
 *   • attribution VERROUILLÉE → non (jamais de changement libre après 1ʳᵉ facture payée) ;
 *   • sinon : oui seulement si la candidate est de priorité STRICTEMENT supérieure
 *     (première attribution valide gagne à priorité égale — pas de vol par un lien tardif).
 */
export function canSupersede(input: {
  current: { source: AttributionSource; status: "pending" | "locked" | "revoked" | "superseded" } | null;
  candidate: AttributionSource;
}): boolean {
  if (!input.current) return true;
  if (input.current.status === "locked") return false;
  if (input.current.status !== "pending") return true;
  return sourcePriority(input.candidate) > sourcePriority(input.current.source);
}

/** Une touche (touch/introduction) est-elle encore valide à `at` ? */
export function isTouchValid(input: { expiresAt: number; at: number }): boolean {
  return input.at <= input.expiresAt;
}

export type SelfReferralSignal =
  | "same_account" // le prospect EST le compte du partenaire
  | "shared_domain" // domaine email du prospect = domaine déclaré du cabinet
  | "same_stripe_customer"; // même Stripe Customer que le partenaire

/**
 * Évalue les signaux d'auto-parrainage. Retourne la liste des signaux détectés (explicables).
 * Un signal non vide DOIT bloquer l'attribution automatique (mise en revue), jamais
 * silencieusement créditer.
 */
export function detectSelfReferral(input: {
  partnerAccountUserId: string | null;
  subjectUserId: string;
  partnerSelfDomains: string[];
  subjectEmailDomain: string | null;
  partnerStripeCustomerId: string | null;
  subjectStripeCustomerId: string | null;
}): SelfReferralSignal[] {
  const signals: SelfReferralSignal[] = [];
  if (input.partnerAccountUserId && input.partnerAccountUserId === input.subjectUserId) signals.push("same_account");
  if (
    input.subjectEmailDomain &&
    input.partnerSelfDomains.map((d) => d.toLowerCase()).includes(input.subjectEmailDomain.toLowerCase())
  ) {
    signals.push("shared_domain");
  }
  if (
    input.partnerStripeCustomerId &&
    input.subjectStripeCustomerId &&
    input.partnerStripeCustomerId === input.subjectStripeCustomerId
  ) {
    signals.push("same_stripe_customer");
  }
  return signals;
}
