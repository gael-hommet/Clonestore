// E-R1 — POST /api/founder-access/funnel (public, append-only).
// Ingestion d'événements CLIENT uniquement (sendBeacon). Refuse explicitement les
// événements de vérité serveur (réservation, confirmation, paiement, abonnement) :
// ceux-ci ne sont produits que par le code serveur / le webhook Stripe.
// La liaison réservation N'EST PAS acceptée depuis le navigateur (§4) : un événement
// de heartbeat ne peut pas rattacher une session à une réservation.
import { NextResponse } from "next/server";
import { getFounderDbForBeacon } from "@/lib/founder-access/runtime";
import { recordFunnelEvent } from "@/lib/founder-access/store";
import { isClientAnalyticsEvent, isServerFunnelEvent } from "@/lib/founder-access/analytics";
import type { ClientAnalyticsEvent } from "@/lib/founder-access/types";
import { sanitizeUtm, sanitizePath } from "@/lib/founder-access/privacy";
import { resolveAnalyticsSession } from "@/lib/founder-access/analytics-session";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : null);

export async function POST(req: Request) {
  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return new NextResponse(null, { status: 413 });

  const name = str(body.name) ?? str(body.event_name);
  if (!name) return new NextResponse(null, { status: 204 });
  // Un événement de vérité serveur envoyé par le navigateur est REFUSÉ (422) — avant
  // tout accès base, pour ne jamais traiter une tentative de forge.
  if (isServerFunnelEvent(name)) return new NextResponse(null, { status: 422 });
  // Tout le reste hors liste blanche client est ignoré silencieusement.
  if (!isClientAnalyticsEvent(name)) return new NextResponse(null, { status: 204 });

  // Événement fire-and-forget : une dépendance indisponible (DB) ne doit jamais devenir un 500
  // visible au navigateur. `getFounderDbForBeacon` ne jette jamais ; `null` ⇒ dégradation propre.
  const db = await getFounderDbForBeacon();
  if (!db) return new NextResponse(null, { status: 204 });
  const rl = await distributedRateLimit(db, `funnel:${hashIp(getClientIp(req)) ?? "anon"}`, 60, 60_000);
  if (!rl.ok) return new NextResponse(null, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  // §8 — session serveur (cookie signé) ; tout id de session du corps est IGNORÉ.
  const { sessionId, setCookie } = resolveAnalyticsSession(req);
  const res = new NextResponse(null, { status: 204 });
  if (setCookie) res.headers.append("set-cookie", setCookie);

  try {
    await recordFunnelEvent(db, {
      reservation_id: null, // jamais lié depuis le navigateur (§4)
      anonymous_session_id: sessionId,
      event_name: name as ClientAnalyticsEvent,
      source: sanitizeUtm(body.source),
      commercial_phase: typeof body.commercialPhase === "string" ? body.commercialPhase.slice(0, 24) : null,
      metadata_safe: { ctaVariant: sanitizeUtm(body.ctaVariant), landingPath: sanitizePath(body.landingPath) },
    });
  } catch {
    /* best-effort : ne jamais bloquer le client sur le funnel */
  }
  return res;
}
