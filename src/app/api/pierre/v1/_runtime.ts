// src/app/api/pierre/v1/_runtime.ts
// PHASE 8.1 — Pierre Production Runtime Core — Next.js route helper.
//
// Resolves the authenticated user (Supabase) + active company header into a
// canonical TenantContext (server-side membership check — cross-tenant denied),
// runs a handler, and returns a stable JSON response with redacted errors.
// No stack traces to the client; no service-role key to the client.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { resolveTenantContext, resolveDefaultCompanyId, type TenantContext } from "@/lib/pierre/v1/tenant-context";
import { resolveActiveCompany } from "@/lib/pierre/v1/members";
import { resolveProductAccess, type ProductAccess } from "@/lib/pierre/v1/entitlements";
import { isAccountMigrated } from "@/lib/pierre/v1/backfill";
import { Errors, toRuntimeError, errorBody } from "@/lib/pierre/v1/errors";
import { isE2EModeEnabled, readE2EIdentityFromRequest } from "@/lib/pierre/v1/e2e-test-identity";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const ACTIVE_COMPANY_HEADER = "x-pierre-company";

/** Resolve the active company server-side: explicit (verified) header, else the persisted active-company
 *  preference (pierre_rt_user_company_prefs) validated against active memberships, else single membership. */
async function resolveRequestCompany(db: SqlExecutor, req: Request, userId: string | null): Promise<string | null> {
  const header = req.headers.get(ACTIVE_COMPANY_HEADER);
  if (header) return header; // verified by resolveTenantContext (membership re-check)
  if (!userId) return null;
  // P8.6 — the active tenant comes from the governed preference path, not just "the single membership".
  const active = await resolveActiveCompany(db, userId);
  if (active) return active;
  return resolveDefaultCompanyId(db, userId);
}

export async function withTenant(
  req: Request,
  handler: (db: SqlExecutor, ctx: TenantContext) => Promise<unknown>
): Promise<NextResponse> {
  try {
    // Identity: in deterministic LOCAL E2E mode the signed test cookie is the identity boundary; otherwise
    // the real Supabase session. The cookie carries ONLY a user id — role/tenant/entitlement are always
    // resolved from the DB below.
    let userId: string | null = null;
    const e2e = isE2EModeEnabled() ? readE2EIdentityFromRequest(req) : null;
    if (e2e) userId = e2e.user_id;
    else userId = (await (await supabaseServer()).auth.getUser()).data.user?.id ?? null;
    const db = await getRuntimeDb();
    const companyId = await resolveRequestCompany(db, req, userId);
    // No membership at all → the account hasn't been backfilled yet. Only THIS
    // distinct code may permit a (gated) legacy fallback in the cockpit.
    if (!companyId && userId && !(await isAccountMigrated(db, userId))) throw Errors.tenantNotMigrated();
    const ctx = await resolveTenantContext(db, {
      user_id: userId,
      company_id: companyId,
      request_id: req.headers.get("x-request-id") ?? undefined,
    });
    const result = await handler(db, ctx);
    return NextResponse.json(result, { headers: { "x-request-id": ctx.request_id } });
  } catch (err) {
    const re = toRuntimeError(err);
    return NextResponse.json(errorBody(re), { status: re.status });
  }
}

/** Operation class a private route performs (drives the product-access policy). */
export type AccessRequirement = "read" | "onboarding" | "write_standard" | "write_costly" | "admin";

/** Decide whether a product-access decision permits an operation class (spec §9/§19). */
export function productAccessPermits(access: ProductAccess, requirement: AccessRequirement): boolean {
  // onboarding mutations are permitted precisely while onboarding is needed (and while fully active/grace),
  // but never under a suspended/cancelled/denied entitlement.
  if (requirement === "onboarding") return ["onboarding_required", "allowed", "grace"].includes(access.decision);
  switch (access.decision) {
    case "allowed": return true;                              // full access (subject to RBAC)
    case "grace": return requirement !== "write_costly";     // continuity, but no new costly actions
    case "onboarding_required": return requirement === "read"; // onboarding surfaces + reads only
    case "suspended":
    case "read_only": return requirement === "read";          // consultation/export only
    case "denied":
    default: return false;
  }
}

/**
 * Governed product gate: withTenant + resolveProductAccess + the §19 policy. A mutation under a
 * suspended/cancelled/onboarding tenant is BLOCKED at the API (never merely hidden in the UI). The
 * resolved access is handed to the handler so it can shape its response.
 */
export async function withProductAccess(
  req: Request,
  requirement: AccessRequirement,
  handler: (db: SqlExecutor, ctx: TenantContext, access: ProductAccess) => Promise<unknown>
): Promise<NextResponse> {
  return withTenant(req, async (db, ctx) => {
    const access = await resolveProductAccess(db, ctx);
    if (!productAccessPermits(access, requirement)) {
      throw Errors.guardBlocked(`Product access '${access.decision}' does not permit '${requirement}'`, {
        decision: access.decision, requirement, reason: access.reason,
      });
    }
    return handler(db, ctx, access);
  });
}

export type AuthIdentity = { user_id: string; email: string | null; email_confirmed_at: string | null };

/**
 * Identity-scoped handler (no active-company binding). For ops where the user is
 * not yet bound to one tenant: invitation acceptance, company listing/switching.
 * Authorization is per-operation (membership check or invitation token). The
 * verified email is surfaced so invitation acceptance can bind to it.
 */
export async function withUser(
  req: Request,
  handler: (db: SqlExecutor, identity: AuthIdentity) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const e2e = isE2EModeEnabled() ? readE2EIdentityFromRequest(req) : null;
    let identity: AuthIdentity;
    if (e2e) {
      identity = { user_id: e2e.user_id, email: e2e.email, email_confirmed_at: e2e.email_verified ? new Date().toISOString() : null };
    } else {
      const { data: auth } = await (await supabaseServer()).auth.getUser();
      const userId = auth.user?.id ?? null;
      if (!userId) throw Errors.unauthenticated();
      const u = auth.user as { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
      identity = { user_id: userId, email: u?.email ?? null, email_confirmed_at: u?.email_confirmed_at ?? u?.confirmed_at ?? null };
    }
    const db = await getRuntimeDb();
    const result = await handler(db, identity);
    return NextResponse.json(result);
  } catch (err) {
    const re = toRuntimeError(err);
    return NextResponse.json(errorBody(re), { status: re.status });
  }
}

/** Parse a JSON body defensively (empty body → {}). */
export async function jsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
