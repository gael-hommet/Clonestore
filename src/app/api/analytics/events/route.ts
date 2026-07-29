// Analytics, Funnel and Launch Measurement Closure — endpoint canonique unique d'ingestion.
// POST /api/analytics/events. Fire-and-forget côté expérience utilisateur : une dépendance
// indisponible ne bloque jamais la page (même contrat que founder-access/presence).

import { NextResponse } from "next/server";
import { getAnalyticsDbForIngestion } from "@/lib/analytics/runtime";
import { insertAnalyticsEvent } from "@/lib/analytics/store";
import { validateClientEnvelope, type AnalyticsServerEnrichedEvent, type AnalyticsEnvironment } from "@/lib/analytics/schema";
import { resolveVisitorId, resolveSessionId } from "@/lib/analytics/identity";
import { classifyTraffic } from "@/lib/analytics/traffic";
import { isAuthenticatedProductionQaRequest } from "@/lib/analytics/qa-auth";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveEnvironment(): AnalyticsEnvironment {
  if (process.env.NODE_ENV === "production") {
    return process.env.VERCEL_ENV === "preview" ? "preview" : "production";
  }
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

export async function POST(req: Request) {
  const db = await getAnalyticsDbForIngestion();
  if (!db) return new NextResponse(null, { status: 204 });

  const clientIp = getClientIp(req);
  const rl = await distributedRateLimit(db, `analytics:${hashIp(clientIp) ?? "anon"}`, 60, 60_000);
  if (!rl.ok) return new NextResponse(null, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return new NextResponse(null, { status: 413 });

  const validation = validateClientEnvelope(body);
  if (!validation.ok || !validation.envelope) {
    // Rejet actif et explicite (pas un 204 silencieux) — un événement inconnu/malformé doit être
    // observable côté client pour le diagnostic, sans jamais exposer de détail d'implémentation.
    return NextResponse.json({ accepted: false, error: validation.error }, { status: 422 });
  }
  const envelope = validation.envelope;

  const cookieHeader = req.headers.get("cookie");
  const { visitorId, setCookie: visitorSetCookie } = resolveVisitorId(cookieHeader);
  const { sessionId, setCookie: sessionSetCookie } = resolveSessionId(cookieHeader);

  const userAgent = req.headers.get("user-agent");
  const testHeaderPresent = req.headers.get("x-clonestore-test") === "1";
  const environment = resolveEnvironment();
  // En Production, `x-clonestore-test` est ignoré (voir classifyTraffic) : seule une requête QA
  // authentifiée par le secret serveur peut être classée `test`. Le secret est lu ici, côté serveur
  // uniquement, jamais journalisé ni renvoyé ; le résultat est un simple booléen. Ce booléen
  // n'influence QUE la classification — il ne débride ni la validation de schéma (déjà exécutée
  // ci-dessus), ni le rate limiting (déjà appliqué ci-dessus), ni la vérité serveur.
  const authenticatedProductionQa = isAuthenticatedProductionQaRequest({
    environment,
    providedToken: req.headers.get("x-clonestore-qa-token"),
    configuredToken: process.env.CLONESTORE_ANALYTICS_QA_TOKEN,
  });
  const trafficClass = classifyTraffic({
    userAgent,
    internalCookieValue: null,
    internalCookieValid: false,
    isAuthenticatedOwner: false, // résolu par un futur adaptateur owner-gate ; jamais présumé ici
    isLocalEnvironment: environment !== "production",
    isAdminRoute: false,
    testHeaderPresent,
    environment,
    authenticatedProductionQa,
  });

  const enriched: AnalyticsServerEnrichedEvent = {
    ...envelope,
    trustLevel: "SERVER_ACCEPTED",
    visitorId,
    sessionId,
    receivedAt: new Date().toISOString(),
    environment,
    trafficClass,
    authenticatedUserId: null,
    countryCode: null,
    sourceChannel: null,
    campaignKey: null,
    partnerAttributionId: null,
    consentState: "unknown",
  };

  const res = NextResponse.json({ accepted: true }, { status: 202 });
  if (visitorSetCookie) res.headers.append("set-cookie", visitorSetCookie);
  res.headers.append("set-cookie", sessionSetCookie);

  try {
    const outcome = await insertAnalyticsEvent(db, { ...enriched, trustLevel: "SERVER_PERSISTED" });
    return NextResponse.json({ accepted: true, outcome }, { status: 202, headers: res.headers });
  } catch {
    // Stockage indisponible en cours d'écriture (race avec getAnalyticsDbForIngestion) : réponse
    // honnête, jamais un faux succès persistant, retry borné laissé au client.
    return NextResponse.json({ accepted: false, error: "STORAGE_UNAVAILABLE" }, { status: 503, headers: res.headers });
  }
}
