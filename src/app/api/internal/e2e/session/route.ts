// src/app/api/internal/e2e/session/route.ts
// PHASE 8.6 — TEST-ONLY E2E session: signs the identity cookie (id + verified email only). Any injected
// role/company/entitlement/permission is ignored. Forbidden outside PIERRE_E2E_TEST_MODE / in production.
import { NextResponse } from "next/server";
import { guardE2E } from "@/lib/pierre/v1/e2e-control-plane";
import { signE2EIdentity, E2E_SESSION_COOKIE } from "@/lib/pierre/v1/e2e-test-identity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.user_id !== "string" || typeof body.email !== "string") {
    return NextResponse.json({ error: { code: "validation_failed", message: "user_id + email required" } }, { status: 422 });
  }
  // Only id + verified email survive — never a client-supplied role/company/entitlement/permission.
  const token = signE2EIdentity({ user_id: body.user_id, email: body.email, email_verified: true });
  const res = NextResponse.json({ user_id: body.user_id, email: body.email, email_verified: true });
  res.cookies.set(E2E_SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600, secure: false });
  return res;
}
