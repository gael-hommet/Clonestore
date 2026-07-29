// Classification de trafic fermée — jamais uniquement par IP. Combinaison déterministe de
// signaux serveur. Voir audit-20260723-full/ANALYTICS_TRAFFIC_CLASSIFICATION_MATRIX.md.
// L'user-agent brut n'est jamais stocké — uniquement le résultat de classification.

import type { AnalyticsTrafficClass } from "./schema";

const INTERNAL_COOKIE = "cs_analytics_internal";

// User-agents de bots/monitoring connus — liste fermée, jamais un pattern générique agressif
// qui classerait un vrai visiteur comme bot.
const KNOWN_BOT_UA_PATTERNS: RegExp[] = [
  /Googlebot/i,
  /Bingbot/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Applebot/i,
  /AhrefsBot/i,
  /SemrushBot/i,
  /UptimeRobot/i,
  /Pingdom/i,
  /StatusCake/i,
  /HeadlessChrome/i, // Lighthouse/CI headless renders — pas un vrai visiteur
];

export interface TrafficClassificationInput {
  userAgent: string | null;
  internalCookieValue: string | null; // déjà vérifié (signé) par l'appelant — cette fonction ne vérifie pas la signature elle-même
  internalCookieValid: boolean;
  isAuthenticatedOwner: boolean;
  isLocalEnvironment: boolean; // NODE_ENV !== 'production' && host local
  isAdminRoute: boolean;
  testHeaderPresent: boolean; // en-tête de test explicite, ex. x-clonestore-test
  environment: "production" | "preview" | "development" | "test";
  // En Production UNIQUEMENT, une requête QA authentifiée serveur (secret vérifié en amont par
  // qa-auth.ts, jamais un en-tête public seul) peut produire la classification `test`. Absent/false
  // → jamais `test` en Production (fail-closed). Ignoré hors Production.
  authenticatedProductionQa?: boolean;
}

export function classifyTraffic(input: TrafficClassificationInput): AnalyticsTrafficClass {
  // 1) Automated — vérifié en premier : un bot connu reste "automated" même s'il traverse une
  // route admin ou un environnement local (ne doit jamais se déguiser en trafic interne réel).
  if (input.userAgent && KNOWN_BOT_UA_PATTERNS.some((re) => re.test(input.userAgent as string))) {
    return "automated";
  }

  // 2) Test — jamais accepté en production sur la seule foi d'un en-tête public. Hors Production, la
  // doctrine historique s'applique (en-tête de test / environnement CI). En Production, la
  // classification `test` exige une requête QA authentifiée serveur (secret vérifié en amont par
  // qa-auth.ts) : un `x-clonestore-test` public seul ne suffit JAMAIS.
  if (input.environment !== "production") {
    if (input.testHeaderPresent) return "test";
    if (input.environment === "test") return "test";
  } else if (input.authenticatedProductionQa === true) {
    return "test";
  }

  // 3) Internal — combinaison déterministe, jamais l'IP seule.
  if (input.isAuthenticatedOwner) return "internal";
  if (input.internalCookieValid && input.internalCookieValue === "on") return "internal";
  if (input.isLocalEnvironment) return "internal";
  if (input.isAdminRoute) return "internal";

  // 4) External par défaut si aucun signal négatif — jamais "unknown" par paresse quand
  // l'information est disponible.
  if (input.userAgent === null) return "unknown";
  return "external";
}

export { INTERNAL_COOKIE };
