// E-R2 §8 — Résolution de la session analytics ÉMISE PAR LE SERVEUR. Les routes
// publiques utilisent UNIQUEMENT cette session (cookie signé), jamais un id arbitraire
// envoyé dans le corps. Si le cookie est absent/falsifié, une nouvelle session est émise.

import { readAnalyticsSession, buildAnalyticsSessionCookie } from "./signed-cookie";

export interface ResolvedAnalyticsSession {
  sessionId: string;
  /** Set-Cookie à renvoyer si une nouvelle session a été émise (sinon null). */
  setCookie: string | null;
}

export function resolveAnalyticsSession(req: Request): ResolvedAnalyticsSession {
  const existing = readAnalyticsSession(req.headers.get("cookie"));
  if (existing) return { sessionId: existing, setCookie: null };
  const issued = buildAnalyticsSessionCookie();
  return { sessionId: issued.sessionId, setCookie: issued.cookie };
}
