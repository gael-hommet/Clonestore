// Phase E.5 — tests d'intégration PostgreSQL réel (PGlite) des analytics first-party.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { upsertWebSession, recordWebEvents, presenceSnapshot, funnelSnapshot, acquisitionBreakdown } from "../analytics";
import { createOrUpdateReservation } from "../store";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

describe("E.5 — sessions web & présence", () => {
  it("upsert une session : conserve la landing, met à jour current_path + last_seen", async () => {
    await upsertWebSession(h.db, { anonymous_session_id: "s1", current_path: "/demo", landing_path: "/demo", utm_source: "newsletter" });
    await upsertWebSession(h.db, { anonymous_session_id: "s1", current_path: "/reserver/pierre", landing_path: "/autre" });
    const { rows } = await h.db.query<{ current_path: string; landing_path: string; utm_source: string }>(
      "select current_path, landing_path, utm_source from clonestore_web_sessions where anonymous_session_id='s1'");
    expect(rows[0].current_path).toBe("/reserver/pierre");
    expect(rows[0].landing_path).toBe("/demo");      // landing conservée
    expect(rows[0].utm_source).toBe("newsletter");   // origine conservée
  });

  it("présence : compte les sessions dans la fenêtre, exclut les expirées", async () => {
    await upsertWebSession(h.db, { anonymous_session_id: "live1", current_path: "/demo/pierre" });
    await upsertWebSession(h.db, { anonymous_session_id: "old1", current_path: "/demo" });
    await h.db.query("update clonestore_web_sessions set last_seen_at = now() - interval '10 minutes' where anonymous_session_id='old1'");
    const snap = await presenceSnapshot(h.db, 120);
    expect(snap.estimate).toBe(true);
    expect(snap.on_demo_pierre).toBeGreaterThanOrEqual(1);
    // old1 (10 min) exclu de la fenêtre de 120 s
    const total = snap.online_total;
    await h.db.query("update clonestore_web_sessions set last_seen_at = now() where anonymous_session_id='old1'");
    const snap2 = await presenceSnapshot(h.db, 120);
    expect(snap2.online_total).toBe(total + 1);
  });
});

describe("E.5 — événements web (allowlist + append-only)", () => {
  it("insère les événements valides, ignore les inconnus", async () => {
    const n = await recordWebEvents(h.db, "s2", [
      { name: "site_viewed", path: "/" },
      { name: "not_a_real_event", path: "/" },
      { name: "demo_viewed", path: "/demo" },
    ]);
    expect(n).toBe(2);
    const { rows } = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_web_events where anonymous_session_id='s2'");
    expect(rows[0].n).toBe(2);
  });

  it("web_events est append-only (UPDATE/DELETE refusés)", async () => {
    await recordWebEvents(h.db, "s3", [{ name: "site_viewed" }]);
    await expect(h.db.query("update clonestore_web_events set event_name='x'")).rejects.toThrow(/append-only/i);
    await expect(h.db.query("delete from clonestore_web_events")).rejects.toThrow(/append-only/i);
  });
});

describe("E.5 — funnel & acquisition mesurés", () => {
  it("calcule volumes + conversions à partir d'événements réels", async () => {
    await recordWebEvents(h.db, "fa", [{ name: "site_viewed" }, { name: "demo_viewed" }]);
    await recordWebEvents(h.db, "fb", [{ name: "site_viewed" }]);
    const f = await funnelSnapshot(h.db, 30);
    const site = f.stages.find((s) => s.key === "site")!;
    const demo = f.stages.find((s) => s.key === "demo")!;
    expect(site.count).toBeGreaterThanOrEqual(2);
    expect(demo.count).toBeGreaterThanOrEqual(1);
    expect(demo.from_top).not.toBeNull();
  });

  it("acquisition : sessions et réservations par source", async () => {
    const t = issueVerificationToken();
    await upsertWebSession(h.db, { anonymous_session_id: "acq1", utm_source: "google", current_path: "/" });
    await createOrUpdateReservation(h.db, {
      email: "acq@x.fr", email_normalized: "acq@x.fr", email_domain_type: "professional",
      company_name: "Acme", company_size: "50-249", verification_hash: t.hash, verification_expires_at: t.expiresAt,
      anonymous_session_id: "acq1",
    });
    const rows = await acquisitionBreakdown(h.db, 30);
    const g = rows.find((r) => r.utm_source === "google");
    expect(g).toBeTruthy();
    expect(g!.reservations).toBeGreaterThanOrEqual(1);
  });
});
