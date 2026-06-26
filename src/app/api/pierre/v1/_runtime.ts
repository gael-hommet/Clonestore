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
import { isAccountMigrated } from "@/lib/pierre/v1/backfill";
import { Errors, toRuntimeError, errorBody } from "@/lib/pierre/v1/errors";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const ACTIVE_COMPANY_HEADER = "x-pierre-company";

export async function withTenant(
  req: Request,
  handler: (db: SqlExecutor, ctx: TenantContext) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const supa = supabaseServer();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth.user?.id ?? null;
    const db = await getRuntimeDb();
    // Active company: explicit header, else the user's single membership (default).
    let companyId: string | null = req.headers.get(ACTIVE_COMPANY_HEADER);
    if (!companyId) {
      companyId = await resolveDefaultCompanyId(db, userId);
      // No membership at all → the account hasn't been backfilled yet. Only THIS
      // distinct code may permit a (gated) legacy fallback in the cockpit.
      if (!companyId && userId && !(await isAccountMigrated(db, userId))) throw Errors.tenantNotMigrated();
    }
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
    const supa = supabaseServer();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth.user?.id ?? null;
    if (!userId) throw Errors.unauthenticated();
    const u = auth.user as { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
    const identity: AuthIdentity = {
      user_id: userId,
      email: u?.email ?? null,
      email_confirmed_at: u?.email_confirmed_at ?? u?.confirmed_at ?? null,
    };
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
