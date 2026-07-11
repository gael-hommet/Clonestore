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
import { suspendPartner, reinstatePartner, activatePartner, tryAutoActivate } from "@/lib/partner-program/server/partners";
import { setProgramSettings } from "@/lib/partner-program/server/settings";
import { backfillLegacyApplications } from "@/lib/partner-program/server/backfill";
import { getStripe } from "@/lib/stripe";
import { runMonthlyPayouts, defaultPayoutDeps } from "@/lib/partner-program/server/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Messages EXPLICITES — l'admin ne doit jamais lire « Action refusée ».
 * Chaque code d'erreur métier a une explication actionnable.
 */
const ERROR_MESSAGES: Record<string, string> = {
  contract_not_accepted: "Le cabinet n’a pas encore accepté les conditions du programme.",
  stripe_onboarding_incomplete: "L’onboarding Stripe Connect n’est pas terminé (versements non activés).",
  blocking_risk_flag: "Un signal de risque bloquant est ouvert : résolvez-le d’abord.",
  already_active: "Ce cabinet est déjà actif.",
  already_provisioned: "Cette candidature a déjà donné lieu à un cabinet.",
  partner_suspended: "Ce cabinet est suspendu ou archivé.",
  partner_not_found: "Cabinet introuvable.",
  application_not_found: "Candidature introuvable.",
  application_closed: "Cette candidature est refusée ou retirée.",
  not_reviewable: "Cette candidature n’est pas dans un état permettant cette action.",
  not_submittable: "Cette introduction n’est pas dans un état permettant cette action.",
  company_already_protected: "Cette entreprise est déjà protégée par un autre cabinet.",
  not_found: "Élément introuvable.",
  program_closed: "Le programme est actuellement fermé.",
  reason_required: "Une justification est obligatoire pour cette action.",
  id_required: "L’identifiant de l’élément est requis.",
  unknown_action: "Action inconnue.",
  server_error: "Erreur serveur : l’action n’a pas pu être appliquée.",
};

function explain(code: string): string {
  return ERROR_MESSAGES[code] ?? "L’action n’a pas pu être appliquée.";
}

function deny(status: number, code: string) {
  return NextResponse.json({ ok: false, error: code, message: explain(code) }, { status, headers: NO_STORE });
}

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
  if (!action) return deny(400, "unknown_action");
  const needsReason = action !== "run_payout_dryrun";
  if (needsReason && !reason) return deny(422, "reason_required");

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
        if (!res.ok) return deny(422, res.error);
        // Le code de recommandation en clair n'est retourné qu'ici, une seule fois.
        return NextResponse.json({ ok: true, partnerId: res.partnerId, publicSlug: res.publicSlug, referralCode: res.referralCode }, { headers: NO_STORE });
      }
      case "reject_application": {
        if (!id) return badId();
        const res = await withService(db, (tx) => rejectApplication(tx, id, actor, reason!));
        return res.ok ? ok() : deny(422, res.error ?? "server_error");
      }
      case "validate_introduction": {
        if (!id) return badId();
        const res = await withService(db, (tx) => validateIntroduction(tx, id, actor, reason!));
        return res.ok ? ok() : deny(409, res.error ?? "server_error");
      }
      case "reject_introduction": {
        if (!id) return badId();
        const res = await withService(db, (tx) => rejectIntroduction(tx, id, actor, reason!));
        return res.ok ? ok() : deny(422, res.error ?? "server_error");
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
        return res.ok ? ok() : deny(422, res.error ?? "server_error");
      }
      case "resolve_risk_flag": {
        if (!id) return badId();
        const status = str(body.status) === "confirmed" ? "confirmed" : str(body.status) === "dismissed" ? "dismissed" : "reviewed_ok";
        const activated = await withService(db, async (tx) => {
          const row = await tx.query<{ partner_id: string | null }>(
            `update clonestore_pp_risk_flags set status=$2, reviewed_by=$3, reviewed_at=now(), review_reason=$4
             where id=$1 returning partner_id`,
            [id, status, actor, reason!],
          );
          const partnerId = row.rows[0]?.partner_id;
          // Le signal levé, l'activation AUTOMATIQUE reprend son cours (aucun clic supplémentaire).
          if (partnerId && status !== "confirmed") {
            const r = await tryAutoActivate(tx, partnerId);
            return r.activated;
          }
          return false;
        });
        return NextResponse.json({ ok: true, activated }, { headers: NO_STORE });
      }
      case "update_settings": {
        const patch = (body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>;
        const next = await withService(db, (tx) => setProgramSettings(tx, actor, patch));
        return NextResponse.json({ ok: true, settings: next }, { headers: NO_STORE });
      }
      case "backfill_applications": {
        // Reprise des dossiers hérités (`received` / `under_review`) vers le parcours
        // automatique. SIMULATION par défaut : il faut `apply: true` pour écrire.
        const dryRun = body.apply !== true;
        const report = await backfillLegacyApplications(db, withService, { dryRun, actor, limit: Number(body.limit) || undefined });
        return NextResponse.json({ ok: true, report }, { headers: NO_STORE });
      }
      case "run_payout_dryrun": {
        // Toujours dry-run depuis la console : aucun transfert réel. Aucune clé live touchée.
        const deps = defaultPayoutDeps(process.env.STRIPE_SECRET_KEY ? getStripe() : ({} as never));
        const now = new Date();
        const result = await runMonthlyPayouts(db, deps, { now, dryRunOverride: true });
        return NextResponse.json({ ok: true, result }, { headers: NO_STORE });
      }
      default:
        return deny(400, "unknown_action");
    }
  } catch (e) {
    console.error("[partners/admin] error:", e instanceof Error ? e.message : "unknown");
    return deny(500, "server_error");
  }
}

function ok() { return NextResponse.json({ ok: true }, { headers: NO_STORE }); }
function badId() { return deny(400, "id_required"); }
