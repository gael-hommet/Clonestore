// E-R2 §5/§6 — vérité webhook avec base réelle (PGlite) + récupérateur de preuve
// injecté. Activation UNIQUEMENT sur preuve commerciale complète ; refus sinon ;
// idempotence ; ordre ; statut inconnu ; et ATOMICITÉ (rollback tout-ou-rien).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, founderRevenueMetrics } from "../store";
import { applyFounderStripeWebhook, type FounderWebhookEvent, type SubscriptionProof } from "../stripe-webhook-bridge";
import { issueVerificationToken } from "../token";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}
const VALID_PROOF: SubscriptionProof = { priceId: "price_pierre", amountCents: 44900, currency: "eur", interval: "month", productId: "prod_pierre" };
const deps = (proof: SubscriptionProof | null = VALID_PROOF, expectedProductId: string | null = null) => ({
  expectedPriceId: "price_pierre", expectedProductId, envIsProduction: false,
  fetchProof: async () => proof,
});
function ev(over: Partial<FounderWebhookEvent>, rid: string): FounderWebhookEvent {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2)}`, eventType: "checkout.session.completed",
    eventCreated: 1_750_000_000, livemode: false, apiVersion: "2024-01-01",
    metadata: { founder_reservation_id: rid, user_id: "u1" }, rawStatus: "active",
    subscriptionId: "sub_1", customerId: "cus_1", isGrantCandidate: true, ...over,
  };
}
async function status(rid: string) {
  const { rows } = await h.db.query<{ status: string; subscription_status: string | null }>("select status, subscription_status from clonestore_founder_reservations where id=$1", [rid]);
  return rows[0];
}

describe("§5 — activation UNIQUEMENT sur preuve complète", () => {
  it("checkout founder valide → activation (une seule fois)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("ok@acme.fr"));
    const e = ev({ eventId: "evt_ok" }, r.id);
    const out1 = await applyFounderStripeWebhook(h.db, e, deps());
    expect(out1).toMatchObject({ handled: true, decision: "applied" });
    expect((await status(r.id)).status).toBe("active_client");
    const mrr1 = (await founderRevenueMetrics(h.db)).mrr_active_cents;
    // replay du même event → aucune double activation
    const out2 = await applyFounderStripeWebhook(h.db, e, deps());
    expect(out2.handled && out2.result.duplicate).toBe(true);
    expect((await founderRevenueMetrics(h.db)).mrr_active_cents).toBe(mrr1);
  });

  it("refuse chaque preuve invalide (aucune activation)", async () => {
    const cases: Array<[string, SubscriptionProof | null, string | null]> = [
      ["badprice", { ...VALID_PROOF, priceId: "price_other" }, null],
      ["badproduct", { ...VALID_PROOF, productId: "prod_x" }, "prod_pierre"],
      ["badamount", { ...VALID_PROOF, amountCents: 1 }, null],
      ["badcurrency", { ...VALID_PROOF, currency: "usd" }, null],
      ["badinterval", { ...VALID_PROOF, interval: "year" }, null],
      ["noproof", null, null],
    ];
    for (const [tag, proof, expProd] of cases) {
      const r = await createOrUpdateReservation(h.db, mk(`${tag}@acme.fr`));
      const out = await applyFounderStripeWebhook(h.db, ev({ eventId: `evt_${tag}` }, r.id), deps(proof, expProd));
      expect(out).toMatchObject({ handled: true, decision: "proof_failed" });
      expect((await status(r.id)).status).not.toBe("active_client");
    }
  });

  it("customer/subscription manquants → refus", async () => {
    const r = await createOrUpdateReservation(h.db, mk("nocust@acme.fr"));
    const noCust = await applyFounderStripeWebhook(h.db, ev({ eventId: "evt_nc", customerId: null }, r.id), deps());
    expect(noCust).toMatchObject({ decision: "proof_failed" });
    const noSub = await applyFounderStripeWebhook(h.db, ev({ eventId: "evt_ns", subscriptionId: null }, r.id), deps());
    expect(noSub).toMatchObject({ decision: "proof_failed" });
    expect((await status(r.id)).status).not.toBe("active_client");
  });

  it("réservation absente → aucune activation", async () => {
    const out = await applyFounderStripeWebhook(h.db, ev({ eventId: "evt_missing" }, "3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a"), deps());
    expect(out.handled && out.result.ignored).toBe("reservation_missing");
  });

  it("statut inconnu → unsupported, aucune activation", async () => {
    const r = await createOrUpdateReservation(h.db, mk("unsup-wh@acme.fr"));
    const out = await applyFounderStripeWebhook(h.db, ev({ eventId: "evt_uns", eventType: "customer.subscription.updated", rawStatus: "quantum", isGrantCandidate: false }, r.id), deps());
    expect(out).toMatchObject({ decision: "unsupported" });
    expect((await status(r.id)).status).not.toBe("active_client");
  });

  it("ordre : event stale ignoré, même timestamp → précédence terminale", async () => {
    const r = await createOrUpdateReservation(h.db, mk("ord-wh@acme.fr"));
    await applyFounderStripeWebhook(h.db, ev({ eventId: "o1", eventCreated: 2000 }, r.id), deps());
    await applyFounderStripeWebhook(h.db, ev({ eventId: "o2", eventType: "customer.subscription.deleted", rawStatus: "canceled", isGrantCandidate: false, eventCreated: 3000 }, r.id), deps());
    // active périmé (t < 3000) → ignoré
    const stale = await applyFounderStripeWebhook(h.db, ev({ eventId: "o0", eventCreated: 1000 }, r.id), deps());
    expect(stale.handled && stale.result.ignored).toBe("stale");
    // active au MÊME timestamp que le canceled → précédence terminale
    const tie = await applyFounderStripeWebhook(h.db, ev({ eventId: "o3", eventCreated: 3000 }, r.id), deps());
    expect(tie.handled && tie.result.ignored).toBe("terminal_precedence");
    expect((await status(r.id)).subscription_status).toBe("canceled");
  });
});

describe("§6 — atomicité (rollback tout-ou-rien)", () => {
  it("une erreur après le journal annule TOUT (ni journal, ni activation)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("atomic@acme.fr"));
    // Wrapper qui fait échouer l'insertion de l'événement funnel d'activation.
    const flaky: SqlExecutor = {
      query: h.db.query.bind(h.db),
      async transaction(fn) {
        return h.db.transaction(async (tx) => {
          const wrapped: SqlExecutor = {
            query: ((text: string, params?: readonly unknown[]) => {
              if (/founder_payment_completed/.test(text)) return Promise.reject(new Error("funnel boom"));
              return tx.query(text, params);
            }) as SqlExecutor["query"],
            transaction: tx.transaction.bind(tx),
          };
          return fn(wrapped);
        });
      },
    };
    await expect(applyFounderStripeWebhook(flaky, ev({ eventId: "evt_atomic" }, r.id), deps())).rejects.toThrow();
    // rollback : aucune ligne de journal, réservation NON activée.
    const j = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id='evt_atomic'");
    expect(j.rows[0].n).toBe(0);
    expect((await status(r.id)).status).not.toBe("active_client");
  });
});
