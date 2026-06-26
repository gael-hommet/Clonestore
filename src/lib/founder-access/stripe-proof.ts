// E-R2 — Vérité Stripe : mapping de statut FAIL-CLOSED (§4), preuve commerciale
// stricte (§2), ordre total déterministe des événements (§3). Fonctions PURES.

import { FOUNDER_SUBSCRIPTION_AMOUNT_CENTS, FOUNDER_CURRENCY } from "./commercial";

// ── §4 — Statut d'abonnement supporté (inconnu = fail-closed) ────────────────
export const STRIPE_SUPPORTED_STATUSES = [
  "active", "trialing", "incomplete", "incomplete_expired", "past_due", "unpaid", "canceled", "paused",
] as const;
export type StripeSupportedStatus = (typeof STRIPE_SUPPORTED_STATUSES)[number];

export type StripeStatusDecision =
  | { ok: true; status: StripeSupportedStatus }
  | { ok: false; reason: "unsupported_stripe_status"; raw_status: string };

const SUPPORTED_SET = new Set<string>(STRIPE_SUPPORTED_STATUSES);

/** Mappe un statut Stripe en statut supporté. Un statut inconnu N'EST PLUS converti
 *  en `none` : il échoue fermé (aucune activation ni désactivation silencieuse). */
export function mapStripeSubscriptionStatusStrict(raw: string | null | undefined): StripeStatusDecision {
  if (typeof raw === "string" && SUPPORTED_SET.has(raw)) return { ok: true, status: raw as StripeSupportedStatus };
  return { ok: false, reason: "unsupported_stripe_status", raw_status: typeof raw === "string" ? raw : String(raw) };
}

/** Statuts accordant l'accès (MRR). */
export function stripeStatusGrants(s: StripeSupportedStatus): boolean {
  return s === "active" || s === "trialing";
}
/** Statuts terminaux/défavorables : ne doivent jamais être annulés par un événement ambigu. */
export function stripeStatusIsUnfavorable(s: StripeSupportedStatus): boolean {
  return s === "canceled" || s === "unpaid" || s === "incomplete_expired";
}

// ── §2 — Preuve commerciale stricte ─────────────────────────────────────────
export interface StripeCommercialProofInput {
  priceId?: string | null;
  productMatches?: boolean | null;   // si le produit a pu être vérifié
  amountCents?: number | null;
  currency?: string | null;          // attendu 'eur' (insensible à la casse)
  interval?: string | null;          // attendu 'month'
  subscriptionId?: string | null;
  customerId?: string | null;
  reservationId?: string | null;
  livemode?: boolean | null;
  /** email du client Stripe (si disponible) vs email de la réservation (normalisés). */
  customerEmailNormalized?: string | null;
  reservationEmailNormalized?: string | null;
}

export type StripeCommercialProofDecision =
  | { allowed: true; reservationId: string; amount_cents: number; currency: string }
  | { allowed: false; reason: string };

/**
 * Valide qu'un paiement Stripe correspond RÉELLEMENT à l'offre Pierre fondateur.
 * Toute preuve manquante ou divergente → refus (jamais d'activation).
 * `envIsProduction` : en prod on exige livemode=true ; sinon livemode=false.
 */
export function validateFounderStripeCommercialProof(
  input: StripeCommercialProofInput,
  opts: { expectedPriceId: string | null; envIsProduction: boolean },
): StripeCommercialProofDecision {
  // E-R2 §4 — pour un événement qui ACCORDE l'accès, AUCUNE preuve n'est optionnelle :
  // toute valeur absente (null/undefined) est un refus, jamais un laissez-passer.
  if (!input.reservationId) return { allowed: false, reason: "missing_reservation" };
  if (!input.subscriptionId) return { allowed: false, reason: "missing_subscription" };
  if (!input.customerId) return { allowed: false, reason: "missing_customer" };

  // Price ID : doit être configuré ET correspondre exactement.
  if (!opts.expectedPriceId) return { allowed: false, reason: "price_not_configured" };
  if (!input.priceId) return { allowed: false, reason: "missing_price_id" };
  if (input.priceId !== opts.expectedPriceId) return { allowed: false, reason: "price_id_mismatch" };

  // Produit Pierre : preuve OBLIGATOIRE (true), pas seulement « non faux ».
  if (input.productMatches !== true) return { allowed: false, reason: "product_not_verified" };

  // Montant + devise + intervalle : tous présents et conformes.
  if (input.amountCents == null) return { allowed: false, reason: "missing_amount" };
  if (input.amountCents !== FOUNDER_SUBSCRIPTION_AMOUNT_CENTS) return { allowed: false, reason: "amount_mismatch" };
  if (!input.currency) return { allowed: false, reason: "missing_currency" };
  if (input.currency.toLowerCase() !== FOUNDER_CURRENCY.toLowerCase()) return { allowed: false, reason: "currency_mismatch" };
  if (!input.interval) return { allowed: false, reason: "missing_interval" };
  if (input.interval !== "month") return { allowed: false, reason: "interval_mismatch" };

  // Cohérence email client/réservation lorsque les deux sont disponibles.
  if (input.customerEmailNormalized && input.reservationEmailNormalized
    && input.customerEmailNormalized !== input.reservationEmailNormalized) {
    return { allowed: false, reason: "customer_email_mismatch" };
  }

  // Cohérence live/test : livemode OBLIGATOIRE et cohérent avec l'environnement.
  if (typeof input.livemode !== "boolean") return { allowed: false, reason: "missing_livemode" };
  if (input.livemode !== opts.envIsProduction) return { allowed: false, reason: "livemode_mismatch" };

  return { allowed: true, reservationId: input.reservationId, amount_cents: input.amountCents, currency: input.currency };
}

// ── §3 — Ordre total déterministe ───────────────────────────────────────────
export interface StripeEventOrderKey { created: number; event_id: string }

/** Compare deux clés d'ordre : created croissant puis event_id lexicographique. */
export function compareStripeEventOrder(a: StripeEventOrderKey, b: StripeEventOrderKey): number {
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  if (a.event_id === b.event_id) return 0;
  return a.event_id < b.event_id ? -1 : 1;
}

/**
 * Décide si un événement entrant doit être APPLIQUÉ, compte tenu du dernier appliqué
 * et de l'état courant. Règles :
 *  - strictement plus ancien (clé d'ordre <) → ignoré (stale) ;
 *  - même clé d'ordre → ignoré (déjà couvert / ambigu) ;
 *  - même `created` mais accorde l'accès alors que l'état courant est défavorable
 *    (terminal) → ignoré (un état terminal ne se réactive pas sans preuve plus récente) ;
 *  - sinon → appliqué.
 */
export function decideStripeApplication(args: {
  incoming: StripeEventOrderKey;
  last: StripeEventOrderKey | null;
  incomingGrants: boolean;
  currentUnfavorable: boolean;
}): { apply: true } | { apply: false; reason: "stale" | "same_order" | "terminal_precedence" } {
  const { incoming, last } = args;
  if (last && last.created !== 0) {
    const cmp = compareStripeEventOrder(incoming, last);
    if (cmp < 0) return { apply: false, reason: "stale" };
    if (cmp === 0) return { apply: false, reason: "same_order" };
    // cmp > 0 : plus récent par clé. Précédence terminale au même `created`.
    if (incoming.created === last.created && args.incomingGrants && args.currentUnfavorable) {
      return { apply: false, reason: "terminal_precedence" };
    }
  }
  return { apply: true };
}
