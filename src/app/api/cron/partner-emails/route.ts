// GET|POST /api/cron/partner-emails — traite l'outbox d'emails partenaires.
// Secret timing-safe, fail-closed. Réutilise le provider Resend partagé.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { processPartnerEmailOutbox } from "@/lib/partner-program/server/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronSecret(): string | null {
  return process.env.PARTNER_EMAIL_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
}
function authorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const provided = req.headers.get("x-cron-secret") ?? (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null);
  if (!provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!cronSecret()) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = await getPartnerDb();
  const result = await processPartnerEmailOutbox(db, withService, 50);
  return NextResponse.json({ ok: true, result });
}

export const GET = run;
export const POST = run;
