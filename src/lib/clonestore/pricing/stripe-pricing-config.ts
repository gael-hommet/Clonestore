// src/lib/clonestore/pricing/stripe-pricing-config.ts
// P10 §6 — GARDE-FOUS d'environnement Stripe pour la tarification par pays. Vérifie que la
// bonne clé de prix existe AVANT tout checkout, FAIL-CLOSED, et SANS aucun repli inter-devise
// (jamais EUR→CHF, jamais CHF→EUR ; jamais test→prod). Testable par injection d'`env`.

import {
  stripePriceEnvKeyForCountry, isSupportedLaunchCountry, currencyForCountry,
  type LaunchCountry, type StripePriceKey, type Currency,
} from "./country-pricing";

export type StripeMode = "test" | "live" | "unknown";
export type Env = Record<string, string | undefined>;

/** Détecte le mode Stripe à partir du préfixe de la clé secrète (sk_test_ / sk_live_). */
export function detectStripeMode(env: Env = process.env): StripeMode {
  const k = env.STRIPE_SECRET_KEY ?? "";
  if (k.startsWith("sk_live_") || k.startsWith("rk_live_")) return "live";
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return "test";
  return "unknown";
}

export interface StripePriceConfig {
  readonly mode: StripeMode;
  readonly secretKeyPresent: boolean;
  readonly webhookSecretPresent: boolean;
  readonly eurPriceId: string | null;   // STRIPE_PRICE_PIERRE_EUR_MONTHLY
  readonly chfPriceId: string | null;   // STRIPE_PRICE_PIERRE_CHF_MONTHLY
}

const nonEmpty = (v: string | undefined): string | null => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);

// Alias de rétro-compatibilité pour l'EUR UNIQUEMENT : l'ancienne variable STRIPE_PRICE_PIERRE
// (prix Pierre unique historique, en EUR) reste acceptée comme prix EUR. C'est un alias MÊME
// DEVISE (EUR→EUR), PAS un repli inter-devise. Le CHF n'a AUCUN alias (fail-closed strict).
function eurPriceIdOf(env: Env): string | null {
  return nonEmpty(env.STRIPE_PRICE_PIERRE_EUR_MONTHLY) ?? nonEmpty(env.STRIPE_PRICE_PIERRE);
}

/** Lit la configuration de prix Stripe (jamais de valeurs par défaut inventées). */
export function readStripePriceConfig(env: Env = process.env): StripePriceConfig {
  return {
    mode: detectStripeMode(env),
    secretKeyPresent: !!nonEmpty(env.STRIPE_SECRET_KEY),
    webhookSecretPresent: !!nonEmpty(env.STRIPE_WEBHOOK_SECRET),
    eurPriceId: eurPriceIdOf(env),                        // _EUR_MONTHLY ?? legacy STRIPE_PRICE_PIERRE
    chfPriceId: nonEmpty(env.STRIPE_PRICE_PIERRE_CHF_MONTHLY), // strict — aucun alias
  };
}

export type StripePriceResolution =
  | { readonly ok: true; readonly priceId: string; readonly priceKey: StripePriceKey; readonly currency: Currency }
  | { readonly ok: false; readonly code: "COUNTRY_NOT_SUPPORTED" | "STRIPE_PRICE_NOT_CONFIGURED"; readonly priceKey: StripePriceKey | null };

/**
 * Résout le price_id Stripe RÉEL pour un pays. FAIL-CLOSED : si la clé de prix attendue est
 * absente → STRIPE_PRICE_NOT_CONFIGURED. AUCUN repli inter-devise (CH n'utilise jamais l'EUR ;
 * FR/BE/LU n'utilisent jamais le CHF). La clé attendue vient du CANON pur.
 */
export function resolveStripePriceIdForCountry(country: unknown, env: Env = process.env): StripePriceResolution {
  if (!isSupportedLaunchCountry(country)) return { ok: false, code: "COUNTRY_NOT_SUPPORTED", priceKey: null };
  const priceKey = stripePriceEnvKeyForCountry(country) as StripePriceKey;
  const currency = currencyForCountry(country) as Currency;
  // EUR : accepte l'alias legacy STRIPE_PRICE_PIERRE (même devise). CHF : strict, aucun alias.
  const priceId = currency === "EUR" ? eurPriceIdOf(env) : nonEmpty(env[priceKey]);
  if (!priceId) return { ok: false, code: "STRIPE_PRICE_NOT_CONFIGURED", priceKey };
  return { ok: true, priceId, priceKey, currency };
}

export interface StripeConfigValidation {
  readonly ok: boolean;
  readonly mode: StripeMode;
  readonly blockers: string[];
  readonly warnings: string[];
  readonly eurConfigured: boolean;
  readonly chfConfigured: boolean;
}

/**
 * Valide la config de prix Stripe. `forProduction:true` exige le mode LIVE + toutes les clés.
 * FAIL-CLOSED : sans EUR → pas de checkout EUR ; sans CHF → pas de checkout CH ; aucun repli.
 */
export function validateStripePricingConfig(opts: { forProduction: boolean; env?: Env }): StripeConfigValidation {
  const env = opts.env ?? process.env;
  const cfg = readStripePriceConfig(env);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!cfg.secretKeyPresent) blockers.push("STRIPE_SECRET_KEY absent — aucun checkout possible.");
  if (!cfg.eurPriceId) blockers.push("STRIPE_PRICE_PIERRE_EUR_MONTHLY absent — checkout EUR (FR/BE/LU) bloqué (fail-closed, aucun repli CHF).");
  if (!cfg.chfPriceId) blockers.push("STRIPE_PRICE_PIERRE_CHF_MONTHLY absent — checkout CH bloqué (fail-closed, aucun repli EUR).");
  if (!cfg.webhookSecretPresent) warnings.push("STRIPE_WEBHOOK_SECRET absent — les événements de facturation ne seront pas vérifiés.");

  if (opts.forProduction) {
    if (cfg.mode !== "live") blockers.push(`Mode Stripe = « ${cfg.mode} » : la PRODUCTION exige le mode LIVE (sk_live_). Aucun prix TEST utilisé en production.`);
    // Anti-mélange test/live : un price_id de test avec une clé live (ou l'inverse) n'est pas détectable
    // au niveau env seul → signalé en avertissement pour vérification externe.
    warnings.push("Vérifier EXTERNELLEMENT que les price_id EUR/CHF appartiennent bien au mode Stripe déclaré (test↔live).");
  } else {
    if (cfg.mode === "live") warnings.push("Mode Stripe LIVE détecté hors contexte production — vérifier l'intention.");
  }

  return { ok: blockers.length === 0, mode: cfg.mode, blockers, warnings, eurConfigured: !!cfg.eurPriceId, chfConfigured: !!cfg.chfPriceId };
}
