// BLOC 3 — Route opaque d'attribution.
//
// /p/[token] est volontairement minimaliste :
//   • lit le token côté serveur ;
//   • vérifie sa forme et sa signature HMAC en temps constant ;
//   • si un grant non révoqué/expiré existe → crée une conversion session ;
//   • si invalide/expiré/inconnu/révoqué → expérience indistinguable
//     (visiteur organique) ;
//   • dans tous les cas, redirige en 303 vers /demo/pierre, SANS token dans
//     l'URL finale ;
//   • pose un cookie HttpOnly signé (cs_conversion_session) ;
//   • répond avec X-Robots-Tag: noindex.
//
// Aucune confirmation d'existence du prospect n'est exposée publiquement.

import { NextResponse, type NextRequest } from "next/server";
import {
  buildConversionSessionCookie,
  CONVERSION_SESSION_COOKIE,
} from "@/lib/clonestore/conversion/session";
import {
  verifyAttributionToken,
} from "@/lib/clonestore/conversion/attribution-token";
import {
  createConversionSessionFromGrant,
  createOrganicConversionSession,
  getGrantByTokenId,
  isGrantUsable,
  markGrantResolved,
  recordConversionEvent,
} from "@/lib/clonestore/conversion/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIRECT_TARGET = "/demo/pierre";

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // L'URL contient le token — on doit en sortir immédiatement. La réponse 303
  // empêche les caches partagés (no-store) et la cible (/demo/pierre) ne porte
  // aucun paramètre. Le Referer pourrait fuir l'URL d'origine vers la cible ;
  // la mitigation est gérée côté CSP/meta referrer du layout demo.

  const baseUrl = new URL(REDIRECT_TARGET, request.nextUrl.origin);
  const response = NextResponse.redirect(baseUrl, { status: 303 });
  response.headers.set("Cache-Control", "no-store, private, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");

  const verification = verifyAttributionToken(token);

  // Cas 1 : token invalide / signature mismatch / forme cassée → session
  // générique. On ne révèle JAMAIS la raison.
  if (!verification.ok || !verification.tokenId) {
    const session = createOrganicConversionSession();
    response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
    return response;
  }

  // Cas 2 : signature valide. On cherche le grant côté serveur.
  const grant = getGrantByTokenId(verification.tokenId);
  if (!grant || !isGrantUsable(grant)) {
    // Grant inconnu / expiré / révoqué → session générique, réponse
    // indistinguable d'un visiteur organique.
    const session = createOrganicConversionSession();
    response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
    return response;
  }

  // Cas 3 : grant utilisable → on l'enregistre comme résolu + crée la session.
  markGrantResolved(verification.tokenId);
  const session = createConversionSessionFromGrant(grant);

  // Émission serveur (allowlist serveur-only) de l'attribution.
  recordConversionEvent({
    sessionId: session.id,
    eventId: "variant_assigned",
    idempotencyKey: `variant_assigned:${session.id}`,
    metadata: {
      variant: session.variant,
      cohort: session.cohort ?? null,
      contact_kind: session.contactKind ?? null,
      campaign: session.campaign ?? null,
      funnel_version: session.funnelVersion,
    },
  });

  response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
  return response;
}

// Toute autre méthode → 405 pour ne pas accepter un POST aveugle.
export async function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}
