// GET|POST /api/cron/partner-payouts — job mensuel de versements partenaires.
// Secret comparé en temps constant (fail-closed). dry-run par défaut (flag PARTNER_PAYOUT_DRY_RUN).
// Aucun transfert réel tant que le flag n'est pas explicitement "false" ET la production autorisée.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStripe } from "@/lib/stripe";
import { getPartnerDb } from "@/lib/partner-program/server/runtime";
import { runMonthlyPayouts, defaultPayoutDeps } from "@/lib/partner-program/server/payouts";
import { isPartnerPayoutsEnabled } from "@/lib/partner-program/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronSecret(): string | null {
  return process.env.PARTNER_PAYOUT_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
}

function authorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false; // fail-closed
  const provided =
    req.headers.get("x-cron-secret") ??
    (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null);
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!cronSecret()) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isPartnerPayoutsEnabled()) return NextResponse.json({ ok: true, skipped: "payouts_disabled" });

  const db = await getPartnerDb();
  const deps = defaultPayoutDeps(process.env.STRIPE_SECRET_KEY ? getStripe() : ({} as never));
  const result = await runMonthlyPayouts(db, deps, { now: new Date() });
  return NextResponse.json({ ok: true, result });
}

export const GET = run;
export const POST = run;
