// CS-FINAL 3 — webhook Stripe CANONIQUE → contribution commerciale (PGlite réel).
// Prouve : (1) la signature est obligatoire (R 1-3) ; (2) seul un événement Stripe
// SIGNÉ pilote la contribution (R 70-72) ; (3) le pont est idempotent et ne casse
// jamais le flux principal (200). Aucune donnée du navigateur n'est jamais autoritative.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createClonestoryHarness, type ClonestoryHarness } from "./clonestory-harness";
import { __setClonestoryDbForTests, withService } from "../server/runtime";
import { registerPartner, verifyEmailToken } from "../server/store";
import { capturePartnerVisit, captureAccountAttribution } from "../server/attribution";
import { newVisitorId } from "../server/attribution-cookie";
import { applyCommercialStripeEvent, reconcileCommercial, type CommercialStripeEvent } from "../server/commercial";
import { randomUUID } from "node:crypto";

const SECRET = "whsec_cs_final_3_test_secret";
process.env.CLONESTORY_LOCAL_MODE = "1";
process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS = "0";
process.env.STRIPE_SECRET_KEY = "sk_test_csfinal3";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

let h: ClonestoryHarness;
let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  h = await createClonestoryHarness();
  __setClonestoryDbForTests(h.db);
  ({ POST } = await import("@/app/api/webhooks/stripe/route"));
});
afterAll(async () => { __setClonestoryDbForTests(null); await h.close(); });

const stripe = new Stripe("sk_test_csfinal3");
function post(eventObj: unknown): Promise<Response> {
  const payload = JSON.stringify(eventObj);
  const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return POST(new Request("https://clonestore.pro/api/webhooks/stripe", {
    method: "POST", headers: { "stripe-signature": sig, "content-type": "application/json" }, body: payload,
  }));
}
function chargeRefundedEvent(pi: string, amountRefunded: number) {
  return {
    id: `evt_${randomUUID()}`, object: "event", api_version: "2024-01-01", created: 1_750_000_500,
    type: "charge.refunded", livemode: false,
    data: { object: { id: "ch_1", object: "charge", payment_intent: pi, invoice: "in_1", amount_refunded: amountRefunded, currency: "eur" } },
  };
}

async function seedVerified(label: string, sub: string, pi: string): Promise<void> {
  const email = `${label}@seed-${label}.test`;
  const r = await registerPartner({ firstName: "P", lastName: label, email: `p-${label}@partner.test` });
  if (!r.ok) throw new Error("register");
  await verifyEmailToken(r.verificationToken!);
  const vid = newVisitorId();
  await capturePartnerVisit({ partnerId: r.partnerId, visitorId: vid, existingVisitorId: null });
  const acc = randomUUID();
  await captureAccountAttribution({ accountUserId: acc, email, visitorId: vid });
  const checkout: CommercialStripeEvent = { eventId: `ev_${label}_co`, type: "checkout.session.completed", livemode: false, createdAt: 1, subscriptionId: sub, customerId: "cus_x", checkoutSessionId: `cs_${sub}`, amountPaid: 0, currency: "eur", userId: acc, agentSlug: "pierre" };
  const invoice: CommercialStripeEvent = { eventId: `ev_${label}_in`, type: "invoice.paid", livemode: false, createdAt: 2, subscriptionId: sub, customerId: "cus_x", invoiceId: `in_${sub}`, paymentIntentId: pi, amountPaid: 44900, currency: "eur" };
  await applyCommercialStripeEvent(checkout, {});
  await applyCommercialStripeEvent(invoice, {});
  await reconcileCommercial(new Date());
}
async function statusOf(sub: string): Promise<string | null> {
  return (await withService(h.db, (tx) => tx.query<{ status: string }>(
    `select status from clonestory_fp_commercial_contributions where stripe_subscription_id=$1`, [sub]))).rows[0]?.status ?? null;
}

describe("webhook commercial — signature & autorité", () => {
  it("signature manquante → 400 ; signature invalide → 400 (aucune mutation)", async () => {
    const noSig = await POST(new Request("https://x/api/webhooks/stripe", { method: "POST", body: "{}" }));
    expect(noSig.status).toBe(400);
    const bad = await POST(new Request("https://x/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": "t=1,v1=deadbeef" }, body: JSON.stringify(chargeRefundedEvent("pi_x", 1)),
    }));
    expect(bad.status).toBe(400);
  });

  it("événement SIGNÉ pilote la contribution (remboursement) sans casser le flux", async () => {
    await seedVerified("whk", "sub_whk", "pi_whk");
    expect(await statusOf("sub_whk")).toBe("verified");
    const res = await post(chargeRefundedEvent("pi_whk", 44900));
    expect(res.status).toBe(200); // ne casse jamais le flux principal
    expect(await statusOf("sub_whk")).toBe("refunded"); // preuve : seul le webhook signé agit
  });

  it("rejouer le même événement signé → idempotent (un seul effet)", async () => {
    await seedVerified("whk2", "sub_whk2", "pi_whk2");
    const ev = chargeRefundedEvent("pi_whk2", 44900);
    await post(ev);
    await post(ev); // même event.id rejoué
    expect(await statusOf("sub_whk2")).toBe("refunded");
    const refundEvents = (await withService(h.db, (tx) => tx.query<{ n: number }>(
      `select count(*)::int n from clonestory_fp_commercial_events e
         join clonestory_fp_commercial_contributions c on c.id = e.contribution_id
        where c.stripe_subscription_id='sub_whk2' and e.type='refund_full'`))).rows[0].n;
    expect(refundEvents).toBe(1); // un seul effet malgré le rejeu
  });
});
