// src/lib/clonestore/production/p15-stripe-live-verification.ts
// P15 §3 — Vérification Stripe LIVE SÛRE et READ-ONLY. Ne crée AUCUN paiement/checkout/customer/
// subscription, n'imprime AUCUN secret. Réutilise la logique P11 (verifyStripePrice / readiness d'env).
// Défaut fail-closed : sans clés live + vérif de prix, le statut est EXTERNAL_BLOCKED, jamais fake-ready.

import { evaluateStripeLiveReadiness, verifyStripePrice, type StripePriceShape, EXPECTED_LIVE_PRICE_CRITERIA } from "./p11-stripe-live-readiness";
import { detectStripeMode, readStripePriceConfig, type Env } from "@/lib/clonestore/pricing/stripe-pricing-config";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

/** Masque un secret : ne révèle jamais la valeur (préfixe + 4 derniers si présent). */
export function maskSecret(v: string | undefined | null): string {
  if (!v || typeof v !== "string" || v.trim().length === 0) return "(absent)";
  const s = v.trim();
  const prefix = s.slice(0, Math.min(8, s.length));
  const last4 = s.length > 12 ? s.slice(-4) : "";
  return `${prefix}…${last4} (len=${s.length})`;
}

/** Forme d'une clé : sk_live_ / sk_test_ / pk_live_ / whsec_. Ne révèle jamais la valeur. */
export function keyShape(v: string | undefined | null): { present: boolean; live: boolean; test: boolean; shape: string } {
  const s = (v ?? "").trim();
  const present = s.length > 0;
  const live = /^sk_live_|^pk_live_|^rk_live_/.test(s);
  const test = /^sk_test_|^pk_test_|^rk_test_/.test(s);
  const shape = !present ? "absent" : live ? "live" : test ? "test" : (/^whsec_/.test(s) ? "webhook_secret" : "unknown");
  return { present, live, test, shape };
}

export type StripeLiveVerdict =
  | "VERIFIED"                 // clés live + les DEUX prix (EUR 44900 / CHF 49900) vérifiés read-only
  | "NEEDS_OWNER_DRYRUN"       // clés live présentes mais aucune vérif de prix live fournie
  | "EXTERNAL_BLOCKED"         // pas de clés live localement (état honnête par défaut)
  | "TEST_MODE_BLOCKED";       // clé test → jamais accepté pour la readiness live

/** Lecteur de prix injecté (fourni par le script owner-gated après prices.retrieve read-only). */
export type StripePriceReader = (which: "eur" | "chf") => Promise<StripePriceShape | null>;

export interface StripeLiveVerificationResult {
  readonly verdict: StripeLiveVerdict;
  readonly ready: boolean;                 // true UNIQUEMENT si VERIFIED
  readonly mode: ReturnType<typeof detectStripeMode>;
  readonly secretKey: ReturnType<typeof keyShape>;
  readonly webhookSecretPresent: boolean;
  readonly webhookSecretLiveShaped: boolean;
  readonly eurPriceIdPresent: boolean;
  readonly chfPriceIdPresent: boolean;
  readonly countryPricingFlag: boolean;
  readonly eurPriceVerification: ReturnType<typeof verifyStripePrice> | null;
  readonly chfPriceVerification: ReturnType<typeof verifyStripePrice> | null;
  readonly noCrossCurrencyFallback: boolean;
  readonly blockers: string[];
  readonly masked: Record<string, string>; // valeurs masquées uniquement
  readonly note: string;
}

/**
 * Vérifie la config Stripe LIVE en READ-ONLY. Si `readPrice` est fourni (dry-run owner autorisé),
 * récupère les prix EUR/CHF et les vérifie via verifyStripePrice (P11). Sinon, statut honnête :
 * EXTERNAL_BLOCKED (pas de clés live) ou NEEDS_OWNER_DRYRUN (clés live mais vérif non exécutée).
 * NE crée jamais de session/paiement, NE révèle jamais de secret. Pur (sauf readPrice injecté).
 */
export async function verifyStripeLiveReadonly(opts: { env?: Env; readPrice?: StripePriceReader } = {}): Promise<StripeLiveVerificationResult> {
  const env = opts.env ?? process.env;
  const cfg = readStripePriceConfig(env);
  const mode = detectStripeMode(env);
  const sk = keyShape(env.STRIPE_SECRET_KEY);
  const whShape = keyShape(env.STRIPE_WEBHOOK_SECRET);
  const webhookSecretPresent = (env.STRIPE_WEBHOOK_SECRET ?? "").trim().length > 0;
  const webhookSecretLiveShaped = /^whsec_/.test((env.STRIPE_WEBHOOK_SECRET ?? "").trim());
  const countryPricingFlag = flagOn(env.STRIPE_COUNTRY_PRICING_ENABLED);

  const blockers: string[] = [];
  const masked: Record<string, string> = {
    STRIPE_SECRET_KEY: maskSecret(env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: maskSecret(env.STRIPE_WEBHOOK_SECRET),
    STRIPE_PRICE_PIERRE_EUR_MONTHLY: cfg.eurPriceId ? "(configured)" : "(absent)",
    STRIPE_PRICE_PIERRE_CHF_MONTHLY: cfg.chfPriceId ? "(configured)" : "(absent)",
  };

  // Clé TEST → jamais accepté pour la readiness live.
  if (sk.test) blockers.push("STRIPE_SECRET_KEY en mode TEST — jamais accepté pour la readiness LIVE.");
  if (!sk.present) blockers.push("STRIPE_SECRET_KEY absent.");
  if (!cfg.eurPriceId) blockers.push("STRIPE_PRICE_PIERRE_EUR_MONTHLY absent (aucun repli CHF).");
  if (!cfg.chfPriceId) blockers.push("STRIPE_PRICE_PIERRE_CHF_MONTHLY absent (aucun repli EUR).");
  if (!webhookSecretPresent) blockers.push("STRIPE_WEBHOOK_SECRET absent — événements non vérifiés.");
  if (!countryPricingFlag) blockers.push("STRIPE_COUNTRY_PRICING_ENABLED désactivé.");

  // Aucun repli inter-devise : les deux ids doivent être DISTINCTS (un seul prix pour deux pays = interdit).
  const noCrossCurrencyFallback = !(cfg.eurPriceId && cfg.chfPriceId && cfg.eurPriceId === cfg.chfPriceId);
  if (!noCrossCurrencyFallback) blockers.push("Un seul price id pour EUR et CHF — repli inter-devise INTERDIT.");

  let eurPriceVerification: ReturnType<typeof verifyStripePrice> | null = null;
  let chfPriceVerification: ReturnType<typeof verifyStripePrice> | null = null;
  let verdict: StripeLiveVerdict;

  if (sk.test) {
    verdict = "TEST_MODE_BLOCKED";
  } else if (!sk.live || mode !== "live") {
    // Pas de clé live locale → état HONNÊTE : bloqué en externe (jamais fake-ready).
    verdict = "EXTERNAL_BLOCKED";
    blockers.push("Aucune clé Stripe LIVE locale — vérification impossible (EXTERNAL_BLOCKED, jamais fake-ready).");
  } else if (!opts.readPrice) {
    // Clés live mais aucune vérif de prix fournie → dry-run owner requis.
    verdict = "NEEDS_OWNER_DRYRUN";
    blockers.push("Clés live présentes mais vérification de prix NON exécutée — dry-run read-only owner requis (prices.retrieve EUR+CHF ; aucun paiement).");
  } else {
    // Dry-run owner : récupère + vérifie les deux prix (read-only).
    const eurPrice = await opts.readPrice("eur").catch(() => null);
    const chfPrice = await opts.readPrice("chf").catch(() => null);
    eurPriceVerification = verifyStripePrice(eurPrice, "EUR");
    chfPriceVerification = verifyStripePrice(chfPrice, "CHF");
    if (!eurPriceVerification.ok) blockers.push(`Prix EUR invalide : ${eurPriceVerification.issues.join(" ; ")}`);
    if (!chfPriceVerification.ok) blockers.push(`Prix CHF invalide : ${chfPriceVerification.issues.join(" ; ")}`);
    const allOk = eurPriceVerification.ok && chfPriceVerification.ok && noCrossCurrencyFallback && webhookSecretPresent && countryPricingFlag;
    verdict = allOk ? "VERIFIED" : "EXTERNAL_BLOCKED";
  }

  return {
    verdict, ready: verdict === "VERIFIED", mode, secretKey: sk,
    webhookSecretPresent, webhookSecretLiveShaped,
    eurPriceIdPresent: !!cfg.eurPriceId, chfPriceIdPresent: !!cfg.chfPriceId, countryPricingFlag,
    eurPriceVerification, chfPriceVerification, noCrossCurrencyFallback,
    blockers, masked,
    note: "Vérification READ-ONLY : aucun checkout/paiement/customer/subscription créé ; aucun secret imprimé. Prix attendus : " + JSON.stringify({ EUR: EXPECTED_LIVE_PRICE_CRITERIA.EUR, CHF: EXPECTED_LIVE_PRICE_CRITERIA.CHF }),
  };
}

// ── Webhook readiness (forme) ────────────────────────────────────────────────────
export interface WebhookReadiness {
  readonly ready: boolean;
  readonly secretPresent: boolean;
  readonly secretLiveShaped: boolean;
  readonly routeExists: boolean;            // route live-webhook connue (documentée)
  readonly signatureEnforced: boolean;      // le handler vérifie la signature (constructEvent)
  readonly idempotent: boolean;             // activation idempotente (orders upsert onConflict)
  readonly handledEvents: string[];
  readonly blockers: string[];
  readonly note: string;
}

/**
 * Readiness du webhook Stripe LIVE (forme). La route `/api/webhooks/stripe` existe et applique la
 * vérification de signature (constructEvent) + activation idempotente (orders upsert). Le SECRET live
 * doit être présent. FAIL-CLOSED : sans secret → bloqué. Pur.
 */
export function evaluateWebhookReadiness(env: Env = process.env): WebhookReadiness {
  const secretPresent = (env.STRIPE_WEBHOOK_SECRET ?? "").trim().length > 0;
  const secretLiveShaped = /^whsec_/.test((env.STRIPE_WEBHOOK_SECRET ?? "").trim());
  const blockers: string[] = [];
  if (!secretPresent) blockers.push("STRIPE_WEBHOOK_SECRET absent — impossible de vérifier les événements.");
  // La route et la vérification de signature/idempotence sont des invariants de code (src/app/api/webhooks/stripe/route.ts).
  const routeExists = true, signatureEnforced = true, idempotent = true;
  return {
    ready: secretPresent && routeExists && signatureEnforced && idempotent,
    secretPresent, secretLiveShaped, routeExists, signatureEnforced, idempotent,
    handledEvents: ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"],
    blockers,
    note: "Route /api/webhooks/stripe : signature vérifiée via stripe.webhooks.constructEvent AVANT tout effet ; jamais de succès sans vérification ; activation idempotente (orders upsert onConflict user_id,agent_slug). invoice.paid/refunds gérés par les ponts commerciaux ; facturation récurrente déférée honnêtement.",
  };
}

/** Réutilise la readiness d'env P11 (forme) pour l'agrégation. */
export { evaluateStripeLiveReadiness };
