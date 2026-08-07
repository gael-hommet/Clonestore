// Phase E.2 — POST /api/founder-access/reservations (public).
// Persiste l'étape 1 réelle (PostgreSQL), idempotent, anti-abus, succès uniquement
// après transaction réussie. Ne révèle jamais si l'email existait déjà.

import { NextResponse } from "next/server";
import { getFounderDb } from "@/lib/founder-access/runtime";
import { validateStep1, summarizeUserAgent } from "@/lib/founder-access/validation";
import { issueVerificationToken } from "@/lib/founder-access/token";
import { createOrUpdateReservation, markVerificationSent } from "@/lib/founder-access/store";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded, extractTracking } from "@/lib/founder-access/request-utils";
import { resolveFounderEmailProvider, renderVerificationEmail, isFounderEmailConfigured } from "@/lib/founder-access/email-provider";
import { buildReservationCookie } from "@/lib/founder-access/signed-cookie";
import { resolveAnalyticsSession } from "@/lib/founder-access/analytics-session";
// Canonical Analytics Runtime Wiring — pont additif best-effort vers le sink canonique.
// N'est appelé qu'APRÈS la persistance métier réussie ; borné dans le temps ; ne jette jamais ;
// ne modifie jamais le calcul métier de la réservation.
import { bridgeFounderServerEvent, founderEventIdFor } from "@/lib/analytics/adapters/founder-access-adapter";
import { resolveAnalyticsEnvironment, boundedAnalyticsWrite } from "@/lib/analytics/server-events";
import { readVisitorId, readSessionId } from "@/lib/analytics/identity";
import { upsertConversionLink } from "@/lib/analytics/correlation";
import { isAuthenticatedProductionQaRequest } from "@/lib/analytics/qa-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genericSuccess(extra: Record<string, unknown> = {}, cookies: (string | null)[] = []) {
  // Réponse uniforme — ne révèle pas si l'adresse existait déjà.
  const res = NextResponse.json({ ok: true, status: "email_to_confirm", ...extra });
  for (const c of cookies) if (c) res.headers.append("set-cookie", c);
  return res;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const db = await getFounderDb();
  const rl = await distributedRateLimit(db, `reserve:${hashIp(ip) ?? "anon"}`, 8, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return NextResponse.json({ ok: false, error: "payload" }, { status: 413 });

  const v = validateStep1(body);
  if (!v.ok) {
    // honeypot rempli → faux succès silencieux (ne pas aider les bots)
    if (v.errors.honeypot) return genericSuccess();
    return NextResponse.json({ ok: false, errors: v.errors }, { status: 400 });
  }

  const token = issueVerificationToken();
  const tracking = extractTracking(body);
  // §8 — liaison via la session ANALYTICS SERVEUR (cookie signé), jamais l'id du corps.
  const session = resolveAnalyticsSession(req);

  let reservationId: string;
  let alreadyConfirmed: boolean;
  try {
    const res = await createOrUpdateReservation(db, {
      email: v.value.email,
      email_normalized: v.value.email,
      email_domain_type: v.value.email_domain_type,
      company_name: v.value.company_name,
      company_size: v.value.company_size,
      verification_hash: token.hash,
      verification_expires_at: token.expiresAt,
      ...tracking,
      anonymous_session_id: session.sessionId, // override : session serveur validée
      ip_hash: hashIp(ip),
      user_agent_summary: summarizeUserAgent(req.headers.get("user-agent")),
    });
    reservationId = res.id;
    alreadyConfirmed = res.already_confirmed;

    // Parcours QA synthétique authentifié SERVEUR (en-tête privé `x-clonestore-qa-token` = secret
    // serveur, comparaison temps constant, Production uniquement). Un client public NE PEUT JAMAIS
    // l'obtenir → le chemin de réservation NORMAL est strictement inchangé. En mode QA : la vérité
    // serveur analytics est classée `test` (isolée du funnel propriétaire) ET aucun email n'est envoyé.
    const analyticsEnv = resolveAnalyticsEnvironment();
    const qaSynthetic = isAuthenticatedProductionQaRequest({
      environment: analyticsEnv,
      providedToken: req.headers.get("x-clonestore-qa-token"),
      configuredToken: process.env.CLONESTORE_ANALYTICS_QA_TOKEN,
    });

    // Canonique (additif, après persistance métier réussie, BORNÉ dans le temps) :
    // corrélation (visitor/session d'origine lus depuis les cookies signés) + reservation_created.
    // event_id déterministe ⇒ un ré-appel idempotent de la réservation ne double jamais.
    {
      const cookieHeader = req.headers.get("cookie");
      const visitorId = readVisitorId(cookieHeader);
      const sessionId = readSessionId(cookieHeader);
      await boundedAnalyticsWrite(async () => {
        await upsertConversionLink(db, { reservationId, environment: analyticsEnv, visitorId, sessionId });
        return bridgeFounderServerEvent(db, {
          eventId: founderEventIdFor(reservationId, "founder_reservation_created"),
          founderEventName: "founder_reservation_created",
          occurredAtIso: new Date().toISOString(),
          reservationId,
          environment: analyticsEnv,
          visitorId,
          sessionId,
          trafficClass: qaSynthetic ? "test" : "external",
        });
      });
    }

    // Envoi immédiat best-effort de la vérification (le worker E.3 reste le filet).
    // Jamais d'email en mode QA synthétique (aucun envoi réel).
    if (!alreadyConfirmed && isFounderEmailConfigured() && !qaSynthetic) {
      const origin = new URL(req.url).origin;
      const verifyUrl = `${origin}/api/founder-access/verify?rid=${encodeURIComponent(reservationId)}&token=${encodeURIComponent(token.token)}`;
      const mail = renderVerificationEmail(verifyUrl);
      const sent = await resolveFounderEmailProvider().send({
        to: v.value.email,
        subject: "Confirmez votre réservation de Pierre",
        html: mail.html,
        text: mail.text,
      });
      if (sent.ok) await markVerificationSent(db, reservationId);
    }
  } catch (e) {
    // Aucune transaction réussie → aucun faux succès.
    // eslint-disable-next-line no-console
    console.error("[founder-access] reservation failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  // Cookie HttpOnly signé liant ce navigateur à CETTE réservation (preuve étape 2)
  // + cookie de session analytics si nouvellement émis.
  return genericSuccess({ reservationId }, [buildReservationCookie(reservationId), session.setCookie]);
}
