// BLOC 3 — Route d'attribution opaque (alignée LeadForge db9b166).
//
// URL publique : `/p/{token_id}.{signature_hex}`
//   • token_id        = 40 hex (uuid.hex + uuid.hex[:8] — produit par LeadForge)
//   • signature_hex   = 64 hex (HMAC-SHA256(token_id, LEADFORGE_ATTRIBUTION_SIGNING_KEY))
//
// Comportement :
//   1. Lit le token côté serveur.
//   2. Vérifie la forme et la signature en temps constant.
//   3. Si un grant ACTIVE non expiré/révoqué existe → crée une conversion session
//      et marque le grant comme visité.
//   4. Si invalide / expiré / inconnu / révoqué / backend KO → session générique
//      organique (réponse indistinguable, pas de fuite d'existence).
//   5. Redirige TOUJOURS en 303 vers /demo/pierre. Token retiré de l'URL finale.
//   6. Pose cookie HttpOnly signé `cs_conversion_session`.
//   7. Headers `X-Robots-Tag: noindex,nofollow,nosnippet,noarchive` + `Referrer-Policy: no-referrer`.

import { NextResponse, type NextRequest } from "next/server";
import {
  buildConversionSessionCookie,
} from "@/lib/clonestore/conversion/session";
import {
  verifyAttributionToken,
} from "@/lib/clonestore/conversion/attribution-token";
import {
  createConversionSessionFromGrant,
  createOrganicConversionSession,
  getGrantByTokenId,
  isConversionBackendAvailable,
  isGrantUsable,
  markGrantVisited,
  recordConversionEvent,
} from "@/lib/clonestore/conversion/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIRECT_TARGET = "/demo/pierre";

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // Origine portable : préfère nextUrl si présent, sinon parse depuis request.url
  // pour rester testable avec un Request standard.
  const originSource = request.nextUrl?.origin ?? new URL(request.url).origin;
  const baseUrl = new URL(REDIRECT_TARGET, originSource);
  const response = NextResponse.redirect(baseUrl, { status: 303 });
  response.headers.set("Cache-Control", "no-store, private, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");

  // Si la conversion backend n'est pas disponible (production sans DB ni
  // flag explicite), on tombe SILENCIEUSEMENT vers une démo organique
  // SANS prétendre persister une attribution. La fonction `createOrganicConversionSession`
  // retourne une session éphémère même si le backend est KO.
  const verification = verifyAttributionToken(token);

  // Branche 1 : token malformé / mauvaise signature → session organique.
  if (!verification.ok || !verification.tokenId) {
    const session = createOrganicConversionSession();
    response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
    return response;
  }

  // Branche 2 : signature valide. Recherche du grant.
  const grant = getGrantByTokenId(verification.tokenId);
  if (!grant || !isGrantUsable(grant)) {
    const session = createOrganicConversionSession();
    response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
    return response;
  }

  // Branche 3 : grant utilisable. Visite marquée + session créée.
  markGrantVisited(verification.tokenId);
  const session = createConversionSessionFromGrant(grant);

  // Évènement serveur — uniquement si le backend a effectivement persisté
  // la session (sinon recordConversionEvent retournera backend_unavailable
  // silencieusement). Ne JAMAIS bloquer le redirect.
  if (isConversionBackendAvailable()) {
    recordConversionEvent({
      sessionId: session.id,
      eventType: "variant_assigned",
      idempotencyKey: `variant_assigned:${session.id}`,
      campaign: grant.campaignId,
      cohort: grant.cohort,
      variant: grant.variant,
      metadata: {
        contact_kind: grant.contactKind,
        segment: grant.segment ?? "",
        email_tier: grant.emailTier ?? "",
      },
    });
  }

  response.headers.append("Set-Cookie", buildConversionSessionCookie(session.id));
  return response;
}

export async function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}
