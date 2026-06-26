// src/lib/pierre/v1/tenant-context.ts
// PHASE 8.1 — Pierre Production Runtime Core — canonical TenantContext.
//
// Every route and every runtime service receives a TenantContext. Workers never
// trust a client-supplied company_id: the context is resolved server-side from
// the authenticated user's membership. Cross-tenant access is denied.

import type { SqlExecutor } from "./sql";
import { newRequestId, newCorrelationId } from "./sql";
import { Errors } from "./errors";

export type MemberRole = "owner" | "admin" | "hr_manager" | "hr_operator" | "viewer";

// Canonical permission key (DB-driven, see pierre_rt_permissions). String for
// flexibility; well-known keys: company.*, mission.*, employee.*, document.*,
// absence.*, payroll_prep.*, validation.*, pierre.*, audit.*, site.*, tenancy.admin.
export type Permission = string;

const LEGACY_ROLE_TO_KEY: Record<MemberRole, string> = {
  owner: "OWNER", admin: "ADMIN", hr_manager: "HR_MANAGER", hr_operator: "HR_OPERATOR", viewer: "VIEWER",
};

const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  owner: ["mission.create","mission.read","mission.cancel","validation.read","validation.decide","task.read","queue.admin","employee.read","employee.write","site.read","site.write","tenancy.admin"],
  admin: ["mission.create","mission.read","mission.cancel","validation.read","validation.decide","task.read","queue.admin","employee.read","employee.write","site.read","site.write","tenancy.admin"],
  hr_manager: ["mission.create","mission.read","mission.cancel","validation.read","validation.decide","task.read","employee.read","employee.write","site.read"],
  hr_operator: ["mission.create","mission.read","task.read","employee.read","site.read"],
  viewer: ["mission.read","task.read","validation.read","employee.read","site.read"],
};

export type TenantContext = {
  company_id: string;
  user_id: string;
  membership_id: string;
  role: MemberRole;
  /** Resolved system + custom role keys (e.g. ["OWNER"]). Used by document-type
   *  governance + documentary CloneGuard. Optional for legacy/synthetic contexts. */
  role_keys?: string[];
  permissions: readonly Permission[];
  /** Site ids the member is restricted to; null = all sites of the company. */
  site_ids: string[] | null;
  request_id: string;
  correlation_id: string;
};

export function hasPermission(ctx: TenantContext, perm: Permission): boolean {
  return ctx.permissions.includes(perm);
}

export function requirePermission(ctx: TenantContext, perm: Permission): void {
  if (!hasPermission(ctx, perm)) throw Errors.forbidden(`Missing permission: ${perm}`);
}

/**
 * PHASE 8.2 — default active company for a user: when the user belongs to exactly
 * one company (the common single-tenant case after backfill), it is the active
 * company without an explicit header. 0 or >1 memberships → must be specified.
 */
export async function resolveDefaultCompanyId(db: SqlExecutor, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { rows } = await db.query<{ company_id: string }>(
    `select company_id from pierre_rt_members where user_id = $1 order by created_at asc`, [userId]);
  return rows.length === 1 ? rows[0].company_id : null;
}

/**
 * Resolve a canonical TenantContext from an authenticated user + a requested
 * company. Verifies real membership server-side. Throws on cross-tenant access.
 */
export async function resolveTenantContext(
  db: SqlExecutor,
  input: { user_id: string | null | undefined; company_id: string | null | undefined; request_id?: string; correlation_id?: string }
): Promise<TenantContext> {
  if (!input.user_id) throw Errors.unauthenticated();
  if (!input.company_id) throw Errors.tenantAccessDenied("No active company");

  const { rows } = await db.query<{ id: string; role: MemberRole; permissions: unknown; status: string }>(
    `select id, role, permissions, status from pierre_rt_members
       where user_id = $1 and company_id = $2 limit 1`,
    [input.user_id, input.company_id]
  );
  if (rows.length === 0) throw Errors.tenantAccessDenied();
  const member = rows[0];
  // Member lifecycle guards (these errors must NOT trigger a legacy fallback).
  if (member.status === "suspended") throw Errors.membershipSuspended();
  if (member.status === "removed" || member.status === "left") throw Errors.tenantAccessDenied("Membership inactive");

  // Company lifecycle guard.
  const comp = await db.query<{ status: string }>(`select status from pierre_rt_companies where id = $1`, [input.company_id]);
  const companyStatus = comp.rows[0]?.status ?? "active";
  if (["suspended", "cancelled", "archived"].includes(companyStatus)) throw Errors.companySuspended(`Company ${companyStatus}`);

  // PHASE 8.2 — RBAC: multi-role from membership_roles -> role_permissions (DB),
  // with the legacy single-role code matrix as fallback. Explicit member
  // permissions extend the set.
  const roleRows = await db.query<{ role_key: string }>(`select role_key from pierre_rt_membership_roles where membership_id = $1`, [member.id]);
  const roleKeys = roleRows.rows.length > 0 ? roleRows.rows.map((r) => r.role_key) : [LEGACY_ROLE_TO_KEY[member.role]];
  const permRows = await db.query<{ permission_key: string }>(
    `select distinct permission_key from pierre_rt_role_permissions where role_key = any($1)`, [roleKeys]);
  const dbPerms = permRows.rows.map((r) => r.permission_key);

  // PHASE 8.2-C — custom roles: a member can also hold company-defined custom
  // roles (assigned via pierre_rt_membership_custom_roles). Their permissions
  // come from pierre_rt_custom_role_permissions, but only for roles that still
  // exist and are not archived. Resolved here so the rest of the runtime treats
  // custom and system roles identically.
  let customPerms: string[] = [];
  const customRoleRows = await db.query<{ role_key: string }>(
    `select role_key from pierre_rt_membership_custom_roles where membership_id = $1`, [member.id]);
  if (customRoleRows.rows.length > 0) {
    const keys = customRoleRows.rows.map((r) => r.role_key);
    const cr = await db.query<{ permission_key: string }>(
      `select distinct crp.permission_key
         from pierre_rt_custom_role_permissions crp
         join pierre_rt_custom_roles cro
           on cro.company_id = crp.company_id and cro.key = crp.role_key and cro.archived_at is null
        where crp.company_id = $1 and crp.role_key = any($2)`,
      [input.company_id, keys]);
    customPerms = cr.rows.map((r) => r.permission_key);
  }

  const codeFallback = ROLE_PERMISSIONS[member.role] ?? [];
  const explicit = Array.isArray(member.permissions) ? (member.permissions as Permission[]) : [];
  const permissions = Array.from(new Set<Permission>([...dbPerms, ...customPerms, ...codeFallback, ...explicit]));

  // PHASE 8.2 — site scope: a member with no member_sites rows sees all sites.
  let site_ids: string[] | null = null;
  const ms = await db.query<{ site_id: string }>(
    `select site_id from pierre_rt_member_sites where member_id = $1`, [member.id]);
  if (ms.rows.length > 0) site_ids = ms.rows.map((r) => r.site_id);

  return {
    company_id: input.company_id,
    user_id: input.user_id,
    membership_id: member.id,
    role: member.role,
    role_keys: Array.from(new Set<string>([...roleKeys, ...customRoleRows.rows.map((r) => r.role_key)])),
    permissions,
    site_ids,
    request_id: input.request_id ?? newRequestId(),
    correlation_id: input.correlation_id ?? newCorrelationId(),
  };
}
