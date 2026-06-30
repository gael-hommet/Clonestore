// src/lib/pierre/v1/__integration__/p86-commercial-event-ingress.itest.ts
// PHASE 8.6 — PROVIDER-NEUTRAL COMMERCIAL EVENT INGRESS, proven on real Postgres (PGlite).
//
// A Stripe webhook, a manual invoice, or an operator activation all collapse onto the SAME normalized
// commercial event key. This file pins that ingress contract end-to-end:
//   • normalizeCommercialEventKey — Stripe → canonical key mapping (and unknown → null);
//   • hashCommercialPayload — deterministic, order-independent conflict hash;
//   • ingestCommercialEvent — first sighting of a (provider, provider_event_id) returns 'received'
//     (under the billing-webhook role, which is the ONLY role allowed to write the ledger);
//   • resolveCommercialEventTarget — the company is ALWAYS resolved from PERSISTED references (an
//     entitlement source_reference, then an activation commercial_reference), NEVER from the payload,
//     and resolves to a null company when no persisted reference matches.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import {
  ingestCommercialEvent,
  resolveCommercialEventTarget,
  applyEntitlementEvent,
  markActivationProvisioning,
  hashCommercialPayload,
  normalizeCommercialEventKey,
  type CommercialEventKey,
} from "../commercial-events";
import {
  requestCustomerActivation,
  computeProvisioningKey,
  claimCustomerActivation,
  provisionCustomerCompany,
} from "../customer-activation";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const BILLING = "pierre_rt_billing_webhook";
const WORKER = "pierre_rt_customer_activation_worker";
const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 ingress — normalizeCommercialEventKey (provider → canonical)", () => {
  it("maps the live Stripe event types onto canonical commercial keys", () => {
    // payment / checkout / invoice success → payment_confirmed
    expect(normalizeCommercialEventKey("stripe", "checkout.session.completed")).toBe("commercial.payment_confirmed");
    expect(normalizeCommercialEventKey("stripe", "invoice.payment_succeeded")).toBe("commercial.payment_confirmed");
    expect(normalizeCommercialEventKey("stripe", "invoice.paid")).toBe("commercial.payment_confirmed");
    // subscription lifecycle
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.created")).toBe("commercial.subscription_active");
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.updated")).toBe("commercial.subscription_updated");
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.deleted")).toBe("commercial.subscription_cancelled");
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.paused")).toBe("commercial.subscription_suspended");
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.resumed")).toBe("commercial.subscription_reactivated");
    // failures / refunds
    expect(normalizeCommercialEventKey("stripe", "invoice.payment_failed")).toBe("commercial.payment_failed");
    expect(normalizeCommercialEventKey("stripe", "charge.refunded")).toBe("commercial.refund_confirmed");
    expect(normalizeCommercialEventKey("stripe", "refund.created")).toBe("commercial.refund_confirmed");
  });

  it("passes through an already-canonical key and is case-insensitive / trims whitespace", () => {
    expect(normalizeCommercialEventKey("stripe", "commercial.payment_confirmed")).toBe("commercial.payment_confirmed");
    // raw types are lower-cased + trimmed before matching
    expect(normalizeCommercialEventKey("stripe", "  Checkout.Session.Completed  ")).toBe("commercial.payment_confirmed");
  });

  it("returns null for an unknown / non-commercial provider event type", () => {
    expect(normalizeCommercialEventKey("stripe", "unknown.event")).toBeNull();
    expect(normalizeCommercialEventKey("stripe", "payment_intent.created")).toBeNull();
    expect(normalizeCommercialEventKey("stripe", "")).toBeNull();
    // mapping is keyed by the raw type only — an unknown type stays unknown regardless of provider label
    expect(normalizeCommercialEventKey("paypal", "totally.made.up")).toBeNull();
  });
});

describe("P8.6 ingress — hashCommercialPayload (deterministic, order-independent)", () => {
  it("produces the SAME hash for the same object regardless of key order", () => {
    const a = hashCommercialPayload({ a: 1, b: 2, c: { x: 10, y: 20 } });
    const b = hashCommercialPayload({ c: { y: 20, x: 10 }, b: 2, a: 1 });
    expect(a).toBe(b);
    // sha256 hex digest shape
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a DIFFERENT hash when a value changes (conflict detection is real)", () => {
    const base = hashCommercialPayload({ a: 1, b: 2 });
    expect(hashCommercialPayload({ a: 1, b: 3 })).not.toBe(base);
    expect(hashCommercialPayload({ a: 9 })).not.toBe(base);
    // arrays are order-SENSITIVE (a different sequence is a different payload)
    expect(hashCommercialPayload([1, 2, 3])).not.toBe(hashCommercialPayload([3, 2, 1]));
  });
});

describe("P8.6 ingress — ingestCommercialEvent (billing-webhook role)", () => {
  it("returns 'received' for a brand-new (provider, provider_event_id)", async () => {
    const evtId = "evt_" + newUuid();
    const payloadHash = hashCommercialPayload({ id: evtId, type: "checkout.session.completed", amount: 4990 });
    const result = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe",
        provider_event_id: evtId,
        event_key: "commercial.payment_confirmed",
        payload_hash: payloadHash,
        subscription_reference: "sub_ingress_1",
      }));
    expect(result).toBe("received");

    // the ledger row landed in the pre-tenant ('pending', null company) state — company is resolved later.
    const row = await h.pg.query<{ application_status: string; company_id: string | null; event_key: string }>(
      `select application_status, company_id, event_key from pierre_rt_commercial_events where provider='stripe' and provider_event_id=$1`,
      [evtId],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].application_status).toBe("pending");
    expect(row.rows[0].company_id).toBeNull();
    expect(row.rows[0].event_key).toBe("commercial.payment_confirmed");
  });

  it("the application role CANNOT write the commercial ledger (truth function is billing-only)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe",
        provider_event_id: "evt_app_" + newUuid(),
        event_key: "commercial.payment_confirmed",
        payload_hash: hashCommercialPayload({ nope: true }),
      })));
    expect(denied).toBe(true);
  });
});

describe("P8.6 ingress — resolveCommercialEventTarget (persisted refs only, never the payload)", () => {
  it("resolves the company from a persisted ENTITLEMENT source_reference", async () => {
    const subRef = "sub_ent_resolve_" + newUuid();
    // seed a live entitlement carrying this subscription reference (billing-webhook truth function).
    const status = await asRole(h, BILLING, h.companyA, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: h.companyA,
        event_key: "commercial.payment_confirmed",
        source_type: "stripe_subscription",
        source_reference: subRef,
      }));
    expect(status).toBe("active");

    // resolve by the subscription reference → the entitlement's company (RLS-bound to companyA).
    const target = await asRole(h, BILLING, h.companyA, (q) =>
      resolveCommercialEventTarget(execFrom(q), { subscription_reference: subRef }));
    expect(target.company_id).toBe(h.companyA);

    // a customer_reference that matches the same persisted source_reference resolves identically.
    const viaCustomer = await asRole(h, BILLING, h.companyA, (q) =>
      resolveCommercialEventTarget(execFrom(q), { customer_reference: subRef }));
    expect(viaCustomer.company_id).toBe(h.companyA);
  });

  it("resolves the company from a persisted ACTIVATION commercial_reference (no matching entitlement ref)", async () => {
    // Drive the full activation → provisioning flow so the activation is bound to a real company.
    const owner = newUuid();
    const commercialRef = "sub_act_commercial_" + newUuid();
    const provSourceRef = "sub_act_source_" + newUuid(); // distinct from commercialRef on purpose
    const provKey = computeProvisioningKey({ commercial_reference: commercialRef });

    const activationId = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), {
        provisioning_key: provKey,
        commercial_reference: commercialRef,
        owner_user_id: owner,
        company_name: "Ingress Activation Co",
        requested_by: owner,
      }));
    expect(activationId).toBeTruthy();

    const marked = await asRole(h, BILLING, h.companyA, (q) =>
      markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", provSourceRef));
    expect(marked).toBe("provisioning");

    const provisionedCompany = await asRole(h, WORKER, h.companyA, async (q) => {
      const tx = execFrom(q);
      const claimed = await claimCustomerActivation(tx, "ingress-worker");
      expect(claimed?.id).toBe(activationId);
      return provisionCustomerCompany(tx, { activation: claimed! });
    });
    expect(provisionedCompany).toBeTruthy();

    // The provisioned entitlement carries provSourceRef as its source_reference, NOT commercialRef.
    // So resolving by commercialRef must skip the entitlement branch and hit the ACTIVATION branch.
    const target = await asRole(h, WORKER, provisionedCompany, (q) =>
      resolveCommercialEventTarget(execFrom(q), { subscription_reference: commercialRef }));
    expect(target.company_id).toBe(provisionedCompany);
    expect(target.activation_id).toBe(activationId);

    // sanity: commercialRef is genuinely NOT an entitlement source_reference (proves the activation branch)
    const entByCommercial = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where source_reference=$1`, [commercialRef]);
    expect(entByCommercial.rows[0].n).toBe(0);
    const entBySource = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1 and source_reference=$2`,
      [provisionedCompany, provSourceRef]);
    expect(entBySource.rows[0].n).toBe(1);
  });

  it("returns a null company (and null activation) when NO persisted reference matches", async () => {
    const target = await asRole(h, BILLING, h.companyA, (q) =>
      resolveCommercialEventTarget(execFrom(q), { subscription_reference: "sub_does_not_exist_" + newUuid() }));
    expect(target.company_id).toBeNull();
    expect(target.activation_id).toBeNull();
  });

  it("returns a null company when NO reference at all is supplied (never guesses from the payload)", async () => {
    const target = await asRole(h, BILLING, h.companyA, (q) =>
      resolveCommercialEventTarget(execFrom(q), {}));
    expect(target.company_id).toBeNull();
    expect(target.activation_id).toBeNull();
  });

  it("event_key set membership is honoured (canonical keys round-trip through the type)", () => {
    // a compile-time + runtime check that the canonical keys the ingress emits are the ones it accepts.
    const canonical: CommercialEventKey[] = [
      "commercial.payment_confirmed", "commercial.subscription_active", "commercial.subscription_updated",
      "commercial.payment_failed", "commercial.subscription_past_due", "commercial.subscription_suspended",
      "commercial.subscription_cancelled", "commercial.subscription_reactivated", "commercial.refund_confirmed",
    ];
    for (const k of canonical) {
      expect(normalizeCommercialEventKey("stripe", k)).toBe(k);
    }
  });
});
