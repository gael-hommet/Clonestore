// Canonical Analytics Runtime Wiring — pont additif best-effort webhook Stripe → sink canonique.
// Émet payment_succeeded / payment_failed / payment_refunded UNIQUEMENT côté serveur, après
// vérification de signature et traitement métier (le webhook reste la seule source de vérité du
// paiement). Auto-avalant : ne jette JAMAIS (le webhook ne doit jamais renvoyer 500 à cause de
// l'analytics, ce qui déclencherait un rejeu Stripe). Ne calcule aucune commission, ne modifie
// aucun payout, ne fait jamais confiance à un montant/partner_id client.

import { getAnalyticsDbForIngestion } from "@/lib/analytics/runtime";
import { recordCanonicalServerEvent } from "@/lib/analytics/server-events";
import { resolvePartnerAttributionForUser } from "./partner-attribution-resolver";
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
  amountMinor?: number | null;
  currency?: string | null;
  countryCode?: string | null;
  occurredAtIso?: string;
}

/**
 * Émet un événement de paiement canonique. Best-effort, auto-avalant. Résout l'attribution
 * Partner en lecture seule (jamais un partner_id client). Retourne un résultat observable.
 */
export async function emitCanonicalPaymentEvent(
  input: CanonicalPaymentEventInput,
): Promise<{ ok: boolean; outcome?: "inserted" | "duplicate"; reason?: string }> {
  try {
    if (!PAYMENT_EVENTS.has(input.eventName) || !input.stripeEventId) {
      return { ok: false, reason: "INVALID_INPUT" };
    }
    const db = await getAnalyticsDbForIngestion();
    if (!db) return { ok: false, reason: "STORAGE_UNAVAILABLE" };

    const partnerAttributionId = await resolvePartnerAttributionForUser(input.subjectUserId);

    const res = await recordCanonicalServerEvent(db, {
      eventName: input.eventName,
      stableKey: `${input.eventName}:${input.stripeEventId}`,
      trustLevel: "PAYMENT_PROVIDER_CONFIRMED",
      occurredAtIso: input.occurredAtIso,
      countryCode: input.countryCode ?? null,
      currency: input.currency ?? null,
      amountMinor: input.amountMinor ?? null,
      partnerAttributionId,
      authenticatedUserId: input.subjectUserId ?? null,
    });
    return res;
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "unknown" };
  }
}
