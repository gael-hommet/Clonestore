// Canonical Analytics Runtime Wiring — pont additif best-effort webhook Stripe → sink canonique.
// Émet payment_succeeded / payment_failed / payment_refunded UNIQUEMENT côté serveur, après
// vérification de signature et traitement métier (le webhook reste la seule source de vérité du
// paiement). Auto-avalant ET borné dans le temps : ne jette jamais et ne peut jamais retarder la
// réponse 200/500 renvoyée à Stripe. Ne calcule aucune commission, ne modifie aucun payout, ne
// fait jamais confiance à un montant/partner_id client. Corrélation résolue SANS cookie.

import { getAnalyticsDbForIngestion } from "@/lib/analytics/runtime";
import {
  recordCanonicalServerEvent,
  boundedAnalyticsWrite,
  resolveAnalyticsEnvironment,
  type BestEffortOutcome,
} from "@/lib/analytics/server-events";
import { resolvePartnerAttributionForUser } from "./partner-attribution-resolver";
import {
  resolveCorrelationByReservation,
  resolveCorrelationByOrderRef,
  upsertConversionLink,
  hashRef,
} from "@/lib/analytics/correlation";
import type { CanonicalAnalyticsEventName } from "@/lib/analytics/schema";

const PAYMENT_EVENTS: ReadonlySet<string> = new Set<CanonicalAnalyticsEventName>([
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
]);

export interface CanonicalPaymentEventInput {
  eventName: Extract<CanonicalAnalyticsEventName, "payment_succeeded" | "payment_failed" | "payment_refunded">;
  /** stripe_event_id — clé d'idempotence : un rejeu du même webhook ne crée jamais un 2ᵉ événement. */
  stripeEventId: string;
  /** user_id résolu SERVEUR (metadata d'abonnement Stripe), jamais client. Sert à résoudre l'attribution Partner. */
  subjectUserId?: string | null;
  /** reservation_id SERVEUR (metadata Stripe), pour retrouver la corrélation d'origine sans cookie. */
  reservationId?: string | null;
  /** subscription/order id Stripe (server), haché en order_ref pour retrouver la corrélation. */
  subscriptionId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  countryCode?: string | null;
  occurredAtIso?: string;
}

/**
 * Émet un événement de paiement canonique, borné dans le temps et auto-avalant. Résout la
 * corrélation (visitor/session d'origine) via la table de liaison — par reservation_id puis, à
 * défaut, par order_ref (abonnement haché) — SANS jamais dépendre d'un cookie. Résout aussi
 * l'attribution Partner en lecture seule.
 */
export async function emitCanonicalPaymentEvent(
  input: CanonicalPaymentEventInput,
): Promise<BestEffortOutcome> {
  return boundedAnalyticsWrite(async () => {
    if (!PAYMENT_EVENTS.has(input.eventName) || !input.stripeEventId) {
      return { ok: false, reason: "INVALID_INPUT" };
    }
    const db = await getAnalyticsDbForIngestion();
    if (!db) return { ok: false, reason: "STORAGE_UNAVAILABLE" };

    const env = resolveAnalyticsEnvironment();
    const orderRef = hashRef(input.subscriptionId);

    // Lie l'order_ref à la réservation si les deux sont connus (permet la résolution ultérieure).
    if (input.reservationId && orderRef) {
      await upsertConversionLink(db, { reservationId: input.reservationId, environment: env, orderRef });
    }

    // Résout la corrélation d'origine sans cookie : réservation d'abord, puis order_ref.
    let corr = input.reservationId ? await resolveCorrelationByReservation(db, input.reservationId, env) : null;
    if (!corr && orderRef) corr = await resolveCorrelationByOrderRef(db, orderRef, env);

    const partnerAttributionId = await resolvePartnerAttributionForUser(input.subjectUserId);

    return recordCanonicalServerEvent(db, {
      eventName: input.eventName,
      stableKey: `${input.eventName}:${input.stripeEventId}`,
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED",
      occurredAtIso: input.occurredAtIso,
      countryCode: input.countryCode ?? null,
      currency: input.currency ?? null,
      amountMinor: input.amountMinor ?? null,
      partnerAttributionId,
      authenticatedUserId: input.subjectUserId ?? corr?.authenticatedUserId ?? null,
      visitorId: corr?.visitorId ?? null,
      sessionId: corr?.sessionId ?? null,
    });
  });
}
