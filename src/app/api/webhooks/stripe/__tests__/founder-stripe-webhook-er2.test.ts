// E-R2 §1 — tests de la VRAIE route webhook Stripe (fonction POST). Signature vérifiée
// avant tout traitement : un payload non signé / mal signé / altéré est rejeté (400)
// AVANT d'atteindre le bridge fondateur. Signature de test calculée avec un secret de test.
import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";

const SECRET = "whsec_test_er2_secret";
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_er2";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

function makeEvent(type: string, dataObject: Record<string, unknown>, created = 1_750_000_000): Record<string, unknown> {
  return { id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", api_version: "2024-01-01", created, type, livemode: false, data: { object: dataObject } };
}

function sign(payload: string): string {
  const stripe = new Stripe("sk_test_er2");
  return stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

async function post(body: string, headers: Record<string, string>) {
  const { POST } = await import("../route");
  return POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body, headers }));
}

describe("§1 — signature Stripe vérifiée avant le bridge", () => {
  it("header stripe-signature absent → 400", async () => {
    const body = JSON.stringify(makeEvent("customer.created", { id: "cus_1" }));
    const res = await post(body, { "content-type": "application/json" });
    expect(res.status).toBe(400);
  });

  it("signature invalide → 400 (jamais de traitement)", async () => {
    const body = JSON.stringify(makeEvent("customer.created", { id: "cus_1" }));
    const res = await post(body, { "stripe-signature": "t=1,v1=deadbeef" });
    expect(res.status).toBe(400);
  });

  it("body altéré après signature → 400", async () => {
    const body = JSON.stringify(makeEvent("customer.created", { id: "cus_1" }));
    const sig = sign(body);
    const tampered = body.replace("cus_1", "cus_HACKED");
    const res = await post(tampered, { "stripe-signature": sig });
    expect(res.status).toBe(400);
  });

  it("signature valide + type non géré → 200 (traité, aucun effet de bord)", async () => {
    const body = JSON.stringify(makeEvent("customer.created", { id: "cus_1" }));
    const res = await post(body, { "stripe-signature": sign(body) });
    expect(res.status).toBe(200);
  });

  it("signature valide + event founder mais base indisponible → jamais 200 silencieux, aucune activation", async () => {
    const savedDb = { a: process.env.DATABASE_URL, b: process.env.SUPABASE_DB_URL, s: process.env.NEXT_PUBLIC_SUPABASE_URL };
    delete process.env.DATABASE_URL; delete process.env.SUPABASE_DB_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      // subscription.deleted founder → atteint le bridge ; sans base, échec contrôlé (500), pas d'activation partielle.
      const ev = makeEvent("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", metadata: { founder_reservation_id: "3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a", user_id: "u1" } });
      const body = JSON.stringify(ev);
      const res = await post(body, { "stripe-signature": sign(body) });
      expect(res.status).not.toBe(200); // jamais d'acquittement silencieux sans persistance
    } finally {
      if (savedDb.a !== undefined) process.env.DATABASE_URL = savedDb.a;
      if (savedDb.b !== undefined) process.env.SUPABASE_DB_URL = savedDb.b;
      if (savedDb.s !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedDb.s;
    }
  });
});
