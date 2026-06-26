// Phase E.2 — tests d'intégration PostgreSQL réel (PGlite) du parcours fondateur.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import {
  createOrUpdateReservation, updateQualification, confirmReservation, recordFunnelEvent,
  listReservations, getReservationDetail, updateReservationAdmin, exportReservationsCsv, recordAdminAudit,
} from "../store";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function base(email: string) {
  const t = issueVerificationToken();
  return {
    email, email_normalized: email, email_domain_type: "professional" as const,
    company_name: "Vireo", company_size: "50-249" as const,
    verification_hash: t.hash, verification_expires_at: t.expiresAt,
    source: "test", anonymous_session_id: "sess-1", token: t.token,
  };
}

describe("E.2 — réservation : persistance réelle", () => {
  it("crée une réservation, un événement funnel et un job email (transaction)", async () => {
    const b = base("ceo@vireo.fr");
    const res = await createOrUpdateReservation(h.db, b);
    expect(res.id).toMatch(/[0-9a-f-]{36}/);
    expect(res.status).toBe("email_to_confirm");

    const row = await h.db.query("select status, email_normalized from clonestore_founder_reservations where id=$1", [res.id]);
    expect(row.rows.length).toBe(1);

    const ev = await h.db.query("select count(*)::int n from clonestore_founder_funnel_events where reservation_id=$1 and event_name='founder_reservation_created'", [res.id]);
    expect((ev.rows[0] as { n: number }).n).toBe(1);

    const job = await h.db.query("select kind,status from clonestore_founder_email_jobs where reservation_id=$1", [res.id]);
    expect(job.rows.length).toBe(1);
    expect((job.rows[0] as { kind: string }).kind).toBe("verification");
  });

  it("déduplique idempotemment sur l'email (double requête → 1 ligne)", async () => {
    const a = await createOrUpdateReservation(h.db, base("dup@vireo.fr"));
    const bb = await createOrUpdateReservation(h.db, { ...base("dup@vireo.fr"), company_name: "Vireo 2" });
    expect(bb.id).toBe(a.id);
    const count = await h.db.query("select count(*)::int n from clonestore_founder_reservations where email_normalized='dup@vireo.fr'");
    expect((count.rows[0] as { n: number }).n).toBe(1);
    const cn = await h.db.query("select company_name from clonestore_founder_reservations where id=$1", [a.id]);
    expect((cn.rows[0] as { company_name: string }).company_name).toBe("Vireo 2");
  });

  it("étape 2 facultative : qualification + intention forte", async () => {
    const r = await createOrUpdateReservation(h.db, base("qual@vireo.fr"));
    await confirmReservationWithToken(r.id, "qual@vireo.fr");
    const q = await updateQualification(h.db, r.id, { full_name: "Clara", role: "DRH", contact_requested: true });
    expect(q?.status).toBe("strong_intent");
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.full_name).toBe("Clara");
    expect(d?.strong_intent).toBe(true);
  });

  it("confirme l'email via token (bon token → confirmed ; mauvais → invalid)", async () => {
    const b = base("verify@vireo.fr");
    const r = await createOrUpdateReservation(h.db, b);
    const bad = await confirmReservation(h.db, r.id, "mauvais-token");
    expect(bad.ok).toBe(false);
    const good = await confirmReservation(h.db, r.id, b.token);
    expect(good.ok).toBe(true);
    expect(good.status).toBe("confirmed");
    // idempotent : re-confirmer ne casse pas
    const again = await confirmReservation(h.db, r.id, b.token);
    expect(again.ok).toBe(true);
  });

  it("événements funnel append-only", async () => {
    await recordFunnelEvent(h.db, { event_name: "founder_cta_clicked", anonymous_session_id: "s9", source: "demo" });
    const n = await h.db.query("select count(*)::int n from clonestore_founder_funnel_events where event_name='founder_cta_clicked'");
    expect((n.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(1);
  });
});

describe("E.2 — lectures admin : recherche, filtres, pagination, export", () => {
  it("recherche + filtre + pagination serveur", async () => {
    const all = await listReservations(h.db, {}, 1, 2);
    expect(all.total).toBeGreaterThanOrEqual(4);
    expect(all.rows.length).toBeLessThanOrEqual(2);

    const search = await listReservations(h.db, { search: "dup@vireo" }, 1, 25);
    expect(search.rows.some((r) => r.email === "dup@vireo.fr")).toBe(true);

    const confirmed = await listReservations(h.db, { confirmed: true }, 1, 25);
    expect(confirmed.rows.every((r) => r.email_verified_at !== null)).toBe(true);

    const size = await listReservations(h.db, { company_size: "50-249" }, 1, 25);
    expect(size.rows.every((r) => r.company_size === "50-249")).toBe(true);
  });

  it("export CSV reflète les filtres", async () => {
    const csv = await exportReservationsCsv(h.db, { confirmed: true });
    expect(csv.split("\n")[0]).toContain("email");
    expect(csv).toContain("verify@vireo.fr");
  });

  it("mise à jour admin gouvernée + audit ; transition interdite rejetée", async () => {
    const r = await createOrUpdateReservation(h.db, base("admin@vireo.fr"));
    await confirmReservationWithToken(r.id, "admin@vireo.fr");
    const ok = await updateReservationAdmin(h.db, r.id, { status: "qualified", internal_notes: "note" });
    expect(ok?.status).toBe("qualified");
    await recordAdminAudit(h.db, { actor_email: "owner@clonestore.pro", action: "reservation.update", target: r.id });
    const audit = await h.db.query("select count(*)::int n from clonestore_founder_admin_audit where target=$1", [r.id]);
    expect((audit.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(1);

    // transition interdite : qualified → started
    await expect(updateReservationAdmin(h.db, r.id, { status: "started" })).rejects.toThrow();
  });
});

// helper : confirme une réservation existante en relisant son hash via un token frais
async function confirmReservationWithToken(id: string, _email: string) {
  const t = issueVerificationToken();
  await h.db.query("update clonestore_founder_reservations set verification_token_hash=$2, verification_expires_at=$3 where id=$1", [id, t.hash, t.expiresAt]);
  const r = await confirmReservation(h.db, id, t.token);
  expect(r.ok).toBe(true);
}
