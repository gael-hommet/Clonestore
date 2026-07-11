// Régression : `invoice.payment_failed` sur la VRAIE route webhook.
//
// Le handler lisait `invoice.subscription`, champ SUPPRIMÉ par l'API Stripe ≥ Basil
// (version épinglée du projet : 2025-11-17.clover). La lecture renvoyait toujours null,
// donc `orders.status = "past_due"` n'était JAMAIS écrit : tout échec de paiement était
// silencieusement ignoré et le client conservait son accès.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Stripe from "stripe";
import { __setStripeWebhookDepsForTests, type StripeWebhookDeps } from "@/lib/founder-access/stripe-webhook-deps";

const SECRET = "whsec_test_api_drift";

const updates: Array<{ subId: string; update: Record<string, unknown> }> = [];
const upserts: Array<Record<string, unknown>> = [];

const deps: StripeWebhookDeps = {
  getFounderDb: async () => { throw new Error("la DB fondateur ne doit pas être touchée ici"); },
  fetchProof: async () => null,
  orders: {
    upsert: async (a) => { upserts.push(a as unknown as Record<string, unknown>); },
    updateBySubId: async (subId, update) => { updates.push({ subId, update }); },
  },
  expectedPriceId: "price_test",
  expectedProductId: "prod_test",
};

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_api_drift";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  __setStripeWebhookDepsForTests(deps);
});

afterAll(() => { __setStripeWebhookDepsForTests(null); });

beforeEach(() => { updates.length = 0; upserts.length = 0; });

function signedRequest(type: string, dataObject: Record<string, unknown>): Request {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    api_version: "2025-11-17.clover",
    created: 1_800_000_000,
    type,
    livemode: false,
    data: { object: dataObject },
  });
  const sig = new Stripe("sk_test_api_drift").webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": sig, "content-type": "application/json" },
  });
}

async function post(type: string, obj: Record<string, unknown>) {
  const { POST } = await import("../route");
  return POST(signedRequest(type, obj));
}

describe("invoice.payment_failed — l'abonnement est retrouvé malgré la migration d'API", () => {
  it("forme COURANTE (parent.subscription_details) → orders passe en past_due", async () => {
    const res = await post("invoice.payment_failed", {
      id: "in_1",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_basil" } },
    });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ subId: "sub_basil", update: { status: "past_due" } }]);
  });

  it("forme LEGACY (invoice.subscription) → toujours prise en charge", async () => {
    const res = await post("invoice.payment_failed", { id: "in_2", subscription: "sub_legacy" });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ subId: "sub_legacy", update: { status: "past_due" } }]);
  });

  it("facture sans abonnement (paiement ponctuel) → aucune écriture, 200", async () => {
    const res = await post("invoice.payment_failed", { id: "in_3", parent: { type: "quote_details" } });
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });
});

describe("customer.subscription.updated — current_period_end retrouvé sur les items", () => {
  it("items.data[].current_period_end alimente le pont fondateur sans erreur", async () => {
    const res = await post("customer.subscription.updated", {
      id: "sub_p",
      status: "active",
      customer: "cus_p",
      items: { data: [{ current_period_end: 1_900_000_000 }] },
    });
    expect(res.status).toBe(200);
    // Pas de metadata founder_reservation_id → le pont fondateur n'est pas sollicité
    // (getFounderDb lèverait). L'ordre est réactivé.
    expect(updates).toEqual([{ subId: "sub_p", update: { status: "active", ended_at: null } }]);
  });
});
