// src/lib/pierre/v1/pierre-stripe-commercial-bridge.ts
// PHASE 8.7.4 — ADDITIVE bridge: a Stripe webhook (already signature-verified by the canonical route) that
// carries EXPLICIT Pierre controlled-journey metadata is fed into the governed Pierre commercial pipeline
// (ingest_commercial_event + apply_entitlement_event) under the dedicated billing-webhook role. It is
// STRICTLY GATED on `pierre_synthetic=true` + `pierre_product_key=pierre` + a valid `pierre_company_id`, so it
// is COMPLETELY INERT for every real customer subscription — it never runs for non-Pierre / non-synthetic
// traffic. Best-effort + fully error-swallowed: it can NEVER change the HTTP status the route returns to Stripe
// or affect the existing orders / founder / CloneStory flows. It never uses the admin or service role.

import type Stripe from "stripe";
import type { SqlExecutor } from "./sql";
import { withBillingWebhookTransaction } from "./billing-webhook-db";
import { ingestCommercialEvent, applyEntitlementEvent, resolveCommercialEvent, normalizeCommercialEventKey, hashCommercialPayload, type CommercialEventKey } from "./commercial-events";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// the Stripe event types the Pierre commercial pipeline reacts to (mirrors the canonical route's switch).
export const PIERRE_BRIDGE_EVENTS: ReadonlySet<string> = new Set([
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.payment_failed",
]);

function asRecord(v: unknown): Record<string, unknown> | null { return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null; }
function metaString(obj: Record<string, unknown> | null, key: string): string | null {
  const m = asRecord(obj?.["metadata"]);
  const v = m?.[key];
  return typeof v === "string" ? v : null;
}

export type PierreControlledTag = { company_id: string; run_id: string | null };

/** Recognise an EXPLICITLY Pierre-tagged controlled event. Returns null for everything else (real traffic). */
export function recognizePierreControlledEvent(event: Stripe.Event): PierreControlledTag | null {
  if (!PIERRE_BRIDGE_EVENTS.has(event.type)) return null;
  const o = asRecord(event.data.object);
  if (metaString(o, "pierre_synthetic") !== "true") return null;      // never real traffic
  if (metaString(o, "pierre_product_key") !== "pierre") return null;
  const company_id = metaString(o, "pierre_company_id");
  if (!company_id || !UUID_RE.test(company_id)) return null;           // refuse a missing/invalid company
  return { company_id, run_id: metaString(o, "pierre_run_id") };
}

export type BillingTxRunner = <T>(binding: { company_id?: string | null }, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
export type PierreCommercialBridgeDeps = { runBillingTx?: BillingTxRunner };
export type PierreCommercialBridgeResult = {
  acted: boolean; reason?: string;
  company_id?: string; event_key?: CommercialEventKey; ingest?: string; entitlement?: string; event_id?: string | null; applied?: boolean;
};

/**
 * Feed one Stripe event into the governed Pierre commercial pipeline IF (and only if) it carries the explicit
 * controlled-journey metadata. Called from the canonical webhook route for every event, AFTER signature
 * verification. Pure/injectable via deps.runBillingTx for tests. Never throws.
 */
export async function bridgePierreCommercial(event: Stripe.Event, deps: PierreCommercialBridgeDeps = {}): Promise<PierreCommercialBridgeResult> {
  const tag = recognizePierreControlledEvent(event);
  if (!tag) return { acted: false, reason: "not_pierre_controlled" };
  const event_key = normalizeCommercialEventKey("stripe", event.type);
  if (!event_key) return { acted: false, reason: "no_commercial_key" };
  const o = asRecord(event.data.object) ?? {};
  const subscription_reference = event.type.startsWith("customer.subscription")
    ? (typeof o["id"] === "string" ? (o["id"] as string) : null)
    : (typeof o["subscription"] === "string" ? (o["subscription"] as string) : null);
  const customer_reference = typeof o["customer"] === "string" ? (o["customer"] as string) : null;
  const runBillingTx = deps.runBillingTx ?? withBillingWebhookTransaction;
  try {
    return await runBillingTx({}, async (tx) => {
      // 1) idempotent ingest of the verified event into the ledger (billing role, governed).
      const ingest = await ingestCommercialEvent(tx, {
        provider: "stripe", provider_event_id: event.id, event_key,
        payload_hash: hashCommercialPayload({ id: event.id, type: event.type, sub: subscription_reference, cus: customer_reference }),
        customer_reference, subscription_reference, product_key: "pierre",
        occurred_at: typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : null,
      });
      // 2) load the persisted event id (idempotency anchor).
      const evRow = await tx.query<{ id: string }>(`select id from pierre_rt_commercial_events where provider='stripe' and provider_event_id=$1`, [event.id]);
      const event_id = evRow.rows[0]?.id ?? null;
      // 3) transition the entitlement for the tagged (validated) company. The company comes from EXPLICIT
      //    synthetic metadata — acceptable only because the bridge is inert unless pierre_synthetic=true.
      const entitlement = await applyEntitlementEvent(tx, {
        company_id: tag.company_id, product_key: "pierre", event_key,
        source_type: "stripe_subscription", source_reference: subscription_reference,
      });
      // 4) mark the commercial event APPLIED + bind the company (governed) so the ledger reflects the effect.
      if (event_id) await resolveCommercialEvent(tx, { event_id, company_id: tag.company_id, status: "applied", reason: "pierre controlled journey" });
      return { acted: true, company_id: tag.company_id, event_key, ingest, entitlement, event_id, applied: !!event_id };
    });
  } catch (e) {
    // BEST-EFFORT: never break the canonical webhook. A missing billing DSN or any error → inert.
    console.error("[pierre-commercial] bridge error (non-fatal):", e instanceof Error ? e.name : "error");
    return { acted: false, reason: "error" };
  }
}
