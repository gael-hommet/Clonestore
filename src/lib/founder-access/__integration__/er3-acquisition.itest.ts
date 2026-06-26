// E-R3 §5 — acquisition : activations et paiements RÉELS (paiement = abonnement Stripe
// actif via webhook, jamais navigateur), taux de conversion réservation et paiement.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { upsertWebSession, acquisitionByDimension } from "../analytics";
import { createOrUpdateReservation, applyFounderStripeEvent } from "../store";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string, session: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt, anonymous_session_id: session };
}
const S = (n: number) => `${n.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

describe("§5 — acquisition activations + paiements", () => {
  it("agrège sessions/réservations/activations/paiements + taux par dimension", async () => {
    // 3 sessions 'google', 1 réservation, dont 1 activée+payée (abonnement actif).
    await upsertWebSession(h.db, { anonymous_session_id: S(1), utm_source: "google", utm_medium: "cpc", utm_campaign: "launch", current_path: "/" });
    await upsertWebSession(h.db, { anonymous_session_id: S(2), utm_source: "google", utm_medium: "cpc", utm_campaign: "launch", current_path: "/" });
    await upsertWebSession(h.db, { anonymous_session_id: S(3), utm_source: "google", utm_medium: "organic", utm_campaign: "launch", current_path: "/" });

    const r = await createOrUpdateReservation(h.db, mk("acq-pay@acme.fr", S(1)));
    // Activation+paiement UNIQUEMENT via événement Stripe serveur (abonnement actif).
    await applyFounderStripeEvent(h.db, { stripe_event_id: "acq_evt", event_type: "checkout.session.completed", event_created_at: 1_750_000_000, reservation_id: r.id, subscription_id: "sub_acq", amount_cents: 44900, currency: "EUR", subscription_status: "active" });

    const bySource = await acquisitionByDimension(h.db, "source", 30);
    const g = bySource.find((x) => x.key === "google")!;
    expect(g.sessions).toBe(3);
    expect(g.reservations).toBe(1);
    expect(g.activations).toBe(1);
    expect(g.payments).toBe(1);
    expect(g.reservation_conversion_rate).toBeCloseTo(33.3, 0); // 1/3
    expect(g.payment_conversion_rate).toBeCloseTo(33.3, 0);

    // Dimensions multiples disponibles.
    const byMedium = await acquisitionByDimension(h.db, "source_medium", 30);
    expect(byMedium.some((x) => x.key.includes("cpc"))).toBe(true);
    const byCampaign = await acquisitionByDimension(h.db, "campaign", 30);
    expect(byCampaign.find((x) => x.key === "launch")!.payments).toBe(1);
  });

  it("un abonnement annulé n'est plus compté comme paiement", async () => {
    const r = await createOrUpdateReservation(h.db, mk("acq-churn@acme.fr", S(9)));
    await upsertWebSession(h.db, { anonymous_session_id: S(9), utm_source: "bing", current_path: "/" });
    await applyFounderStripeEvent(h.db, { stripe_event_id: "acq_c1", event_type: "checkout.session.completed", event_created_at: 1000, reservation_id: r.id, subscription_id: "sub_c", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    await applyFounderStripeEvent(h.db, { stripe_event_id: "acq_c2", event_type: "customer.subscription.deleted", event_created_at: 2000, reservation_id: r.id, subscription_id: "sub_c", subscription_status: "canceled" });
    const bing = (await acquisitionByDimension(h.db, "source", 30)).find((x) => x.key === "bing")!;
    expect(bing.payments).toBe(0); // plus actif → hors paiements
    expect(bing.activations).toBe(1); // activated_at conservé (historique)
  });
});
