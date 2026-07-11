// src/lib/clonestore/production/p15-1-payment-mode.ts
// P15.1 §1 — Mode de PAIEMENT sûr (demo/pré-lancement). Source de vérité unique de « le paiement en
// ligne est-il ouvert ? ». FAIL-CLOSED : le mode « live » n'est JAMAIS renvoyé tant que le plancher
// dur P10 (PRODUCTION_AUTHORIZED) est false — même avec des clés live. Défaut : disabled ou test, jamais live.
// Ne crée aucun paiement, n'active aucun accès payant, n'imprime aucun secret.

import { detectStripeMode, type Env, type StripeMode } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { PRODUCTION_AUTHORIZED as P10_PRODUCTION_AUTHORIZED } from "./p10-production-gate";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

export type PaymentMode = "disabled" | "test" | "live";

/**
 * Résout le mode de paiement. RÈGLES (fail-closed) :
 *  - override explicite CLONESTORE_PAYMENT_MODE=disabled OU flag CLONESTORE_PAYMENT_DISABLED → "disabled".
 *  - clés Stripe LIVE présentes MAIS production non autorisée (plancher P10 false) → "disabled" (jamais "live").
 *  - clé LIVE + PRODUCTION_AUTHORIZED (impossible tant que const=false) → "live".
 *  - clé TEST (sk_test_) → "test".
 *  - aucune clé → "disabled".
 * « live » n'est donc JAMAIS renvoyé depuis l'env seul. Pur.
 */
export function resolvePaymentMode(env: Env = process.env): PaymentMode {
  const explicit = (env.CLONESTORE_PAYMENT_MODE ?? "").trim().toLowerCase();
  if (explicit === "disabled" || flagOn(env.CLONESTORE_PAYMENT_DISABLED)) return "disabled";

  const stripeMode: StripeMode = detectStripeMode(env);
  if (stripeMode === "live") {
    // Clés live présentes : le paiement LIVE exige l'autorisation de production (plancher dur P10).
    return P10_PRODUCTION_AUTHORIZED ? "live" : "disabled"; // fail-closed → disabled tant que P10=false
  }
  if (stripeMode === "test") return "test";
  return "disabled";
}

/** Le paiement en ligne est-il ouvert (test ou live) ? Pur. */
export function isPaymentOpen(env: Env = process.env): boolean {
  return resolvePaymentMode(env) !== "disabled";
}

/** Une session de checkout peut-elle être créée ? (jamais en mode disabled). Pur. */
export function canCreateCheckoutSession(env: Env = process.env): boolean {
  return resolvePaymentMode(env) !== "disabled";
}

/** Un accès PAYANT réel est-il possible ? UNIQUEMENT en mode live (jamais tant que P10=false). Pur. */
export function paidAccessPossible(env: Env = process.env): boolean {
  return resolvePaymentMode(env) === "live";
}

/**
 * Le paiement est-il EXPLICITEMENT bloqué (mode démo/pré-lancement) OU clés live sans autorisation ?
 * Sert à court-circuiter le checkout AVANT toute interaction Stripe. Ne se déclenche PAS sur le simple
 * « aucune clé » (géré par le 503 existant STRIPE_NOT_CONFIGURED) → additif, sûr. Pur.
 */
export function paymentExplicitlyBlocked(env: Env = process.env): boolean {
  const explicit = (env.CLONESTORE_PAYMENT_MODE ?? "").trim().toLowerCase() === "disabled" || flagOn(env.CLONESTORE_PAYMENT_DISABLED);
  const liveNotAuthorized = detectStripeMode(env) === "live" && !P10_PRODUCTION_AUTHORIZED;
  return explicit || liveNotAuthorized;
}

export interface PaymentModeStatus {
  readonly mode: PaymentMode;
  readonly paymentOpen: boolean;
  readonly canCreateCheckoutSession: boolean;
  readonly paidAccessPossible: boolean;
  readonly stripeMode: StripeMode;
  readonly productionAuthorized: boolean;
  readonly reasons: string[];
  readonly allowedActions: string[];   // ce que l'utilisateur PEUT faire en mode disabled
  readonly blockedActions: string[];   // ce qui reste bloqué
  readonly note: string;
}

/** Statut complet du mode de paiement (pour l'UI + les preuves). Pur. */
export function paymentModeStatus(env: Env = process.env): PaymentModeStatus {
  const mode = resolvePaymentMode(env);
  const stripeMode = detectStripeMode(env);
  const reasons: string[] = [];
  if (mode === "disabled") {
    if ((env.CLONESTORE_PAYMENT_MODE ?? "").trim().toLowerCase() === "disabled" || flagOn(env.CLONESTORE_PAYMENT_DISABLED)) reasons.push("Paiement explicitement désactivé (mode démo/pré-lancement).");
    else if (stripeMode === "live") reasons.push("Clés Stripe LIVE présentes mais production NON autorisée (plancher dur P10) → paiement désactivé.");
    else reasons.push("Aucune clé Stripe live/test exploitable → paiement désactivé.");
  } else if (mode === "test") {
    reasons.push("Clé Stripe TEST — répétition uniquement, aucun paiement réel.");
  }
  return {
    mode,
    paymentOpen: mode !== "disabled",
    canCreateCheckoutSession: mode !== "disabled",
    paidAccessPossible: mode === "live",
    stripeMode,
    productionAuthorized: P10_PRODUCTION_AUTHORIZED,
    reasons,
    allowedActions: [
      "Voir les tarifs (FR/BE/LU 449 EUR, CH 499 CHF).",
      "Demander une démo.",
      "Demander un accès fondateur.",
      "Être prévenu du lancement.",
      "Préparer l'onboarding.",
    ],
    blockedActions: [
      "Créer une session de paiement Stripe réelle.",
      "Activer un accès payant sans paiement vérifié (webhook + réconciliation).",
      "Charger un client.",
    ],
    note: "Le mode « live » n'est jamais atteignable tant que PRODUCTION_AUTHORIZED (P10) est false. Défaut sûr : disabled (ou test en dev). Aucun paiement réel, aucun accès payant, aucun secret imprimé.",
  };
}
