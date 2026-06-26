// E-R1 §14 — Sanitisation analytics (vie privée). Aucune PII persistée : referrer
// réduit à origin+path, query/fragment/credentials supprimés ; UTM/paths bornés ;
// champs contenant email/token/authorization/code/secret rejetés.

const PII_RE = /(e?mail|token|authorization|bearer|secret|password|passwd|api[-_]?key|\bcode\b|jwt|session[-_]?id|access[-_]?token)/i;
// Détection grossière d'une adresse email littérale.
const EMAIL_LITERAL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** true si la valeur ressemble à de la PII / un secret → à rejeter. */
export function looksLikePii(value: string): boolean {
  return PII_RE.test(value) || EMAIL_LITERAL_RE.test(value);
}

function cleanScalar(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (looksLikePii(s)) return null;     // refus : ne jamais persister de PII
  return s.slice(0, max);
}

/** UTM borné, sans PII. */
export function sanitizeUtm(v: unknown): string | null {
  return cleanScalar(v, 120);
}

/** Chemin : pathname uniquement (query/fragment supprimés), borné, sans PII. */
export function sanitizePath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let p = v.trim();
  if (!p) return null;
  // si une URL absolue est passée, ne garder que le pathname
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { /* garder tel quel */ }
  p = p.split(/[?#]/)[0]; // retirer query + fragment
  if (looksLikePii(p)) return null;
  return p.slice(0, 200);
}

/** Referrer : réduit à origin + pathname (pas de query/fragment/credentials). */
export function sanitizeReferrer(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const raw = v.trim();
  try {
    const u = new URL(raw);
    const reduced = `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");
    if (looksLikePii(reduced)) return null;
    return reduced.slice(0, 200);
  } catch {
    // pas une URL absolue : traiter comme un chemin
    return sanitizePath(raw);
  }
}

/** Domaine du referrer (acquisition). */
export function referrerDomain(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return new URL(v.trim()).hostname.replace(/^www\./, "").slice(0, 120) || null;
  } catch {
    return null;
  }
}

/** Famille de navigateur très générale (jamais l'UA complet). */
export function sanitizeBrowserFamily(v: unknown): string | null {
  const s = cleanScalar(v, 40);
  if (!s) return null;
  const known = ["chrome", "safari", "firefox", "edge", "opera", "samsung", "webview"];
  const lower = s.toLowerCase();
  const match = known.find((k) => lower.includes(k));
  return match ?? "other";
}

const DEVICE_SET = new Set(["mobile", "tablet", "desktop", "unknown"]);

export interface SanitizedAnalyticsPayload {
  current_path: string | null;
  landing_path: string | null;
  referrer: string | null;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  device_category: "mobile" | "tablet" | "desktop" | "unknown" | null;
  browser_family: string | null;
  commercial_phase: string | null;
}

/**
 * E-R2 §9 — point d'entrée UNIQUE de sanitisation pour toutes les routes analytics
 * publiques (presence, funnel…). Plus aucun `str()` brut : tout passe par les
 * sanitiseurs anti-PII ci-dessus.
 */
export function sanitizeClientAnalyticsPayload(body: Record<string, unknown>): SanitizedAnalyticsPayload {
  const device = typeof body.device_category === "string" ? body.device_category.toLowerCase() : null;
  const phase = typeof body.commercial_phase === "string" ? body.commercial_phase.slice(0, 40) : null;
  return {
    current_path: sanitizePath(body.current_path),
    landing_path: sanitizePath(body.landing_path),
    referrer: sanitizeReferrer(body.referrer),
    referrer_domain: referrerDomain(body.referrer),
    utm_source: sanitizeUtm(body.utm_source),
    utm_medium: sanitizeUtm(body.utm_medium),
    utm_campaign: sanitizeUtm(body.utm_campaign),
    utm_content: sanitizeUtm(body.utm_content),
    utm_term: sanitizeUtm(body.utm_term),
    device_category: device && DEVICE_SET.has(device) ? (device as SanitizedAnalyticsPayload["device_category"]) : null,
    browser_family: sanitizeBrowserFamily(body.browser_family),
    commercial_phase: phase && !looksLikePii(phase) ? phase : null,
  };
}

/** Métadonnées sûres : retire toute clé/valeur ressemblant à de la PII, borne la taille. */
export function sanitizeMetadata(meta: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!meta || typeof meta !== "object") return out;
  let n = 0;
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= 12) break;
    if (looksLikePii(k)) continue;
    const val = cleanScalar(v, 120);
    if (val !== null) { out[k.slice(0, 40)] = val; n++; }
  }
  return out;
}
