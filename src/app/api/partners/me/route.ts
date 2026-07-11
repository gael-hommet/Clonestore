// GET /api/partners/me — espace cabinet (lecture RLS-isolée).
// Aucun cabinet ne voit les données d'un autre : lecture sous withPartner (RLS forcée).
// Les introductions sont PAGINÉES (aucun plafond métier, aucun chargement global).

import { NextResponse } from "next/server";
import { getPartnerDb, withService, withPartner } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { getPartnerOverview, listPartnerCommissions } from "@/lib/partner-program/server/summary";
import { listIntroductionsPaged, clampPaging } from "@/lib/partner-program/server/introductions";
import { getShareableCode, hasBlockingRiskFlag } from "@/lib/partner-program/server/partners";
import { remainingOnboardingSteps } from "@/lib/partner-program/onboarding-rules";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function GET(req: Request) {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const p = auth.partner;
  const url = new URL(req.url);
  const paging = clampPaging(Number(url.searchParams.get("limit") ?? 25), Number(url.searchParams.get("offset") ?? 0));
  const statusFilter = url.searchParams.get("status");

  const blocking = await withService(db, (tx) => hasBlockingRiskFlag(tx, p.id));

  const [overview, commissions, introductions, code, stats] = await withPartner(db, p.id, async (tx) => {
    const ov = await getPartnerOverview(tx, p.id);
    const co = await listPartnerCommissions(tx, p.id, 100);
    const intro = await listIntroductionsPaged(tx, p.id, { limit: paging.limit, offset: paging.offset, status: statusFilter });
    const c = await getShareableCode(tx, p.id);
    // Statistiques du lien : clics (touches) + prospects rattachés.
    const s = await tx.query<{ clicks: number; attributed: number; lost: number }>(
      `select
         (select count(*)::int from clonestore_pp_referral_touches where partner_id = $1) as clicks,
         (select count(*)::int from clonestore_pp_attributions where partner_id = $1 and status in ('pending','locked')) as attributed,
         (select count(*)::int from clonestore_pp_customers where partner_id = $1 and status = 'canceled') as lost`,
      [p.id],
    );
    return [ov, co, intro, c, s.rows[0]] as const;
  });

  // Lien public propre (redirige vers la route technique qui enregistre le touch serveur).
  const link = `${getBaseUrl()}/partenaires/r/${encodeURIComponent(p.public_slug)}`;

  // Étapes restantes explicites — jamais un message vague.
  const remaining = remainingOnboardingSteps({
    status: p.status,
    contractAccepted: Boolean(p.contract_accepted_at),
    onboardingStatus: p.stripe_onboarding_status,
    payoutsEnabled: p.payouts_enabled,
    hasBlockingRiskFlag: blocking,
  });

  return NextResponse.json({
    ok: true,
    partner: {
      displayName: p.display_name, status: p.status, publicSlug: p.public_slug,
      commissionRateBps: p.commission_rate_bps, payoutThresholdMinor: p.payout_threshold_minor, currency: p.payout_currency,
      stripeOnboardingStatus: p.stripe_onboarding_status, payoutsEnabled: p.payouts_enabled,
      contractAccepted: Boolean(p.contract_accepted_at),
      underReview: blocking,
    },
    link,
    code: code ? { value: code.code, hint: code.hint, generation: code.generation, retrievable: code.code !== null } : null,
    overview,
    stats: {
      clicks: Number(stats?.clicks ?? 0),
      prospectsAttributed: Number(stats?.attributed ?? 0),
      clientsLost: Number(stats?.lost ?? 0),
    },
    commissions,
    introductions, // { items, total, limit, offset, hasMore } — aucun plafond
    onboardingSteps: remaining,
    actionsRequired: remaining,
  }, { headers: NO_STORE });
}
