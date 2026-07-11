// Programme partenaires — règles de VERSEMENT pures. Décide si un cabinet est éligible et
// quel montant net verser. Aucune I/O. Les montants sont en centimes entiers.

export type PayoutEligibilityInput = {
  partnerStatus: "pending" | "contract_pending" | "stripe_pending" | "active" | "suspended" | "archived";
  payoutsEnabled: boolean; // Stripe Connect payouts_enabled
  onboardingStatus: "none" | "pending" | "complete" | "restricted";
  availableMinor: number; // solde disponible NET (reversals inclus, réserve écoulée, hors gelées)
  frozenMinor: number; // montant gelé (litige) — informational
  thresholdMinor: number; // seuil minimum de versement
  hasOpenDispute: boolean; // au moins un litige ouvert sur le cabinet
};

export type PayoutDecision =
  | { eligible: true; amountMinor: number }
  | { eligible: false; reason: string };

/**
 * Décide l'éligibilité au versement.
 *   partenaire non actif                → non
 *   onboarding Stripe incomplet / payouts désactivés → non (jamais de versement à un compte non prêt)
 *   litige ouvert                       → non (gel de sécurité)
 *   solde disponible <= 0               → non
 *   solde disponible < seuil            → non (reporté)
 *   sinon                               → oui, pour le montant disponible net
 */
export function decidePayout(input: PayoutEligibilityInput): PayoutDecision {
  if (input.partnerStatus !== "active") return { eligible: false, reason: "partner_inactive" };
  if (input.onboardingStatus !== "complete" || !input.payoutsEnabled) return { eligible: false, reason: "stripe_not_ready" };
  if (input.hasOpenDispute) return { eligible: false, reason: "open_dispute" };
  if (input.availableMinor <= 0) return { eligible: false, reason: "nothing_available" };
  if (input.availableMinor < input.thresholdMinor) return { eligible: false, reason: "below_threshold" };
  return { eligible: true, amountMinor: input.availableMinor };
}

/** Clé de période mensuelle (ex. 2026-08) à partir d'une date. */
export function monthPeriodKey(date: { getUTCFullYear(): number; getUTCMonth(): number }): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Bornes UTC (début inclus, fin exclus) du mois précédent pour un `now` donné. */
export function previousMonthBounds(now: Date): { start: string; end: string; key: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString(), key: monthPeriodKey(start) };
}
