// src/lib/clonestore/production/p11-stripe-live-readiness.ts
// P11 §3 — Readiness Stripe LIVE (jamais de secret exposé, fail-closed). Vérifie la FORME de
// l'environnement (mode live, deux prix, webhook, flag) et fournit une logique de vérification de
// prix RÉELLE (verifyStripePrice) exécutable par l'owner contre les clés LIVE — mais P11 NE fait
// AUCUN appel live et NE crée AUCun checkout. liveApiVerified reste false tant qu'aucune
// vérification live autorisée par l'owner n'a été produite.

import {
  detectStripeMode, readStripePriceConfig, type Env, type StripeMode,
} from "@/lib/clonestore/pricing/stripe-pricing-config";
import { expectedUnitAmountForCountry, expectedStripeCurrencyForCountry } from "@/lib/clonestore/pricing/country-pricing";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };
const present = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;

/** Critères de prix attendus (canon) — utilisés par la vérification live autorisée par l'owner. */
export const EXPECTED_LIVE_PRICE_CRITERIA = {
  EUR: { currency: "eur", unitAmount: expectedUnitAmountForCountry("FR"), interval: "month" as const },
  CHF: { currency: "chf", unitAmount: expectedUnitAmountForCountry("CH"), interval: "month" as const },
};

// Forme MINIMALE d'un prix Stripe (on ne dépend pas du SDK ici — pur et testable).
export interface StripePriceShape {
  active?: boolean | null;
  currency?: string | null;
  unit_amount?: number | null;
  type?: string | null;
  recurring?: { interval?: string | null; trial_period_days?: number | null } | null;
}
export interface PriceVerification { ok: boolean; issues: string[]; observed: { active: boolean | null; currency: string | null; unitAmount: number | null; interval: string | null } }

/**
 * Vérifie qu'un objet prix Stripe correspond au critère attendu pour une devise. PUR (prend l'objet
 * prix déjà récupéré — la récupération live/read-only est faite par un script owner-gated séparé).
 * Vérifie : active, currency, unit_amount, recurring.interval=month, pas d'essai gratuit accidentel.
 */
export function verifyStripePrice(price: StripePriceShape | null | undefined, currency: "EUR" | "CHF"): PriceVerification {
  const crit = EXPECTED_LIVE_PRICE_CRITERIA[currency];
  const observed = { active: price?.active ?? null, currency: (price?.currency ?? null), unitAmount: price?.unit_amount ?? null, interval: price?.recurring?.interval ?? null };
  const issues: string[] = [];
  if (!price) { issues.push("prix introuvable"); return { ok: false, issues, observed }; }
  if (price.active !== true) issues.push("prix non actif");
  if ((price.currency ?? "").toLowerCase() !== crit.currency) issues.push(`devise attendue ${crit.currency}, observée ${price.currency}`);
  if (price.unit_amount !== crit.unitAmount) issues.push(`montant attendu ${crit.unitAmount}, observé ${price.unit_amount}`);
  if ((price.recurring?.interval ?? null) !== crit.interval) issues.push(`intervalle attendu ${crit.interval}, observé ${price.recurring?.interval ?? "aucun"}`);
  if (price.recurring?.trial_period_days) issues.push(`essai gratuit inattendu (${price.recurring.trial_period_days}j) sur le prix`);
  return { ok: issues.length === 0, issues, observed };
}

export interface StripeLiveReadiness {
  ready: boolean;               // prêt au niveau FORME d'env pour la production country-pricing
  mode: StripeMode;
  liveApiVerified: boolean;     // false tant qu'aucune vérif live autorisée owner n'existe
  blockers: string[];
  warnings: string[];
  requiredEnv: { name: string; present: boolean; required: boolean }[];
  eurPriceConfigured: boolean;
  chfPriceConfigured: boolean;
  webhookConfigured: boolean;
  countryPricingFlag: boolean;
  publishableKeyPresent: boolean;
  baseUrlPresent: boolean;
  expectedPriceCriteria: typeof EXPECTED_LIVE_PRICE_CRITERIA;
  note: string;
}

/**
 * Évalue la readiness Stripe LIVE (FORME d'env). FAIL-CLOSED : mode test bloque, prix EUR/CHF ou
 * webhook manquant bloque, flag country-pricing off bloque, aucun repli inter-devise. Ne fait
 * AUCUN appel Stripe. `liveApiVerified` reste false (une vérif live requiert un dry-run owner).
 */
export function evaluateStripeLiveReadiness(env: Env = process.env): StripeLiveReadiness {
  const cfg = readStripePriceConfig(env);
  const mode = detectStripeMode(env);
  const blockers: string[] = [];
  const warnings: string[] = [];

  const countryPricingFlag = flagOn(env.STRIPE_COUNTRY_PRICING_ENABLED);
  const publishableKeyPresent = present(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) || present(env.STRIPE_PUBLISHABLE_KEY);
  const baseUrlPresent = present(env.CLONESTORE_PUBLIC_APP_URL) || present(env.CLONESTORE_BASE_URL);

  if (!cfg.secretKeyPresent) blockers.push("STRIPE_SECRET_KEY absent.");
  if (mode !== "live") blockers.push(`Mode Stripe « ${mode} » : la production LIVE exige sk_live_ (aucune clé/prix TEST en production).`);
  if (!cfg.eurPriceId) blockers.push("STRIPE_PRICE_PIERRE_EUR_MONTHLY (ou legacy STRIPE_PRICE_PIERRE) absent — checkout EUR bloqué (aucun repli CHF).");
  if (!cfg.chfPriceId) blockers.push("STRIPE_PRICE_PIERRE_CHF_MONTHLY absent — checkout CH bloqué (aucun repli EUR).");
  if (!cfg.webhookSecretPresent) blockers.push("STRIPE_WEBHOOK_SECRET absent — événements de facturation non vérifiés.");
  if (!countryPricingFlag) blockers.push("STRIPE_COUNTRY_PRICING_ENABLED désactivé — tarification par pays inactive.");
  if (!publishableKeyPresent) warnings.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY absent (Stripe Checkout redirige côté serveur ; à confirmer si Elements est utilisé).");
  if (!baseUrlPresent) warnings.push("URL de base publique non définie via env (dérivée de getBaseUrl()).");

  // Vérification API LIVE : P11 ne l'exécute JAMAIS lui-même. Elle n'est considérée faite que si
  // l'owner a produit un artefact d'attestation (CLONESTORE_STRIPE_LIVE_VERIFIED) APRÈS un dry-run
  // read-only contre les clés live — et seulement en mode live. Sinon → bloqueur.
  const liveApiVerified = mode === "live" && flagOn(env.CLONESTORE_STRIPE_LIVE_VERIFIED);
  if (!liveApiVerified) blockers.push("Vérification API Stripe LIVE NON attestée — requiert un dry-run read-only owner (prices.retrieve EUR+CHF ; aucun checkout/paiement) puis CLONESTORE_STRIPE_LIVE_VERIFIED.");

  const requiredEnv = [
    { name: "STRIPE_SECRET_KEY", present: cfg.secretKeyPresent, required: true },
    { name: "STRIPE_WEBHOOK_SECRET", present: cfg.webhookSecretPresent, required: true },
    { name: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", present: !!cfg.eurPriceId, required: true },
    { name: "STRIPE_PRICE_PIERRE_CHF_MONTHLY", present: !!cfg.chfPriceId, required: true },
    { name: "STRIPE_COUNTRY_PRICING_ENABLED", present: countryPricingFlag, required: true },
    { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", present: publishableKeyPresent, required: false },
    { name: "CLONESTORE_PUBLIC_APP_URL", present: baseUrlPresent, required: false },
  ];

  return {
    ready: blockers.length === 0, // ne devient jamais true tant que liveApiVerified reste false (blocker ci-dessus)
    mode, liveApiVerified, blockers, warnings, requiredEnv,
    eurPriceConfigured: !!cfg.eurPriceId, chfPriceConfigured: !!cfg.chfPriceId, webhookConfigured: cfg.webhookSecretPresent,
    countryPricingFlag, publishableKeyPresent, baseUrlPresent,
    expectedPriceCriteria: EXPECTED_LIVE_PRICE_CRITERIA,
    note: "Aucun appel Stripe live effectué par P11 ; aucun checkout créé. verifyStripePrice() fournit la logique de vérification (unit-testée) pour un dry-run read-only autorisé par l'owner.",
  };
}
