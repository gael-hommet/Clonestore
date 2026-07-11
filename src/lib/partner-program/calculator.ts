// Programme « Cabinets Fondateurs » — calculateur d'estimation PUR (landing publique).
// Les chiffres affichés sont des ESTIMATIONS indicatives fondées sur le prix de
// référence Pierre (449 € HT/mois, FR/BE/LU) et le taux du programme (20 %).
// La commission réelle dépend exclusivement des montants HT effectivement encaissés
// (moteur financier serveur) — ce module ne calcule JAMAIS une commission due.

import { commissionTargetMinor, DEFAULT_COMMISSION_RATE_BPS } from "./money";

/** Prix de référence Pierre en unités mineures HT (FR/BE/LU) — 449,00 €. */
export const REFERENCE_PRICE_EUR_MINOR = 44_900;

/** Commission mensuelle indicative pour UN client actif : 89,80 €. */
export const REFERENCE_COMMISSION_EUR_MINOR = commissionTargetMinor(
  REFERENCE_PRICE_EUR_MINOR,
  DEFAULT_COMMISSION_RATE_BPS,
); // = 8980

export type CommissionEstimate = {
  clients: number;
  monthlyMinor: number;
  yearlyMinor: number;
};

/** Estimation indicative : clients actifs × 89,80 €/mois (entiers uniquement). */
export function estimateCommission(clients: number): CommissionEstimate {
  const n = Number.isSafeInteger(clients) && clients > 0 ? Math.min(clients, 10_000) : 0;
  const monthlyMinor = n * REFERENCE_COMMISSION_EUR_MINOR;
  return { clients: n, monthlyMinor, yearlyMinor: monthlyMinor * 12 };
}
