// src/app/agents/pierre/use/secure/[token]/route.ts
// PHASE 8.4-R1.10 — resolve a secure communication link. Requires an authenticated session whose
// active tenant matches the link's tenant (and whose user matches the named recipient). The token is
// opaque; no object_key / bucket / internal URL is ever exposed. On success the user is redirected to
// the in-tenant object view; every refusal is fail-closed with a redacted status.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { resolveDefaultCompanyId } from "@/lib/pierre/v1/tenant-context";
import { resolveSecureLinkAccess } from "@/lib/pierre/v1/communication-secure-access";
import { SecureLinkError } from "@/lib/pierre/v1/communication-secure-links";
import { secureLinkSecret } from "@/lib/pierre/v1/communication-provider-config";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  unauthenticated: 401, tenant_mismatch: 403, recipient_mismatch: 403, bad_object_type: 400,
  not_found: 404, expired: 410, bad_signature: 401, malformed: 400, bad_payload: 400, unconfigured: 503,
};

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const secret = secureLinkSecret();
    if (!secret) return NextResponse.json({ error: { code: "unconfigured", message: "secure links not configured" } }, { status: 503 });
    const { token } = await ctx.params;

    const supa = supabaseServer();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth.user?.id ?? null;
    const db = await getRuntimeDb();
    const headerCompany = req.headers.get("x-pierre-company");
    const companyId = headerCompany ?? (userId ? await resolveDefaultCompanyId(db, userId) : null);

    const access = await resolveSecureLinkAccess(db, { token, secret, sessionUserId: userId, sessionCompanyId: companyId });
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL(access.view_path, origin), { status: 302 });
  } catch (err) {
    if (err instanceof SecureLinkError) {
      const status = STATUS[err.code] ?? 403;
      return NextResponse.json({ error: { code: err.code, message: "secure link refused" } }, { status });
    }
    return NextResponse.json({ error: { code: "internal", message: "secure link resolution failed" } }, { status: 500 });
  }
}
