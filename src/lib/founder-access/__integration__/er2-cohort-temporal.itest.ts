// E-R2 §11/§12 — funnel cohorté TEMPOREL (cas complets) + présence homepage stricte.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { cohortFunnelSnapshot, presenceSnapshot, upsertWebSession } from "../analytics";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

let n = 0;
function sid(): string { n++; return `${n.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`; }
// Insert direct avec occurred_at explicite (web_events est append-only : pas d'UPDATE).
async function evAt(session: string, name: string, msAgo: number) {
  await h.db.query(
    "insert into clonestore_web_events (anonymous_session_id, event_name, occurred_at) values ($1,$2, now() - ($3 || ' milliseconds')::interval)",
    [session, name, msAgo]);
}

describe("§11 — funnel cohorté temporel, cas complets", () => {
  it("respecte l'ordre, la première occurrence, et borne les conversions à 100 %", async () => {
    // s1 : parcours correct site→demo→demo_completed
    const s1 = sid();
    await evAt(s1, "site_viewed", 5000); await evAt(s1, "demo_viewed", 4000); await evAt(s1, "demo_completed", 3000);
    // s2 : demo AVANT site → demo non franchi
    const s2 = sid();
    await evAt(s2, "demo_viewed", 5000); await evAt(s2, "site_viewed", 4000);
    // s3 : checkout AVANT site → étapes intermédiaires non franchies
    const s3 = sid();
    await evAt(s3, "founder_checkout_started", 5000); await evAt(s3, "site_viewed", 4000);
    // s4 : doublons de site_viewed (première occurrence seulement) + demo
    const s4 = sid();
    await evAt(s4, "site_viewed", 6000); await evAt(s4, "site_viewed", 2000); await evAt(s4, "demo_viewed", 5000);
    // s5 : pas de site_viewed (hors cohorte) — ne doit pas être éligible
    const s5 = sid();
    await evAt(s5, "demo_viewed", 5000);
    // s6 : événement serveur sans session (null) — exclu du cohorté
    await h.db.query("insert into clonestore_founder_funnel_events (anonymous_session_id, event_name) values (null,'founder_reservation_created')");

    const c = await cohortFunnelSnapshot(h.db, 30);
    const get = (k: string) => c.stages.find((s) => s.key === k)!;

    // éligibles = sessions avec site_viewed = s1,s2,s3,s4 = 4 (s5 exclu, serveur exclu)
    expect(c.eligible).toBe(4);
    expect(get("site").count).toBe(4);
    // demo franchi temporellement : s1 (4000<5000 ok), s4 (5000<6000 ok). s2 demo avant site → non.
    expect(get("demo").count).toBe(2);
    // demo_completed : s1 uniquement
    expect(get("demo_done").count).toBe(1);
    // toutes conversions depuis le sommet ≤ 100 %
    for (const s of c.stages) if (s.from_top !== null) expect(s.from_top).toBeLessThanOrEqual(100);
  });
});

describe("§12 — présence homepage stricte (current_path = '/')", () => {
  it("compte la homepage uniquement pour le chemin exact '/'", async () => {
    await upsertWebSession(h.db, { anonymous_session_id: sid(), current_path: "/" });
    await upsertWebSession(h.db, { anonymous_session_id: sid(), current_path: "/demo" });        // pas homepage
    await upsertWebSession(h.db, { anonymous_session_id: sid(), current_path: "/reserver" });     // pas homepage
    const p = await presenceSnapshot(h.db, 120);
    expect(p.on_homepage).toBe(1);
    expect(p.on_demo).toBeGreaterThanOrEqual(1);
  });
});
