// src/lib/pierre/v1/company-access.ts
// PHASE 8.6 — company ACCESS lifecycle: member status transitions + ownership transfer (governed), and
// re-exports of the already-existing active-company resolution/switch helpers (spec §27 — reuse, do not
// duplicate). Truth lives in SECURITY DEFINER functions enforcing last-owner protection; the caller binds
// the app role + app.current_company.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import { Errors } from "./errors";

// Reuse the existing, proven active-company helpers rather than re-implement them.
export { resolveActiveCompany, switchCompany, listCompaniesForUser } from "./members";

export type MemberStatus = "active" | "suspended" | "removed" | "left";

/** Governed member-status transition (suspend / reactivate / revoke). Last-owner protected. */
export async function setMemberStatus(
  db: SqlExecutor, ctx: TenantContext, input: { membership_id: string; status: MemberStatus; reason?: string | null },
): Promise<string> {
  requirePermission(ctx, "tenancy.admin");
  const { rows } = await db.query<{ result: string }>(
    `select pierre_rt_set_member_status($1,$2,$3,$4,$5) as result`,
    [ctx.company_id, input.membership_id, input.status, ctx.user_id, input.reason ?? null],
  );
  return rows[0].result;
}

/** A member leaving voluntarily (self). The last active owner cannot leave. */
export async function leaveCompany(db: SqlExecutor, ctx: TenantContext): Promise<string> {
  const { rows } = await db.query<{ result: string }>(
    `select pierre_rt_set_member_status($1,$2,'left',$3,'self_departure') as result`,
    [ctx.company_id, ctx.membership_id, ctx.user_id],
  );
  return rows[0].result;
}

/**
 * Transfer ownership from the current owner (the actor) to an active member. Atomic; never leaves the
 * company without an owner; the previous owner is demoted to admin unless keep_previous_owner is set.
 */
export async function transferCompanyOwnership(
  db: SqlExecutor, ctx: TenantContext, input: { to_membership_id: string; keep_previous_owner?: boolean },
): Promise<string> {
  if (ctx.role !== "owner") throw Errors.forbidden("Only the current owner can transfer ownership");
  requirePermission(ctx, "tenancy.admin");
  const { rows } = await db.query<{ result: string }>(
    `select pierre_rt_transfer_company_ownership($1,$2,$3,$4,$5) as result`,
    [ctx.company_id, ctx.membership_id, input.to_membership_id, ctx.user_id, !input.keep_previous_owner],
  );
  return rows[0].result;
}

export type AccessEventRow = {
  id: string; company_id: string; actor_user_id: string | null; target_user_id: string | null;
  membership_id: string | null; event_kind: string; previous_state: string | null; new_state: string | null;
  reason_code: string | null; created_at: string;
};

/** The append-only access-event audit for the active tenant. */
export async function listCompanyAccessEvents(db: SqlExecutor, ctx: TenantContext, limit = 100): Promise<AccessEventRow[]> {
  const { rows } = await db.query<AccessEventRow>(
    `select id, company_id, actor_user_id, target_user_id, membership_id, event_kind, previous_state, new_state, reason_code, created_at
       from pierre_rt_company_access_events where company_id=$1 order by created_at desc, id desc limit $2`,
    [ctx.company_id, limit],
  );
  return rows;
}
