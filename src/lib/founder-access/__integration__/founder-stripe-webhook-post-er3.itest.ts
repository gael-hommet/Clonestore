// E-R3 §3 — VRAIE route POST /api/webhooks/stripe avec base PGlite + dépendances
// injectées (passerelle Stripe contractuelle, commandes no-op). Signature réelle.
// On n'appelle PAS le bridge directement : tout passe par la fonction POST.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import Stripe from "stripe";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, founderRevenueMetrics } from "../store";
import { __setStripeWebhookDepsForTests, type StripeWebhookDeps } from "../stripe-webhook-deps";
import type { SubscriptionProof } from "../stripe-webhook-bridge";
import { issueVerificationToken } from "../token";

const SECRET = "whsec_er3_secret";
let h: FounderHarness;
beforeAll(async () => {
  h = await createFounderHarness();
  process.env.STRIPE_SECRET_KEY = "sk_test_er3";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});
afterAll(async () => { await h.close(); __setStripeWebhookDepsForTests(null); });
afterEach(() => __setStripeWebhookDepsForTests(null));

const VALID_PROOF: SubscriptionProof = { priceId: "price_pierre", amountCents: 44900, currency: "eur", interval: "month", productId: "prod_pierre" };
const ordersNoop = { upsert: async () => {}, updateBySubId: async () => {} };
function injectDeps(over: Partial<StripeWebhookDeps> = {}) {
  __setStripeWebhookDepsForTests({
    getFounderDb: async () => h.db, fetchProof: async () => VALID_PROOF, orders: ordersNoop,
    expectedPriceId: "price_pierre", expectedProductId: null, ...over,
  });
}
function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}
function sign(payload: string): string {
  return new Stripe("sk_test_er3").webhooks.generateTestHeaderString({ payload, secret: SECRET });
}
function checkoutEvent(rid: string, over: Record<string, unknown> = {}, created = 1_750_000_000): string {
  return JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", api_version: "2024-01-01", created, livemode: false,
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", subscription: "sub_1", customer: "cus_1", payment_status: "paid",
      // P15 §4 — signaux de réconciliation pays/devise réels (pays de facturation Stripe FR + devise
      // EUR concordante) : sans eux le gate fail-closed (PAYMENT PATH CLOSURE 2026-07-24) bloque
      // toute activation faute de pays de facturation déterminé, quelle que soit la preuve fournie.
      currency: "eur", customer_details: { address: { country: "FR" } },
      metadata: { user_id: "11111111-1111-4111-8111-111111111111", agent_slug: "pierre", founder_reservation_id: rid, ...((over.metadata as object) ?? {}) }, ...over } },
  });
}
async function post(body: string, sig?: string) {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  return POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body, headers: sig ? { "stripe-signature": sig } : {} }));
}
async function statusOf(rid: string) {
  const { rows } = await h.db.query<{ status: string; subscription_status: string | null }>("select status, subscription_status from clonestore_founder_reservations where id=$1", [rid]);
  return rows[0];
}

describe("E-R3 §3 — route POST réelle avec base", () => {
  it("checkout valide → activation (une seule fois, replay sans doublon)", async () => {
    injectDeps();
    const r = await createOrUpdateReservation(h.db, mk("post-ok@acme.fr"));
    const body = checkoutEvent(r.id);
    const res1 = await post(body, sign(body));
    expect(res1.status).toBe(200);
    expect((await statusOf(r.id)).status).toBe("active_client");
    const mrr1 = (await founderRevenueMetrics(h.db)).mrr_active_cents;
    const res2 = await post(body, sign(body)); // même event id → idempotent
    expect(res2.status).toBe(200);
    expect((await founderRevenueMetrics(h.db)).mrr_active_cents).toBe(mrr1);
  });

  it("signature invalide → 400, aucune activation", async () => {
    injectDeps();
    const r = await createOrUpdateReservation(h.db, mk("post-badsig@acme.fr"));
    const res = await post(checkoutEvent(r.id), "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
    expect((await statusOf(r.id)).status).not.toBe("active_client");
  });

  it("preuve invalide (prix/produit/montant/devise/intervalle) → aucune activation", async () => {
    const cases: Array<[string, SubscriptionProof, string | null]> = [
      ["price", { ...VALID_PROOF, priceId: "price_x" }, null],
      ["product", { ...VALID_PROOF, productId: "prod_x" }, "prod_pierre"],
      ["amount", { ...VALID_PROOF, amountCents: 1 }, null],
      ["currency", { ...VALID_PROOF, currency: "usd" }, null],
      ["interval", { ...VALID_PROOF, interval: "year" }, null],
    ];
    for (const [tag, proof, expProd] of cases) {
      injectDeps({ fetchProof: async () => proof, expectedProductId: expProd });
      const r = await createOrUpdateReservation(h.db, mk(`post-${tag}@acme.fr`));
      const body = checkoutEvent(r.id);
      const res = await post(body, sign(body));
      expect(res.status).toBe(200);
      expect((await statusOf(r.id)).status).not.toBe("active_client");
    }
  });

  it("mauvais customer/subscription → aucune activation", async () => {
    injectDeps();
    const r = await createOrUpdateReservation(h.db, mk("post-nocust@acme.fr"));
    const body = checkoutEvent(r.id, { customer: null });
    const res = await post(body, sign(body));
    // session sans customer → soit skipped (validation), soit proof_failed ; jamais activé
    expect((await statusOf(r.id)).status).not.toBe("active_client");
    expect(res.status).toBe(200);
  });

  it("réservation inconnue → aucune activation", async () => {
    injectDeps();
    const body = checkoutEvent("3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a");
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    const j = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where reservation_id='3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a'");
    expect(j.rows[0].n).toBe(0); // jamais lié à une réservation inexistante
  });

  it("§1 — DB webhook dédiée non configurée → 503 (Stripe retry), aucune activation", async () => {
    const { WebhookDatabaseNotConfiguredError } = await import("../webhook-db");
    const r = await createOrUpdateReservation(h.db, mk("post-503@acme.fr"));
    injectDeps({ getFounderDb: async () => { throw new WebhookDatabaseNotConfiguredError(); } });
    const body = checkoutEvent(r.id);
    const res = await post(body, sign(body));
    expect(res.status).toBe(503);
    expect((await statusOf(r.id)).status).not.toBe("active_client");
  });

  it("erreur DB (commande) → non-200, aucune activation partielle", async () => {
    const r = await createOrUpdateReservation(h.db, mk("post-dberr@acme.fr"));
    injectDeps({ orders: { upsert: async () => { throw new Error("orders boom"); }, updateBySubId: async () => {} } });
    const body = checkoutEvent(r.id);
    const res = await post(body, sign(body));
    expect(res.status).not.toBe(200);
    expect((await statusOf(r.id)).status).not.toBe("active_client");
  });
});
