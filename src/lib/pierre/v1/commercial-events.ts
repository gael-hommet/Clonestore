// src/lib/pierre/v1/commercial-events.ts
// PHASE 8.6 — provider-neutral COMMERCIAL EVENT ingress + entitlement transition pipeline.
//
// A Stripe webhook, a manual invoice, or an operator activation all become the SAME normalized event.
// Rules (spec §15): same (provider, provider_event_id) + same hash → idempotent; same id + different
// hash → conflict; an old event never regresses the entitlement; an unresolved event → operator
// quarantine; the company is ALWAYS resolved from persisted commercial references, NEVER from the
// payload. Truth mutation runs only under the billing-webhook role (governed SECURITY DEFINER funcs).

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";

/** Canonical, fournisseur-neutral commercial event keys. */
export type CommercialEventKey =
  | "commercial.payment_confirmed"
  | "commercial.subscription_active"
  | "commercial.subscription_updated"
  | "commercial.payment_failed"
  | "commercial.subscription_past_due"
  | "commercial.subscription_suspended"
  | "commercial.subscription_cancelled"
  | "commercial.subscription_reactivated"
  | "commercial.refund_confirmed";

const KNOWN_KEYS: ReadonlySet<string> = new Set<CommercialEventKey>([
  "commercial.payment_confirmed", "commercial.subscription_active", "commercial.subscription_updated",
  "commercial.payment_failed", "commercial.subscription_past_due", "commercial.subscription_suspended",
  "commercial.subscription_cancelled", "commercial.subscription_reactivated", "commercial.refund_confirmed",
]);

/** Map a raw provider event type onto a canonical commercial event key (or null = non-commercial). */
export function normalizeCommercialEventKey(provider: string, rawType: string): CommercialEventKey | null {
  const t = (rawType || "").toLowerCase().trim();
  if (KNOWN_KEYS.has(t)) return t as CommercialEventKey;
  // Stripe-flavoured mapping (the only live provider planned for P8.7); other providers extend here.
  switch (t) {
    case "checkout.session.completed":
    case "invoice.payment_succeeded":
    case "invoice.paid":
      return "commercial.payment_confirmed";
    case "customer.subscription.created":
      return "commercial.subscription_active";
    case "customer.subscription.updated":
      return "commercial.subscription_updated";
    case "customer.subscription.deleted":
      return "commercial.subscription_cancelled";
    case "invoice.payment_failed":
      return "commercial.payment_failed";
    case "customer.subscription.paused":
      return "commercial.subscription_suspended";
    case "customer.subscription.resumed":
      return "commercial.subscription_reactivated";
    case "charge.refunded":
    case "refund.created":
      return "commercial.refund_confirmed";
    default:
      return null;
  }
}

/** Deterministic, order-independent hash of the commercial payload (conflict detection). */
export function hashCommercialPayload(payload: unknown): string {
  const canonical = stableStringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

export type CommercialIngressInput = {
  provider: string;
  provider_event_id: string;
  event_key: CommercialEventKey;
  payload_hash: string;
  customer_reference?: string | null;
  subscription_reference?: string | null;
  order_reference?: string | null;
  product_key?: string;
  occurred_at?: string | null;
};

export type CommercialIngressResult = "received" | "duplicate" | "conflict";

/** Ingest a verified, normalized commercial event into the ledger (idempotent; conflict-aware). */
export async function ingestCommercialEvent(tx: SqlExecutor, input: CommercialIngressInput): Promise<CommercialIngressResult> {
  const { rows } = await tx.query<{ result: string }>(
    `select pierre_rt_ingest_commercial_event($1,$2,$3,$4,$5,$6,$7,$8,$9) as result`,
    [
      input.provider, input.provider_event_id, input.event_key, input.payload_hash,
      input.customer_reference ?? null, input.subscription_reference ?? null, input.order_reference ?? null,
      input.product_key ?? "pierre", input.occurred_at ?? null,
    ],
  );
  return rows[0].result as CommercialIngressResult;
}

/**
 * Resolve the company a commercial event belongs to, from PERSISTED references only (never the payload).
 * Looks for: an entitlement whose source_reference matches, then an activation whose commercial_reference
 * matches. Returns { company_id, activation_id } — either may be null.
 */
export async function resolveCommercialEventTarget(
  tx: SqlExecutor,
  refs: { customer_reference?: string | null; subscription_reference?: string | null; order_reference?: string | null },
): Promise<{ company_id: string | null; activation_id: string | null }> {
  const candidates = [refs.subscription_reference, refs.order_reference, refs.customer_reference].filter(Boolean) as string[];
  if (candidates.length === 0) return { company_id: null, activation_id: null };

  const ent = await tx.query<{ company_id: string }>(
    `select company_id from pierre_rt_product_entitlements where source_reference = any($1) order by updated_at desc limit 1`,
    [candidates],
  );
  if (ent.rows[0]) {
    const act = await tx.query<{ id: string }>(
      `select id from pierre_rt_customer_activations where company_id = $1 order by created_at desc limit 1`,
      [ent.rows[0].company_id],
    );
    return { company_id: ent.rows[0].company_id, activation_id: act.rows[0]?.id ?? null };
  }
  const act = await tx.query<{ id: string; company_id: string | null }>(
    `select id, company_id from pierre_rt_customer_activations where commercial_reference = any($1) order by created_at desc limit 1`,
    [candidates],
  );
  if (act.rows[0]) return { company_id: act.rows[0].company_id, activation_id: act.rows[0].id };
  return { company_id: null, activation_id: null };
}

/**
 * The SINGLE ordered, governed entry point for applying a persisted commercial event. It self-loads the
 * event, resolves the company from PERSISTED references, enforces ordering (older events never regress a
 * recent state), quarantines unresolved/future-incoherent events, transitions the entitlement and stamps
 * the ordering authority — all atomically under the billing-webhook role. The caller passes ONLY the
 * event id; it cannot fabricate a status. Returns 'applied:<status>' | 'ignored_stale' | 'quarantined' |
 * 'duplicate' | 'conflict' | the prior application_status.
 */
export async function applyCommercialEvent(tx: SqlExecutor, eventId: string): Promise<string> {
  const { rows } = await tx.query<{ result: string }>(`select pierre_rt_apply_commercial_event($1) as result`, [eventId]);
  return rows[0].result;
}

/**
 * Low-level entitlement transition primitive (server-role only; NOT client-reachable). Prefer
 * applyCommercialEvent() for the ordered, event-sourced production path — this primitive does not enforce
 * commercial ordering by itself. Returns the resulting status (or 'ignored').
 */
export async function applyEntitlementEvent(
  tx: SqlExecutor,
  input: { company_id: string; product_key?: string; event_key: CommercialEventKey; source_type?: string; source_reference?: string | null; grace_seconds?: number },
): Promise<string> {
  const { rows } = await tx.query<{ result: string }>(
    `select pierre_rt_apply_entitlement_event($1,$2,$3,$4,$5,$6) as result`,
    [input.company_id, input.product_key ?? "pierre", input.event_key, input.source_type ?? null, input.source_reference ?? null, input.grace_seconds ?? 7 * 24 * 3600],
  );
  return rows[0].result;
}

/** Mark a commercial event applied / ignored / quarantined and (optionally) bind its company. */
export async function resolveCommercialEvent(
  tx: SqlExecutor,
  input: { event_id: string; company_id?: string | null; status: "applied" | "ignored" | "quarantined"; reason?: string | null },
): Promise<void> {
  await tx.query(`select pierre_rt_resolve_commercial_event($1,$2,$3,$4)`, [
    input.event_id, input.company_id ?? null, input.status, input.reason ?? null,
  ]);
}

/** Flip an awaiting_commercial_proof activation to provisioning once a confirming event arrives. */
export async function markActivationProvisioning(
  tx: SqlExecutor, activationId: string, sourceType?: string | null, sourceReference?: string | null,
): Promise<string> {
  const { rows } = await tx.query<{ result: string }>(
    `select pierre_rt_mark_activation_provisioning($1,$2,$3) as result`,
    [activationId, sourceType ?? null, sourceReference ?? null],
  );
  return rows[0].result;
}
