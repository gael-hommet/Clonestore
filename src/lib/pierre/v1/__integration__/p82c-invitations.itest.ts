// src/lib/pierre/v1/__integration__/p82c-invitations.itest.ts
// PHASE 8.2-C correction — invitation acceptance: site-scope binding (with
// company_id, validated, deduped) + authenticated-email binding. Real Postgres.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { acceptInvitation, hashToken } from "../members";
import { createSite, archiveSite } from "../sites";
import { resolveTenantContext } from "../tenant-context";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function seedInvite(opts: { company: string; email: string; siteIds?: string[]; roles?: string[]; expiresInDays?: number; status?: string }): Promise<{ id: string; raw: string }> {
  const raw = `rawtok-${newUuid()}`;
  const id = newUuid();
  const days = String(opts.expiresInDays ?? 14);
  await h.db.query(
    `insert into pierre_rt_invitations (id, company_id, email, token_hash, roles, site_ids, invited_by, status, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now() + ($9 || ' days')::interval)`,
    [id, opts.company, opts.email.toLowerCase(), hashToken(raw), opts.roles ?? ["VIEWER"], opts.siteIds ?? [], h.userA, opts.status ?? "pending", days]);
  return { id, raw };
}
const verified = (email: string) => ({ email, email_confirmed_at: "2026-06-15T00:00:00Z" });

// ── Site scope ───────────────────────────────────────────────────────────────
describe("invitation site scope", () => {
  it("invitation WITHOUT a site → membership, no member_sites, context site_ids = null", async () => {
    const u = newUuid();
    const { raw } = await seedInvite({ company: h.companyA, email: "nosite@acme.test" });
    const r = await acceptInvitation(h.db, { user_id: u, ...verified("nosite@acme.test"), token: raw });
    expect(r.site_ids).toEqual([]);
    const ms = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_member_sites where member_id=$1`, [r.membership_id]);
    expect(ms.rows[0].n).toBe(0);
    const ctx = await resolveTenantContext(h.db, { user_id: u, company_id: h.companyA });
    expect(ctx.site_ids).toBeNull();
  });

  it("invitation WITH one and with multiple sites → member_sites rows carry company_id; context has the site_ids", async () => {
    const ctxA = h.ctx("A");
    const s1 = await createSite(h.db, ctxA, { name: "Paris" });
    const s2 = await createSite(h.db, ctxA, { name: "Lyon" });

    const u1 = newUuid();
    const i1 = await seedInvite({ company: h.companyA, email: "one@acme.test", siteIds: [s1.id] });
    const r1 = await acceptInvitation(h.db, { user_id: u1, ...verified("one@acme.test"), token: i1.raw });
    expect(r1.site_ids).toEqual([s1.id]);
    const row = await h.db.query<{ company_id: string }>(`select company_id from pierre_rt_member_sites where member_id=$1`, [r1.membership_id]);
    expect(row.rows[0].company_id).toBe(h.companyA); // company_id (NOT NULL) is set
    const ctx1 = await resolveTenantContext(h.db, { user_id: u1, company_id: h.companyA });
    expect(ctx1.site_ids?.sort()).toEqual([s1.id]);

    const u2 = newUuid();
    const i2 = await seedInvite({ company: h.companyA, email: "multi@acme.test", siteIds: [s1.id, s2.id] });
    const r2 = await acceptInvitation(h.db, { user_id: u2, ...verified("multi@acme.test"), token: i2.raw });
    expect(r2.site_ids.sort()).toEqual([s1.id, s2.id].sort());
    const ctx2 = await resolveTenantContext(h.db, { user_id: u2, company_id: h.companyA });
    expect(ctx2.site_ids?.sort()).toEqual([s1.id, s2.id].sort());
  });

  it("cross-tenant site is refused", async () => {
    const sB = await createSite(h.db, h.ctx("B"), { name: "B-site" });
    const { raw } = await seedInvite({ company: h.companyA, email: "x@acme.test", siteIds: [sB.id] });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("x@acme.test"), token: raw })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("nonexistent site is refused", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "y@acme.test", siteIds: [newUuid()] });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("y@acme.test"), token: raw })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("archived site is refused", async () => {
    const ctxA = h.ctx("A");
    const s = await createSite(h.db, ctxA, { name: "Closing" });
    await archiveSite(h.db, ctxA, s.id);
    const { raw } = await seedInvite({ company: h.companyA, email: "z@acme.test", siteIds: [s.id] });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("z@acme.test"), token: raw })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("duplicate site_ids within one invitation are deduped to a single member_sites row", async () => {
    const ctxA = h.ctx("A");
    const s1 = await createSite(h.db, ctxA, { name: "Dedup" });
    const u = newUuid();
    const { raw } = await seedInvite({ company: h.companyA, email: "dedup@acme.test", siteIds: [s1.id, s1.id, s1.id] }); // duplicates in invite
    const r = await acceptInvitation(h.db, { user_id: u, ...verified("dedup@acme.test"), token: raw });
    expect(r.site_ids).toEqual([s1.id]);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_member_sites where member_id=$1`, [r.membership_id]);
    expect(n.rows[0].n).toBe(1);
  });
});

// ── Email identity binding ───────────────────────────────────────────────────
describe("invitation email binding", () => {
  it("correct user + correct verified email accepts", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "good@acme.test" });
    const r = await acceptInvitation(h.db, { user_id: newUuid(), ...verified("Good@Acme.TEST"), token: raw }); // case-insensitive
    expect(r.company_id).toBe(h.companyA);
  });

  it("right token but wrong email is refused", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "invited@acme.test" });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("someoneelse@acme.test"), token: raw })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("unverified email is refused", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "needsverify@acme.test" });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), email: "needsverify@acme.test", email_confirmed_at: null, token: raw })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("expired token is refused (not found)", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "expired@acme.test", expiresInDays: -1 });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("expired@acme.test"), token: raw })).rejects.toMatchObject({ code: "not_found" });
  });

  it("revoked token is refused (not found)", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "revoked@acme.test", status: "revoked" });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("revoked@acme.test"), token: raw })).rejects.toMatchObject({ code: "not_found" });
  });

  it("already-used token is refused on a second different user", async () => {
    const { raw } = await seedInvite({ company: h.companyA, email: "once@acme.test" });
    await acceptInvitation(h.db, { user_id: newUuid(), ...verified("once@acme.test"), token: raw });
    await expect(acceptInvitation(h.db, { user_id: newUuid(), ...verified("once@acme.test"), token: raw })).rejects.toMatchObject({ code: "not_found" });
  });

  it("two concurrent acceptances → exactly one succeeds", async () => {
    const u = newUuid();
    const { raw } = await seedInvite({ company: h.companyA, email: "race@acme.test" });
    const results = await Promise.allSettled([
      acceptInvitation(h.db, { user_id: u, ...verified("race@acme.test"), token: raw }),
      acceptInvitation(h.db, { user_id: u, ...verified("race@acme.test"), token: raw }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
  });
});
