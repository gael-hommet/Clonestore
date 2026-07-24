// Anti-replay du flux orders sur la VRAIE route webhook, avec ledger injecté.
// Prouve : event dupliqué sans double effet, ancien event ne ressuscite pas une commande,
// et webhook falsifié rejeté (400) AVANT d'atteindre le ledger.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Stripe from "stripe";
import { __setStripeWebhookDepsForTests, type StripeWebhookDeps } from "@/lib/founder-access/stripe-webhook-deps";
import {
  claimOrdersEvent,
  finishOrdersEvent,
  fingerprintEventObject,
  type OrdersEventLedgerPort,
  type OrdersEventReceipt,
} from "@/lib/billing/orders-event-ledger";
import type { EventRank } from "@/lib/billing/orders-event-ordering";

const SECRET = "whsec_test_orders_ledger";

// Ledger en mémoire réutilisant la logique réelle claim/finish.
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
const updates: Array<{ subId: string; update: Record<string, unknown> }> = [];
let ledger: ReturnType<typeof memoryLedger>;

function makeDeps(): StripeWebhookDeps {
  return {
    getFounderDb: async () => { throw new Error("founder DB non sollicitée"); },
    fetchProof: async () => null,
    orders: {
      upsert: async (a) => { upserts.push(a as unknown as Record<string, unknown>); },
      updateBySubId: async (subId, update) => { updates.push({ subId, update }); },
    },
    ordersLedger: ledger,
    expectedPriceId: "price_test",
    expectedProductId: "prod_test",
  };
}

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_orders_ledger";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  // Ce fichier teste l'anti-replay/l'ordre monotone du ledger, pas la réconciliation pays
  // (révélée par défaut depuis PAYMENT PATH CLOSURE) — désactivation explicite pour isoler le
  // comportement testé (ces fixtures n'ont pas de signal de facturation).
  process.env.STRIPE_COUNTRY_RECONCILIATION_ENABLED = "false";
});
afterAll(() => { __setStripeWebhookDepsForTests(null); });

beforeEach(() => {
  upserts.length = 0;
  updates.length = 0;
  ledger = memoryLedger();
  __setStripeWebhookDepsForTests(makeDeps());
});

function eventPayload(type: string, id: string, created: number, obj: Record<string, unknown>) {
  return JSON.stringify({ id, object: "event", api_version: "2025-11-17.clover", created, type, livemode: false, data: { object: obj } });
}
function signed(payload: string) {
  return new Stripe("sk_test_orders_ledger").webhooks.generateTestHeaderString({ payload, secret: SECRET });
}
async function post(payload: string, sig?: string) {
  const { POST } = await import("../route");
  return POST(new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": sig ?? signed(payload), "content-type": "application/json" },
  }));
}

const deletedObj = (created: number) => eventPayload("customer.subscription.deleted", `evt_del_${created}`, created, { id: "sub_1", customer: "cus_1" });
const updatedActive = (id: string, created: number) =>
  eventPayload("customer.subscription.updated", id, created, { id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ current_period_end: 2_000_000_000 }] } });

describe("webhook orders — anti-replay", () => {
  it("event dupliqué → une seule mutation (second = duplicate)", async () => {
    const payload = updatedActive("evt_1", 100);
    const r1 = await post(payload);
    const r2 = await post(payload);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(updates).toHaveLength(1); // le rejeu n'a produit AUCUNE seconde mutation
  });

  it("annulation puis ANCIENNE mise à jour active rejouée → pas de résurrection", async () => {
    await post(deletedObj(200)); // cancel récent
    expect(updates).toContainEqual({ subId: "sub_1", update: { status: "canceled", ended_at: expect.any(String) } });
    updates.length = 0;

    await post(updatedActive("evt_old_active", 150)); // active PLUS ANCIEN
    expect(updates).toHaveLength(0); // stale → aucune réactivation
  });

  it("vraie réactivation ULTÉRIEURE → appliquée", async () => {
    await post(deletedObj(200));
    updates.length = 0;
    await post(updatedActive("evt_new_active", 400)); // active plus récent
    expect(updates).toHaveLength(1);
    expect(updates[0].update).toMatchObject({ status: "active" });
  });

  it("webhook falsifié (signature invalide) → 400 AVANT le ledger", async () => {
    const payload = updatedActive("evt_forge", 100);
    const res = await post(payload, "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
    expect(ledger.rows.size).toBe(0); // rien n'a atteint le ledger
    expect(updates).toHaveLength(0);
  });
});
