// src/lib/pierre/v1/runtime-system-auth.ts
// PHASE 8.5 — the runtime tick/scheduler/recovery triggers are SYSTEM operations (cron / internal
// queue), NEVER ordinary client actions. An authenticated `document.read` user can NOT drive the
// runtime. The system caller proves itself with a DEDICATED shared secret compared in constant time
// (Authorization: Bearer <secret>, or x-pierre-system-secret). A missing or wrong secret is refused.
// The secret is never logged. The acting TenantContext is resolved server-side from the tenant's
// owner membership (a real actor for the audit trail) — never from a client-supplied identity.

import { timingSafeEqual, randomUUID } from "crypto";
import type { SqlExecutor } from "./sql";
import { resolveTenantContext, type TenantContext } from "./tenant-context";

/** The DEDICATED runtime system secret (never logged). R1.10 — no implicit CRON_SECRET fallback: the
 *  runtime trigger has its own secret so a generic cron secret can never drive the autonomous runtime.
 *  An empty env var is treated as unset (fail-closed). */
export function runtimeSystemSecret(): string | null {
  return process.env.PIERRE_RUNTIME_SYSTEM_SECRET || null;
}

function presentedSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers.get("x-pierre-system-secret");
}

/** Constant-time verification of the runtime system secret. Missing/empty/mismatched → false. */
export function verifyRuntimeSystemRequest(req: Request, secret: string): boolean {
  const provided = presentedSecret(req);
  if (!provided || !secret) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

/** R1.10 — discover the tenants that actually have due runtime work (a system tick never trusts a
 *  client-supplied company_id; it processes only tenants the DB itself reports as having work).
 *  NOTE: this is the non-atomic legacy discovery (no coordination). The system routes use the atomic,
 *  fair, leased discovery below (R4.6); this remains for read-only diagnostics. */
export async function claimRuntimeTenants(db: SqlExecutor, limit: number): Promise<string[]> {
  const rows = (await db.query<{ company_id: string }>(`select tenant_company_id as company_id from pierre_rt_claim_runtime_tenants($1, now())`, [Math.min(Math.max(limit, 1), 500)])).rows;
  return rows.map((r) => r.company_id);
}

/** A held tenant lease — the caller MUST release it (complete/fail) after processing the tenant. */
export type RuntimeTenantLease = { company_id: string; lease_fencing: number; holder: string; scope: RuntimeLeaseScope };
export type RuntimeLeaseScope = "worker" | "scheduler" | "recovery";

/** R4.6 — discover + ATOMICALLY LEASE the tenants with due runtime work, fairly (least-recently-served
 *  first) and exclusively (a concurrent holder receives only the tenants this one did NOT claim). Each
 *  returned tenant is leased to a freshly-generated holder for `leaseSeconds`; the caller releases each
 *  lease (completeRuntimeTenantLease / failRuntimeTenantLease) when done. */
export async function claimRuntimeTenantLeases(
  db: SqlExecutor, scope: RuntimeLeaseScope, limit: number, leaseSeconds = 120,
): Promise<RuntimeTenantLease[]> {
  const holder = `${scope}-${randomUUID()}`;
  const rows = (await db.query<{ tenant_company_id: string; lease_fencing: number }>(
    `select tenant_company_id, lease_fencing from pierre_rt_claim_runtime_tenant_leases($1,$2,$3,$4,now())`,
    [scope, holder, Math.min(Math.max(limit, 1), 500), Math.max(leaseSeconds, 1)])).rows;
  return rows.map((r) => ({ company_id: r.tenant_company_id, lease_fencing: Number(r.lease_fencing), holder, scope }));
}

/** Release a tenant lease cleanly after processing (idempotent; a stale holder is refused by the DB). */
export async function completeRuntimeTenantLease(db: SqlExecutor, lease: RuntimeTenantLease): Promise<void> {
  await db.query(`select pierre_rt_complete_tenant_lease($1,$2,$3,$4,now())`, [lease.company_id, lease.scope, lease.holder, lease.lease_fencing]);
}

/** Release a tenant lease recording a failure (so it is reclaimable; the failure is observable). */
export async function failRuntimeTenantLease(db: SqlExecutor, lease: RuntimeTenantLease, error: string): Promise<void> {
  await db.query(`select pierre_rt_fail_tenant_lease($1,$2,$3,$4,now(),$5)`, [lease.company_id, lease.scope, lease.holder, lease.lease_fencing, error.slice(0, 120)]);
}

/** Resolve a system actor context for a tenant: the tenant's owner/admin (a real, FK-valid actor). */
export async function resolveRuntimeSystemContext(db: SqlExecutor, companyId: string): Promise<TenantContext> {
  const owner = (await db.query<{ user_id: string }>(
    `select user_id from pierre_rt_members where company_id=$1 and (status is null or status='active') and role in ('owner','admin') order by case role when 'owner' then 0 else 1 end, created_at asc limit 1`,
    [companyId])).rows[0];
  if (!owner) throw new Error("no owner membership for the tenant");
  return resolveTenantContext(db, { user_id: owner.user_id, company_id: companyId });
}
