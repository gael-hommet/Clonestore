// Phase E.3 — tests d'intégration PostgreSQL réel (PGlite) du worker email.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { createOrUpdateReservation, confirmReservation, unsubscribeReservation } from "../store";
import { runEmailTick, enqueueDueScheduledEmails } from "../email-worker";
import type { FounderEmailProvider } from "../email-provider";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function provider(ok: boolean, sink?: { count: number }): FounderEmailProvider {
  return { mode: "local", async send() { if (sink) sink.count++; return ok ? { ok: true, id: "msg_1", mode: "local" } : { ok: false, error: "boom", mode: "local" }; } };
}

function mk(email: string) {
  const t = issueVerificationToken();
  return { email, email_normalized: email, email_domain_type: "professional" as const, company_name: "Acme", company_size: "50-249" as const, verification_hash: t.hash, verification_expires_at: t.expiresAt };
}

async function jobStatus(rid: string, kind = "verification") {
  const { rows } = await h.db.query<{ status: string; attempts: number }>(
    "select status, attempts from clonestore_founder_email_jobs where reservation_id=$1 and kind=$2", [rid, kind]);
  return rows[0];
}

describe("E.3 — worker email", () => {
  it("envoie la vérification puis est idempotent (aucun double envoi)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("verify@acme.fr"));
    const sink = { count: 0 };
    const res1 = await runEmailTick(h.db, provider(true, sink), { baseUrl: "https://x.test" });
    expect(res1.sent).toBe(1);
    expect((await jobStatus(r.id))?.status).toBe("sent");

    const res2 = await runEmailTick(h.db, provider(true, sink), { baseUrl: "https://x.test" });
    expect(res2.claimed).toBe(0); // déjà envoyé → rien à reprendre
    expect(sink.count).toBe(1);   // un seul envoi au total
  });

  it("réémet un token frais à l'envoi (le hash en base change)", async () => {
    const r = await createOrUpdateReservation(h.db, mk("fresh@acme.fr"));
    const before = await h.db.query<{ verification_token_hash: string }>(
      "select verification_token_hash from clonestore_founder_reservations where id=$1", [r.id]);
    await runEmailTick(h.db, provider(true), { baseUrl: "https://x.test" });
    const after = await h.db.query<{ verification_token_hash: string }>(
      "select verification_token_hash from clonestore_founder_reservations where id=$1", [r.id]);
    expect(after.rows[0].verification_token_hash).not.toBe(before.rows[0].verification_token_hash);
  });

  it("ignore (skip) une vérification pour une réservation déjà confirmée", async () => {
    const b = mk("already@acme.fr");
    const r = await createOrUpdateReservation(h.db, b);
    await confirmReservation(h.db, r.id, b.verification_hash ? "x" : "x"); // n'aboutit pas (mauvais token)
    // forcer la confirmation directe + un job de vérification pending
    await h.db.query("update clonestore_founder_reservations set email_verified_at=now(), status='confirmed' where id=$1", [r.id]);
    await h.db.query("update clonestore_founder_email_jobs set status='pending', send_at=now() where reservation_id=$1 and kind='verification'", [r.id]);
    await runEmailTick(h.db, provider(true), { baseUrl: "https://x.test" });
    expect((await jobStatus(r.id))?.status).toBe("skipped");
  });

  it("retente en cas d'échec, puis bascule en dead-letter au max", async () => {
    const r = await createOrUpdateReservation(h.db, mk("retry@acme.fr"));
    const res = await runEmailTick(h.db, provider(false), { baseUrl: "https://x.test" });
    expect(res.retried).toBe(1);
    let st = await jobStatus(r.id);
    expect(st?.status).toBe("pending");
    expect(st?.attempts).toBe(1);

    // simuler l'épuisement des tentatives
    await h.db.query("update clonestore_founder_email_jobs set attempts=5, status='pending', send_at=now() where reservation_id=$1 and kind='verification'", [r.id]);
    const res2 = await runEmailTick(h.db, provider(false), { baseUrl: "https://x.test" });
    expect(res2.dead).toBe(1);
    st = await jobStatus(r.id);
    expect(st?.status).toBe("dead");
  });

  it("enfile les emails programmés uniquement pour les confirmés", async () => {
    const c = mk("confirmed@acme.fr");
    const rc = await createOrUpdateReservation(h.db, c);
    await h.db.query("update clonestore_founder_reservations set email_verified_at=now(), status='confirmed' where id=$1", [rc.id]);
    const ru = await createOrUpdateReservation(h.db, mk("unconfirmed@acme.fr")); // pas confirmé

    const n = await enqueueDueScheduledEmails(h.db, new Date("2026-09-01T00:00:00Z"));
    expect(n).toBeGreaterThan(0);
    const confirmedJobs = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_email_jobs where reservation_id=$1 and kind<>'verification'", [rc.id]);
    expect(confirmedJobs.rows[0].n).toBeGreaterThan(0);
    const unconfirmedJobs = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_email_jobs where reservation_id=$1 and kind<>'verification'", [ru.id]);
    expect(unconfirmedJobs.rows[0].n).toBe(0);
  });

  it("désinscription : statut unsubscribed + jobs en attente annulés", async () => {
    const r = await createOrUpdateReservation(h.db, mk("bye@acme.fr"));
    const ok = await unsubscribeReservation(h.db, r.id);
    expect(ok).toBe(true);
    const st = await h.db.query<{ status: string }>("select status from clonestore_founder_reservations where id=$1", [r.id]);
    expect(st.rows[0].status).toBe("unsubscribed");
    const pending = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_founder_email_jobs where reservation_id=$1 and status='pending'", [r.id]);
    expect(pending.rows[0].n).toBe(0);
  });
});
