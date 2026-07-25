// Phase E.2 — GET /api/founder-access/verify?rid=&token= (confirmation email).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { confirmReservation } from "@/lib/founder-access/store";
// Canonical Analytics Runtime Wiring — pont additif best-effort, uniquement après confirmation
// réussie. Idempotent (event_id déterministe) : un ré-appel de confirmation ne double jamais.
import { bridgeFounderServerEvent, founderEventIdFor } from "@/lib/analytics/adapters/founder-access-adapter";
import { resolveAnalyticsEnvironment } from "@/lib/analytics/server-events";

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
      // Canonique (additif) : email confirmé. event_id déterministe ⇒ pas de doublon sur
      // re-confirmation idempotente. N'affecte jamais la redirection métier.
      await bridgeFounderServerEvent(db, {
        eventId: founderEventIdFor(rid, "founder_email_verified"),
        founderEventName: "founder_email_verified",
        occurredAtIso: new Date().toISOString(),
        reservationId: rid,
        environment: resolveAnalyticsEnvironment(),
      });
      return dest("ok");
    }
    return dest(res.reason === "expired" ? "expired" : "invalid");
  } catch {
    return dest("error");
  }
}
