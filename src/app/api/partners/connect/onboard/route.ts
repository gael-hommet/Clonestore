// POST /api/partners/connect/onboard — crée/relie le compte Stripe Connect du cabinet et
// retourne un lien d'onboarding hébergé. TEST MODE. Le cabinet n'est jamais activé
// financièrement tant que account.updated ne confirme pas payouts_enabled.

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { getStripe } from "@/lib/stripe";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { ensureConnectedAccount, createOnboardingLink, defaultConnectDeps } from "@/lib/partner-program/server/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, code: "STRIPE_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
  }
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  try {
    const deps = defaultConnectDeps(getStripe());
    const ensured = await withService(db, (tx) => ensureConnectedAccount(tx, deps, auth.partner.id));
    if (!ensured.ok) return NextResponse.json({ ok: false, error: ensured.error }, { status: 422, headers: NO_STORE });

    const base = getBaseUrl();
    const link = await createOnboardingLink(deps, ensured.accountId, {
      refreshUrl: new URL("/partenaires/espace?onboarding=refresh", base).toString(),
      returnUrl: new URL("/partenaires/espace?onboarding=done", base).toString(),
    });
    return NextResponse.json({ ok: true, url: link.url }, { headers: NO_STORE });
  } catch (e) {
    console.error("[partners/connect] error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, code: "CONNECT_ERROR" }, { status: 500, headers: NO_STORE });
  }
}
