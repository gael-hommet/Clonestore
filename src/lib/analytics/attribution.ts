// Attribution serveur-authoritative — jamais un partner_id/source/campagne fourni par le client
// comme vérité finale. Voir audit-20260723-full/ANALYTICS_ATTRIBUTION_CONTRACT.md.
//
// Le dimension "partner" n'est JAMAIS résolue ici : ce module ne lit, ne parse et ne fait
// confiance à aucun cookie Partner Program. Il accepte en entrée un `partnerAttributionId` déjà
// résolu et validé par le Partner Program lui-même (src/lib/partner-program/server/attribution.ts,
// non modifié dans ce bloc) — jamais recalculé ici, pour ne jamais dupliquer ou contourner la
// logique anti-fraude/anti-auto-parrainage déjà existante et testée dans ce système séparé.

export const ATTRIBUTION_CHANNELS = [
  "direct",
  "organic_search",
  "referral",
  "social_organic",
  "email",
  "partner",
  "paid_campaign", // réservé pour un futur usage — aucune campagne payante active aujourd'hui
  "internal",
  "unknown",
] as const;
export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number];

// Allowlist stricte des paramètres UTM acceptés — toute autre clé de query string est supprimée.
export const UTM_ALLOWLIST = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_ALLOWLIST)[number];

const MAX_UTM_VALUE_LENGTH = 64;
// Valeurs bornées : lettres/chiffres/tirets/underscores/points uniquement — jamais de texte
// arbitraire dans le dashboard (interdiction explicite du master prompt).
const UTM_VALUE_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

export function sanitizeUtmParams(searchParams: URLSearchParams): Partial<Record<UtmKey, string>> {
  const out: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_ALLOWLIST) {
    const raw = searchParams.get(key);
    if (!raw) continue;
    const trimmed = raw.slice(0, MAX_UTM_VALUE_LENGTH);
    if (UTM_VALUE_RE.test(trimmed)) out[key] = trimmed;
  }
  return out;
}

const KNOWN_SEARCH_ENGINE_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "ecosia.",
  "qwant.",
];
const KNOWN_SOCIAL_HOSTS = ["facebook.", "instagram.", "linkedin.", "x.com", "twitter.", "tiktok."];

export interface AttributionInput {
  referrerHost: string | null; // host uniquement, jamais l'URL complète avec chemin/query
  utm: Partial<Record<UtmKey, string>>;
  isInternalTraffic: boolean;
  partnerAttributionId: string | null; // déjà résolu par le Partner Program — jamais recalculé ici
}

/**
 * Résout le canal d'attribution pour UNE visite (touch). N'implémente pas la logique
 * first/last-touch de fenêtre — voir `resolveFirstLastTouch` ci-dessous pour la combinaison
 * de plusieurs touches dans le temps.
 */
export function resolveAttributionChannel(input: AttributionInput): AttributionChannel {
  if (input.isInternalTraffic) return "internal";
  if (input.partnerAttributionId) return "partner";
  if (input.utm.utm_medium === "email") return "email";
  if (input.utm.utm_source || input.utm.utm_campaign) return "paid_campaign";
  if (!input.referrerHost) return "direct";
  const host = input.referrerHost.toLowerCase();
  if (KNOWN_SEARCH_ENGINE_HOSTS.some((h) => host.includes(h))) return "organic_search";
  if (KNOWN_SOCIAL_HOSTS.some((h) => host.includes(h))) return "social_organic";
  return "referral";
}

export interface AttributionTouch {
  channel: AttributionChannel;
  occurredAt: string; // ISO
  sourceChannel: string | null;
  campaignKey: string | null;
}

export interface FirstLastTouch {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
}

// Fenêtre d'attribution — aucune décision préexistante trouvée dans le code lu pour ce nouveau
// contrat. 30 jours retenu comme valeur conservatrice documentée, pas une vérité définitive.
export const ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * Combine une liste de touches chronologiques (déjà triées, la plus ancienne en premier) en
 * first-touch/last-touch, dans la fenêtre d'attribution. Un touch "direct" n'écrase jamais un
 * touch précédent valide et non expiré (règle explicite : "direct ne doit pas écraser
 * automatiquement une source précédente valide sans règle").
 */
export function resolveFirstLastTouch(touches: readonly AttributionTouch[], now: Date): FirstLastTouch | null {
  if (touches.length === 0) return null;
  const windowStart = now.getTime() - ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const withinWindow = touches.filter((t) => new Date(t.occurredAt).getTime() >= windowStart);
  if (withinWindow.length === 0) return null;

  const firstTouch = withinWindow[0];

  // Dernier touch non-direct s'il existe et est dans la fenêtre ; sinon, le vrai dernier touch
  // (même direct) — un direct ne remplace un touch valide que s'il n'y a rien de mieux après.
  let lastTouch = withinWindow[withinWindow.length - 1];
  const lastNonDirect = [...withinWindow].reverse().find((t) => t.channel !== "direct");
  if (lastNonDirect && new Date(lastNonDirect.occurredAt).getTime() >= new Date(lastTouch.occurredAt).getTime() - 1) {
    // le dernier touch non-direct est au moins aussi récent que le tout dernier touch direct
    // enregistré juste après lui : on garde le non-direct comme last-touch "significatif".
    if (lastTouch.channel === "direct") lastTouch = lastNonDirect;
  }

  return { firstTouch, lastTouch };
}
