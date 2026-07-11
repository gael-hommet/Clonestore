// GET /api/partners/me — vue d'ensemble de l'espace cabinet (lecture RLS-isolée).
// Aucun cabinet ne voit les données d'un autre : lecture sous withPartner (RLS forcée).

import { NextResponse } from "next/server";
import { getPartnerDb, withService, withPartner } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { getPartnerOverview, listPartnerCommissions } from "@/lib/partner-program/server/summary";
import { listIntroductions } from "@/lib/partner-program/server/introductions";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function GET() {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const p = auth.partner;
  const [overview, commissions, introductions, codeHint] = await withPartner(db, p.id, async (tx) => {
    const ov = await getPartnerOverview(tx, p.id);
    const co = await listPartnerCommissions(tx, p.id, 100);
    const intro = await listIntroductions(tx, p.id);
    const hint = await tx.query<{ code_hint: string; generation: number }>(
      `select code_hint, generation from clonestore_pp_partner_codes where partner_id=$1 and status='active' limit 1`,
      [p.id],
    );
    return [ov, co, intro, hint.rows[0] ?? null] as const;
  });

  const link = `${getBaseUrl()}/api/partners/click?partner=${encodeURIComponent(p.public_slug)}`;

  // Actions requises (jamais de commission annoncée acquise avant l'heure).
  const actionsRequired: string[] = [];
  if (p.status === "contract_pending") actionsRequired.push("accept_contract");
  if (p.stripe_onboarding_status !== "complete" || !p.payouts_enabled) actionsRequired.push("complete_stripe_onboarding");

  return NextResponse.json({
    ok: true,
    partner: {
      displayName: p.display_name, status: p.status, publicSlug: p.public_slug,
      commissionRateBps: p.commission_rate_bps, payoutThresholdMinor: p.payout_threshold_minor, currency: p.payout_currency,
      stripeOnboardingStatus: p.stripe_onboarding_status, payoutsEnabled: p.payouts_enabled,
      contractAccepted: Boolean(p.contract_accepted_at),
    },
    link,
    codeHint: codeHint ? { last4: codeHint.code_hint, generation: codeHint.generation } : null,
    overview,
    commissions,
    introductions,
    actionsRequired,
  }, { headers: NO_STORE });
}
