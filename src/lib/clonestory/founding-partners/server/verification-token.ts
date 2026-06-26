// CloneStory — token de vérification STATELESS (SERVER-ONLY).
//
// Le token est entièrement reconstructible à partir de (partnerId, génération,
// expiration) + un secret serveur HMAC. Il n'est JAMAIS stocké : la base ne garde
// que (partner_id, generation, token_exp_ms). Conséquences :
//   • un retry technique d'une même génération produit EXACTEMENT le même token/lien ;
//   • un email déjà reçu reste valide tant que la génération courante n'a pas changé ;
//   • aucun token brut en base ni dans les logs ;
//   • expiration vérifiée (dans la charge signée) ;
//   • révocation = incrément de la génération courante du partenaire.
//
// Format : `csyv1.<base64url(payload)>.<hmac>` ; payload = { p, g, e }.

import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./config";

const PREFIX = "csyv1";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function mac(json: string): string {
  return b64url(createHmac("sha256", sessionSecret()).update(`${PREFIX}.${json}`).digest());
}

export interface VerificationTokenParts {
  partnerId: string;
  generation: number;
  expMs: number;
}

/** Déterministe : même (partnerId, generation, expMs) + même secret → même token. */
export function buildVerificationToken(partnerId: string, generation: number, expMs: number): string {
  const json = b64url(Buffer.from(JSON.stringify({ p: partnerId, g: generation, e: expMs }), "utf8"));
  return `${PREFIX}.${json}.${mac(json)}`;
}

/** Vérifie l'HMAC (temps constant) et la structure. N'évalue PAS l'expiration ici. */
export function parseVerificationToken(token: string | null | undefined): VerificationTokenParts | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const json = parts[1];
  const expected = mac(json);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const pl = JSON.parse(fromB64url(json).toString("utf8")) as { p?: unknown; g?: unknown; e?: unknown };
    if (typeof pl.p !== "string" || typeof pl.g !== "number" || typeof pl.e !== "number") return null;
    return { partnerId: pl.p, generation: pl.g, expMs: pl.e };
  } catch {
    return null;
  }
}

export function isVerificationTokenExpired(expMs: number, now = Date.now()): boolean {
  return now > expMs;
}
