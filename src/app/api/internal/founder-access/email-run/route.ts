// Phase E.6 — POST /api/internal/founder-access/email-run (admin + porte gouvernée).
// Tick manuel du worker email depuis le cockpit. Aucun secret cron requis (gated par
// la porte propriétaire + session + allowlist). En prod sans Resend : 503 explicite,
// jamais de faux envoi. Audité.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { runEmailTick } from "@/lib/founder-access/email-worker";
import { resolveFounderEmailProvider, isFounderEmailConfigured } from "@/lib/founder-access/email-provider";
import { recordAdminAudit } from "@/lib/founder-access/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  if (process.env.NODE_ENV === "production" && !isFounderEmailConfigured()) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
  const db = await getRuntimeDb();
  let provider;
  try { provider = resolveFounderEmailProvider(); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "provider" }, { status: 503 }); }

  const result = await runEmailTick(db, provider, { workerId: `cockpit-${Date.now()}` });
  await recordAdminAudit(db, { actor_email: auth.email, action: "email.tick", result: "ok", context_safe: { sent: result.sent, dead: result.dead } });
  return NextResponse.json({ ok: true, mode: provider.mode, ...result }, { headers: { "cache-control": "private, no-store" } });
}
