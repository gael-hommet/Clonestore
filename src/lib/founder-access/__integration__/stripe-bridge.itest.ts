// Phase E.4 — tests d'intégration PostgreSQL réel (PGlite) de la vérité Stripe.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, applyFounderStripeEvent, founderRevenueMetrics, getReservationDetail } from "../store";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}

describe("E.4 — vérité Stripe (webhook → réservation)", () => {
  it("active une réservation sur preuve de paiement (et journalise l'event)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("pay@acme.fr"));
    const res = await applyFounderStripeEvent(h.db, {
      stripe_event_id: "evt_1", event_type: "checkout.session.completed", reservation_id: r.id,
      subscription_id: "sub_1", customer_id: "cus_1", amount_cents: 44900, currency: "EUR", subscription_status: "active",
    });
    expect(res.applied).toBe(true);
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.status).toBe("active_client");
    expect(d?.subscription_amount_cents).toBe(44900);
    expect(d?.stripe_subscription_id).toBe("sub_1");
    expect(d?.activated_at).not.toBeNull();
    const ev = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id='evt_1'");
    expect(ev.rows[0].n).toBe(1);
  });

  it("est idempotent sur stripe_event_id (rejeu sans double comptage)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("dup@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_dup", event_type: "checkout.session.completed", reservation_id: r.id, subscription_id: "sub_d", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const again = await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_dup", event_type: "checkout.session.completed", reservation_id: r.id, subscription_id: "sub_d", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    expect(again.duplicate).toBe(true);
    const ev = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id='evt_dup'");
    expect(ev.rows[0].n).toBe(1);
  });

  it("ne compte jamais une réservation non payée comme revenu", async () => {
    // une réservation simplement confirmée n'a pas de subscription_status → hors MRR
    await createOrUpdateReservation(h.db, mk("free@acme.fr"));
    const before = await founderRevenueMetrics(h.db);
    const r = await createOrUpdateReservation(h.db, mk("mrr@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_mrr", event_type: "checkout.session.completed", reservation_id: r.id, subscription_id: "sub_m", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const after = await founderRevenueMetrics(h.db);
    expect(after.mrr_active_cents - before.mrr_active_cents).toBe(44900);
    expect(after.arr_active_cents).toBe(after.mrr_active_cents * 12);
  });

  it("retire du MRR un abonnement annulé (churn)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("churn@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_c1", event_type: "checkout.session.completed", reservation_id: r.id, subscription_id: "sub_c", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const active = await founderRevenueMetrics(h.db);
    await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_c2", event_type: "customer.subscription.deleted", reservation_id: r.id, subscription_id: "sub_c", subscription_status: "canceled" });
    const churned = await founderRevenueMetrics(h.db);
    expect(churned.mrr_active_cents).toBe(active.mrr_active_cents - 44900);
    expect(churned.canceled).toBeGreaterThanOrEqual(1);
    // l'historique d'activation reste (activated_at non effacé)
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.activated_at).not.toBeNull();
  });
});
