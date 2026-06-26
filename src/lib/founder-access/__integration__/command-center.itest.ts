// Phase E.6 — tests d'intégration PostgreSQL réel (PGlite) du Founder Command Center.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, applyFounderStripeEvent } from "../store";
import { getFounderCommandCenterSnapshot, listFounderClients, emailOperations } from "../command-center";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}

describe("E.6 — snapshot du command center", () => {
  it("compose des données réelles (overview, revenue, presence, funnel, sources, alerts)", async () => {
    await createOrUpdateReservation(h.db, mk("a@acme.fr"));
    const snap = await getFounderCommandCenterSnapshot(h.db);
    expect(snap.overview.reservations_total).toBeGreaterThanOrEqual(1);
    expect(snap.presence.estimate).toBe(true);
    expect(Array.isArray(snap.funnel.stages)).toBe(true);
    expect(snap.sources.find((s) => s.key === "postgres")).toBeTruthy();
    expect(snap.alerts.length).toBeGreaterThan(0);
    expect(typeof snap.generated_at).toBe("string");
  });

  it("alerte critique quand Stripe n'est pas connecté ; revenu non payé non compté", async () => {
    const snap = await getFounderCommandCenterSnapshot(h.db);
    // En test, STRIPE_SECRET_KEY est absent → source non connectée + alerte critique.
    expect(snap.revenue.stripe_connected).toBe(false);
    expect(snap.alerts.some((a) => a.code === "stripe_not_configured" && a.severity === "critical")).toBe(true);
    // Une réservation simplement confirmée ne génère aucun MRR.
    expect(snap.revenue.mrr_active_cents).toBe(0);
  });

  it("liste les clients actifs (status active_client) avec sub Stripe masqué", async () => {
    const r = await createOrUpdateReservation(h.db, mk("client@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "evt_cc", event_type: "checkout.session.completed", reservation_id: r.id, subscription_id: "sub_1234567890", customer_id: "cus_x", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const clients = await listFounderClients(h.db, 1, 25);
    const c = clients.rows.find((x) => x.email === "client@acme.fr");
    expect(c).toBeTruthy();
    expect(c!.subscription_amount_cents).toBe(44900);
    expect(c!.stripe_subscription_masked).toContain("…");        // jamais l'id complet
    expect(c!.stripe_subscription_masked).not.toBe("sub_1234567890");
  });

  it("opérations email : agrège les statuts de la file", async () => {
    await createOrUpdateReservation(h.db, mk("emailops@acme.fr")); // crée un job verification pending
    const ops = await emailOperations(h.db);
    expect(ops.pending + ops.sent + ops.skipped).toBeGreaterThan(0);
    expect(typeof ops.provider_configured).toBe("boolean");
  });
});
