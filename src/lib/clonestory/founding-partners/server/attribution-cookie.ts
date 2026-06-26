// CloneStory — cookie d'attribution (first-touch). Signé+vérifié serveur, HttpOnly,
// SANS e-mail/nom/donnée partenaire lisible : porte uniquement un identifiant visiteur
// OPAQUE. Ce n'est PAS une session privée et ne donne jamais accès au registre.
//
// Durée 90 jours : un prospect met souvent plusieurs semaines entre la découverte par
// un lien partenaire et la création réelle d'un compte/entreprise ; 90 jours couvrent
// ce cycle sans conserver de donnée personnelle. Versionné (`_v1`) → évolutif/révocable.

import { signCookie, verifyCookie, readCookie } from "@/lib/founder-access/signed-cookie";
import { sessionSecret } from "./config";
import { randomBytes } from "node:crypto";

export const ATTRIBUTION_COOKIE = "csy_attribution_v1";
export const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const VISITOR_RE = /^[a-f0-9]{32}$/;

export function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

export function buildAttributionCookie(visitorId: string): string {
  const token = signCookie(visitorId, sessionSecret(), ATTRIBUTION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${ATTRIBUTION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${ATTRIBUTION_TTL_MS / 1000}`;
}

/** Renvoie l'identifiant visiteur opaque si le cookie est valide, signé et non expiré. */
export function readAttributionCookie(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, ATTRIBUTION_COOKIE);
  const v = verifyCookie(raw, sessionSecret());
  return v && VISITOR_RE.test(v) ? v : null;
}
