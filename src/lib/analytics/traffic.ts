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
}

export function classifyTraffic(input: TrafficClassificationInput): AnalyticsTrafficClass {
  // 1) Automated — vérifié en premier : un bot connu reste "automated" même s'il traverse une
  // route admin ou un environnement local (ne doit jamais se déguiser en trafic interne réel).
  if (input.userAgent && KNOWN_BOT_UA_PATTERNS.some((re) => re.test(input.userAgent as string))) {
    return "automated";
  }

  // 2) Test — jamais accepté en production, quelle que soit la combinaison de signaux.
  if (input.environment !== "production") {
    if (input.testHeaderPresent) return "test";
    if (input.environment === "test") return "test";
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
