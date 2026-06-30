// src/lib/pierre/v1/membership-invitations.ts
// PHASE 8.6 — membership INVITATIONS (token security + governed lifecycle).
//
// The raw token is generated once, returned once, and NEVER persisted — only its SHA-256 hash is stored.
// Acceptance is identity-bound (the accepting account's verified email must match the normalized invited
// email) and atomic (invitation accepted + membership active + access event), with idempotent replay.
// Resend supersedes the prior pending invite rather than piling up duplicates.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import { Errors } from "./errors";

/** Role-keys an inviter may grant must be a subset of what their own role can confer. */
const ROLE_KEY_RANK: Record<string, number> = { OWNER: 100, ADMIN: 90, HR_DIRECTOR: 80, HR_MANAGER: 70, PAYROLL_MANAGER: 60, SITE_MANAGER: 50, HR_OPERATOR: 40, MANAGER: 40, VALIDATOR: 40, AUDITOR: 30, EMPLOYEE: 20, VIEWER: 10 };

export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function generateInvitationToken(): { token: string; token_hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, token_hash: hashInvitationToken(token) };
}
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
/** Constant-time compare of two hex hashes. */
export function safeHashEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function highestRank(roleKeys: string[]): number {
  return roleKeys.reduce((max, k) => Math.max(max, ROLE_KEY_RANK[k] ?? 0), 0);
}

export type CreateInvitationInput = {
  email: string;
  roles?: string[];           // role-keys (e.g. ["HR_MANAGER"])
  ttl_ms?: number;
};
export type CreateInvitationResult = { invitation_id: string; token: string; expires_at: string };

/**
 * Create an invitation (app, governed). The inviter must hold tenancy.admin and may not grant a role
 * higher than their own. Returns the raw token ONCE (never stored, never logged).
 */
export async function createMembershipInvitation(
  db: SqlExecutor, ctx: TenantContext, input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  requirePermission(ctx, "tenancy.admin");
  const roles = (input.roles && input.roles.length > 0 ? input.roles : ["VIEWER"]).map((r) => r.toUpperCase());
  const inviterRank = highestRank(ctx.role_keys ?? []);
  if (highestRank(roles) > inviterRank) throw Errors.forbidden("Cannot invite to a role higher than your own");
  const emailNorm = normalizeEmail(input.email);
  const { token, token_hash } = generateInvitationToken();
  const expires_at = new Date(Date.now() + (input.ttl_ms ?? INVITATION_TTL_MS)).toISOString();
  const { rows } = await db.query<{ id: string }>(
    `select pierre_rt_create_membership_invitation($1,$2,$3,$4,$5,$6,$7) as id`,
    [ctx.company_id, input.email, emailNorm, roles, token_hash, ctx.user_id, expires_at],
  );
  return { invitation_id: rows[0].id, token, expires_at };
}

/** Revoke a pending invitation (app, governed). */
export async function revokeMembershipInvitation(db: SqlExecutor, ctx: TenantContext, invitationId: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  await db.query(`select pierre_rt_revoke_membership_invitation($1,$2,$3)`, [ctx.company_id, invitationId, ctx.user_id]);
}

/** Resend = supersede the prior pending invite + issue a fresh token (create handles the supersede). */
export async function resendMembershipInvitation(
  db: SqlExecutor, ctx: TenantContext, input: { email: string; roles?: string[]; ttl_ms?: number },
): Promise<CreateInvitationResult> {
  return createMembershipInvitation(db, ctx, input);
}

export type AcceptInvitationInput = {
  token: string;
  user_id: string;
  /** the accepting account's VERIFIED email (email_confirmed_at must be set upstream). */
  account_email: string;
  email_verified: boolean;
};

/**
 * Accept an invitation (identity-bound, runs before a tenant context exists). The account email must be
 * verified and must match the invited email. Atomic + idempotent replay. Returns the membership id.
 */
export async function acceptMembershipInvitation(db: SqlExecutor, input: AcceptInvitationInput): Promise<string> {
  if (!input.email_verified) throw Errors.forbidden("Email must be verified to accept an invitation");
  const token_hash = hashInvitationToken(input.token);
  const emailNorm = normalizeEmail(input.account_email);
  const { rows } = await db.query<{ m: string }>(
    `select pierre_rt_accept_membership_invitation($1,$2,$3,$4) as m`,
    [token_hash, input.user_id, emailNorm, new Date().toISOString()],
  );
  return rows[0].m;
}

export type InvitationRow = {
  id: string; company_id: string; email: string; email_normalized: string | null; roles: string[];
  status: string; expires_at: string; invited_by: string | null; accepted_by: string | null;
  accepted_at: string | null; revoked_at: string | null; created_at: string;
};

/** List invitations for the active tenant (never exposes the token hash). */
export async function listMembershipInvitations(db: SqlExecutor, ctx: TenantContext): Promise<InvitationRow[]> {
  const { rows } = await db.query<InvitationRow>(
    `select id, company_id, email, email_normalized, roles, status, expires_at, invited_by, accepted_by, accepted_at, revoked_at, created_at
       from pierre_rt_invitations where company_id=$1 order by created_at desc`,
    [ctx.company_id],
  );
  return rows;
}
