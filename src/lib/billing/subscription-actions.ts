// src/lib/billing/subscription-actions.ts
// Cycle de vie d'abonnement — décisions PURES (annuler / reprendre / décrire).
// Aucun réseau, aucune base, aucun effet de bord.
//
// DOCTRINE (décision produit) : l'annulation en libre-service est TOUJOURS
// `cancel_at_period_end: true` — le client garde Pierre jusqu'au terme déjà payé et peut
// revenir sur sa décision (`cancel_at_period_end: false`) avant l'échéance. L'annulation
// IMMÉDIATE n'existe que comme action interne admin, protégée et auditée (hors de ce module).
//
// INVARIANT DE SÉCURITÉ : aucune action n'est autorisée sur un abonnement qui n'appartient
// pas à l'utilisateur. Le subId provient de SA ligne `orders` (liaison serveur), et si
// l'abonnement Stripe porte une metadata.user_id, elle doit concorder.

import { mapSubscriptionStatus, type ActivationStatus } from "./stripe-activation";

/** Vue minimale d'un abonnement Stripe (source : API Stripe, jamais le client). */
export type StripeSubscriptionActionView = {
  id: string;
  status: string | null;
  metadataUserId: string | null;
  cancelAtPeriodEnd: boolean;
} | null;

export type SubscriptionActionAuth =
  | { ok: true; subscriptionId: string }
  | { ok: false; httpStatus: number; code: string; message: string };

/**
 * Autorise une action (cancel/resume) sur l'abonnement de l'utilisateur.
 *   pas d'abonnement local            → 404 NO_SUBSCRIPTION
 *   abonnement introuvable chez Stripe → 404 SUBSCRIPTION_NOT_FOUND
 *   abonnement d'un autre utilisateur  → 403 SUBSCRIPTION_USER_MISMATCH
 *   sinon                              → ok
 */
export function authorizeSubscriptionAction(input: {
  userId: string;
  localSubscriptionId: string | null;
  subscription: StripeSubscriptionActionView;
}): SubscriptionActionAuth {
  if (!input.localSubscriptionId) {
    return { ok: false, httpStatus: 404, code: "NO_SUBSCRIPTION", message: "Aucun abonnement rattaché à ce compte." };
  }
  const sub = input.subscription;
  if (!sub || sub.id !== input.localSubscriptionId) {
    return { ok: false, httpStatus: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "Abonnement introuvable." };
  }
  if (sub.metadataUserId !== null && sub.metadataUserId !== input.userId) {
    return { ok: false, httpStatus: 403, code: "SUBSCRIPTION_USER_MISMATCH", message: "Cet abonnement ne correspond pas à votre compte." };
  }
  return { ok: true, subscriptionId: sub.id };
}

/**
 * Clé d'idempotence d'une écriture d'abonnement (POST subscriptions.update).
 * L'intention est incluse : basculer l'annulation ON puis OFF sont deux écritures
 * distinctes et rejouables indépendamment.
 */
export function subscriptionUpdateIdempotencyKey(input: {
  subscriptionId: string;
  intent: "cancel_at_period_end" | "resume";
}): string {
  return `cs-sub-${input.intent}:${input.subscriptionId}`;
}

// ── Description d'abonnement pour l'UI (aucune donnée sensible) ──────────────

export type SubscriptionUiState =
  | "active"
  | "trialing"
  | "cancel_scheduled"
  | "past_due"
  | "canceled"
  | "none";

export type SubscriptionSummary = {
  uiState: SubscriptionUiState;
  activationStatus: ActivationStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null; // Unix seconds
  trialEnd: number | null;
  canCancel: boolean; // proposer « Annuler à la fin de la période »
  canResume: boolean; // proposer « Conserver mon abonnement »
};

/**
 * Résume l'état d'abonnement pour l'interface. Ne renvoie AUCUN identifiant Stripe.
 * `cancel_scheduled` prime sur `active`/`trialing` quand une annulation est programmée.
 */
export function summarizeSubscription(input: {
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
}): SubscriptionSummary {
  const activationStatus = mapSubscriptionStatus(input.status);
  const grants = activationStatus === "active" || activationStatus === "trialing";

  let uiState: SubscriptionUiState;
  if (grants && input.cancelAtPeriodEnd) uiState = "cancel_scheduled";
  else if (activationStatus === "trialing") uiState = "trialing";
  else if (activationStatus === "active") uiState = "active";
  else if (activationStatus === "past_due" || activationStatus === "unpaid") uiState = "past_due";
  else if (activationStatus === "none") uiState = "none";
  else uiState = "canceled";

  return {
    uiState,
    activationStatus,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    currentPeriodEnd: typeof input.currentPeriodEnd === "number" ? input.currentPeriodEnd : null,
    trialEnd: typeof input.trialEnd === "number" ? input.trialEnd : null,
    // On ne peut annuler que ce qui octroie l'accès et n'est pas déjà programmé.
    canCancel: grants && !input.cancelAtPeriodEnd,
    // On ne peut reprendre que ce qui est programmé pour annulation.
    canResume: grants && input.cancelAtPeriodEnd,
  };
}
