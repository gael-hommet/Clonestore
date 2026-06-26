// Phase E.3 — POST /api/founder-access/resend-verification (public).
// Renvoie l'email de confirmation. Réponse uniforme : ne révèle jamais si l'adresse
// existe ou est déjà confirmée. Rate-limité. Aucun token en clair en base.

import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { normalizeEmail } from "@/lib/founder-access/validation";
import { deterministicVerificationToken, hashToken, VERIFICATION_TTL_MS } from "@/lib/founder-access/token";
import { findReservationForResend, refreshVerificationToken, setVerificationHash, markVerificationSent } from "@/lib/founder-access/store";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";
import { resolveFounderEmailProvider, renderVerificationEmail, isFounderEmailConfigured } from "@/lib/founder-access/email-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNIFORM = { ok: true, status: "email_to_confirm" as const };

export async function POST(req: Request) {
  const db = await getRuntimeDb();
  const rl = await distributedRateLimit(db, `resend:${hashIp(getClientIp(req)) ?? "anon"}`, 4, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const body = await readJsonBounded<{ email?: unknown }>(req);
  if (body === null) return NextResponse.json({ ok: false, error: "payload" }, { status: 413 });
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!email || !email.includes("@")) return NextResponse.json(UNIFORM); // ne pas révéler

  try {
    const r = await findReservationForResend(db, email);
    // N'agir que si une réservation non confirmée et non désinscrite existe.
    if (r && !r.verified && !r.unsubscribed) {
      // §6 — bump de version → nouveau token déterministe (l'ancien lien est invalidé).
      const version = await refreshVerificationToken(db, r.id);
      if (version !== null) {
        const plain = deterministicVerificationToken(r.id, version);
        await setVerificationHash(db, r.id, hashToken(plain), new Date(Date.now() + VERIFICATION_TTL_MS).toISOString());
        if (isFounderEmailConfigured()) {
          const origin = new URL(req.url).origin;
          const verifyUrl = `${origin}/api/founder-access/verify?rid=${encodeURIComponent(r.id)}&token=${encodeURIComponent(plain)}`;
          const mail = renderVerificationEmail(verifyUrl);
          const sent = await resolveFounderEmailProvider().send({ to: email, subject: "Confirmez votre réservation de Pierre", html: mail.html, text: mail.text, idempotencyKey: `founder-email:${r.id}:verification:${version}` });
          if (sent.ok) await markVerificationSent(db, r.id);
        }
      }
    }
  } catch {
    /* réponse uniforme même en cas d'erreur interne — pas de fuite */
  }
  return NextResponse.json(UNIFORM);
}
