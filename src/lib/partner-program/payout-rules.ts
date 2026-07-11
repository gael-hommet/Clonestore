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

// ── Statuts explicites d'un lot de versement ─────────────────────────────────
// `preview` n'existe QUE en mémoire : une prévisualisation n'écrit jamais en base.
export type TransferStatus =
  | "preview"
  | "pending"
  | "processing"
  | "transferred"
  | "failed_retryable"
  | "failed_permanent"
  | "reconciliation_required";

/**
 * Clé d'idempotence DÉTERMINISTE d'un versement.
 * Deux exécutions du même lot produisent la même clé → Stripe ne crée jamais deux transferts.
 * Si le lot change (remboursement arrivé entre-temps), la clé change : c'est un AUTRE versement.
 */
export function payoutIdempotencyKey(partnerId: string, periodKey: string, batchHash: string): string {
  return `partner-payout:${partnerId}:${periodKey}:${batchHash}`;
}

export type FailureClass = "failed_retryable" | "failed_permanent" | "reconciliation_required";

export type TransferFailure = {
  klass: FailureClass;
  /** Message exact affiché à l'admin — jamais « échec ». */
  message: string;
  /** Action précise attendue. */
  requiredAction: string;
};

/**
 * Classe un échec Stripe. La règle de sûreté : une issue INCONNUE (timeout, réseau, 5xx)
 * n'est JAMAIS un échec — le transfert a pu partir. On exige un rapprochement.
 */
export function classifyTransferFailure(input: { code?: string | null; type?: string | null; message?: string | null }): TransferFailure {
  const code = (input.code ?? "").toLowerCase();
  const type = (input.type ?? "").toLowerCase();

  // Issue inconnue : ne jamais conclure. Le transfert a peut-être abouti chez Stripe.
  if (type === "stripeconnectionerror" || type === "stripeapierror" || code === "etimedout" || code === "econnreset") {
    return {
      klass: "reconciliation_required",
      message: "Stripe n’a pas confirmé l’issue du transfert (délai ou erreur réseau). Le versement a peut-être abouti.",
      requiredAction: "Rapprochement requis : relancer le run interrogera Stripe avec la même clé d’idempotence avant toute recréation.",
    };
  }

  if (code === "balance_insufficient") {
    return {
      klass: "failed_retryable",
      message: "Le solde de la plateforme CloneStore est insuffisant pour effectuer ce transfert.",
      requiredAction: "Approvisionner le solde Stripe de la plateforme, puis relancer le run. Les commissions sont retournées au pool.",
    };
  }
  if (code === "rate_limit" || type === "striperatelimiterror") {
    return {
      klass: "failed_retryable",
      message: "Stripe a limité le débit des requêtes.",
      requiredAction: "Relancer le run : les commissions sont retournées au pool, aucun montant n’est perdu.",
    };
  }
  if (code === "account_invalid" || code === "transfers_not_allowed" || code === "insufficient_capabilities_for_transfer") {
    return {
      klass: "failed_permanent",
      message: "Le compte Stripe Connect du cabinet n’accepte pas les transferts (compte incomplet, restreint ou suspendu).",
      requiredAction: "Le cabinet doit terminer ou corriger son onboarding Stripe. Les commissions restent disponibles.",
    };
  }

  return {
    klass: "failed_retryable",
    message: input.message?.slice(0, 200) || "Stripe a refusé le transfert.",
    requiredAction: "Consulter le motif Stripe, corriger, puis relancer le run. Les commissions sont retournées au pool.",
  };
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
