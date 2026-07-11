// Programme partenaires — PONT webhook Stripe → moteur de commissions.
// Branché sur le webhook CANONIQUE (src/app/api/webhooks/stripe/route.ts), APRÈS vérification
// de signature. ADDITIF et BEST-EFFORT : n'agit que si le programme est activé ; ne casse
// jamais le webhook principal (toute erreur est tracée puis avalée). Idempotent (ledger d'event).

import type Stripe from "stripe";
import { getPartnerDb, withService } from "./runtime";
import { applyPartnerCommercialEvent, type PartnerCommercialEvent } from "./commission";
import { applyAccountUpdated } from "./connect";
import { isPartnerProgramEnabled } from "../flags";
import { extractInvoiceSubscriptionId, extractInvoicePaymentIntentId } from "@/lib/billing/stripe-event-fields";

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

const SUPPORTED = new Set([
  "invoice.paid",
  "invoice.payment_succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "account.updated",
]);

export type PartnerBridgeDeps = {
  /** Résout l'user_id du prospect depuis la metadata de l'abonnement (comme le pont orders). */
  resolveSubscriptionUser?: (subscriptionId: string) => Promise<string | null>;
};

/** Extrait un PartnerCommercialEvent normalisé (sans secret) d'un event Stripe, ou null. */
export function extractPartnerEvent(event: Stripe.Event, subjectUserId: string | null): PartnerCommercialEvent | null {
  if (!SUPPORTED.has(event.type) || event.type === "account.updated") return null;
  const o = rec(event.data.object);
  const base: PartnerCommercialEvent = {
    eventId: event.id,
    type: event.type,
    livemode: Boolean(event.livemode),
    eventCreated: typeof event.created === "number" ? event.created : null,
    subscriptionId: null,
    customerId: str(o, "customer"),
    subjectUserId,
  };

  switch (event.type) {
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return {
        ...base,
        subscriptionId: o ? extractInvoiceSubscriptionId(o) : null,
        invoiceId: str(o, "id"),
        paymentIntentId: o ? extractInvoicePaymentIntentId(o) : null,
        totalMinor: num(o, "total") ?? 0,
        taxMinor: num(o, "tax") ?? 0,
        totalExcludingTaxMinor: num(o, "total_excluding_tax"),
        amountPaidMinor: num(o, "amount_paid") ?? 0,
        currency: str(o, "currency"),
      };
    case "charge.refunded":
      return { ...base, paymentIntentId: str(o, "payment_intent"), refundTtcMinor: num(o, "amount_refunded") ?? 0, currency: str(o, "currency") };
    case "charge.dispute.created":
      return { ...base, paymentIntentId: str(o, "payment_intent") };
    case "charge.dispute.closed": {
      const status = str(o, "status");
      return { ...base, paymentIntentId: str(o, "payment_intent"), disputeResolved: status === "won" ? "won" : "lost" };
    }
    default:
      return null;
  }
}

/** Pont best-effort. À appeler depuis le webhook canonique pour CHAQUE événement. */
export async function bridgePartnerCommercial(event: Stripe.Event, deps: PartnerBridgeDeps = {}): Promise<void> {
  if (!isPartnerProgramEnabled()) return;
  if (!SUPPORTED.has(event.type)) return;

  try {
    const db = await getPartnerDb();

    // account.updated → statut d'onboarding Connect du cabinet.
    if (event.type === "account.updated") {
      const acct = rec(event.data.object);
      const accountId = str(acct, "id");
      if (!accountId) return;
      await withService(db, (tx) =>
        applyAccountUpdated(tx, {
          accountId,
          detailsSubmitted: acct?.["details_submitted"] === true,
          chargesEnabled: acct?.["charges_enabled"] === true,
          payoutsEnabled: acct?.["payouts_enabled"] === true,
        }),
      );
      return;
    }

    // Résoudre l'user du prospect pour invoice.paid (les factures ne portent pas la metadata).
    let subjectUserId: string | null = null;
    if ((event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") && deps.resolveSubscriptionUser) {
      const o = rec(event.data.object);
      const subId = o ? extractInvoiceSubscriptionId(o) : null;
      if (subId) subjectUserId = await deps.resolveSubscriptionUser(subId);
    }

    const normalized = extractPartnerEvent(event, subjectUserId);
    if (!normalized) return;
    await withService(db, (tx) => applyPartnerCommercialEvent(tx, normalized));
  } catch (e) {
    console.error("[partner-program] bridge error (non-fatal):", e instanceof Error ? e.name : "error");
  }
}
