// GET|POST /api/cron/partner-payouts — versement mensuel des commissions partenaires.
//
// SÉCURITÉ :
//   • secret obligatoire, comparé en temps CONSTANT (fail-closed si absent) ;
//   • dry-run par défaut : tant que PARTNER_PAYOUT_DRY_RUN n'est pas explicitement "false",
//     le job ne fait qu'une PRÉVISUALISATION — aucune écriture, aucun appel Stripe, aucun e-mail ;
//   • verrou de période en base (run_key) : deux workers simultanés → un seul verse. Le dry-run
//     ne prend AUCUN verrou : une simulation ne doit jamais empêcher le vrai versement ;
//   • rejouable : relancer le cron ne crée jamais de second transfert (clé d'idempotence).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStripe } from "@/lib/stripe";
import { getPartnerDb } from "@/lib/partner-program/server/runtime";
import { runMonthlyPayouts, notifyAvailableCommissions, defaultPayoutDeps } from "@/lib/partner-program/server/payouts";
import { isPartnerPayoutsEnabled, isPartnerPayoutDryRun } from "@/lib/partner-program/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secrets acceptés. DEUX déclencheurs légitimes existent :
 *   • le cron natif Vercel, qui envoie `Authorization: Bearer $CRON_SECRET` ;
 *   • l'opérateur, qui déclenche une prévisualisation avec le secret dédié.
 * On accepte donc l'un OU l'autre — sinon poser un secret dédié casserait le cron planifié.
 */
function cronSecrets(): string[] {
  return [process.env.PARTNER_PAYOUT_CRON_SECRET, process.env.CRON_SECRET]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
}

/** Comparaison en temps CONSTANT, sans fuite de longueur exploitable. */
function matches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(req: Request): boolean {
  const secrets = cronSecrets();
  if (!secrets.length) return false; // fail-closed : aucun secret configuré → aucun déclenchement
  const provided =
    req.headers.get("x-cron-secret") ??
    (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null);
  if (!provided) return false;
  // Toutes les comparaisons sont évaluées : pas de court-circuit qui fuiterait par le timing.
  return secrets.reduce((ok, s) => matches(provided, s) || ok, false);
}

async function run(req: Request) {
  if (!cronSecrets().length) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isPartnerPayoutsEnabled()) return NextResponse.json({ ok: true, skipped: "payouts_disabled" });

  const db = await getPartnerDb();

  // Les commissions arrivées à maturité sont annoncées au cabinet, exactement une fois.
  // Aucun montant n'est modifié : seule une colonne de notification est renseignée.
  const notified = await notifyAvailableCommissions(db);

  const deps = defaultPayoutDeps(process.env.STRIPE_SECRET_KEY ? getStripe() : ({} as never));
  const result = await runMonthlyPayouts(db, deps, { now: new Date() });

  return NextResponse.json({
    ok: true,
    mode: isPartnerPayoutDryRun() ? "dry_run_preview" : "live_transfers",
    notifiedPartners: notified.notified,
    result,
  });
}

export const GET = run;
export const POST = run;
