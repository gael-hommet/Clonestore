// CloneStory — inscription au Cercle (POST). Réponse UNIFORME : ne révèle jamais
// si une adresse existe déjà. Préflight production AVANT toute écriture/rate-limit.
// Création ATOMIQUE (partenaire + token hashé + outbox) ; envoi best-effort avec
// reprise garantie par l'outbox (jamais de compte orphelin, jamais de double email).

import { NextResponse } from "next/server";
import { getClientIp, rateLimit, readJsonBounded } from "@/lib/founder-access/request-utils";
import {
  findPartnerByCode,
  findPartnerByLinkToken,
  markVerificationFailed,
  markVerificationSent,
  markVerificationUnknown,
  registerPartner,
} from "@/lib/clonestory/founding-partners/server/store";
import { readRefCookie } from "@/lib/clonestory/founding-partners/server/session";
import { renderVerificationEmail, sendClonestoryEmail } from "@/lib/clonestory/founding-partners/server/emails";
import {
  assertClonestoryRegistrationReady,
  devAffordancesAllowed,
  registrationOpen,
} from "@/lib/clonestory/founding-partners/server/config";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };
const ok = (extra?: Record<string, unknown>) => NextResponse.json({ ok: true, ...extra }, { headers: NO_STORE });
const unavailable = () => NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });

export async function POST(req: Request) {
  // 1) Fermeture par flag (décision opérateur) — message dédié, AVANT toute écriture.
  if (!registrationOpen()) {
    return NextResponse.json({ ok: false, error: "registration_closed" }, { status: 503, headers: NO_STORE });
  }

  // 2) PRÉFLIGHT PRODUCTION — avant rate-limit, body, token, écriture. Config
  // incomplète → 503 sans exposition interne, AUCUNE ligne créée. Le flag seul ne
  // suffit jamais.
  try {
    assertClonestoryRegistrationReady();
  } catch {
    return unavailable();
  }

  const ip = getClientIp(req);
  if (!rateLimit(`csy-register:${ip ?? "anon"}`, 6, 60_000).ok) return ok(); // uniforme

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });

  // Honeypot : un bot remplit ce champ caché.
  if (typeof body.website === "string" && body.website.trim() !== "") return ok();
  if (body.acceptTerms !== true) {
    return NextResponse.json({ ok: false, error: "terms_required" }, { status: 422, headers: NO_STORE });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : null);

  // 3) Création ATOMIQUE (partenaire + token + outbox). Toute erreur d'infra → 503,
  // rollback complet, aucun compte partiel.
  let result;
  try {
    let introducerPartnerId: string | null = null;
    if (str(body.refToken)) introducerPartnerId = (await findPartnerByLinkToken(str(body.refToken)!))?.id ?? null;
    if (!introducerPartnerId && str(body.refCode)) introducerPartnerId = (await findPartnerByCode(str(body.refCode)!))?.id ?? null;
    if (!introducerPartnerId) introducerPartnerId = readRefCookie(req.headers.get("cookie"));

    result = await registerPartner(
      {
        firstName: str(body.firstName) ?? "",
        lastName: str(body.lastName) ?? "",
        email: str(body.email) ?? "",
        displayName: str(body.displayName),
        phone: str(body.phone),
        company: str(body.company),
        role: str(body.role),
      },
      { introducerPartnerId },
    );
  } catch {
    return unavailable();
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422, headers: NO_STORE });
  }

  // 4) Envoi APRÈS commit — best-effort. L'outbox garantit la reprise : un échec
  // réseau ne perd jamais le compte ni la possibilité d'envoyer. Réponse neutre.
  let devVerifyUrl: string | undefined;
  if (result.verificationToken && result.outboxId) {
    const origin = new URL(req.url).origin;
    const verifyUrl = `${origin}/founding-partners/verify?token=${encodeURIComponent(result.verificationToken)}`;
    if (devAffordancesAllowed()) devVerifyUrl = verifyUrl; // dev/E2E uniquement, JAMAIS en production
    const mail = renderVerificationEmail(verifyUrl);
    try {
      const res = await sendClonestoryEmail({
        to: str(body.email)!,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // Clé de la GÉNÉRATION → un retry technique dédupe côté fournisseur.
        idempotencyKey: `csy-verification:${result.partnerId}:${result.generation}`,
      });
      if (res.ok) await markVerificationSent(result.outboxId, res.id ?? null);
      else await markVerificationFailed(result.outboxId, res.error ?? "send_failed");
    } catch (e) {
      // Envoi INCERTAIN → delivery_unknown (le worker retentera le MÊME token/clé).
      try {
        await markVerificationUnknown(result.outboxId, e instanceof Error ? e.message : "send_error");
      } catch {
        /* la reprise par l'outbox reste possible même si le marquage échoue */
      }
    }
  }

  return ok(devVerifyUrl ? { devVerifyUrl } : undefined);
}
