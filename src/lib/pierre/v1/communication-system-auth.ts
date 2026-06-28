// src/lib/pierre/v1/communication-system-auth.ts
// PHASE 8.4-R1.2 — the communication dispatch trigger is a SYSTEM operation (cron / internal queue),
// NEVER an ordinary client action. An authenticated `document.read` user can NOT trigger a dispatch.
// The system caller proves itself with a shared secret compared in constant time (Authorization:
// Bearer <secret>, or x-pierre-system-secret). A missing or wrong secret is refused. The secret is
// never logged. The acting TenantContext is resolved server-side from the tenant's owner membership
// (a real actor for the audit trail) — never from a client-supplied identity.

import { timingSafeEqual } from "crypto";
import type { SqlExecutor } from "./sql";
import { resolveTenantContext, type TenantContext } from "./tenant-context";

/** The system/cron secret for the communication dispatch trigger (never logged). An empty env var is
 *  treated as unset (so a blank value never silently authorizes). */
export function communicationSystemSecret(): string | null {
  return process.env.PIERRE_COMMUNICATION_SYSTEM_SECRET || process.env.CRON_SECRET || null;
}

function presentedSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return req.headers.get("x-pierre-system-secret");
}

/** Constant-time verification of the system secret. Missing/empty/mismatched → false. */
export function verifyCommunicationSystemRequest(req: Request, secret: string): boolean {
  const provided = presentedSecret(req);
  if (!provided || !secret) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

/** Resolve a system actor context for a tenant: the tenant's owner (a real, FK-valid actor). */
export async function resolveSystemTenantContext(db: SqlExecutor, companyId: string): Promise<TenantContext> {
  const owner = (await db.query<{ user_id: string }>(
    `select user_id from pierre_rt_members where company_id=$1 and (status is null or status='active') and role in ('owner','admin') order by case role when 'owner' then 0 else 1 end, created_at asc limit 1`,
    [companyId])).rows[0];
  if (!owner) throw new Error("no owner membership for the tenant");
  return resolveTenantContext(db, { user_id: owner.user_id, company_id: companyId });
}
