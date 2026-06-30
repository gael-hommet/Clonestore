// src/lib/pierre/v1/entitlements.ts
// PHASE 8.6 — per-company PRODUCT ENTITLEMENT reads + the central resolveProductAccess() gate.
//
// This is the SINGLE authority every private Pierre surface must consult. It is NOT enough to check
// `user != null`, `company exists`, or a role: access is the product of (authenticated) × (active
// membership) × (entitlement state) × (onboarding state). The entitlement TRUTH is written only by the
// billing-webhook / activation-worker roles via governed functions (see commercial-events.ts,
// customer-activation.ts); the application role can only READ it.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";

export const DEFAULT_PRODUCT_KEY = "pierre";

export type EntitlementStatus = "pending" | "active" | "grace" | "suspended" | "cancelled" | "expired";

export type EntitlementRow = {
  id: string;
  company_id: string;
  product_key: string;
  status: EntitlementStatus;
  source_type: string;
  source_reference: string | null;
  starts_at: string | null;
  grace_until: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  version: number;
};

/** The product-access decision a private route/page acts on. */
export type ProductAccessDecision =
  | "allowed"            // full access subject to role permissions
  | "onboarding_required" // entitled but onboarding not yet complete
  | "grace"              // payment lapsed; existing access maintained, new costly actions limited
  | "read_only"          // suspended/cancelled; consultation + export only
  | "suspended"          // alias of read_only when the cause is a commercial suspension
  | "denied";            // no entitlement / not entitled

export type ProductAccess = {
  decision: ProductAccessDecision;
  product_key: string;
  entitlement_status: EntitlementStatus | null;
  onboarding_status: string | null;
  /** May the tenant run NEW costly actions (new missions, invitations, signatures)? */
  can_use: boolean;
  /** Read/export remains available even when can_use is false (suspended/cancelled). */
  can_read: boolean;
  reason: string;
};

/** The LIVE (non-terminal) entitlement for a company+product, if any. */
export async function getEntitlement(
  db: SqlExecutor, companyId: string, productKey = DEFAULT_PRODUCT_KEY,
): Promise<EntitlementRow | null> {
  const { rows } = await db.query<EntitlementRow>(
    `select id, company_id, product_key, status, source_type, source_reference,
            starts_at, grace_until, suspended_at, cancelled_at, expires_at, version
       from pierre_rt_product_entitlements
      where company_id = $1 and product_key = $2
      order by case status when 'active' then 0 when 'grace' then 1 when 'suspended' then 2
                            when 'pending' then 3 when 'cancelled' then 4 else 5 end asc,
               updated_at desc
      limit 1`,
    [companyId, productKey],
  );
  return rows[0] ?? null;
}

/** The current onboarding session row for a company+product, if any. */
export async function getOnboardingSession(
  db: SqlExecutor, companyId: string, productKey = DEFAULT_PRODUCT_KEY,
): Promise<{ id: string; status: string; progress_percent: number; current_step_key: string | null } | null> {
  const { rows } = await db.query<{ id: string; status: string; progress_percent: number; current_step_key: string | null }>(
    `select id, status, progress_percent, current_step_key
       from pierre_rt_onboarding_sessions
      where company_id = $1 and product_key = $2
      order by created_at desc limit 1`,
    [companyId, productKey],
  );
  return rows[0] ?? null;
}

/**
 * The governed product-access gate. Pure decision over server-fetched state. Every private Pierre route
 * MUST gate on this — masking a button in the UI is never sufficient.
 *
 * The ctx is assumed to come from resolveTenantContext (which already proved an ACTIVE membership and a
 * non-suspended company); this layer adds the commercial + onboarding dimension that membership alone
 * does not carry.
 */
export async function resolveProductAccess(
  db: SqlExecutor, ctx: TenantContext, productKey = DEFAULT_PRODUCT_KEY,
): Promise<ProductAccess> {
  const ent = await getEntitlement(db, ctx.company_id, productKey);
  const session = await getOnboardingSession(db, ctx.company_id, productKey);
  const onboarding_status = session?.status ?? null;

  if (!ent || ent.status === "pending") {
    return {
      decision: "denied", product_key: productKey, entitlement_status: ent?.status ?? null,
      onboarding_status, can_use: false, can_read: false,
      reason: ent ? "entitlement_pending" : "no_entitlement",
    };
  }

  if (ent.status === "cancelled" || ent.status === "expired") {
    return {
      decision: "read_only", product_key: productKey, entitlement_status: ent.status,
      onboarding_status, can_use: false, can_read: true, reason: `entitlement_${ent.status}`,
    };
  }

  if (ent.status === "suspended") {
    return {
      decision: "suspended", product_key: productKey, entitlement_status: ent.status,
      onboarding_status, can_use: false, can_read: true, reason: "entitlement_suspended",
    };
  }

  // active or grace: onboarding must be complete before full use.
  if (onboarding_status !== "completed") {
    return {
      decision: "onboarding_required", product_key: productKey, entitlement_status: ent.status,
      onboarding_status, can_use: false, can_read: true, reason: "onboarding_incomplete",
    };
  }

  if (ent.status === "grace") {
    return {
      decision: "grace", product_key: productKey, entitlement_status: ent.status,
      onboarding_status, can_use: true, can_read: true, reason: "entitlement_grace",
    };
  }

  return {
    decision: "allowed", product_key: productKey, entitlement_status: ent.status,
    onboarding_status, can_use: true, can_read: true, reason: "active",
  };
}
