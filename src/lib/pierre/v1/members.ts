// src/lib/pierre/v1/members.ts
// PHASE 8.2-C — Members, invitations, lifecycle, ownership transfer, multi-company.
//
// Security model:
//  - Admin-driven ops (invite/resend/revoke/suspend/reactivate/remove/transfer)
//    run inside the caller's RLS-bound tenant transaction (withTenantTransaction).
//  - acceptInvitation is an identity transition: the accepting user is not yet a
//    member, so it runs as a service-role op authorized by the *raw token* (whose
//    SHA-256 we match). The raw token is never stored and never logged.

import { createHash, randomBytes } from "crypto";
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext, MemberRole } from "./tenant-context";
import { requirePermission } from "./rbac";

// P16E §4.A (R1) — the legacy `pierre_rt_members.role` column is a DUPLICATE source of truth
// alongside `pierre_rt_membership_roles`. `resolveTenantContext` unions `ROLE_PERMISSIONS[role]`
// (and falls back to the legacy role when no membership_roles remain), so a stale base column
// silently re-grants revoked authority: removing a member's roles left `role` at 'hr_manager'
// and they kept validation.decide/employee.write. Fix: after every system-role assign/remove,
// SYNCHRONIZE the base column to the highest-privilege system role still held (or 'viewer' when
// none remain) so the column can never re-grant an authority the member no longer holds.
const ROLE_KEY_TO_MEMBER: Record<string, MemberRole> = {
  OWNER: "owner", ADMIN: "admin", HR_MANAGER: "hr_manager", HR_OPERATOR: "hr_operator", VIEWER: "viewer",
};
const ROLE_RANK: Record<MemberRole, number> = { owner: 4, admin: 3, hr_manager: 2, hr_operator: 1, viewer: 0 };

/** Recompute the legacy base role from the member's CURRENT system membership_roles.
 *  'viewer' (read-only floor) when none remain — a member with no explicit role holds no
 *  authority beyond reading. Custom roles do not affect the base (they add their own perms). */
async function syncBaseRole(db: SqlExecutor, companyId: string, membershipId: string): Promise<void> {
  const rows = (await db.query<{ role_key: string }>(
    `select role_key from pierre_rt_membership_roles where membership_id = $1`, [membershipId])).rows;
  let best: MemberRole = "viewer";
  for (const r of rows) {
    const mr = ROLE_KEY_TO_MEMBER[r.role_key];
    if (mr && ROLE_RANK[mr] > ROLE_RANK[best]) best = mr;
  }
  await db.query(`update pierre_rt_members set role = $3 where company_id = $1 and id = $2`, [companyId, membershipId, best]);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

async function audit(db: SqlExecutor, companyId: string, actor: string | null, subjectType: string, subjectId: string | null, action: string): Promise<void> {
  await db.query(
    `insert into pierre_rt_data_access_log (id, company_id, subject_type, subject_id, actor_user_id, action)
     values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), companyId, subjectType, subjectId, actor, action]);
}

/** Active-owner count for a company (legacy role='owner' OR membership_roles OWNER). */
async function countActiveOwners(db: SqlExecutor, companyId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(distinct m.id) as n
       from pierre_rt_members m
      where m.company_id = $1 and m.status = 'active'
        and (m.role = 'owner' or exists (
          select 1 from pierre_rt_membership_roles mr where mr.membership_id = m.id and mr.role_key = 'OWNER'))`,
    [companyId]);
  return Number(rows[0]?.n ?? 0);
}

async function isOwner(db: SqlExecutor, companyId: string, membershipId: string): Promise<boolean> {
  const { rows } = await db.query<{ owner: boolean }>(
    `select (m.role = 'owner' or exists (
        select 1 from pierre_rt_membership_roles mr where mr.membership_id = m.id and mr.role_key = 'OWNER')) as owner
       from pierre_rt_members m where m.company_id = $1 and m.id = $2`,
    [companyId, membershipId]);
  return rows[0]?.owner ?? false;
}

// ── Members ──────────────────────────────────────────────────────────────────
export type MemberView = {
  id: string; user_id: string; role: string; status: string;
  roles: string[]; custom_roles: string[]; created_at: string;
};

export async function listMembers(db: SqlExecutor, ctx: TenantContext): Promise<MemberView[]> {
  requirePermission(ctx, "tenancy.admin");
  const { rows } = await db.query<{ id: string; user_id: string; role: string; status: string; created_at: string }>(
    `select id, user_id, role, status, created_at from pierre_rt_members where company_id = $1 order by created_at asc`,
    [ctx.company_id]);
  const out: MemberView[] = [];
  for (const m of rows) {
    const sys = await db.query<{ role_key: string }>(`select role_key from pierre_rt_membership_roles where membership_id = $1`, [m.id]);
    const cust = await db.query<{ role_key: string }>(`select role_key from pierre_rt_membership_custom_roles where membership_id = $1`, [m.id]);
    out.push({ id: m.id, user_id: m.user_id, role: m.role, status: m.status,
      roles: sys.rows.map((r) => r.role_key), custom_roles: cust.rows.map((r) => r.role_key),
      created_at: typeof m.created_at === "string" ? m.created_at : new Date(m.created_at as unknown as string).toISOString() });
  }
  return out;
}

// ── Invitations ──────────────────────────────────────────────────────────────
export type CreateInvitationInput = { email: string; roles?: string[]; site_ids?: string[]; expires_in_days?: number };
export type InvitationResult = { id: string; email: string; status: string; expires_at: string; raw_token: string; idempotent: boolean };

export async function createInvitation(db: SqlExecutor, ctx: TenantContext, input: CreateInvitationInput): Promise<InvitationResult> {
  requirePermission(ctx, "tenancy.admin");
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw Errors.validation("Valid email is required");
  // Members are keyed by auth user_id, not email; duplicate-membership detection
  // happens idempotently at acceptInvitation (existing membership → reactivate).
  // Here we guarantee at most one *pending* invitation per (company, email) via the
  // unique constraint + the reuse path below.

  const roles = (input.roles && input.roles.length > 0 ? input.roles : ["VIEWER"]).map((r) => r.toUpperCase());
  await assertAssignableRoles(db, ctx, roles);
  const siteIds = input.site_ids ?? [];
  const expiresDays = Math.min(60, Math.max(1, input.expires_in_days ?? 14));

  // Idempotent: a pending invitation for (company,email) is reused (token rotated).
  const pending = await db.query<{ id: string }>(
    `select id from pierre_rt_invitations where company_id = $1 and email = $2 and status = 'pending' limit 1`, [ctx.company_id, email]);
  const raw = newRawToken();
  const tokenHash = hashToken(raw);
  if (pending.rows.length > 0) {
    const id = pending.rows[0].id;
    const { rows } = await db.query<{ id: string; email: string; status: string; expires_at: string }>(
      `update pierre_rt_invitations set token_hash = $3, roles = $4, site_ids = $5,
          expires_at = now() + ($6 || ' days')::interval where company_id = $1 and id = $2 returning id, email, status, expires_at`,
      [ctx.company_id, id, tokenHash, roles, siteIds, String(expiresDays)]);
    await audit(db, ctx.company_id, ctx.user_id, "invitation", id, "invitation_reissued");
    await emitInvitationCommunication(db, ctx, { invitation_id: id, email, raw, tokenHash, roles });
    return { ...rows[0], expires_at: isoOf(rows[0].expires_at), raw_token: raw, idempotent: true };
  }

  const id = newUuid();
  const { rows } = await db.query<{ id: string; email: string; status: string; expires_at: string }>(
    `insert into pierre_rt_invitations (id, company_id, email, token_hash, roles, site_ids, invited_by, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7, now() + ($8 || ' days')::interval)
     returning id, email, status, expires_at`,
    [id, ctx.company_id, email, tokenHash, roles, siteIds, ctx.user_id, String(expiresDays)]);
  await audit(db, ctx.company_id, ctx.user_id, "invitation", id, "invitation_created");
  await emitInvitationCommunication(db, ctx, { invitation_id: id, email, raw, tokenHash, roles });
  return { ...rows[0], expires_at: isoOf(rows[0].expires_at), raw_token: raw, idempotent: false };
}

/**
 * PHASE 8.6 — emit the REAL P8.4 communication for an invitation: a `member.invited` outbox business
 * event carrying the recipient email + the raw token + the accept link in its GOVERNED, internal payload.
 * The token never leaves through the client API — it flows ONLY into the outbox, then to the communication
 * worker, then to the email provider (which delivers/records it). The accept link the invitee receives is
 * the single carrier of the token. The dedup_key + payload version make each (re)issue a distinct delivery.
 */
async function emitInvitationCommunication(
  db: SqlExecutor, ctx: TenantContext,
  p: { invitation_id: string; email: string; raw: string; tokenHash: string; roles: string[] },
): Promise<void> {
  const link = `/invite/accept#token=${p.raw}`;
  const payload = { invitation_id: p.invitation_id, email: p.email, token: p.raw, link, roles: p.roles, version: p.tokenHash.slice(0, 18) };
  await db.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key)
       values ($1,$2,'member.invited',$3,$4) on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, JSON.stringify(payload), `member.invited:${p.invitation_id}:${p.tokenHash.slice(0, 16)}`]);
}

export async function resendInvitation(db: SqlExecutor, ctx: TenantContext, invitationId: string): Promise<InvitationResult> {
  requirePermission(ctx, "tenancy.admin");
  const raw = newRawToken();
  const { rows } = await db.query<{ id: string; email: string; status: string; expires_at: string }>(
    `update pierre_rt_invitations set token_hash = $3, expires_at = now() + interval '14 days'
       where company_id = $1 and id = $2 and status = 'pending' returning id, email, status, expires_at`,
    [ctx.company_id, invitationId, hashToken(raw)]);
  if (rows.length === 0) throw Errors.notFound("Pending invitation not found");
  await audit(db, ctx.company_id, ctx.user_id, "invitation", invitationId, "invitation_resent");
  return { ...rows[0], expires_at: isoOf(rows[0].expires_at), raw_token: raw, idempotent: false };
}

export async function revokeInvitation(db: SqlExecutor, ctx: TenantContext, invitationId: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  const { rows } = await db.query(
    `update pierre_rt_invitations set status = 'revoked', revoked_at = now()
       where company_id = $1 and id = $2 and status = 'pending' returning id`, [ctx.company_id, invitationId]);
  if (rows.length === 0) throw Errors.notFound("Pending invitation not found");
  await audit(db, ctx.company_id, ctx.user_id, "invitation", invitationId, "invitation_revoked");
}

/** Expire stale pending invitations (scheduled job). Service-role / global. */
export async function expireInvitations(db: SqlExecutor): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `update pierre_rt_invitations set status = 'expired' where status = 'pending' and expires_at < now() returning id`);
  return rows.length;
}

export type AcceptIdentity = { user_id: string; email?: string | null; email_confirmed_at?: string | null; token: string };

/** Set NEXT_PUBLIC/PIERRE_ALLOW_INVITE_EMAIL_MISMATCH="true" to permit accepting an
 *  invitation with a different (but verified) authenticated email — audited. Default OFF. */
function inviteEmailMismatchAllowed(): boolean {
  return process.env.PIERRE_ALLOW_INVITE_EMAIL_MISMATCH === "true";
}
const normEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/**
 * Accept an invitation by raw token. Identity transition (service role): the
 * accepting user is not yet a member. Enforces:
 *  - the token's SHA-256 matches a pending, unexpired invitation;
 *  - the authenticated email is VERIFIED and matches the invited email
 *    (case-insensitive), unless an explicit, audited override is configured;
 *  - every invited site belongs to the invitation's company, exists and is not
 *    archived (cross-tenant / missing / archived sites are refused);
 *  - site_ids are de-duplicated and inserted WITH company_id, in the SAME
 *    transaction as the acceptance.
 * The raw token is never logged. Idempotent: a replay for an already-member
 * reactivates and returns the existing membership.
 */
export async function acceptInvitation(db: SqlExecutor, input: AcceptIdentity): Promise<{ company_id: string; membership_id: string; roles: string[]; site_ids: string[] }> {
  if (!input.user_id) throw Errors.unauthenticated();
  if (!input.token) throw Errors.validation("Token is required");
  const tokenHash = hashToken(input.token);

  return db.transaction(async (tx) => {
    const inv = await tx.query<{ id: string; company_id: string; email: string; roles: string[]; site_ids: string[]; status: string }>(
      `select id, company_id, email, roles, site_ids, status from pierre_rt_invitations
         where token_hash = $1 and status = 'pending' and expires_at > now() for update`, [tokenHash]);
    if (inv.rows.length === 0) throw Errors.notFound("Invitation invalid, expired, or already used");
    const i = inv.rows[0];

    // Email identity binding.
    const authEmail = normEmail(input.email);
    const invitedEmail = normEmail(i.email);
    if (!authEmail) throw Errors.forbidden("Authenticated email required to accept an invitation");
    if (!input.email_confirmed_at) throw Errors.forbidden("Email must be verified to accept an invitation");
    if (authEmail !== invitedEmail) {
      if (!inviteEmailMismatchAllowed()) throw Errors.forbidden("Invitation was issued to a different email");
      await audit(tx, i.company_id, input.user_id, "invitation", i.id, "invitation_email_mismatch_override");
    }

    // Validate invited sites BEFORE any insert: belong to company, exist, not archived.
    const siteIds = Array.from(new Set((i.site_ids ?? []).filter(Boolean)));
    for (const sid of siteIds) {
      const s = await tx.query<{ id: string; archived_at: string | null }>(
        `select id, archived_at from pierre_rt_sites where company_id = $1 and id = $2`, [i.company_id, sid]);
      if (s.rows.length === 0) throw Errors.validation(`Invited site not found in company: ${sid}`);
      if (s.rows[0].archived_at) throw Errors.validation(`Invited site is archived: ${sid}`);
    }

    // Existing membership (any status) → reactivate; else create.
    const existing = await tx.query<{ id: string; status: string }>(
      `select id, status from pierre_rt_members where company_id = $1 and user_id = $2 limit 1`, [i.company_id, input.user_id]);
    let membershipId: string;
    if (existing.rows.length > 0) {
      membershipId = existing.rows[0].id;
      await tx.query(`update pierre_rt_members set status = 'active' where id = $1`, [membershipId]);
    } else {
      membershipId = newUuid();
      const primaryRole = (i.roles[0] ?? "VIEWER").toLowerCase();
      const legacyRole = ["owner", "admin", "hr_manager", "hr_operator", "viewer"].includes(primaryRole) ? primaryRole : "viewer";
      await tx.query(
        `insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,$4,'active')`,
        [membershipId, i.company_id, input.user_id, legacyRole]);
    }
    // Assign system roles from the invitation (custom roles handled by assignRole).
    const systemRoles = await tx.query<{ key: string }>(`select key from pierre_rt_roles where key = any($1)`, [i.roles]);
    for (const r of systemRoles.rows) {
      await tx.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,$3) on conflict do nothing`,
        [i.company_id, membershipId, r.key]);
    }
    // Site scope from invitation — WITH company_id (NOT NULL), deduped, idempotent.
    for (const sid of siteIds) {
      await tx.query(`insert into pierre_rt_member_sites (company_id, member_id, site_id) values ($1,$2,$3) on conflict do nothing`,
        [i.company_id, membershipId, sid]);
    }
    await tx.query(`update pierre_rt_invitations set status = 'accepted', accepted_at = now() where id = $1`, [i.id]);
    await audit(tx, i.company_id, input.user_id, "invitation", i.id, "invitation_accepted");
    return { company_id: i.company_id, membership_id: membershipId, roles: i.roles, site_ids: siteIds };
  });
}

// ── Member lifecycle ─────────────────────────────────────────────────────────
async function getMember(db: SqlExecutor, companyId: string, membershipId: string): Promise<{ id: string; user_id: string; role: string; status: string }> {
  const { rows } = await db.query<{ id: string; user_id: string; role: string; status: string }>(
    `select id, user_id, role, status from pierre_rt_members where company_id = $1 and id = $2`, [companyId, membershipId]);
  if (rows.length === 0) throw Errors.notFound("Member not found");
  return rows[0];
}

export async function suspendMember(db: SqlExecutor, ctx: TenantContext, membershipId: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  const m = await getMember(db, ctx.company_id, membershipId);
  if (await isOwner(db, ctx.company_id, membershipId) && (await countActiveOwners(db, ctx.company_id)) <= 1) {
    throw Errors.conflict("Cannot suspend the last active owner");
  }
  await db.query(`update pierre_rt_members set status = 'suspended' where company_id = $1 and id = $2`, [ctx.company_id, membershipId]);
  await audit(db, ctx.company_id, ctx.user_id, "member", m.user_id, "member_suspended");
}

export async function reactivateMember(db: SqlExecutor, ctx: TenantContext, membershipId: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  const m = await getMember(db, ctx.company_id, membershipId);
  if (m.status === "removed") throw Errors.conflict("Removed members must be re-invited");
  await db.query(`update pierre_rt_members set status = 'active' where company_id = $1 and id = $2`, [ctx.company_id, membershipId]);
  await audit(db, ctx.company_id, ctx.user_id, "member", m.user_id, "member_reactivated");
}

export async function removeMember(db: SqlExecutor, ctx: TenantContext, membershipId: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  const m = await getMember(db, ctx.company_id, membershipId);
  if (await isOwner(db, ctx.company_id, membershipId) && (await countActiveOwners(db, ctx.company_id)) <= 1) {
    throw Errors.conflict("Cannot remove the last active owner");
  }
  await db.query(`update pierre_rt_members set status = 'removed' where company_id = $1 and id = $2`, [ctx.company_id, membershipId]);
  await audit(db, ctx.company_id, ctx.user_id, "member", m.user_id, "member_removed");
}

export async function leaveCompany(db: SqlExecutor, ctx: TenantContext): Promise<void> {
  if (await isOwner(db, ctx.company_id, ctx.membership_id) && (await countActiveOwners(db, ctx.company_id)) <= 1) {
    throw Errors.conflict("Transfer ownership before leaving as the last owner");
  }
  await db.query(`update pierre_rt_members set status = 'left' where company_id = $1 and id = $2`, [ctx.company_id, ctx.membership_id]);
  await audit(db, ctx.company_id, ctx.user_id, "member", ctx.user_id, "member_left");
}

/**
 * Transfer ownership to another active member. Serialized via FOR UPDATE so two
 * concurrent transfers cannot both win. The target is promoted to owner BEFORE
 * the actor is demoted, so the active-owner count never drops to zero.
 */
export async function transferOwnership(db: SqlExecutor, ctx: TenantContext, targetMembershipId: string, opts: { demote_self?: boolean } = {}): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  if (!(await isOwner(db, ctx.company_id, ctx.membership_id))) throw Errors.forbidden("Only an owner can transfer ownership");
  return db.transaction(async (tx) => {
    const target = await tx.query<{ id: string; user_id: string; status: string }>(
      `select id, user_id, status from pierre_rt_members where company_id = $1 and id = $2 for update`, [ctx.company_id, targetMembershipId]);
    if (target.rows.length === 0) throw Errors.notFound("Target member not found");
    if (target.rows[0].status !== "active") throw Errors.conflict("Target member is not active");
    // Promote target.
    await tx.query(`update pierre_rt_members set role = 'owner' where company_id = $1 and id = $2`, [ctx.company_id, targetMembershipId]);
    await tx.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'OWNER') on conflict do nothing`, [ctx.company_id, targetMembershipId]);
    await tx.query(`update pierre_rt_companies set owner_user_id = $2 where id = $1`, [ctx.company_id, target.rows[0].user_id]);
    if (opts.demote_self) {
      // Safe: target is already an owner, so >=1 owner remains.
      await tx.query(`update pierre_rt_members set role = 'admin' where company_id = $1 and id = $2`, [ctx.company_id, ctx.membership_id]);
      await tx.query(`delete from pierre_rt_membership_roles where membership_id = $1 and role_key = 'OWNER'`, [ctx.membership_id]);
      await tx.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'ADMIN') on conflict do nothing`, [ctx.company_id, ctx.membership_id]);
    }
    await audit(tx, ctx.company_id, ctx.user_id, "member", target.rows[0].user_id, "ownership_transferred");
  });
}

// ── Role assignment to a member ──────────────────────────────────────────────
/** Validate that the caller may assign the given roles (no privilege escalation
 *  to permissions they do not themselves hold; roles must exist). */
export async function assertAssignableRoles(db: SqlExecutor, ctx: TenantContext, roleKeys: string[]): Promise<{ system: string[]; custom: string[] }> {
  const system: string[] = [];
  const custom: string[] = [];
  for (const key of roleKeys) {
    const sys = await db.query<{ key: string }>(`select key from pierre_rt_roles where key = $1`, [key]);
    if (sys.rows.length > 0) { system.push(key); continue; }
    const cus = await db.query<{ key: string }>(`select key from pierre_rt_custom_roles where company_id = $1 and key = $2 and archived_at is null`, [ctx.company_id, key]);
    if (cus.rows.length > 0) { custom.push(key); continue; }
    throw Errors.validation(`Unknown role: ${key}`);
  }
  // No self-escalation: an OWNER/tenancy.admin may assign any role; others may only
  // assign roles whose permission set is a subset of their own.
  const isAdmin = ctx.permissions.includes("company.admin") || ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin) {
    const target = await rolePermissionUnion(db, ctx.company_id, system, custom);
    for (const p of target) if (!ctx.permissions.includes(p)) throw Errors.forbidden(`Cannot grant permission you do not hold: ${p}`);
  }
  return { system, custom };
}

async function rolePermissionUnion(db: SqlExecutor, companyId: string, system: string[], custom: string[]): Promise<string[]> {
  const out = new Set<string>();
  if (system.length > 0) {
    const r = await db.query<{ permission_key: string }>(`select distinct permission_key from pierre_rt_role_permissions where role_key = any($1)`, [system]);
    r.rows.forEach((x) => out.add(x.permission_key));
  }
  if (custom.length > 0) {
    const r = await db.query<{ permission_key: string }>(`select distinct permission_key from pierre_rt_custom_role_permissions where company_id = $1 and role_key = any($2)`, [companyId, custom]);
    r.rows.forEach((x) => out.add(x.permission_key));
  }
  return [...out];
}

export async function assignRole(db: SqlExecutor, ctx: TenantContext, membershipId: string, roleKey: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  await getMember(db, ctx.company_id, membershipId);
  const { system, custom } = await assertAssignableRoles(db, ctx, [roleKey]);
  if (system.length > 0) {
    await db.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,$3) on conflict do nothing`, [ctx.company_id, membershipId, roleKey]);
    await syncBaseRole(db, ctx.company_id, membershipId); // R1 — keep the base column consistent
  } else if (custom.length > 0) {
    await db.query(`insert into pierre_rt_membership_custom_roles (company_id, membership_id, role_key) values ($1,$2,$3) on conflict do nothing`, [ctx.company_id, membershipId, roleKey]);
  }
  await audit(db, ctx.company_id, ctx.user_id, "member", membershipId, `role_assigned:${roleKey}`);
}

export async function removeRole(db: SqlExecutor, ctx: TenantContext, membershipId: string, roleKey: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  await getMember(db, ctx.company_id, membershipId);
  // Removing OWNER must keep >=1 active owner.
  if (roleKey === "OWNER" && (await countActiveOwners(db, ctx.company_id)) <= 1 && (await isOwner(db, ctx.company_id, membershipId))) {
    throw Errors.conflict("Cannot remove the last active owner role");
  }
  await db.query(`delete from pierre_rt_membership_roles where membership_id = $1 and role_key = $2`, [membershipId, roleKey]);
  await db.query(`delete from pierre_rt_membership_custom_roles where membership_id = $1 and role_key = $2`, [membershipId, roleKey]);
  // R1 — the base column must reflect the roles that REMAIN, or a revoked role keeps re-granting.
  await syncBaseRole(db, ctx.company_id, membershipId);
  await audit(db, ctx.company_id, ctx.user_id, "member", membershipId, `role_removed:${roleKey}`);
}

// ── Multi-company (identity-scoped, service role) ────────────────────────────
export async function listCompaniesForUser(db: SqlExecutor, userId: string): Promise<Array<{ id: string; name: string; role: string; status: string; member_status: string }>> {
  const { rows } = await db.query<{ id: string; name: string; role: string; status: string; member_status: string }>(
    `select c.id, c.name, m.role, c.status, m.status as member_status
       from pierre_rt_members m join pierre_rt_companies c on c.id = m.company_id
      where m.user_id = $1 and m.status in ('active','suspended') order by c.name asc`, [userId]);
  return rows;
}

export async function switchCompany(db: SqlExecutor, userId: string, companyId: string): Promise<{ company_id: string }> {
  // Validate membership + company health, then persist preference.
  const { rows } = await db.query<{ ms: string; cs: string }>(
    `select m.status as ms, c.status as cs from pierre_rt_members m join pierre_rt_companies c on c.id = m.company_id
      where m.user_id = $1 and m.company_id = $2 limit 1`, [userId, companyId]);
  if (rows.length === 0) throw Errors.tenantAccessDenied();
  if (rows[0].ms === "suspended") throw Errors.membershipSuspended();
  if (rows[0].ms === "removed" || rows[0].ms === "left") throw Errors.tenantAccessDenied("Membership inactive");
  if (["suspended", "cancelled", "archived"].includes(rows[0].cs)) throw Errors.companySuspended();
  await db.query(
    `insert into pierre_rt_user_company_prefs (user_id, last_company_id, updated_at) values ($1,$2, now())
     on conflict (user_id) do update set last_company_id = excluded.last_company_id, updated_at = now()`,
    [userId, companyId]);
  return { company_id: companyId };
}

/** Resolve the active company: explicit pref if still valid, else single membership. */
export async function resolveActiveCompany(db: SqlExecutor, userId: string): Promise<string | null> {
  const pref = await db.query<{ last_company_id: string | null }>(`select last_company_id from pierre_rt_user_company_prefs where user_id = $1`, [userId]);
  const prefId = pref.rows[0]?.last_company_id ?? null;
  if (prefId) {
    const ok = await db.query<{ ms: string; cs: string }>(
      `select m.status as ms, c.status as cs from pierre_rt_members m join pierre_rt_companies c on c.id = m.company_id
        where m.user_id = $1 and m.company_id = $2 limit 1`, [userId, prefId]);
    if (ok.rows.length > 0 && ok.rows[0].ms === "active" && !["suspended", "cancelled", "archived"].includes(ok.rows[0].cs)) return prefId;
  }
  const list = await listCompaniesForUser(db, userId);
  const active = list.filter((c) => c.member_status === "active" && !["suspended", "cancelled", "archived"].includes(c.status));
  return active.length === 1 ? active[0].id : (active[0]?.id ?? null);
}

function isoOf(v: unknown): string { return v instanceof Date ? v.toISOString() : new Date(v as string).toISOString(); }
