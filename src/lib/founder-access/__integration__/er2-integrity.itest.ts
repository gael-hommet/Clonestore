// E-R2 — intégrité PostgreSQL (PGlite) : journal Stripe non falsifiable (§5),
// statut inconnu fail-closed (§4), funnel cohorté TEMPOREL (§10).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, applyFounderStripeEvent, stripeAnomalyCount } from "../store";
import { recordWebEvents, cohortFunnelSnapshot } from "../analytics";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}

describe("§3/§5 — journal Stripe NON falsifiable par le rôle applicatif général", () => {
  it("grants : pierre_rt_app n'a ni INSERT ni EXECUTE ; le writer dédié a EXECUTE ; PUBLIC non", async () => {
    const q = async (sql: string) => Number((await h.db.query<{ b: boolean }>(sql)).rows[0].b);
    expect(await q("select has_table_privilege('pierre_rt_app','clonestore_founder_stripe_events','INSERT')::int as b")).toBe(0);
    expect(await q("select has_function_privilege('pierre_rt_app','clonestore_record_founder_stripe_event(jsonb)','EXECUTE')::int as b")).toBe(0);
    expect(await q("select has_function_privilege('public','clonestore_record_founder_stripe_event(jsonb)','EXECUTE')::int as b")).toBe(0);
    expect(await q("select has_function_privilege('clonestore_stripe_webhook_writer','clonestore_record_founder_stripe_event(jsonb)','EXECUTE')::int as b")).toBe(1);
  });

  it("SET ROLE pierre_rt_app → INSERT/UPDATE/DELETE/EXECUTE tous refusés", async () => {
    const payload = JSON.stringify({ stripe_event_id: "forge1", event_type: "checkout.session.completed", processing_result: "applied", payload_safe: {} });
    await h.db.query("set role pierre_rt_app");
    try {
      await expect(h.db.query(`select clonestore_record_founder_stripe_event('${payload}'::jsonb)`)).rejects.toThrow();
      await expect(h.db.query("insert into clonestore_founder_stripe_events (stripe_event_id,event_type) values ('forge2','x')")).rejects.toThrow();
      await expect(h.db.query("update clonestore_founder_stripe_events set event_type='x'")).rejects.toThrow();
      await expect(h.db.query("delete from clonestore_founder_stripe_events")).rejects.toThrow();
    } finally {
      await h.db.query("reset role");
    }
    // Aucune forge n'a abouti.
    const n = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id in ('forge1','forge2')");
    expect(n.rows[0].n).toBe(0);
  });

  it("l'écriture légitime passe par la fonction contrôlée (event journalisé une fois)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("ctrl@acme.fr"));
    await applyFounderStripeEvent(h.db, { stripe_event_id: "ctrl1", event_type: "checkout.session.completed", event_created_at: 1_750_000_000, reservation_id: r.id, subscription_id: "s", amount_cents: 44900, currency: "EUR", subscription_status: "active" });
    const n = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_stripe_events where stripe_event_id='ctrl1'");
    expect(n.rows[0].n).toBe(1);
  });
});

describe("§4 — statut Stripe inconnu fail-closed", () => {
  it("journalise 'unsupported' sans muter la réservation", async () => {
    const r = await createOrUpdateReservation(h.db, mk("unsup@acme.fr"));
    const res = await applyFounderStripeEvent(h.db, { stripe_event_id: "uns1", event_type: "customer.subscription.updated", event_created_at: 1_750_000_100, reservation_id: r.id, subscription_id: "s", subscription_status: "none", unsupported_raw_status: "quantum_superposed" });
    expect(res.ignored).toBe("unsupported_status");
    const row = await h.db.query<{ processing_result: string; status: string }>(
      "select e.processing_result, r.status from clonestore_founder_stripe_events e join clonestore_founder_reservations r on r.id=e.reservation_id where e.stripe_event_id='uns1'");
    expect(row.rows[0].processing_result).toBe("unsupported");
    expect(row.rows[0].status).not.toBe("active_client");
    expect(await stripeAnomalyCount(h.db)).toBeGreaterThanOrEqual(1);
  });
});

describe("§10 — funnel cohorté TEMPOREL (jamais > 100 %, ordre respecté)", () => {
  it("une session qui voit la démo AVANT le site ne compte pas l'étape démo", async () => {
    const ordered = "aaaa1111-1111-4111-8111-111111111111";
    const reversed = "bbbb2222-2222-4222-8222-222222222222";
    // ordered : site_viewed puis demo_viewed (ordre correct)
    await recordWebEvents(h.db, ordered, [{ name: "site_viewed" }]);
    await new Promise((r) => setTimeout(r, 10));
    await recordWebEvents(h.db, ordered, [{ name: "demo_viewed" }]);
    // reversed : demo_viewed AVANT site_viewed
    await recordWebEvents(h.db, reversed, [{ name: "demo_viewed" }]);
    await new Promise((r) => setTimeout(r, 10));
    await recordWebEvents(h.db, reversed, [{ name: "site_viewed" }]);

    const c = await cohortFunnelSnapshot(h.db, 30);
    const site = c.stages.find((s) => s.key === "site")!;
    const demo = c.stages.find((s) => s.key === "demo")!;
    expect(site.count).toBeGreaterThanOrEqual(2);   // les deux sont éligibles (ont site_viewed)
    // seul 'ordered' franchit demo temporellement → demo.count < site.count
    expect(demo.count).toBeLessThan(site.count);
    for (const s of c.stages) if (s.from_top !== null) expect(s.from_top).toBeLessThanOrEqual(100);
  });
});
