// Phase E — tests d'intégration PostgreSQL réel (PGlite) du hardening E.2.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import {
  createOrUpdateReservation, updateReservationAdmin, getReservationDetail,
  exportReservationsCsv, recordFunnelEvent, recordAdminAudit,
} from "../store";
import { distributedRateLimit } from "../request-utils";
import { issueVerificationToken } from "../token";

let h: FounderHarness;
beforeAll(async () => { h = await createFounderHarness(); });
afterAll(async () => { await h.close(); });

function mk(email: string, company = "Acme") {
  const t = issueVerificationToken();
  return {
    email, email_normalized: email, email_domain_type: "professional" as const,
    company_name: company, company_size: "50-249" as const,
    verification_hash: t.hash, verification_expires_at: t.expiresAt, source: "test",
  };
}

describe("§3.1 — export keyset sans plafond + anti-injection", () => {
  it("exporte plus de 100 lignes (aucun plafond silencieux)", async () => {
    for (let i = 0; i < 150; i++) await createOrUpdateReservation(h.db, mk(`bulk${i}@acme.fr`));
    const csv = await exportReservationsCsv(h.db, {});
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(151); // en-tête + ≥150
  });

  it("neutralise une formule CSV dans le nom d'entreprise", async () => {
    await createOrUpdateReservation(h.db, mk("evil@acme.fr", "=cmd|'/c calc'!A1"));
    const csv = await exportReservationsCsv(h.db, { search: "evil@acme" });
    const dataLine = csv.split("\n").find((l) => l.includes("evil@acme.fr"))!;
    // La cellule formule est préfixée d'une apostrophe (et entourée de guillemets car contient ; et ").
    expect(dataLine).toContain("'=cmd");
    expect(dataLine.includes("\n=cmd")).toBe(false);
  });
});

describe("§3.2 — append-only structurel (triggers DB)", () => {
  it("refuse UPDATE et DELETE sur les événements funnel", async () => {
    await recordFunnelEvent(h.db, { event_name: "founder_cta_clicked", source: "demo" });
    await expect(h.db.query("update clonestore_founder_funnel_events set event_name='x'")).rejects.toThrow(/append-only/i);
    await expect(h.db.query("delete from clonestore_founder_funnel_events")).rejects.toThrow(/append-only/i);
  });

  it("refuse UPDATE et DELETE sur l'audit administrateur", async () => {
    await recordAdminAudit(h.db, { actor_email: "o@clonestore.pro", action: "cockpit.open" });
    await expect(h.db.query("update clonestore_founder_admin_audit set action='x'")).rejects.toThrow(/append-only/i);
    await expect(h.db.query("delete from clonestore_founder_admin_audit")).rejects.toThrow(/append-only/i);
  });
});

describe("§3.5 — relation commerciale réellement persistée", () => {
  it("« Marquer contacté » persiste contact_status, contacted_at, contacted_by", async () => {
    const r = await createOrUpdateReservation(h.db, mk("contact@acme.fr"));
    const res = await updateReservationAdmin(h.db, r.id, { contacted: true }, "owner@clonestore.pro");
    expect(res?.contact_status).toBe("contacted");
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.contact_status).toBe("contacted");
    expect(d?.contacted_at).not.toBeNull();
    expect(d?.contacted_by).toBe("owner@clonestore.pro");
  });

  it("définit une prochaine relance et une note de contact", async () => {
    const r = await createOrUpdateReservation(h.db, mk("followup@acme.fr"));
    const when = new Date(Date.now() + 86_400_000).toISOString();
    await updateReservationAdmin(h.db, r.id, { contact_status: "follow_up", next_followup_at: when, last_contact_note: "rappeler lundi" }, "owner@clonestore.pro");
    const d = await getReservationDetail(h.db, r.id);
    expect(d?.contact_status).toBe("follow_up");
    expect(d?.next_followup_at).not.toBeNull();
    expect(d?.last_contact_note).toBe("rappeler lundi");
  });
});

describe("§3.6 — rate limiting distribué (Postgres)", () => {
  it("bloque au-delà du maximum puis fournit un retryAfter", async () => {
    const key = `unit:${Date.now()}`;
    let last;
    for (let i = 0; i < 3; i++) last = await distributedRateLimit(h.db, key, 3, 60_000);
    expect(last!.ok).toBe(true); // 3e appel encore autorisé (count=3 <= 3)
    const blocked = await distributedRateLimit(h.db, key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});
