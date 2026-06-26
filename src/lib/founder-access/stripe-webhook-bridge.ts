// E-R2 §3/§5 — pont webhook Stripe → réservation fondateur, EXTRAIT pour être
// testable avec une base réelle (PGlite) et un récupérateur de preuve injecté.
// La route /api/webhooks/stripe l'appelle après vérification de signature.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { applyFounderStripeEvent, type StripeApplyResult } from "./store";
import { FOUNDER_SUBSCRIPTION_AMOUNT_CENTS, FOUNDER_CURRENCY } from "./commercial";
import { mapStripeSubscriptionStatusStrict, stripeStatusGrants, validateFounderStripeCommercialProof } from "./stripe-proof";

export interface FounderWebhookEvent {
  eventId: string;
  eventType: string;
  eventCreated: number;
  livemode: boolean;
  apiVersion: string | null;
  metadata: Record<string, string> | null;
  rawStatus: string;             // statut Stripe BRUT (mappé strictement ici)
  subscriptionId: string | null;
  customerId: string | null;
  currentPeriodEnd?: number | null;
  isGrantCandidate: boolean;     // checkout.completed / subscription active|trialing
}

export interface SubscriptionProof {
  priceId: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  productId: string | null;
}

export interface FounderWebhookDeps {
  expectedPriceId: string | null;
  expectedProductId: string | null;
  envIsProduction: boolean;
  /** Récupère la preuve commerciale depuis Stripe (ou un fake en test). */
  fetchProof?: (subscriptionId: string) => Promise<SubscriptionProof | null>;
}

export type FounderWebhookOutcome =
  | { handled: false; reason: "not_founder" }
  | { handled: true; result: StripeApplyResult; decision: "unsupported" | "proof_failed" | "applied" };

/**
 * Applique un événement Stripe vérifié à la réservation fondateur. FAIL-CLOSED :
 * statut inconnu → journal 'unsupported' (aucune mutation) ; preuve commerciale
 * incomplète sur un événement d'activation → 'proof_failed' (aucune activation).
 */
export async function applyFounderStripeWebhook(
  db: SqlExecutor, ev: FounderWebhookEvent, deps: FounderWebhookDeps,
): Promise<FounderWebhookOutcome> {
  const rid = ev.metadata?.["founder_reservation_id"];
  if (!rid) return { handled: false, reason: "not_founder" };

  // user_id : seulement s'il s'agit d'un UUID (metadata défensive — jamais d'erreur DB).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawUserId = ev.metadata?.["user_id"];
  const userId = typeof rawUserId === "string" && UUID_RE.test(rawUserId) ? rawUserId : null;

  const base = {
    stripe_event_id: ev.eventId, event_type: ev.eventType, event_created_at: ev.eventCreated,
    livemode: ev.livemode, api_version: ev.apiVersion, reservation_id: rid,
    subscription_id: ev.subscriptionId, customer_id: ev.customerId, currency: FOUNDER_CURRENCY,
    current_period_end: ev.currentPeriodEnd ?? null, user_id: userId,
  };

  // §4 — statut inconnu → fail-closed.
  const mapped = mapStripeSubscriptionStatusStrict(ev.rawStatus);
  if (!mapped.ok) {
    const result = await applyFounderStripeEvent(db, { ...base, subscription_status: "none", amount_cents: null, unsupported_raw_status: mapped.raw_status });
    return { handled: true, result, decision: "unsupported" };
  }
  const grants = stripeStatusGrants(mapped.status);

  // §2/§4 — preuve commerciale COMPLÈTE sur un événement d'activation.
  if (ev.isGrantCandidate && grants) {
    const proof = deps.fetchProof && ev.subscriptionId ? await deps.fetchProof(ev.subscriptionId) : null;
    const productMatches = proof
      ? (deps.expectedProductId ? proof.productId === deps.expectedProductId : (proof.priceId != null && proof.priceId === deps.expectedPriceId))
      : null;
    const decision = validateFounderStripeCommercialProof(
      {
        priceId: proof?.priceId ?? null, productMatches,
        amountCents: proof?.amountCents ?? null, currency: proof?.currency ?? null, interval: proof?.interval ?? null,
        subscriptionId: ev.subscriptionId, customerId: ev.customerId, reservationId: rid, livemode: ev.livemode,
      },
      { expectedPriceId: deps.expectedPriceId, envIsProduction: deps.envIsProduction },
    );
    if (!decision.allowed) {
      const result = await applyFounderStripeEvent(db, { ...base, subscription_status: mapped.status, amount_cents: null, proof_failed_reason: decision.reason });
      return { handled: true, result, decision: "proof_failed" };
    }
  }

  const result = await applyFounderStripeEvent(db, {
    ...base, subscription_status: mapped.status, amount_cents: grants ? FOUNDER_SUBSCRIPTION_AMOUNT_CENTS : null,
  });
  return { handled: true, result, decision: "applied" };
}
