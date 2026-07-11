// src/lib/billing/stripe-event-fields.ts
// Extracteurs PURS de champs d'objets Stripe, tolérants à la version d'API.
//
// POURQUOI CE MODULE EXISTE
// Depuis l'API 2025-03-31 (« Basil »), Stripe a DÉPLACÉ plusieurs champs. Avec la version
// épinglée du projet (2025-11-17.clover) et le SDK v20, ces propriétés N'EXISTENT PLUS :
//   • Invoice.subscription        → Invoice.parent.subscription_details.subscription
//   • Invoice.payment_intent      → Invoice.payments.data[].payment.payment_intent
//   • Subscription.current_period_end → Subscription.items.data[].current_period_end
//
// Le code lisait ces objets via `Record<string, unknown>` : TypeScript ne pouvait donc pas
// signaler la rupture, et les lectures renvoyaient silencieusement `null`.
//
// Un endpoint webhook délivre les événements dans la version d'API configurée sur
// l'endpoint, et un événement rejoué/archivé peut porter l'ANCIENNE forme. Ces
// extracteurs lisent donc la forme courante EN PRIORITÉ, puis retombent sur l'ancienne.
// Aucun réseau, aucun effet de bord.

function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/** Un champ Stripe expansible : soit l'id (string), soit l'objet développé { id }. */
function expandableId(v: unknown): string | null {
  if (typeof v === "string") return v || null;
  const o = rec(v);
  const id = o?.["id"];
  return typeof id === "string" && id ? id : null;
}

/**
 * Id de l'abonnement à l'origine d'une facture.
 * Courant : `invoice.parent.subscription_details.subscription`.
 * Legacy  : `invoice.subscription`.
 */
export function extractInvoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const details = rec(rec(invoice["parent"])?.["subscription_details"]);
  const current = expandableId(details?.["subscription"]);
  if (current) return current;
  return expandableId(invoice["subscription"]);
}

/**
 * Id du PaymentIntent réglant une facture.
 * Courant : premier `invoice.payments.data[].payment.payment_intent`.
 * Legacy  : `invoice.payment_intent`.
 */
export function extractInvoicePaymentIntentId(invoice: Record<string, unknown>): string | null {
  const data = rec(invoice["payments"])?.["data"];
  if (Array.isArray(data)) {
    for (const entry of data) {
      const payment = rec(rec(entry)?.["payment"]);
      const pi = expandableId(payment?.["payment_intent"]);
      if (pi) return pi;
    }
  }
  return expandableId(invoice["payment_intent"]);
}

/**
 * Fin de la période en cours d'un abonnement (timestamp Unix, secondes).
 * Courant : max des `subscription.items.data[].current_period_end`.
 * Legacy  : `subscription.current_period_end`.
 *
 * Le max est retenu car un abonnement multi-lignes peut porter des périodes distinctes ;
 * la fin de couverture de l'accès est la plus tardive.
 */
export function extractSubscriptionCurrentPeriodEnd(subscription: Record<string, unknown>): number | null {
  const data = rec(subscription["items"])?.["data"];
  if (Array.isArray(data)) {
    let latest: number | null = null;
    for (const entry of data) {
      const end = rec(entry)?.["current_period_end"];
      if (typeof end === "number" && Number.isFinite(end)) {
        latest = latest === null || end > latest ? end : latest;
      }
    }
    if (latest !== null) return latest;
  }
  const legacy = subscription["current_period_end"];
  return typeof legacy === "number" && Number.isFinite(legacy) ? legacy : null;
}
