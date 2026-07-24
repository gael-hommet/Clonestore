// src/app/api/webhooks/stripe/__tests__/payment-path-country-reconciliation.test.ts
//
// PAYMENT PATH CLOSURE (2026-07-24) — preuve que checkout.session.completed applique
// désormais la réconciliation pays PAR DÉFAUT (révélée, aucune variable d'env à positionner) :
// un pays de session incohérent avec la facturation Stripe réelle N'ACTIVE PAS l'accès payant
// silencieusement (country_review_required), et un événement rejoué deux fois ne produit
// qu'une seule mutation (idempotence du ledger).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Stripe from "stripe";
import { __setStripeWebhookDepsForTests, type StripeWebhookDeps } from "@/lib/founder-access/stripe-webhook-deps";
import {
  type OrdersEventLedgerPort,
  type OrdersEventReceipt,
} from "@/lib/billing/orders-event-ledger";
import type { EventRank } from "@/lib/billing/orders-event-ordering";

const SECRET = "whsec_test_payment_path_recon";

function memoryLedger(): OrdersEventLedgerPort & { rows: Map<string, OrdersEventReceipt> } {
  const rows = new Map<string, OrdersEventReceipt>();
  return {
    rows,
    async tryInsertReceipt(row) {
      if (rows.has(row.stripe_event_id)) return { inserted: false, existing: rows.get(row.stripe_event_id)! };
      rows.set(row.stripe_event_id, { ...row, processing_result: "pending", attempts: 1 });
      return { inserted: true, existing: null };
    },
    async highWaterForObject(objectId, exclude): Promise<EventRank | null> {
      let best: EventRank | null = null;
      for (const r of rows.values()) {
        if (r.object_id !== objectId || r.processing_result !== "applied" || r.stripe_event_id === exclude) continue;
        const rank = { eventCreated: r.event_created, eventId: r.stripe_event_id };
        if (!best || rank.eventCreated > best.eventCreated) best = rank;
      }
      return best;
    },
    async updateReceipt(id, patch) {
      const r = rows.get(id);
      if (r) Object.assign(r, patch);
    },
  };
}

const upserts: Array<Record<string, unknown>> = [];
let ledger: ReturnType<typeof memoryLedger>;

function makeDeps(): StripeWebhookDeps {
  return {
    getFounderDb: async () => { throw new Error("founder DB non sollicitée dans ce test"); },
    fetchProof: async () => null,
    orders: {
      upsert: async (a) => { upserts.push(a as unknown as Record<string, unknown>); },
      updateBySubId: async () => {},
    },
    ordersLedger: ledger,
    expectedPriceId: "price_test",
    expectedProductId: "prod_test",
  };
}

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_payment_path_recon";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  delete process.env.STRIPE_COUNTRY_RECONCILIATION_ENABLED; // révélé par défaut — pas besoin de le positionner
});
afterAll(() => { __setStripeWebhookDepsForTests(null); });

beforeEach(() => {
  upserts.length = 0;
  ledger = memoryLedger();
  __setStripeWebhookDepsForTests(makeDeps());
});

function checkoutCompletedPayload(args: {
  eventId: string;
  subId: string;
  userId: string;
  selectedCountry: string;
  billingCountry: string;
  currency: string;
}) {
  const obj = {
    id: `cs_${args.subId}`,
    object: "checkout.session",
    mode: "subscription",
    subscription: args.subId,
    payment_status: "paid",
    currency: args.currency,
    customer: `cus_${args.subId}`,
    customer_details: { address: { country: args.billingCountry } },
    metadata: { user_id: args.userId, agent_slug: "pierre", selected_country: args.selectedCountry },
  };
  return JSON.stringify({
    id: args.eventId, object: "event", api_version: "2025-11-17.clover",
    created: 1000, type: "checkout.session.completed", livemode: false,
    data: { object: obj },
  });
}

function signed(payload: string) {
  return new Stripe("sk_test_payment_path_recon").webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

async function post(payload: string) {
  const { POST } = await import("../route");
  return POST(new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signed(payload), "content-type": "application/json" },
  }));
}

describe("PAYMENT PATH CLOSURE — réconciliation pays sur checkout.session.completed (révélée par défaut)", () => {
  it("France : session FR + facturation Stripe FR + EUR -> activation normale", async () => {
    const payload = checkoutCompletedPayload({
      eventId: "evt_fr_1", subId: "sub_fr_1", userId: "PAYMENT_PATH_TEST-fr",
      selectedCountry: "FR", billingCountry: "FR", currency: "eur",
    });
    const res = await post(payload);
    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].status).toBe("active");
  });

  it("Suisse : session CH + facturation Stripe CH + CHF -> activation normale", async () => {
    const payload = checkoutCompletedPayload({
      eventId: "evt_ch_1", subId: "sub_ch_1", userId: "PAYMENT_PATH_TEST-ch",
      selectedCountry: "CH", billingCountry: "CH", currency: "chf",
    });
    const res = await post(payload);
    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].status).toBe("active");
  });

  it("session déclarée France MAIS facturation Stripe réelle Suisse -> PAS d'activation silencieuse", async () => {
    const payload = checkoutCompletedPayload({
      eventId: "evt_conflict_1", subId: "sub_conflict_1", userId: "PAYMENT_PATH_TEST-conflict",
      selectedCountry: "FR", billingCountry: "CH", currency: "eur",
    });
    const res = await post(payload);
    expect(res.status).toBe(200); // Stripe reçoit toujours 200 (event traité), mais…
    expect(upserts).toHaveLength(1);
    expect(upserts[0].status).not.toBe("active"); // …le statut n'est PAS "active"
  });

  it("Suisse facturée en EUR (devise incohérente) -> pas d'activation", async () => {
    const payload = checkoutCompletedPayload({
      eventId: "evt_curr_1", subId: "sub_curr_1", userId: "PAYMENT_PATH_TEST-curr",
      selectedCountry: "CH", billingCountry: "CH", currency: "eur",
    });
    const res = await post(payload);
    expect(res.status).toBe(200);
    expect(upserts[0].status).not.toBe("active");
  });

  it("le MÊME événement reçu deux fois -> une seule écriture (idempotence du ledger)", async () => {
    const payload = checkoutCompletedPayload({
      eventId: "evt_replay_1", subId: "sub_replay_1", userId: "PAYMENT_PATH_TEST-replay",
      selectedCountry: "FR", billingCountry: "FR", currency: "eur",
    });
    const r1 = await post(payload);
    const r2 = await post(payload);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(upserts).toHaveLength(1); // le rejeu n'a produit AUCUNE seconde écriture
  });
});
