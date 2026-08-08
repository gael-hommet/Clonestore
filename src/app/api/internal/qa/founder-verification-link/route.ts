// BLOC 4 — Voie QA INTERNE (Production) : récupère de manière contrôlée la VRAIE URL de
// vérification d'une réservation QA synthétique, pour prouver le parcours email→vérification en
// Production SANS envoyer aucun email à une personne réelle.
//
// GARDES (toutes obligatoires, fail-closed — voir mintQaVerificationLink) :
//   1. Secret serveur `CLONESTORE_ANALYTICS_QA_TOKEN` via l'en-tête privé `x-clonestore-qa-token`,
//      comparé en temps constant, Production UNIQUEMENT. Impossible via query param public ou via
//      le simple `x-clonestore-test`.
//   2. La réservation DOIT être reconnue QA côté serveur (reservation_created classé `test`) : une
//      VRAIE réservation (external) ⇒ 403, jamais ciblable.
// Le token émis est le VRAI mécanisme (issueVerificationToken → hash en DB) et le clic traverse la
// VRAIE route /api/founder-access/verify. Le token n'est jamais journalisé.

import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { resolveAnalyticsEnvironment } from "@/lib/analytics/server-events";
import { mintQaVerificationLink } from "@/lib/founder-access/qa-verification-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const environment = resolveAnalyticsEnvironment();
  const body = (await req.json().catch(() => ({}))) as { reservationId?: unknown };
  const db = await getRuntimeDb();
  const result = await mintQaVerificationLink(db, {
    reservationId: typeof body?.reservationId === "string" ? body.reservationId : "",
    environment,
    providedToken: req.headers.get("x-clonestore-qa-token"),
    configuredToken: process.env.CLONESTORE_ANALYTICS_QA_TOKEN,
    origin: new URL(req.url).origin,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, verifyUrl: result.verifyUrl });
}
