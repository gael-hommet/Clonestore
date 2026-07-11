// Programme partenaires — AUTORISATION DES VERSEMENTS LIVE (fail-closed).
//
// Un transfert Stripe Live ne peut partir que si TOUTES les conditions ci-dessous sont
// réunies. L'absence d'une variable vaut toujours NON. Aucune variable ne peut, à elle
// seule, autoriser un transfert Live — surtout pas `PARTNER_PAYOUT_DRY_RUN=false`.
//
// La fonction est PURE : elle lit un environnement passé en argument (l'appelant fournit
// `process.env`). Elle est donc entièrement testable, sans mock global.

export type LiveAuthorizationInput = Record<string, string | undefined>;

/** Chaque condition est nommée : un refus dit TOUJOURS laquelle a manqué. */
export type LiveAuthorizationCheck = {
  key: string;
  passed: boolean;
  explanation: string;
};

export type LiveAuthorizationDecision =
  | { authorized: true; checks: LiveAuthorizationCheck[] }
  | { authorized: false; blockedBy: string[]; checks: LiveAuthorizationCheck[] };

const isTrue = (v: string | undefined): boolean => (v ?? "").trim().toLowerCase() === "true";
const isFalse = (v: string | undefined): boolean => (v ?? "").trim().toLowerCase() === "false";

/**
 * Autorisation des transferts LIVE. Fail-closed : tout ce qui n'est pas explicitement
 * vrai est faux. Toute incohérence (clé Test avec autorisation Live, Preview Vercel,
 * dry-run actif) refuse et EXPLIQUE.
 */
export function evaluateLivePayoutAuthorization(env: LiveAuthorizationInput): LiveAuthorizationDecision {
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeIsLive = secret.startsWith("sk_live_");
  const stripeIsTest = secret.startsWith("sk_test_");

  // Vercel expose VERCEL_ENV = production | preview | development.
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();

  const checks: LiveAuthorizationCheck[] = [
    {
      key: "NODE_ENV",
      passed: (env.NODE_ENV ?? "").trim() === "production",
      explanation: "NODE_ENV doit valoir « production ».",
    },
    {
      key: "PARTNER_PAYOUTS_ENABLED",
      passed: isTrue(env.PARTNER_PAYOUTS_ENABLED),
      explanation: "Le job de versement doit être explicitement activé (PARTNER_PAYOUTS_ENABLED=true).",
    },
    {
      key: "PARTNER_PAYOUT_DRY_RUN",
      passed: isFalse(env.PARTNER_PAYOUT_DRY_RUN),
      explanation: "Le dry-run doit être explicitement désactivé (PARTNER_PAYOUT_DRY_RUN=false). Toute autre valeur, ou son absence, maintient la simulation.",
    },
    {
      key: "PARTNER_PAYOUT_LIVE_AUTHORIZED",
      passed: isTrue(env.PARTNER_PAYOUT_LIVE_AUTHORIZED),
      explanation: "L'autorisation Live explicite du propriétaire est requise (PARTNER_PAYOUT_LIVE_AUTHORIZED=true). Son absence vaut refus.",
    },
    {
      key: "STRIPE_SECRET_KEY",
      passed: stripeIsLive,
      explanation: "Un transfert Live exige une clé Stripe Live (sk_live_…). Une clé Test ne peut jamais produire un mouvement Live.",
    },
    {
      key: "PARTNER_PAYOUT_CRON_SECRET",
      passed: Boolean((env.PARTNER_PAYOUT_CRON_SECRET ?? env.CRON_SECRET ?? "").trim()),
      explanation: "Un secret de cron doit être configuré : sans lui, le job ne peut pas être déclenché de façon authentifiée.",
    },
    {
      key: "VERCEL_ENV",
      passed: vercelEnv === "production",
      explanation: "L'environnement doit être Vercel Production. Un déploiement Preview ou Development ne verse jamais.",
    },
    {
      key: "NO_TEST_KEY",
      passed: !stripeIsTest,
      explanation: "Incohérence : une clé Stripe Test est configurée alors qu'un transfert Live est demandé.",
    },
    {
      key: "NO_TEST_WEBHOOK_MIX",
      // Une clé Live avec une clé publique Test signe un environnement mal configuré.
      passed: !(stripeIsLive && (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test_")),
      explanation: "Incohérence : clé secrète Live mais clé publique Test. L'environnement mélange les modes.",
    },
  ];

  const blockedBy = checks.filter((c) => !c.passed).map((c) => c.key);
  if (blockedBy.length > 0) return { authorized: false, blockedBy, checks };
  return { authorized: true, checks };
}

/** Raccourci booléen fail-closed, branché sur l'environnement du processus. */
export function isPartnerLivePayoutAuthorized(env: LiveAuthorizationInput = process.env): boolean {
  return evaluateLivePayoutAuthorization(env).authorized;
}

/** Explication lisible d'un refus (journalisable, sans jamais révéler un secret). */
export function explainLiveBlock(env: LiveAuthorizationInput = process.env): string {
  const d = evaluateLivePayoutAuthorization(env);
  if (d.authorized) return "Versements Live autorisés : toutes les gardes sont satisfaites.";
  const failed = d.checks.filter((c) => !c.passed);
  return `Versements Live BLOQUÉS (${failed.length} garde(s)) : ${failed.map((c) => `${c.key} — ${c.explanation}`).join(" | ")}`;
}
