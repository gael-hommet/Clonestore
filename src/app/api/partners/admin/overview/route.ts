// GET /api/partners/admin/overview — données de la console admin (gate founder).

import { NextResponse } from "next/server";
import { resolveFounderAdmin, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function GET() {
  const admin = await resolveFounderAdmin();
  if (!admin.ok) return founderAdminDeniedResponse(admin.reason);

  const db = await getPartnerDb();
  const data = await withService(db, async (tx) => {
    const applications = (await tx.query(`select id, cabinet_name as "cabinetName", email, country, cabinet_type as "cabinetType", status, created_at as "createdAt" from clonestore_pp_applications order by created_at desc limit 100`)).rows;
    const partners = (await tx.query(`select id, display_name as "displayName", public_slug as "publicSlug", status, stripe_onboarding_status as "stripeOnboardingStatus", payouts_enabled as "payoutsEnabled", activated_at as "activatedAt" from clonestore_pp_partners order by created_at desc limit 200`)).rows;
    const introductions = (await tx.query(`select id, partner_id as "partnerId", company_name as "companyName", status, submitted_at as "submittedAt" from clonestore_pp_introductions where status='submitted' order by submitted_at asc limit 100`)).rows;
    const riskFlags = (await tx.query(`select id, partner_id as "partnerId", kind, severity, explanation, status, created_at as "createdAt" from clonestore_pp_risk_flags where status='open' order by created_at desc limit 100`)).rows;
    const payoutRuns = (await tx.query(`select id, run_key as "runKey", dry_run as "dryRun", status, partners_considered as "partnersConsidered", transfers_created as "transfersCreated", total_amount_minor as "totalAmountMinor", started_at as "startedAt" from clonestore_pp_payout_runs order by started_at desc limit 20`)).rows;
    const ledger = (await tx.query<{ gross: string; reversals: string; paid: string; frozen: string }>(
      `select
         coalesce(sum(commission_minor) filter (where entry_type='commission'),0) as gross,
         coalesce(sum(commission_minor) filter (where entry_type='reversal'),0) as reversals,
         coalesce(sum(commission_minor) filter (where status='paid'),0) as paid,
         coalesce(sum(commission_minor) filter (where status='frozen'),0) as frozen
       from clonestore_pp_commission_entries`,
    )).rows[0];
    return { applications, partners, introductions, riskFlags, payoutRuns, ledger };
  });

  return NextResponse.json({ ok: true, ...data }, { headers: NO_STORE });
}
