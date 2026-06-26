// Phase E.2 — PATCH /api/founder-access/reservations/:id/qualification (public, facultatif).
// §3.3 — protégé par une preuve de possession (cookie HttpOnly signé lié à l'id),
// pas seulement par un UUID difficile à deviner. Toute cible étrangère est refusée.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { validateStep2 } from "@/lib/founder-access/validation";
import { updateQualification } from "@/lib/founder-access/store";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";
import { reservationCookieAuthorizes, reservationCookieSecret } from "@/lib/founder-access/signed-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });

  const db = await getRuntimeDb();
  const rl = await distributedRateLimit(db, `qualif:${hashIp(getClientIp(req)) ?? "anon"}`, 12, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  // Preuve de possession : le cookie doit être présent, signé et lié à CETTE réservation.
  // Si aucun secret n'est configuré, on échoue fermé (jamais d'autorisation par défaut).
  if (!reservationCookieSecret() || !reservationCookieAuthorizes(req.headers.get("cookie"), id)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (body === null) return NextResponse.json({ ok: false, error: "payload" }, { status: 413 });

  const v = validateStep2(body);
  if (!v.ok) return NextResponse.json({ ok: false, errors: v.errors }, { status: 400 });

  try {
    const res = await updateQualification(db, id, v.value);
    if (!res) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
