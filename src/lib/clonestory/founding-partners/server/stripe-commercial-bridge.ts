// CloneStory — PONT webhook Stripe → contribution commerciale (CS-FINAL 3).
//
// Branché sur le webhook Stripe CANONIQUE (src/app/api/webhooks/stripe/route.ts),
// APRÈS vérification de signature. ADDITIF et BEST-EFFORT : n'agit que si le compte
// porte une attribution CloneStory ; ne casse JAMAIS le checkout principal (toute
// erreur est tracée puis avalée — la réconciliation rejoue les événements `failed`).
//
// Aucune donnée Stripe sensible n'est persistée : ni numéro de carte, ni secret, ni
// e-mail prospect en clair. Le ledger ne garde que des identifiants Stripe non sensibles.

import type Stripe from "stripe";
import { applyCommercialStripeEvent, type CommercialStripeEvent, type CommercialDeps } from "./commercial";
import { clonestoryFeatureEnabled } from "./config";

function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}
function str(o: Record<string, unknown> | null, k: string): string | null {
  const v = o?.[k];
  return typeof v === "string" ? v : null;
}
function num(o: Record<string, unknown> | null, k: string): number | null {
  const v = o?.[k];
  return typeof v === "number" ? v : null;
}
function meta(o: Record<string, unknown> | null, k: string): string | null {
  const m = rec(o?.["metadata"]);
  const v = m?.[k];
  return typeof v === "string" ? v : null;
}

/** Types Stripe pris en charge par le moteur commercial (les autres sont ignorés). */
const SUPPORTED = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "checkout.session.expired",
  "customer.subscription.deleted",
]);

/**
 * Extrait un événement commercial NORMALISÉ (sans secret) depuis un événement Stripe.
 * Retourne null si le type n'est pas pris en charge. Pure et testable.
 */
export function extractCommercialEvent(event: Stripe.Event): CommercialStripeEvent | null {
  if (!SUPPORTED.has(event.type)) return null;
  const o = rec(event.data.object);
  const base = {
    eventId: event.id,
    type: event.type,
    livemode: Boolean(event.livemode),
    createdAt: typeof event.created === "number" ? event.created : null,
    subscriptionId: null as string | null,
    customerId: str(o, "customer"),
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.expired":
      return {
        ...base,
        subscriptionId: str(o, "subscription"),
        checkoutSessionId: str(o, "id"),
        paymentIntentId: str(o, "payment_intent"),
        amountPaid: str(o, "payment_status") === "paid" ? num(o, "amount_total") : 0,
        currency: str(o, "currency"),
        userId: meta(o, "user_id"),
        agentSlug: meta(o, "agent_slug"),
      };

    case "invoice.paid":
    case "invoice.payment_succeeded":
      return {
        ...base,
        subscriptionId: str(o, "subscription"),
        invoiceId: str(o, "id"),
        paymentIntentId: str(o, "payment_intent"),
        amountPaid: num(o, "amount_paid"),
        currency: str(o, "currency"),
      };

    case "charge.refunded":
      return {
        ...base,
        chargeId: str(o, "id"),
        paymentIntentId: str(o, "payment_intent"),
        invoiceId: str(o, "invoice"),
        amountRefunded: num(o, "amount_refunded"), // CUMUL remboursé (absolu)
        currency: str(o, "currency"),
      };

    case "charge.dispute.created":
      return {
        ...base,
        chargeId: str(o, "charge"),
        paymentIntentId: str(o, "payment_intent"),
      };

    case "charge.dispute.closed": {
      const status = str(o, "status");
      return {
        ...base,
        chargeId: str(o, "charge"),
        paymentIntentId: str(o, "payment_intent"),
        disputeResolved: status === "won" ? "won" : "lost",
      };
    }

    case "customer.subscription.deleted":
      return { ...base, subscriptionId: str(o, "id") };

    default:
      return null;
  }
}

/**
 * Pont best-effort. À appeler depuis le webhook canonique pour CHAQUE événement.
 * `deps.resolveSubscriptionMeta` permet de retrouver user_id/agent_slug quand l'event
 * ne les porte pas (factures). Toute exception est avalée (le checkout ne casse jamais).
 */
export async function bridgeClonestoryCommercial(
  event: Stripe.Event, deps: CommercialDeps = {},
): Promise<void> {
  if (!clonestoryFeatureEnabled("commercial_bridge")) return; // interrupteur d'incident
  const normalized = extractCommercialEvent(event);
  if (!normalized) return;
  try {
    await applyCommercialStripeEvent(normalized, deps);
  } catch (e) {
    // BEST-EFFORT : ne jamais casser le webhook principal. L'événement reste, si le
    // ledger a pu être écrit, re-jouable par la réconciliation ; sinon il est perdu
    // côté CloneStory (limite documentée) — l'orders principal reste intact.
    console.error("[clonestory-commercial] bridge error (non-fatal):", e instanceof Error ? e.name : "error");
  }
}
