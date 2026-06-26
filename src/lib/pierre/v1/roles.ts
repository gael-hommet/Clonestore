// src/lib/pierre/v1/roles.ts
// PHASE 8.2-C — Roles: system catalog (read-only) + company custom roles (CRUD).
//
// Custom roles live in pierre_rt_custom_roles (company-scoped key) with their
// permission grants in pierre_rt_custom_role_permissions. System roles are
// immutable. No role may grant a permission that does not exist. Custom roles
// are resolved into a member's effective permissions by resolveTenantContext.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";

export type RoleView = {
  key: string; label: string; is_system: boolean; archived: boolean;
  version: number; permissions: string[];
};

async function validatePermissions(db: SqlExecutor, perms: string[]): Promise<string[]> {
  const unique = Array.from(new Set(perms));
  if (unique.length === 0) return [];
  const { rows } = await db.query<{ key: string }>(`select key from pierre_rt_permissions where key = any($1)`, [unique]);
  const known = new Set(rows.map((r) => r.key));
  const unknown = unique.filter((p) => !known.has(p));
  if (unknown.length > 0) throw Errors.validation(`Unknown permission(s): ${unknown.join(", ")}`);
  return unique;
}

function slugifyKey(label: string): string {
  const base = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  if (!base) throw Errors.validation("Role label must contain alphanumerics");
  return `CUSTOM_${base}`;
}

export async function listRoles(db: SqlExecutor, ctx: TenantContext): Promise<RoleView[]> {
  requirePermission(ctx, "tenancy.admin");
  const sys = await db.query<{ key: string; label: string }>(`select key, label from pierre_rt_roles order by key`);
  const out: RoleView[] = [];
  for (const r of sys.rows) {
    const p = await db.query<{ permission_key: string }>(`select permission_key from pierre_rt_role_permissions where role_key = $1`, [r.key]);
    out.push({ key: r.key, label: r.label, is_system: true, archived: false, version: 1, permissions: p.rows.map((x) => x.permission_key) });
  }
  const cus = await db.query<{ key: string; label: string; archived_at: string | null; version: number }>(
    `select key, label, archived_at, version from pierre_rt_custom_roles where company_id = $1 order by key`, [ctx.company_id]);
  for (const r of cus.rows) {
    const p = await db.query<{ permission_key: string }>(`select permission_key from pierre_rt_custom_role_permissions where company_id = $1 and role_key = $2`, [ctx.company_id, r.key]);
    out.push({ key: r.key, label: r.label, is_system: false, archived: r.archived_at != null, version: r.version, permissions: p.rows.map((x) => x.permission_key) });
  }
  return out;
}

export async function getRole(db: SqlExecutor, ctx: TenantContext, key: string): Promise<RoleView> {
  requirePermission(ctx, "tenancy.admin");
  const sys = await db.query<{ key: string; label: string }>(`select key, label from pierre_rt_roles where key = $1`, [key]);
  if (sys.rows.length > 0) {
    const p = await db.query<{ permission_key: string }>(`select permission_key from pierre_rt_role_permissions where role_key = $1`, [key]);
    return { key, label: sys.rows[0].label, is_system: true, archived: false, version: 1, permissions: p.rows.map((x) => x.permission_key) };
  }
  const cus = await db.query<{ key: string; label: string; archived_at: string | null; version: number }>(
    `select key, label, archived_at, version from pierre_rt_custom_roles where company_id = $1 and key = $2`, [ctx.company_id, key]);
  if (cus.rows.length === 0) throw Errors.notFound("Role not found");
  const p = await db.query<{ permission_key: string }>(`select permission_key from pierre_rt_custom_role_permissions where company_id = $1 and role_key = $2`, [ctx.company_id, key]);
  return { key, label: cus.rows[0].label, is_system: false, archived: cus.rows[0].archived_at != null, version: cus.rows[0].version, permissions: p.rows.map((x) => x.permission_key) };
}

export async function createRole(db: SqlExecutor, ctx: TenantContext, input: { label: string; permissions?: string[]; key?: string }): Promise<RoleView> {
  requirePermission(ctx, "tenancy.admin");
  if (!input.label?.trim()) throw Errors.validation("Role label is required");
  const key = input.key ? (input.key.toUpperCase().startsWith("CUSTOM_") ? input.key.toUpperCase() : `CUSTOM_${input.key.toUpperCase()}`) : slugifyKey(input.label);
  // No collision with a system role.
  const sys = await db.query(`select 1 from pierre_rt_roles where key = $1`, [key]);
  if (sys.rows.length > 0) throw Errors.conflict("Role key collides with a system role");
  const exists = await db.query(`select 1 from pierre_rt_custom_roles where company_id = $1 and key = $2`, [ctx.company_id, key]);
  if (exists.rows.length > 0) throw Errors.conflict("Custom role already exists");
  const perms = await validatePermissions(db, input.permissions ?? []);
  await db.query(`insert into pierre_rt_custom_roles (company_id, key, label, created_by, version) values ($1,$2,$3,$4,1)`,
    [ctx.company_id, key, input.label.trim(), ctx.user_id]);
  for (const p of perms) {
    await db.query(`insert into pierre_rt_custom_role_permissions (company_id, role_key, permission_key) values ($1,$2,$3) on conflict do nothing`, [ctx.company_id, key, p]);
  }
  return getRole(db, ctx, key);
}

export async function patchRole(db: SqlExecutor, ctx: TenantContext, key: string, patch: { label?: string; permissions?: string[] }, version: number): Promise<RoleView> {
  requirePermission(ctx, "tenancy.admin");
  const sys = await db.query(`select 1 from pierre_rt_roles where key = $1`, [key]);
  if (sys.rows.length > 0) throw Errors.forbidden("System roles are immutable");
  const cur = await db.query<{ version: number; archived_at: string | null }>(`select version, archived_at from pierre_rt_custom_roles where company_id = $1 and key = $2`, [ctx.company_id, key]);
  if (cur.rows.length === 0) throw Errors.notFound("Custom role not found");
  if (cur.rows[0].archived_at) throw Errors.conflict("Role is archived");
  if (cur.rows[0].version !== version) throw Errors.versionConflict();

  if (typeof patch.label === "string" && patch.label.trim()) {
    await db.query(`update pierre_rt_custom_roles set label = $3 where company_id = $1 and key = $2`, [ctx.company_id, key, patch.label.trim()]);
  }
  if (Array.isArray(patch.permissions)) {
    const perms = await validatePermissions(db, patch.permissions);
    await db.query(`delete from pierre_rt_custom_role_permissions where company_id = $1 and role_key = $2`, [ctx.company_id, key]);
    for (const p of perms) await db.query(`insert into pierre_rt_custom_role_permissions (company_id, role_key, permission_key) values ($1,$2,$3)`, [ctx.company_id, key, p]);
  }
  await db.query(`update pierre_rt_custom_roles set version = version + 1 where company_id = $1 and key = $2`, [ctx.company_id, key]);
  return getRole(db, ctx, key);
}

export async function archiveRole(db: SqlExecutor, ctx: TenantContext, key: string): Promise<void> {
  requirePermission(ctx, "tenancy.admin");
  const sys = await db.query(`select 1 from pierre_rt_roles where key = $1`, [key]);
  if (sys.rows.length > 0) throw Errors.forbidden("System roles cannot be archived");
  const r = await db.query(`update pierre_rt_custom_roles set archived_at = now() where company_id = $1 and key = $2 and archived_at is null returning key`, [ctx.company_id, key]);
  if (r.rows.length === 0) throw Errors.notFound("Active custom role not found");
  // Detach from any memberships so it stops granting permissions.
  await db.query(`delete from pierre_rt_membership_custom_roles where company_id = $1 and role_key = $2`, [ctx.company_id, key]);
}
