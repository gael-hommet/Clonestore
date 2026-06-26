// src/lib/pierre/v1/company.ts
// PHASE 8.2 — complete company model: read + optimistic patch + lifecycle status.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";

export type CompanyRow = {
  id: string; name: string; legal_name: string | null; display_name: string | null; slug: string | null;
  legal_form: string | null; registration_country: string | null; registration_number: string | null;
  vat_number: string | null; sector: string | null; company_size: string | null; default_locale: string;
  timezone: string; default_currency: string; default_autonomy_mode: string; status: string;
  onboarding_status: string; owner_user_id: string | null; version: number;
};

const PATCHABLE = new Set([
  "name", "legal_name", "display_name", "slug", "legal_form", "registration_country", "registration_number",
  "vat_number", "sector", "company_size", "default_locale", "timezone", "default_currency",
  "default_autonomy_mode", "onboarding_status",
]);
const STATUS_TRANSITIONS: Record<string, string[]> = {
  onboarding: ["active", "cancelled", "archived"],
  active: ["suspended", "cancellation_pending", "archived"],
  suspended: ["active", "cancellation_pending", "archived"],
  cancellation_pending: ["cancelled", "active"],
  cancelled: ["archived"],
  archived: [],
};

export async function getCompany(db: SqlExecutor, ctx: TenantContext): Promise<CompanyRow> {
  requirePermission(ctx, "company.read");
  const { rows } = await db.query<CompanyRow>(`select * from pierre_rt_companies where id = $1`, [ctx.company_id]);
  if (rows.length === 0) throw Errors.notFound("Company not found");
  return rows[0];
}

export async function patchCompany(db: SqlExecutor, ctx: TenantContext, patch: Record<string, unknown>, version: number): Promise<CompanyRow> {
  requirePermission(ctx, "company.write");

  // Status changes are governed transitions, not free updates.
  if (typeof patch.status === "string") {
    const cur = await getCompany(db, ctx);
    const allowed = STATUS_TRANSITIONS[cur.status] ?? [];
    if (cur.status !== patch.status && !allowed.includes(patch.status)) {
      throw Errors.validation(`Illegal company status transition ${cur.status} -> ${patch.status}`, { from: cur.status, to: patch.status });
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [ctx.company_id, version];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "status" || PATCHABLE.has(k)) {
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (sets.length === 0) throw Errors.validation("No patchable fields provided");
  const { rows } = await db.query<CompanyRow>(
    `update pierre_rt_companies set ${sets.join(", ")}, version = version + 1, updated_at = now()
       where id = $1 and version = $2 returning *`, params);
  if (rows.length === 0) throw Errors.versionConflict();
  return rows[0];
}

export async function listAccessibleCompanies(db: SqlExecutor, userId: string): Promise<Array<{ id: string; name: string; role: string; status: string; member_status: string }>> {
  // Service-level read (identity op): which companies can this user act in?
  const { rows } = await db.query<{ id: string; name: string; role: string; status: string; member_status: string }>(
    `select c.id, c.name, m.role, c.status, m.status as member_status
       from pierre_rt_members m join pierre_rt_companies c on c.id = m.company_id
      where m.user_id = $1 order by c.name asc`, [userId]);
  return rows;
}

/** Validate that a user may switch to a company (active membership + active company). */
export async function assertCompanyAccessible(db: SqlExecutor, userId: string, companyId: string): Promise<void> {
  const { rows } = await db.query<{ ms: string; cs: string }>(
    `select m.status as ms, c.status as cs from pierre_rt_members m join pierre_rt_companies c on c.id=m.company_id
      where m.user_id=$1 and m.company_id=$2 limit 1`, [userId, companyId]);
  if (rows.length === 0) throw Errors.tenantAccessDenied();
  if (rows[0].ms === "suspended") throw Errors.membershipSuspended();
  if (rows[0].ms === "removed" || rows[0].ms === "left") throw Errors.tenantAccessDenied("Membership inactive");
  if (["suspended", "cancelled", "archived"].includes(rows[0].cs)) throw Errors.companySuspended();
}
