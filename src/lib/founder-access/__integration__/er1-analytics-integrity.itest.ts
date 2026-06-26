// E-R1 — intégrité analytics (PGlite) : web_events refuse les événements serveur (§3),
// liaison session↔réservation côté serveur (§4/§5), funnel cohorté borné (§17),
// acquisition multi-dimensions (§15).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { recordWebEvents, cohortFunnelSnapshot, acquisitionByDimension, upsertWebSession } from "../analytics";
import { createOrUpdateReservation } from "../store";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });
const SID = "3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a";

describe("§3 — web_events refuse les événements serveur", () => {
  it("recordWebEvents ignore les événements de vérité serveur, garde les client", async () => {
    const n = await recordWebEvents(h.db, SID, [
      { name: "site_viewed" },
      { name: "founder_payment_completed" }, // serveur → refusé
      { name: "founder_email_verified" },    // serveur → refusé
      { name: "demo_viewed" },
    ]);
    expect(n).toBe(2);
    const got = await h.db.query<{ event_name: string }>("select event_name from clonestore_web_events where anonymous_session_id=$1", [SID]);
    const names = got.rows.map((r) => r.event_name);
    expect(names).toContain("site_viewed");
    expect(names).not.toContain("founder_payment_completed");
  });
});

describe("§4/§5 — liaison session↔réservation côté serveur", () => {
  it("la réservation est liée à la session lors de createOrUpdateReservation", async () => {
    const t = issueVerificationToken();
    await createOrUpdateReservation(h.db, { email: "link@acme.fr", email_normalized: "link@acme.fr", email_domain_type: "professional", company_name: "Acme", company_size: "50-249", verification_hash: t.hash, verification_expires_at: t.expiresAt, anonymous_session_id: SID });
    const r = await h.db.query<{ anonymous_session_id: string }>("select anonymous_session_id from clonestore_founder_reservations where email_normalized='link@acme.fr'");
    expect(r.rows[0].anonymous_session_id).toBe(SID);
    // la table session n'a pas de reservation_id imposé par un heartbeat (jamais écrit par la route).
    await upsertWebSession(h.db, { anonymous_session_id: SID, current_path: "/demo" });
    const s = await h.db.query<{ reservation_id: string | null }>("select reservation_id from clonestore_web_sessions where anonymous_session_id=$1", [SID]);
    expect(s.rows[0].reservation_id).toBeNull();
  });
});

describe("§17 — funnel cohorté borné à 100 % depuis le sommet", () => {
  it("conversion depuis le sommet ≤ 100 % (cohorte unique)", async () => {
    const s1 = "11111111-1b2c-4d3e-8f9a-0b1c2d3e4f5a";
    const s2 = "22222222-1b2c-4d3e-8f9a-0b1c2d3e4f5a";
    await recordWebEvents(h.db, s1, [{ name: "site_viewed" }, { name: "demo_viewed" }]);
    await recordWebEvents(h.db, s2, [{ name: "site_viewed" }]);
    const c = await cohortFunnelSnapshot(h.db, 30);
    expect(c.eligible).toBeGreaterThanOrEqual(2);
    for (const st of c.stages) {
      if (st.from_top !== null) expect(st.from_top).toBeLessThanOrEqual(100);
    }
  });
});

describe("§15 — acquisition multi-dimensions", () => {
  it("agrège par source/medium/campaign", async () => {
    await upsertWebSession(h.db, { anonymous_session_id: "aa111111-1b2c-4d3e-8f9a-0b1c2d3e4f5a", utm_source: "google", utm_medium: "cpc", utm_campaign: "launch", current_path: "/" });
    const bySource = await acquisitionByDimension(h.db, "source", 30);
    expect(bySource.some((r) => r.key === "google")).toBe(true);
    const byMedium = await acquisitionByDimension(h.db, "source_medium", 30);
    expect(byMedium.some((r) => r.key.includes("cpc"))).toBe(true);
    const byCampaign = await acquisitionByDimension(h.db, "campaign", 30);
    expect(byCampaign.some((r) => r.key === "launch")).toBe(true);
  });
});
