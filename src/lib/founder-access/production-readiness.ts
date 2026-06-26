// BLOC FINAL §6/§7/§8/§10 — readiness PRODUCTION (variables d'environnement & verdict).
// Fonctions PURES : ne lisent QUE la présence/format des variables, ne renvoient
// JAMAIS leur valeur. Aucun secret exposé. Aucune connexion réseau ici.

export interface EnvCheck { ok: boolean; blockers: string[]; warnings: string[] }

const present = (v: string | undefined): boolean => Boolean(v && v.trim().length > 0);
const strong = (v: string | undefined, min = 24): boolean => present(v) && (v as string).trim().length >= min;
// secrets de dev connus à NE PAS utiliser en production.
const DEV_DEFAULTS = new Set(["clonestore-dev-token-secret", "clonestore-dev-analytics-session-secret"]);

function isProd(): boolean { return process.env.NODE_ENV === "production"; }

// ── §6 — Stripe ─────────────────────────────────────────────────────────────
export function checkFounderStripeEnvironment(): EnvCheck {
  const blockers: string[] = []; const warnings: string[] = [];
  const sk = process.env.STRIPE_SECRET_KEY;
  const wh = process.env.STRIPE_WEBHOOK_SECRET;
  const price = process.env.STRIPE_PRICE_PIERRE;
  const product = process.env.STRIPE_PRODUCT_PIERRE;
  const dbUrl = process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;

  if (!present(sk)) blockers.push("STRIPE_SECRET_KEY manquante");
  else if (!/^sk_(test|live)_/.test(sk!)) warnings.push("STRIPE_SECRET_KEY format inattendu (sk_test_/sk_live_)");
  if (!present(wh)) blockers.push("STRIPE_WEBHOOK_SECRET manquante");
  else if (!/^whsec_/.test(wh!)) warnings.push("STRIPE_WEBHOOK_SECRET format inattendu (whsec_)");
  if (!present(price)) blockers.push("STRIPE_PRICE_PIERRE manquante");
  else if (!/^price_/.test(price!)) warnings.push("STRIPE_PRICE_PIERRE format inattendu (price_)");
  if (!present(product)) warnings.push("STRIPE_PRODUCT_PIERRE manquante (produit prouvé implicitement par le Price ID)");
  else if (!/^prod_/.test(product!)) warnings.push("STRIPE_PRODUCT_PIERRE format inattendu (prod_)");
  if (!present(dbUrl)) blockers.push("CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL manquante (webhook fail-closed en prod)");

  // Cohérence live/test.
  if (present(sk) && present(wh)) {
    const live = sk!.startsWith("sk_live_");
    if (isProd() && !live) warnings.push("NODE_ENV=production mais STRIPE_SECRET_KEY est en mode test");
  }
  return { ok: blockers.length === 0, blockers, warnings };
}

// ── §7 — Email (Resend) ─────────────────────────────────────────────────────
export function checkFounderEmailEnvironment(): EnvCheck {
  const blockers: string[] = []; const warnings: string[] = [];
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CLONESTORE_FOUNDER_EMAIL_FROM;
  const tokenSecret = process.env.CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET ?? process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  const linkSecret = process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  const appUrl = process.env.CLONESTORE_PUBLIC_APP_URL;

  if (!present(apiKey)) blockers.push("RESEND_API_KEY manquante (aucun envoi réel en prod)");
  else if (!/^re_/.test(apiKey!)) warnings.push("RESEND_API_KEY format inattendu (re_)");
  if (!present(from)) blockers.push("CLONESTORE_FOUNDER_EMAIL_FROM manquante");
  else if (!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(from!)) warnings.push("CLONESTORE_FOUNDER_EMAIL_FROM sans domaine valide");
  if (!strong(tokenSecret)) blockers.push("Secret de token de vérification manquant/faible (>=24 car.)");
  else if (DEV_DEFAULTS.has(tokenSecret!.trim()) && isProd()) blockers.push("Secret de token = défaut de dev en production");
  if (!strong(linkSecret)) blockers.push("Secret de lien email (unsubscribe) manquant/faible");
  if (!present(appUrl)) warnings.push("CLONESTORE_PUBLIC_APP_URL manquante (liens absolus → défaut)");
  else if (!/^https?:\/\//i.test(appUrl!)) warnings.push("CLONESTORE_PUBLIC_APP_URL doit être une URL absolue");
  return { ok: blockers.length === 0, blockers, warnings };
}

// ── §8 — Analytics ──────────────────────────────────────────────────────────
export function checkFounderAnalyticsEnvironment(): EnvCheck {
  const blockers: string[] = []; const warnings: string[] = [];
  const secret = process.env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET;
  if (!strong(secret)) blockers.push("CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET manquant/faible (>=24 car.)");
  else if (DEV_DEFAULTS.has(secret!.trim()) && isProd()) blockers.push("Secret de session analytics = défaut de dev en production");
  if (present(secret) && secret === process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET) {
    warnings.push("Secret de session analytics identique au secret de cookie de réservation (préférer distinct)");
  }
  if (!present(process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET)) warnings.push("Owner gate non configurée (cockpit inaccessible)");
  return { ok: blockers.length === 0, blockers, warnings };
}

// ── §10 — Verdict agrégé ────────────────────────────────────────────────────
export interface ReadinessComponent { key: string; ok: boolean; blockers: string[]; warnings: string[] }
export type PhaseEProductionReadiness =
  | { status: "ready"; blockers: []; warnings: string[]; components: ReadinessComponent[] }
  | { status: "blocked"; blockers: string[]; warnings: string[]; components: ReadinessComponent[] };

export function aggregateProductionReadiness(components: ReadinessComponent[]): PhaseEProductionReadiness {
  const blockers = components.flatMap((c) => c.blockers.map((b) => `[${c.key}] ${b}`));
  const warnings = components.flatMap((c) => c.warnings.map((w) => `[${c.key}] ${w}`));
  if (blockers.length === 0) return { status: "ready", blockers: [], warnings, components };
  return { status: "blocked", blockers, warnings, components };
}
