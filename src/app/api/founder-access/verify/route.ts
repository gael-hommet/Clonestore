// Phase E.2 — GET /api/founder-access/verify?rid=&token= (confirmation email).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { confirmReservation } from "@/lib/founder-access/store";
// Canonical Analytics Runtime Wiring — pont additif best-effort borné, uniquement après
// confirmation réussie. Idempotent (event_id déterministe). La corrélation vient de la RÉSERVATION
// (visiteur d'origine), jamais du navigateur qui ouvre le lien de confirmation.
import { bridgeFounderServerEvent, founderEventIdFor, resolveReservationTrafficClass } from "@/lib/analytics/adapters/founder-access-adapter";
import { resolveAnalyticsEnvironment, boundedAnalyticsWrite } from "@/lib/analytics/server-events";
import { resolveCorrelationByReservation } from "@/lib/analytics/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rid = url.searchParams.get("rid") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const dest = (state: string) => NextResponse.redirect(new URL(`/reserver/pierre?confirm=${state}`, url.origin));

  if (!UUID_RE.test(rid) || !token) return dest("invalid");
  try {
    const db = await getRuntimeDb();
    const res = await confirmReservation(db, rid, token);
    if (res.ok) {
      // Canonique (additif, borné) : email confirmé. Corrélation résolue par reservation_id
      // (visiteur d'ORIGINE), jamais le navigateur courant. event_id déterministe ⇒ pas de doublon.
      const env = resolveAnalyticsEnvironment();
      await boundedAnalyticsWrite(async () => {
        const corr = await resolveCorrelationByReservation(db, rid, env);
        // Classe de trafic serveur-autoritaire : un parcours QA synthétique reste `test` (exclu du
        // funnel propriétaire) jusqu'au bout, dérivé de la vérité reservation_created persistée.
        const trafficClass = await resolveReservationTrafficClass(db, rid, env);
        return bridgeFounderServerEvent(db, {
          eventId: founderEventIdFor(rid, "founder_email_verified"),
          founderEventName: "founder_email_verified",
          occurredAtIso: new Date().toISOString(),
          reservationId: rid,
          environment: env,
          visitorId: corr?.visitorId ?? null,
          sessionId: corr?.sessionId ?? null,
          trafficClass,
        });
      });
      return dest("ok");
    }
    return dest(res.reason === "expired" ? "expired" : "invalid");
  } catch {
    return dest("error");
  }
}
