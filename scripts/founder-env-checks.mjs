// BLOC FINAL — vérifications d'environnement Founder Access (ESM, opérateur).
// Ne lisent QUE la présence/format ; ne renvoient jamais la valeur d'un secret.
// Miroir CLI de src/lib/founder-access/production-readiness.ts (testé côté app).

const present = (v) => Boolean(v && String(v).trim().length > 0);
const strong = (v, min = 24) => present(v) && String(v).trim().length >= min;
const DEV_DEFAULTS = new Set(["clonestore-dev-token-secret", "clonestore-dev-analytics-session-secret"]);
const isProd = () => process.env.NODE_ENV === "production";

export function checkStripeEnv(env = process.env) {
  const blockers = [], warnings = [];
  const sk = env.STRIPE_SECRET_KEY, wh = env.STRIPE_WEBHOOK_SECRET;
  const price = env.STRIPE_PRICE_PIERRE, product = env.STRIPE_PRODUCT_PIERRE;
  const dbUrl = env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL;
  if (!present(sk)) blockers.push("STRIPE_SECRET_KEY manquante");
  else if (!/^sk_(test|live)_/.test(sk)) warnings.push("STRIPE_SECRET_KEY format inattendu");
  if (!present(wh)) blockers.push("STRIPE_WEBHOOK_SECRET manquante");
  else if (!/^whsec_/.test(wh)) warnings.push("STRIPE_WEBHOOK_SECRET format inattendu");
  if (!present(price)) blockers.push("STRIPE_PRICE_PIERRE manquante");
  else if (!/^price_/.test(price)) warnings.push("STRIPE_PRICE_PIERRE format inattendu");
  if (!present(product)) warnings.push("STRIPE_PRODUCT_PIERRE manquante (prouvé via Price ID)");
  if (!present(dbUrl)) blockers.push("CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL manquante");
  if (present(sk) && isProd() && !sk.startsWith("sk_live_")) warnings.push("prod mais clé Stripe test");
  return { ok: blockers.length === 0, blockers, warnings };
}

export function checkEmailEnv(env = process.env) {
  const blockers = [], warnings = [];
  const apiKey = env.RESEND_API_KEY, from = env.CLONESTORE_FOUNDER_EMAIL_FROM;
  const tokenSecret = env.CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET ?? env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET ?? env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  const linkSecret = env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET ?? env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  if (!present(apiKey)) blockers.push("RESEND_API_KEY manquante");
  else if (!/^re_/.test(apiKey)) warnings.push("RESEND_API_KEY format inattendu");
  if (!present(from)) blockers.push("CLONESTORE_FOUNDER_EMAIL_FROM manquante");
  else if (!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(from)) warnings.push("CLONESTORE_FOUNDER_EMAIL_FROM sans domaine valide");
  if (!strong(tokenSecret)) blockers.push("Secret de token de vérification manquant/faible");
  else if (DEV_DEFAULTS.has(String(tokenSecret).trim()) && isProd()) blockers.push("Secret token = défaut de dev en prod");
  if (!strong(linkSecret)) blockers.push("Secret de lien email manquant/faible");
  if (!present(env.CLONESTORE_PUBLIC_APP_URL)) warnings.push("CLONESTORE_PUBLIC_APP_URL manquante");
  return { ok: blockers.length === 0, blockers, warnings };
}

export function checkAnalyticsEnv(env = process.env) {
  const blockers = [], warnings = [];
  const secret = env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET;
  if (!strong(secret)) blockers.push("CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET manquant/faible");
  else if (DEV_DEFAULTS.has(String(secret).trim()) && isProd()) blockers.push("Secret session analytics = défaut de dev en prod");
  if (present(secret) && secret === env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET) warnings.push("Secret session analytics = secret cookie réservation (préférer distinct)");
  return { ok: blockers.length === 0, blockers, warnings };
}

export function ownerGateEnv(env = process.env) {
  const blockers = [], warnings = [];
  for (const k of ["CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH", "CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET", "CLONESTORE_OWNER_COCKPIT_SLUG"])
    if (!present(env[k])) blockers.push(`${k} manquante`);
  return { ok: blockers.length === 0, blockers, warnings };
}

export function printCheck(label, res) {
  console.log(`\n[${label}] ${res.ok ? "OK" : "BLOCKED"}`);
  for (const b of res.blockers) console.log(`  ✗ ${b}`);
  for (const w of res.warnings) console.log(`  ! ${w}`);
  return res.ok;
}
