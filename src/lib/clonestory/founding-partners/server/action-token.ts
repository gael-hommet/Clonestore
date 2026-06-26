// CloneStory — token d'ACTION STATELESS, à usage par lien email (SERVER-ONLY, CS-FINAL 4).
//
// Généralise le token de vérification : entièrement reconstructible à partir de
// (purpose, subjectId, génération, expiration) + secret serveur HMAC. JAMAIS stocké en
// base (seuls subject_id + génération + expiration sont connus). Permet :
//   • à un worker d'outbox de RECONSTRUIRE le lien sans conserver de token brut ;
//   • un retry technique → exactement le même lien (idempotent) ;
//   • la révocation = incrément de la génération du sujet ;
//   • aucun token brut en base ni dans les logs.
//
// Le `purpose` est inclus dans la charge ET dans le préfixe HMAC : un token « introconfirm »
// ne peut jamais être rejoué comme « verify » (cloisonnement des usages).
//
// Format : `csya1.<base64url(payload)>.<hmac>` ; payload = { u, s, g, e }.

import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./config";

const PREFIX = "csya1";
export type ActionPurpose = "introconfirm" | "introrefuse";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function mac(purpose: string, json: string): string {
  return b64url(createHmac("sha256", sessionSecret()).update(`${PREFIX}.${purpose}.${json}`).digest());
}

export interface ActionTokenParts {
  purpose: ActionPurpose;
  subjectId: string;
  generation: number;
  expMs: number;
}

/** Déterministe : mêmes (purpose, subjectId, generation, expMs) + secret → même token. */
export function buildActionToken(purpose: ActionPurpose, subjectId: string, generation: number, expMs: number): string {
  const json = b64url(Buffer.from(JSON.stringify({ u: purpose, s: subjectId, g: generation, e: expMs }), "utf8"));
  return `${PREFIX}.${json}.${mac(purpose, json)}`;
}

/** Vérifie l'HMAC (temps constant) + la structure + le purpose attendu. N'évalue PAS l'expiration. */
export function parseActionToken(token: string | null | undefined, expectedPurpose: ActionPurpose): ActionTokenParts | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const json = parts[1];
  let pl: { u?: unknown; s?: unknown; g?: unknown; e?: unknown };
  try {
    pl = JSON.parse(fromB64url(json).toString("utf8"));
  } catch {
    return null;
  }
  if (pl.u !== expectedPurpose || typeof pl.s !== "string" || typeof pl.g !== "number" || typeof pl.e !== "number") return null;
  const expected = mac(expectedPurpose, json);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { purpose: expectedPurpose, subjectId: pl.s, generation: pl.g, expMs: pl.e };
}

export function isActionTokenExpired(expMs: number, now = Date.now()): boolean {
  return now > expMs;
}
