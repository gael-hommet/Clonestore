// src/lib/pierre/v1/__integration__/p86-invitation-security.itest.ts
// PHASE 8.6 — membership INVITATION token security + acceptance guards, proven on real Postgres (PGlite).
//
// Focus: the raw token is returned exactly once and NEVER persisted (the table stores only token_hash;
// no 'token'/'token_raw' column), the stored hash equals hashInvitationToken(rawToken), the raw token
// carries substantial entropy, and acceptance is identity-bound + time-bound: it is refused when the
// account email is unverified, when the verified account email does not match the invited email, and when
// the invitation has expired. Everything is driven through the real createMembershipInvitation /
// acceptMembershipInvitation services under the app role with a bound tenant context (the governed SQL
// functions read app.current_company), exactly as production calls them.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import type { TenantContext } from "../tenant-context";
import {
  createMembershipInvitation,
  acceptMembershipInvitation,
  hashInvitationToken,
  generateInvitationToken,
  normalizeEmail,
  INVITATION_TTL_MS,
  type CreateInvitationResult,
} from "../membership-invitations";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
function execFrom(
  q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) =>
      q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

// A bound tenant context for company A whose company_id matches the GUC bound by asRole, and which holds
// tenancy.admin + an OWNER role-key (so the inviter may grant the requested role-keys).
function ctxA(): TenantContext {
  const c = h.ctx("A");
  expect(c.company_id).toBe(h.companyA);
  expect(c.permissions).toContain("tenancy.admin");
  expect(c.role_keys).toContain("OWNER");
  return c;
}

// Create an invitation through the real governed service under the app role + bound tenant.
async function invite(email: string, roles: string[], ttl_ms?: number): Promise<CreateInvitationResult> {
  return asRole(h, APP, h.companyA, (q) =>
    createMembershipInvitation(execFrom(q), ctxA(), { email, roles, ttl_ms }));
}

describe("P8.6 invitation token security — the raw token is shown once and only its hash is stored", () => {
  it("generateInvitationToken() yields a high-entropy raw token whose stored form is its SHA-256 hash", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    // raw token has substantial entropy (randomBytes(32) base64url ≈ 43 chars) and is distinct per call
    expect(a.token.length).toBeGreaterThanOrEqual(32);
    expect(b.token.length).toBeGreaterThanOrEqual(32);
    expect(a.token).not.toBe(b.token);
    // base64url alphabet only — never a hex/uuid masquerading as a token
    expect(a.token).toMatch(/^[A-Za-z0-9_-]+$/);
    // the helper's hash is the deterministic SHA-256 (hex) of the raw token, and never equals the raw token
    expect(a.token_hash).toBe(hashInvitationToken(a.token));
    expect(a.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token_hash).not.toBe(a.token);
    expect(a.token_hash).not.toBe(b.token_hash);
  });

  it("the invitations table has token_hash and NO raw-token column", async () => {
    const rows = await h.pg.query(
      `select column_name from information_schema.columns where table_name='pierre_rt_invitations'`);
    const cols = rows.rows.map((r) => (r as { column_name: string }).column_name);
    expect(cols).toContain("token_hash");
    expect(cols).not.toContain("token");
    expect(cols).not.toContain("token_raw");
    expect(cols).not.toContain("token_plain");
  });

  it("createMembershipInvitation returns the raw token once; the DB persists only its hash", async () => {
    const email = "secret-token@example.com";
    const created = await invite(email, ["HR_MANAGER"]);
    // the service hands back the raw token (and an expiry) — this is the ONLY time it exists in cleartext
    expect(created.invitation_id).toBeTruthy();
    expect(created.token.length).toBeGreaterThanOrEqual(32);
    expect(created.expires_at).toBeTruthy();

    // the persisted row stores the HASH of the raw token — never the token itself
    const stored = await h.pg.query(
      `select token_hash, email, email_normalized, status from pierre_rt_invitations where id=$1`,
      [created.invitation_id]);
    const row = stored.rows[0] as { token_hash: string; email: string; email_normalized: string; status: string };
    expect(row.token_hash).toBe(hashInvitationToken(created.token));
    expect(row.token_hash).not.toBe(created.token);
    expect(row.status).toBe("pending");
    expect(row.email).toBe(email);
    expect(row.email_normalized).toBe(normalizeEmail(email));

    // the raw token appears in NO column of the persisted row (defence-in-depth scan of every text field)
    const full = await h.pg.query(`select * from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    const cells = Object.values(full.rows[0] as Record<string, unknown>);
    for (const cell of cells) {
      if (typeof cell === "string") expect(cell).not.toContain(created.token);
    }
  });

  it("only the matching raw token can be hashed back to the stored hash (entropy is load-bearing)", async () => {
    const created = await invite("hash-match@example.com", ["VIEWER"]);
    const { token_hash } = (await h.pg.query(
      `select token_hash from pierre_rt_invitations where id=$1`, [created.invitation_id])).rows[0] as { token_hash: string };
    // the real token reproduces the hash; a different token (even one char off) does not
    expect(hashInvitationToken(created.token)).toBe(token_hash);
    expect(hashInvitationToken(created.token + "x")).not.toBe(token_hash);
    expect(hashInvitationToken(created.token.slice(0, -1))).not.toBe(token_hash);
  });
});

describe("P8.6 invitation acceptance guards — identity-bound and time-bound", () => {
  it("accepts a verified, email-matched holder of the raw token → an active membership", async () => {
    const email = "happy@example.com";
    const created = await invite(email, ["HR_MANAGER"]);
    const user = newUuid();
    const membershipId = await asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), {
        token: created.token, user_id: user, account_email: email, email_verified: true,
      }));
    expect(membershipId).toBeTruthy();
    const m = await h.pg.query(
      `select status from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, user]);
    expect((m.rows[0] as { status: string }).status).toBe("active");
    // the invitation is now consumed (accepted), not still pending
    const inv = await h.pg.query(
      `select status, accepted_by from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    expect((inv.rows[0] as { status: string; accepted_by: string }).status).toBe("accepted");
    expect((inv.rows[0] as { accepted_by: string }).accepted_by).toBe(user);
  });

  it("refuses acceptance when the account email is NOT verified (no DB write occurs)", async () => {
    const email = "unverified@example.com";
    const created = await invite(email, ["VIEWER"]);
    // the unverified guard short-circuits in the service before any SQL is issued
    await expect(
      acceptMembershipInvitation(h.db, {
        token: created.token, user_id: newUuid(), account_email: email, email_verified: false,
      }),
    ).rejects.toThrow(/verif/i);
    // the invitation must remain pending and unconsumed
    const inv = await h.pg.query(
      `select status, accepted_by from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    expect((inv.rows[0] as { status: string }).status).toBe("pending");
    expect((inv.rows[0] as { accepted_by: string | null }).accepted_by).toBeNull();
  });

  it("refuses acceptance when the verified account email does not match the invited email", async () => {
    const created = await invite("invited@example.com", ["VIEWER"]);
    const user = newUuid();
    const mismatch = await refused(() => asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), {
        token: created.token, user_id: user, account_email: "attacker@example.com", email_verified: true,
      })));
    expect(mismatch).toBe(true);
    // refusal is total: no membership materialised for the mismatched user, invite still pending
    const m = await h.pg.query(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, user]);
    expect((m.rows[0] as { n: number }).n).toBe(0);
    const inv = await h.pg.query(
      `select status from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    expect((inv.rows[0] as { status: string }).status).toBe("pending");
  });

  it("email matching is normalization-aware: a case/whitespace variant of the invited email still accepts", async () => {
    const created = await invite("Casey.Case@Example.com", ["VIEWER"]);
    const user = newUuid();
    // the holder's verified email differs only in case + surrounding whitespace → normalizeEmail aligns them
    const membershipId = await asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), {
        token: created.token, user_id: user, account_email: "  CASEY.CASE@EXAMPLE.COM ", email_verified: true,
      }));
    expect(membershipId).toBeTruthy();
    const m = await h.pg.query(
      `select status from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, user]);
    expect((m.rows[0] as { status: string }).status).toBe("active");
  });

  it("refuses acceptance of an EXPIRED invitation even with the correct token + verified matching email", async () => {
    const email = "expired@example.com";
    // a TTL in the past makes the invitation already expired at creation time
    const created = await invite(email, ["VIEWER"], -1000);
    expect(new Date(created.expires_at).getTime()).toBeLessThan(Date.now());
    const user = newUuid();
    const expired = await refused(() => asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), {
        token: created.token, user_id: user, account_email: email, email_verified: true,
      })));
    expect(expired).toBe(true);
    // no membership created, and the invitation is NOT consumed. The governed function raises after the
    // stale-invite flip, so the refusal rolls back the whole tx: the invite is never marked 'accepted'
    // (it remains 'pending' here precisely because the rejection unwound the in-function 'expired' update).
    const m = await h.pg.query(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyA, user]);
    expect((m.rows[0] as { n: number }).n).toBe(0);
    const inv = await h.pg.query(
      `select status, accepted_by from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    const invRow = inv.rows[0] as { status: string; accepted_by: string | null };
    expect(invRow.status).not.toBe("accepted");
    expect(invRow.accepted_by).toBeNull();
  });

  it("an unknown token hash is refused (a forged token never resolves to an invitation)", async () => {
    const forged = generateInvitationToken().token; // a perfectly-formed token that was never issued
    const refusedUnknown = await refused(() => asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), {
        token: forged, user_id: newUuid(), account_email: "nobody@example.com", email_verified: true,
      })));
    expect(refusedUnknown).toBe(true);
  });

  it("the default TTL is a finite, sensible window (one week)", () => {
    expect(INVITATION_TTL_MS).toBe(7 * 24 * 3600 * 1000);
    expect(INVITATION_TTL_MS).toBeGreaterThan(0);
  });
});
