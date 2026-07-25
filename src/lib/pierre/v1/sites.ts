// src/lib/pierre/v1/sites.ts
// PHASE 8.2 / 8.2-C — Sites repository + service (tenant + RBAC scoped) with full
// CRUD + lifecycle (update, archive, reactivate, assign-manager). Optimistic
// concurrency on `version`. Archiving a site with active employees is blocked
// unless an explicit reassignment target is provided.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission, canAccessSite, siteScopeArray } from "./rbac";

export type SiteRow = {
  id: string; company_id: string; name: string; code: string | null;
  timezone: string; type: string; address: string | null; postal_code: string | null;
  city: string | null; country: string | null; phone: string | null; email: string | null;
  manager_membership_id: string | null; legal_establishment_number: string | null;
  active: boolean; version: number; created_at: string; updated_at: string; archived_at: string | null;
};

const PATCHABLE = new Set(["name", "code", "timezone", "type", "address", "postal_code", "city", "country", "phone", "email", "legal_establishment_number"]);

export const SiteRepo = {
  async insert(db: SqlExecutor, companyId: string, s: { name: string; code: string | null; timezone: string; type?: string; address?: string | null; postal_code?: string | null; city?: string | null; country?: string | null }): Promise<SiteRow> {
    const { rows } = await db.query<SiteRow>(
      `insert into pierre_rt_sites (id, company_id, name, code, timezone, type, address, postal_code, city, country)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [newUuid(), companyId, s.name, s.code, s.timezone, s.type ?? "office", s.address ?? null, s.postal_code ?? null, s.city ?? null, s.country ?? null]);
    return rows[0];
  },
  async byId(db: SqlExecutor, companyId: string, id: string): Promise<SiteRow | null> {
    const { rows } = await db.query<SiteRow>(`select * from pierre_rt_sites where company_id=$1 and id=$2`, [companyId, id]);
    return rows[0] ?? null;
  },
  async list(db: SqlExecutor, companyId: string, scope: string[] | null, includeArchived = false): Promise<SiteRow[]> {
    const arch = includeArchived ? "" : " and archived_at is null";
    if (scope) {
      const { rows } = await db.query<SiteRow>(`select * from pierre_rt_sites where company_id=$1 and id = any($2)${arch} order by name asc`, [companyId, scope]);
      return rows;
    }
    const { rows } = await db.query<SiteRow>(`select * from pierre_rt_sites where company_id=$1${arch} order by name asc`, [companyId]);
    return rows;
  },
  async activeEmployeeCount(db: SqlExecutor, companyId: string, siteId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(`select count(*) as n from pierre_rt_employees where company_id=$1 and site_id=$2 and archived_at is null and status not in ('left')`, [companyId, siteId]);
    return Number(rows[0]?.n ?? 0);
  },
};

function validateAddress(input: { postal_code?: string | null; country?: string | null }): void {
  if (input.postal_code != null && input.postal_code !== "" && !/^[A-Za-z0-9 -]{2,12}$/.test(input.postal_code)) throw Errors.validation("Invalid postal_code");
  if (input.country != null && input.country !== "" && !/^[A-Za-z]{2,3}$/.test(input.country)) throw Errors.validation("country must be an ISO code");
}

export async function createSite(db: SqlExecutor, ctx: TenantContext, input: { name: string; code?: string | null; timezone?: string; type?: string; address?: string | null; postal_code?: string | null; city?: string | null; country?: string | null }): Promise<SiteRow> {
  requirePermission(ctx, "site.write");
  if (!input.name || input.name.trim().length === 0) throw Errors.validation("site name is required");
  validateAddress(input);
  return SiteRepo.insert(db, ctx.company_id, { name: input.name.trim(), code: input.code ?? null, timezone: input.timezone ?? "Europe/Paris", type: input.type, address: input.address, postal_code: input.postal_code, city: input.city, country: input.country });
}

export async function listSites(db: SqlExecutor, ctx: TenantContext): Promise<SiteRow[]> {
  requirePermission(ctx, "site.read");
  return SiteRepo.list(db, ctx.company_id, siteScopeArray(ctx));
}

export async function getSite(db: SqlExecutor, ctx: TenantContext, id: string): Promise<SiteRow> {
  requirePermission(ctx, "site.read");
  const s = await SiteRepo.byId(db, ctx.company_id, id);
  if (!s) throw Errors.notFound("Site not found");
  if (!canAccessSite(ctx, s.id)) throw Errors.forbidden("Site out of scope");
  return s;
}

export async function patchSite(db: SqlExecutor, ctx: TenantContext, id: string, patch: Record<string, unknown>, version: number): Promise<SiteRow> {
  requirePermission(ctx, "site.write");
  const s = await getSite(db, ctx, id);
  validateAddress(patch as { postal_code?: string | null; country?: string | null });
  const sets: string[] = [];
  const params: unknown[] = [ctx.company_id, id, version];
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE.has(k)) { params.push(v); sets.push(`${k} = $${params.length}`); }
  }
  if (sets.length === 0) throw Errors.validation("No patchable site fields provided");
  const { rows } = await db.query<SiteRow>(
    `update pierre_rt_sites set ${sets.join(", ")}, version = version + 1, updated_at = now()
       where company_id = $1 and id = $2 and version = $3 returning *`, params);
  if (rows.length === 0) throw Errors.versionConflict();
  void s;
  return rows[0];
}

export async function archiveSite(db: SqlExecutor, ctx: TenantContext, id: string, opts: { reassign_to_site_id?: string | null } = {}): Promise<SiteRow> {
  requirePermission(ctx, "site.write");
  const s = await getSite(db, ctx, id);
  if (s.archived_at) return s;
  const count = await SiteRepo.activeEmployeeCount(db, ctx.company_id, id);
  if (count > 0) {
    if (!opts.reassign_to_site_id) throw Errors.conflict(`Site has ${count} active employee(s); provide reassign_to_site_id`);
    const target = await SiteRepo.byId(db, ctx.company_id, opts.reassign_to_site_id);
    if (!target || target.archived_at) throw Errors.validation("Reassignment target site is invalid or archived");
    await db.query(`update pierre_rt_employees set site_id = $3, updated_at = now() where company_id = $1 and site_id = $2`, [ctx.company_id, id, opts.reassign_to_site_id]);
  }
  const { rows } = await db.query<SiteRow>(`update pierre_rt_sites set archived_at = now(), active = false, version = version + 1, updated_at = now() where company_id = $1 and id = $2 returning *`, [ctx.company_id, id]);
  return rows[0];
}

export async function reactivateSite(db: SqlExecutor, ctx: TenantContext, id: string): Promise<SiteRow> {
  requirePermission(ctx, "site.write");
  await getSite(db, ctx, id);
  const { rows } = await db.query<SiteRow>(`update pierre_rt_sites set archived_at = null, active = true, version = version + 1, updated_at = now() where company_id = $1 and id = $2 returning *`, [ctx.company_id, id]);
  return rows[0];
}

export async function assignSiteManager(db: SqlExecutor, ctx: TenantContext, id: string, managerMembershipId: string): Promise<SiteRow> {
  requirePermission(ctx, "site.write");
  await getSite(db, ctx, id);
  // Manager must be an active member of the company.
  const m = await db.query<{ id: string; status: string }>(`select id, status from pierre_rt_members where company_id = $1 and id = $2`, [ctx.company_id, managerMembershipId]);
  if (m.rows.length === 0) throw Errors.validation("Manager is not a member of this company");
  if (m.rows[0].status !== "active") throw Errors.conflict("Manager membership is not active");
  // Manager must be authorized on the site (unrestricted scope, or explicitly scoped to it).
  const scope = await db.query<{ site_id: string }>(`select site_id from pierre_rt_member_sites where member_id = $1`, [managerMembershipId]);
  if (scope.rows.length > 0 && !scope.rows.some((r) => r.site_id === id)) throw Errors.forbidden("Manager is not authorized on this site");
  const { rows } = await db.query<SiteRow>(`update pierre_rt_sites set manager_membership_id = $3, version = version + 1, updated_at = now() where company_id = $1 and id = $2 returning *`, [ctx.company_id, id, managerMembershipId]);
  return rows[0];
}
