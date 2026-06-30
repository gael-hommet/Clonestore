// src/lib/pierre/v1/__integration__/p86-invitation-replay-resend-crosstenant.itest.ts
// PHASE 8.6 — membership INVITATIONS: replay idempotency, resend supersession, and cross-tenant
// isolation — proven on real Postgres (PGlite) through the governed service modules.
//
// Focus:
//  - A pending invitation accepted TWICE (same token, same verified user, matching email) yields the
//    SAME membership id (idempotent replay) — and accept refuses an unverified email.
//  - resendMembershipInvitation SUPERSEDES the prior pending invite: exactly one 'pending' remains for
//    that email, the old row becomes 'superseded', and the OLD token can no longer be accepted.
//  - An invitation created in company A, when accepted, creates a membership ONLY in company A
//    (cross-tenant isolation — the membership's company_id is A, never B).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import {
  createMembershipInvitation, resendMembershipInvitation, acceptMembershipInvitation, normalizeEmail,
} from "../membership-invitations";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules
// inside a role-bound + tenant-bound transaction (this is how the governed SQL is reached).
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}
const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

/** Count invitation rows for (company,email_normalized) grouped by status. */
async function invStatuses(companyId: string, emailNorm: string): Promise<Record<string, number>> {
  const r = await h.pg.query<{ status: string; n: number }>(
    `select status, count(*)::int as n from pierre_rt_invitations
       where company_id=$1 and email_normalized=$2 group by status`,
    [companyId, emailNorm],
  );
  return Object.fromEntries((r.rows as { status: string; n: number }[]).map((x) => [x.status, x.n]));
}

describe("P8.6 invitation — replay idempotency", () => {
  it("accepting the same pending invitation twice (same verified user) returns the SAME membership id", async () => {
    const company = h.companyA;
    const ctx = h.ctx("A");
    const email = "Replay.User@Example.com";
    const emailNorm = normalizeEmail(email);
    const acceptingUser = newUuid();

    const created = await asRole(h, APP, company, (q) =>
      createMembershipInvitation(execFrom(q), ctx, { email, roles: ["HR_MANAGER"] }));
    expect(created.invitation_id).toBeTruthy();
    expect(created.token).toBeTruthy();
    // the raw token must never appear as a stored column value (it is only hashed)
    const stored = await h.pg.query<{ token_hash: string }>(
      `select token_hash from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    expect((stored.rows[0] as { token_hash: string }).token_hash).not.toBe(created.token);

    // first accept → a fresh active membership
    const membership1 = await asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: created.token, user_id: acceptingUser, account_email: email, email_verified: true }));
    expect(membership1).toBeTruthy();
    const m1 = await h.pg.query<{ status: string; company_id: string }>(
      `select status, company_id from pierre_rt_members where company_id=$1 and user_id=$2`, [company, acceptingUser]);
    expect((m1.rows[0] as { status: string }).status).toBe("active");

    // second accept (idempotent replay, same token + same user) → SAME membership id
    const membership2 = await asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: created.token, user_id: acceptingUser, account_email: email, email_verified: true }));
    expect(membership2).toBe(membership1);

    // still exactly one membership row for that user, and one 'accepted' invitation
    const memCount = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [company, acceptingUser]);
    expect((memCount.rows[0] as { n: number }).n).toBe(1);
    const statuses = await invStatuses(company, emailNorm);
    expect(statuses.accepted).toBe(1);
    expect(statuses.pending ?? 0).toBe(0);

    // the granted role-key was applied to the membership
    const roleRows = await h.pg.query<{ role_key: string }>(
      `select role_key from pierre_rt_membership_roles where company_id=$1 and membership_id=$2`, [company, membership1]);
    expect((roleRows.rows as { role_key: string }[]).map((x) => x.role_key)).toContain("HR_MANAGER");
  });

  it("acceptMembershipInvitation refuses an UNVERIFIED email (no membership created)", async () => {
    const company = h.companyA;
    const ctx = h.ctx("A");
    const email = "unverified@example.com";
    const acceptingUser = newUuid();
    const created = await asRole(h, APP, company, (q) =>
      createMembershipInvitation(execFrom(q), ctx, { email, roles: ["VIEWER"] }));

    const denied = await refused(() => asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: created.token, user_id: acceptingUser, account_email: email, email_verified: false })));
    expect(denied).toBe(true);

    const m = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [company, acceptingUser]);
    expect((m.rows[0] as { n: number }).n).toBe(0);
    // invitation is still pending — verification failure must not consume it
    const statuses = await invStatuses(company, normalizeEmail(email));
    expect(statuses.pending).toBe(1);
  });

  it("acceptMembershipInvitation refuses a MISMATCHED account email", async () => {
    const company = h.companyA;
    const ctx = h.ctx("A");
    const email = "intended@example.com";
    const acceptingUser = newUuid();
    const created = await asRole(h, APP, company, (q) =>
      createMembershipInvitation(execFrom(q), ctx, { email, roles: ["VIEWER"] }));

    const denied = await refused(() => asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: created.token, user_id: acceptingUser, account_email: "someone.else@example.com", email_verified: true })));
    expect(denied).toBe(true);

    const m = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [company, acceptingUser]);
    expect((m.rows[0] as { n: number }).n).toBe(0);
  });
});

describe("P8.6 invitation — resend supersedes the prior pending invite", () => {
  it("resend leaves exactly one 'pending' invitation; the old one becomes 'superseded' and its token no longer accepts", async () => {
    const company = h.companyA;
    const ctx = h.ctx("A");
    const email = "resend.target@example.com";
    const emailNorm = normalizeEmail(email);

    const first = await asRole(h, APP, company, (q) =>
      createMembershipInvitation(execFrom(q), ctx, { email, roles: ["VIEWER"] }));
    expect(first.invitation_id).toBeTruthy();

    // resend = issue a fresh invite that supersedes the prior pending one
    const resent = await asRole(h, APP, company, (q) =>
      resendMembershipInvitation(execFrom(q), ctx, { email, roles: ["VIEWER"] }));
    expect(resent.invitation_id).toBeTruthy();
    expect(resent.invitation_id).not.toBe(first.invitation_id);
    expect(resent.token).not.toBe(first.token);

    // exactly ONE pending remains, and it is the resent invitation; the old one is 'superseded'
    const statuses = await invStatuses(company, emailNorm);
    expect(statuses.pending).toBe(1);
    expect(statuses.superseded).toBe(1);

    const firstRow = await h.pg.query<{ status: string }>(`select status from pierre_rt_invitations where id=$1`, [first.invitation_id]);
    expect((firstRow.rows[0] as { status: string }).status).toBe("superseded");
    const resentRow = await h.pg.query<{ status: string }>(`select status from pierre_rt_invitations where id=$1`, [resent.invitation_id]);
    expect((resentRow.rows[0] as { status: string }).status).toBe("pending");

    // the OLD (superseded) token can no longer be accepted
    const oldRejected = await refused(() => asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: first.token, user_id: newUuid(), account_email: email, email_verified: true })));
    expect(oldRejected).toBe(true);

    // the NEW token still accepts and creates the membership
    const newUser = newUuid();
    const membership = await asRole(h, APP, company, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: resent.token, user_id: newUser, account_email: email, email_verified: true }));
    expect(membership).toBeTruthy();
    const m = await h.pg.query<{ status: string }>(`select status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, newUser]);
    expect((m.rows[0] as { status: string }).status).toBe("active");
    // after acceptance: the pending becomes accepted, no live pending remains
    const after = await invStatuses(company, emailNorm);
    expect(after.pending ?? 0).toBe(0);
    expect(after.accepted).toBe(1);
    expect(after.superseded).toBe(1);
  });

  it("the (company,email,status) uniqueness keeps at most one row per status: a 2nd resend (with a prior superseded row present) is refused", async () => {
    // The frozen v3 schema enforces `unique (company_id, email, status)`. Resend supersedes the current
    // pending → exactly one 'superseded' row. A SECOND resend would have to create a SECOND 'superseded'
    // row for the same (company,email) → the unique constraint refuses it. This proves the invariant is
    // a HARD database guarantee (no silent accumulation of stale invitations), not merely convention.
    const company = h.companyA;
    const ctx = h.ctx("A");
    const email = "many.resends@example.com";
    const emailNorm = normalizeEmail(email);

    await asRole(h, APP, company, (q) => createMembershipInvitation(execFrom(q), ctx, { email, roles: ["VIEWER"] }));
    // first resend: pending → superseded, plus a fresh pending. This succeeds.
    await asRole(h, APP, company, (q) => resendMembershipInvitation(execFrom(q), ctx, { email }));
    let statuses = await invStatuses(company, emailNorm);
    expect(statuses.pending).toBe(1);
    expect(statuses.superseded).toBe(1);

    // second resend would need a SECOND superseded row → refused by the unique constraint.
    const denied = await refused(() => asRole(h, APP, company, (q) =>
      resendMembershipInvitation(execFrom(q), ctx, { email })));
    expect(denied).toBe(true);

    // state is unchanged: still exactly one pending + one superseded.
    statuses = await invStatuses(company, emailNorm);
    expect(statuses.pending).toBe(1);
    expect(statuses.superseded).toBe(1);
  });
});

describe("P8.6 invitation — cross-tenant isolation", () => {
  it("an invitation created in company A creates a membership ONLY in company A (never company B)", async () => {
    const email = "crosstenant@example.com";
    const acceptingUser = newUuid();

    // create in company A (bound to A's GUC + A's ctx)
    const created = await asRole(h, APP, h.companyA, (q) =>
      createMembershipInvitation(execFrom(q), h.ctx("A"), { email, roles: ["VIEWER"] }));
    // the stored invitation belongs to company A
    const invCompany = await h.pg.query<{ company_id: string }>(
      `select company_id from pierre_rt_invitations where id=$1`, [created.invitation_id]);
    expect((invCompany.rows[0] as { company_id: string }).company_id).toBe(h.companyA);

    // accept it
    const membership = await asRole(h, APP, h.companyA, (q) =>
      acceptMembershipInvitation(execFrom(q), { token: created.token, user_id: acceptingUser, account_email: email, email_verified: true }));
    expect(membership).toBeTruthy();

    // the membership's company_id is A
    const memRow = await h.pg.query<{ company_id: string; id: string }>(
      `select id, company_id from pierre_rt_members where id=$1`, [membership]);
    expect((memRow.rows[0] as { company_id: string }).company_id).toBe(h.companyA);

    // and NO membership exists for that user in company B
    const inB = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_members where company_id=$1 and user_id=$2`, [h.companyB, acceptingUser]);
    expect((inB.rows[0] as { n: number }).n).toBe(0);

    // exactly one membership total for that user, and it is in A
    const all = await h.pg.query<{ company_id: string }>(
      `select company_id from pierre_rt_members where user_id=$1`, [acceptingUser]);
    expect((all.rows as { company_id: string }[]).map((x) => x.company_id)).toEqual([h.companyA]);
  });

  it("creating an invitation for tenant A while the GUC is bound to tenant B is refused (tenant mismatch)", async () => {
    const email = "mismatch@example.com";
    // ctx says company A, but we bind the tx GUC to company B → the governed function rejects.
    const denied = await refused(() => asRole(h, APP, h.companyB, (q) =>
      createMembershipInvitation(execFrom(q), h.ctx("A"), { email, roles: ["VIEWER"] })));
    expect(denied).toBe(true);
    // nothing was persisted for that email in either tenant
    const a = await invStatuses(h.companyA, normalizeEmail(email));
    const b = await invStatuses(h.companyB, normalizeEmail(email));
    expect(Object.keys(a).length).toBe(0);
    expect(Object.keys(b).length).toBe(0);
  });
});
