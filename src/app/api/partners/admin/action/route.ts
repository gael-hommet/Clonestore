// POST /api/partners/admin/action — console admin CloneStore (actions auditées).
// Gate : resolveFounderAdmin (allowlist email + session). Chaque action exige une `reason`.
// Aucun bouton « modifier le solde » : toute correction financière passe par une écriture
// compensatoire (reversal), jamais une mutation directe.

import { NextResponse } from "next/server";
import { resolveFounderAdmin, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { readJsonBounded } from "@/lib/founder-access/request-utils";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { markApplicationUnderReview, acceptApplication, rejectApplication } from "@/lib/partner-program/server/applications";
import { validateIntroduction, rejectIntroduction } from "@/lib/partner-program/server/introductions";
import { suspendPartner, reinstatePartner, activatePartner } from "@/lib/partner-program/server/partners";
import { setProgramSettings } from "@/lib/partner-program/server/settings";
import { getStripe } from "@/lib/stripe";
import { runMonthlyPayouts, defaultPayoutDeps } from "@/lib/partner-program/server/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: Request) {
  const admin = await resolveFounderAdmin();
  if (!admin.ok) return founderAdminDeniedResponse(admin.reason);
  const actor = admin.email;

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });

  const action = str(body.action);
  const reason = str(body.reason);
  const id = str(body.id);
  // Toute action sensible exige une justification.
  if (!action) return NextResponse.json({ ok: false, error: "action_required" }, { status: 400, headers: NO_STORE });
  const needsReason = action !== "run_payout_dryrun";
  if (needsReason && !reason) return NextResponse.json({ ok: false, error: "reason_required" }, { status: 422, headers: NO_STORE });

  const db = await getPartnerDb();
  try {
    switch (action) {
      case "review_application":
        if (!id) return badId();
        await withService(db, (tx) => markApplicationUnderReview(tx, id, actor));
        return ok();
      case "accept_application": {
        if (!id) return badId();
        const res = await withService(db, (tx) => acceptApplication(tx, id, actor, reason!));
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422, headers: NO_STORE });
        // Le code de recommandation en clair n'est retourné qu'ici, une seule fois.
        return NextResponse.json({ ok: true, partnerId: res.partnerId, publicSlug: res.publicSlug, referralCode: res.referralCode }, { headers: NO_STORE });
      }
      case "reject_application": {
        if (!id) return badId();
        const res = await withService(db, (tx) => rejectApplication(tx, id, actor, reason!));
        return res.ok ? ok() : NextResponse.json({ ok: false, error: res.error }, { status: 422, headers: NO_STORE });
      }
      case "validate_introduction": {
        if (!id) return badId();
        const res = await withService(db, (tx) => validateIntroduction(tx, id, actor, reason!));
        return res.ok ? ok() : NextResponse.json({ ok: false, error: res.error }, { status: 409, headers: NO_STORE });
      }
      case "reject_introduction": {
        if (!id) return badId();
        const res = await withService(db, (tx) => rejectIntroduction(tx, id, actor, reason!));
        return res.ok ? ok() : NextResponse.json({ ok: false, error: res.error }, { status: 422, headers: NO_STORE });
      }
      case "suspend_partner":
        if (!id) return badId();
        await withService(db, (tx) => suspendPartner(tx, id, actor, reason!));
        return ok();
      case "reinstate_partner":
        if (!id) return badId();
        await withService(db, (tx) => reinstatePartner(tx, id, actor, reason!));
        return ok();
      case "activate_partner": {
        if (!id) return badId();
        const res = await withService(db, (tx) => activatePartner(tx, id, actor, reason!));
        return res.ok ? ok() : NextResponse.json({ ok: false, error: res.error }, { status: 422, headers: NO_STORE });
      }
      case "resolve_risk_flag": {
        if (!id) return badId();
        const status = str(body.status) === "confirmed" ? "confirmed" : str(body.status) === "dismissed" ? "dismissed" : "reviewed_ok";
        await withService(db, (tx) => tx.query(`update clonestore_pp_risk_flags set status=$2, reviewed_by=$3, reviewed_at=now(), review_reason=$4 where id=$1`, [id, status, actor, reason!]));
        return ok();
      }
      case "update_settings": {
        const patch = (body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>;
        const next = await withService(db, (tx) => setProgramSettings(tx, actor, patch));
        return NextResponse.json({ ok: true, settings: next }, { headers: NO_STORE });
      }
      case "run_payout_dryrun": {
        // Toujours dry-run depuis la console : aucun transfert réel. Aucune clé live touchée.
        const deps = defaultPayoutDeps(process.env.STRIPE_SECRET_KEY ? getStripe() : ({} as never));
        const now = new Date();
        const result = await runMonthlyPayouts(db, deps, { now, dryRunOverride: true });
        return NextResponse.json({ ok: true, result }, { headers: NO_STORE });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400, headers: NO_STORE });
    }
  } catch (e) {
    console.error("[partners/admin] error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_STORE });
  }
}

function ok() { return NextResponse.json({ ok: true }, { headers: NO_STORE }); }
function badId() { return NextResponse.json({ ok: false, error: "id_required" }, { status: 400, headers: NO_STORE }); }
