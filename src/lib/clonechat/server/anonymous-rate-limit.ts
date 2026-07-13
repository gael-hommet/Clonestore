// src/lib/clonechat/server/anonymous-rate-limit.ts
// C1.6 §4 — Contrôle d'abus de la voie ANONYME.
//
// Ouvrir la conversation à tous ne veut pas dire l'ouvrir sans limite. Le budget global protège
// déjà le coût (l'anonyme n'a AUCUN compteur par utilisateur : il n'a pas d'identité, et on ne
// lui en fabrique pas). Ce limiteur ajoute une fenêtre glissante par CLIENT.
//
// RÈGLES DE VIE PRIVÉE :
//   · l'IP n'est JAMAIS stockée ni journalisée : seule une EMPREINTE tronquée l'est ;
//   · l'empreinte n'est PAS un identifiant utilisateur — elle ne rejoint aucun tenant, aucun
//     compte, aucune donnée métier, et elle disparaît avec le processus ;
//   · aucune écriture en base.

import { createHash } from "node:crypto";

export interface AnonymousRateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

/** Fenêtre glissante : 12 messages / 5 minutes par client anonyme. */
export const ANON_WINDOW_MS = 5 * 60 * 1000;
export const ANON_MAX_IN_WINDOW = 12;

/**
 * Empreinte opaque et NON RÉVERSIBLE du client. Jamais une identité : uniquement une clé de
 * compartimentage pour la fenêtre glissante.
 */
export function anonymousFingerprint(headers: Headers): string {
  const ip =
    (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  const ua = (headers.get("user-agent") ?? "").slice(0, 80);
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 24); // tronquée
}

type Hit = { count: number; windowStart: number };
const hits = new Map<string, Hit>();

/** Purge paresseuse : le processus ne conserve jamais un historique long. */
function sweep(now: number): void {
  if (hits.size < 512) return;
  for (const [k, h] of hits) if (now - h.windowStart > ANON_WINDOW_MS) hits.delete(k);
}

export function checkAnonymousRateLimit(fingerprint: string, now: number = Date.now()): AnonymousRateLimitDecision {
  sweep(now);
  const h = hits.get(fingerprint);
  if (!h || now - h.windowStart > ANON_WINDOW_MS) {
    hits.set(fingerprint, { count: 1, windowStart: now });
    return { allowed: true, remaining: ANON_MAX_IN_WINDOW - 1, retryAfterSeconds: 0 };
  }
  if (h.count >= ANON_MAX_IN_WINDOW) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((ANON_WINDOW_MS - (now - h.windowStart)) / 1000) };
  }
  h.count += 1;
  return { allowed: true, remaining: ANON_MAX_IN_WINDOW - h.count, retryAfterSeconds: 0 };
}

/** Message honnête de limitation — il ne prétend JAMAIS que CloneChat est indisponible. */
export function anonymousRateLimitMessage(retryAfterSeconds: number): string {
  const min = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Vous allez un peu vite pour moi. Reprenons dans ${min} minute${min > 1 ? "s" : ""} — ou connectez-vous pour continuer sans attendre.`;
}

/** Réservé aux tests : remet le limiteur à zéro. */
export function __resetAnonymousRateLimit(): void {
  hits.clear();
}
