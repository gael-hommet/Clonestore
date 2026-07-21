// Phase E.5 — POST /api/founder-access/presence (public, anonyme).
// Heartbeat de présence first-party + ingestion d'événements web (noms validés).
// Aucune IP brute, aucun fingerprinting ; session anonyme uniquement. 204.

import { NextResponse } from "next/server";
import { getFounderDbForBeacon } from "@/lib/founder-access/runtime";
import { upsertWebSession, recordWebEvents } from "@/lib/founder-access/analytics";
import { sanitizeClientAnalyticsPayload, sanitizePath } from "@/lib/founder-access/privacy";
import { resolveAnalyticsSession } from "@/lib/founder-access/analytics-session";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Heartbeat fire-and-forget : une dépendance indisponible (DB) ne doit jamais devenir un 500
  // visible au navigateur. `getFounderDbForBeacon` ne jette jamais ; `null` ⇒ dégradation propre.
  const db = await getFounderDbForBeacon();
  if (!db) return new NextResponse(null, { status: 204 });
  const rl = await distributedRateLimit(db, `presence:${hashIp(getClientIp(req)) ?? "anon"}`, 120, 60_000);
  if (!rl.ok) return new NextResponse(null, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return new NextResponse(null, { status: 413 });

  // §8 — session ÉMISE PAR LE SERVEUR : lue depuis le cookie signé (jamais le corps).
  const { sessionId, setCookie } = resolveAnalyticsSession(req);
  const res = new NextResponse(null, { status: 204 });
  if (setCookie) res.headers.append("set-cookie", setCookie);

  // §9 — sanitisation centrale unique (referrer/UTM/paths/browser/metadata), aucune PII.
  const p = sanitizeClientAnalyticsPayload(body);
  try {
    await upsertWebSession(db, {
      anonymous_session_id: sessionId,
      current_path: p.current_path, landing_path: p.landing_path, referrer: p.referrer,
      utm_source: p.utm_source, utm_medium: p.utm_medium, utm_campaign: p.utm_campaign,
      utm_content: p.utm_content, utm_term: p.utm_term,
      device_category: p.device_category, browser_family: p.browser_family, commercial_phase: p.commercial_phase,
      reservation_id: null, // §4 — jamais lié depuis un heartbeat navigateur
    });
    if (Array.isArray(body.events)) {
      const events = body.events
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .map((e) => ({ name: String((e as Record<string, unknown>).name ?? ""), path: sanitizePath((e as Record<string, unknown>).path) }));
      await recordWebEvents(db, sessionId, events); // n'accepte que les événements CLIENT
    }
  } catch {
    /* l'analytics ne doit jamais casser l'expérience */
  }
  return res;
}
