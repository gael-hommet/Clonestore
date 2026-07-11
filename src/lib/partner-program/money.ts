// Programme « Cabinets Fondateurs » — moteur d'argent PUR.
// Unités mineures ENTIÈRES (centimes) exclusivement ; taux en basis points
// (20 % = 2000 bps). AUCUN float financier : toutes les opérations sont des
// entiers vérifiés (Number.isSafeInteger) — les ordres de grandeur du programme
// (abonnements mensuels en centimes × bps ≤ ~10^9) restent très loin de 2^53.
//
// RÈGLE D'ARRONDI (documentée, déterministe) :
//   La commission CUMULÉE d'une facture = floor(base_HT_nette_cumulée × rate_bps / 10000),
//   la base cumulée étant toujours ≥ 0. Chaque écriture du ledger est la DIFFÉRENCE
//   entre cette cible cumulée et la somme des écritures déjà passées pour la facture.
//   Conséquences :
//   • l'arrondi se fait toujours au centime INFÉRIEUR sur le cumul (jamais sur chaque
//     événement isolé) → pas de dérive d'arrondi quand des remboursements partiels
//     s'enchaînent ;
//   • un remboursement total ramène la cible à floor(0) = 0, donc la somme des
//     écritures (commission + reversals) vaut exactement 0 ;
//   • jamais de sur-reversement : la somme du ledger par facture est toujours égale
//     à la cible, ni plus ni moins.

export const DEFAULT_COMMISSION_RATE_BPS = 2000; // 20 %
export const BPS_DENOMINATOR = 10_000;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`montant financier invalide (${label}): ${value} — entier requis (unités mineures)`);
  }
}

/** Vérifie qu'un montant est un entier d'unités mineures ≥ 0. */
export function assertMinorAmount(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) throw new Error(`montant financier négatif interdit (${label}): ${value}`);
}

/** Vérifie qu'un taux bps est un entier plausible (0 → 10000). */
export function assertRateBps(rateBps: number): void {
  assertSafeInteger(rateBps, "rate_bps");
  if (rateBps < 0 || rateBps > BPS_DENOMINATOR) {
    throw new Error(`taux bps hors bornes: ${rateBps}`);
  }
}

/**
 * Cible de commission cumulée pour une base HT nette cumulée (≥ 0).
 * floor(base × bps / 10000) en arithmétique entière.
 */
export function commissionTargetMinor(eligibleNetTotalMinor: number, rateBps: number): number {
  assertMinorAmount(eligibleNetTotalMinor, "eligible_net_total");
  assertRateBps(rateBps);
  return Math.floor((eligibleNetTotalMinor * rateBps) / BPS_DENOMINATOR);
}

/**
 * Écriture à passer au ledger = cible cumulée − somme déjà écrite pour la facture.
 * Peut être négative (reversal), positive (commission/complément) ou nulle (rien à écrire).
 */
export function commissionDeltaMinor(input: {
  eligibleNetTotalMinor: number; // base HT nette cumulée APRÈS l'événement (≥ 0)
  rateBps: number;
  alreadyWrittenMinor: number; // somme signée des écritures existantes de la facture
}): number {
  assertSafeInteger(input.alreadyWrittenMinor, "already_written");
  const target = commissionTargetMinor(input.eligibleNetTotalMinor, input.rateBps);
  return target - input.alreadyWrittenMinor;
}

/**
 * Base HT éligible d'une facture Stripe payée (unités mineures).
 * Priorité à total_excluding_tax (déjà net de remises, hors TVA) ; sinon total − tax.
 * Facture non réellement encaissée (amount_paid ≤ 0) → 0. Jamais négatif.
 */
export function eligibleNetFromInvoice(input: {
  totalMinor: number;
  taxMinor: number;
  totalExcludingTaxMinor: number | null;
  amountPaidMinor: number;
}): number {
  assertSafeInteger(input.totalMinor, "invoice_total");
  assertSafeInteger(input.taxMinor, "invoice_tax");
  assertSafeInteger(input.amountPaidMinor, "invoice_amount_paid");
  if (input.totalExcludingTaxMinor !== null) {
    assertSafeInteger(input.totalExcludingTaxMinor, "invoice_total_excluding_tax");
  }
  if (input.amountPaidMinor <= 0) return 0;
  const base =
    input.totalExcludingTaxMinor !== null
      ? input.totalExcludingTaxMinor
      : input.totalMinor - input.taxMinor;
  return Math.max(0, base);
}

/**
 * Part HT d'un remboursement TTC, au prorata de la facture d'origine :
 * floor(refund_ttc × base_HT / total_ttc), bornée par la base HT restante.
 * total_ttc ≤ 0 (facture 100 % remisée) → 0.
 */
export function refundEligibleNetMinor(input: {
  refundTtcMinor: number;
  invoiceTotalMinor: number;
  invoiceEligibleNetMinor: number;
  remainingEligibleNetMinor: number;
}): number {
  assertMinorAmount(input.refundTtcMinor, "refund_ttc");
  assertSafeInteger(input.invoiceTotalMinor, "invoice_total");
  assertMinorAmount(input.invoiceEligibleNetMinor, "invoice_eligible_net");
  assertMinorAmount(input.remainingEligibleNetMinor, "remaining_eligible_net");
  if (input.invoiceTotalMinor <= 0) return 0;
  const proportional = Math.floor(
    (input.refundTtcMinor * input.invoiceEligibleNetMinor) / input.invoiceTotalMinor,
  );
  return Math.min(Math.max(0, proportional), input.remainingEligibleNetMinor);
}

/** Formate un montant en unités mineures vers une chaîne lisible (ex. 8980 → "89,80 €"). */
export function formatMinorAmount(minor: number, currency: string): string {
  assertSafeInteger(minor, "format_amount");
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const units = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  const unitsStr = units.toLocaleString("fr-FR");
  const symbol = currency.toLowerCase() === "eur" ? "€" : currency.toUpperCase();
  return `${sign}${unitsStr},${cents} ${symbol}`;
}
