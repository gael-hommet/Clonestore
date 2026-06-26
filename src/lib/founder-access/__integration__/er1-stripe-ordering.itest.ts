// E-R1 §7 — ordre monotone des événements Stripe (PGlite). Un événement plus ancien
// que le dernier appliqué ne réactive jamais un abonnement.
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
const T0 = 1_750_000_000; // epoch secondes de référence

describe("E-R1 §7 — ordre monotone Stripe", () => {
  it("active(t1) → canceled(t2) → active périmé(t0) ignoré (pas de réactivation)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("order@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "e1", event_type: "customer.subscription.updated", event_created_at: T0 + 100, reservation_id: r.id, subscription_id: "sub", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    await applyFounderStripeEvent(h.db, { stripe_event_id: "e2", event_type: "customer.subscription.deleted", event_created_at: T0 + 200, reservation_id: r.id, subscription_id: "sub", subscription_status: "canceled" });

    const stale = await applyFounderStripeEvent(h.db, { stripe_event_id: "e0", event_type: "customer.subscription.updated", event_created_at: T0 + 50, reservation_id: r.id, subscription_id: "sub", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    expect(stale.ignored).toBe("stale");
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.status).toBe("active_client"); // l'historique reste, mais…
    const rev = await founderRevenueMetrics(h.db);
    // …l'abonnement est canceled → hors MRR (la réactivation périmée n'a rien changé).
    const sub = await h.db.query<{ s: string }>("select subscription_status s from clonestore_founder_reservations where id=$1", [r.id]);
    expect(sub.rows[0].s).toBe("canceled");
    expect(rev.mrr_active_cents).toBe(0);
  });

  it("rejeu du même stripe_event_id → duplicate (aucun double comptage)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("replay@acme.fr"));
    const a = await applyFounderStripeEvent(h.db, { stripe_event_id: "rp1", event_type: "checkout.session.completed", event_created_at: T0, reservation_id: r.id, subscription_id: "s", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const b = await applyFounderStripeEvent(h.db, { stripe_event_id: "rp1", event_type: "checkout.session.completed", event_created_at: T0, reservation_id: r.id, subscription_id: "s", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    expect(a.applied).toBe(true);
    expect(b.duplicate).toBe(true);
    const n = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id='rp1'");
    expect(n.rows[0].n).toBe(1);
  });

  it("incomplete n'accorde pas l'accès (hors MRR)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("incomplete@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "inc1", event_type: "customer.subscription.created", event_created_at: T0, reservation_id: r.id, subscription_id: "si", subscription_status: "incomplete" });
    const sub = await h.db.query<{ s: string; st: string }>("select subscription_status s, status st from clonestore_founder_reservations where id=$1", [r.id]);
    expect(sub.rows[0].s).toBe("incomplete");
    expect(sub.rows[0].st).not.toBe("active_client"); // pas d'activation sur incomplete
  });

  it("journalise event_created_at + processing_result", async () => {
    const r = await createOrUpdateReservation(h.db, mk("journal@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "j1", event_type: "checkout.session.completed", event_created_at: T0, livemode: false, reservation_id: r.id, subscription_id: "s", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const row = await h.db.query<{ processing_result: string; event_created_at: string | null; livemode: boolean }>("select processing_result, event_created_at, livemode from clonestore_founder_stripe_events where stripe_event_id='j1'");
    expect(row.rows[0].processing_result).toBe("applied");
    expect(row.rows[0].event_created_at).not.toBeNull();
    expect(row.rows[0].livemode).toBe(false);
  });
});
