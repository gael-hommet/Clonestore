// src/lib/billing/entitlement-reconciliation.ts
// Décision PURE de réconciliation d'entitlement : « cet utilisateur a-t-il droit à
// un accès payant, d'après la VÉRITÉ Stripe ? ». Aucun effet de bord, aucun réseau,
// aucune base — testable exhaustivement.
//
// Invariant de sécurité : un accès payant ne peut JAMAIS être accordé sans un
// abonnement Stripe réel, lié au compte, dans un statut octroyant l'accès.
// Toute incertitude → refus (fail-closed). Le défaut de ce module doit être « non ».

import { isAccessGranted, mapSubscriptionStatus, type ActivationStatus } from "./stripe-activation";

/** Vue minimale de l'ordre local (source : table `orders`). */
export type LocalOrderView = {
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
} | null;

/** Vue minimale de l'abonnement Stripe (source : API Stripe, jamais le client). */
export type StripeSubscriptionView = {
  id: string;
  status: string | null;
  customerId: string | null;
  metadataUserId: string | null;
  metadataAgentSlug: string | null;
} | null;

export type ReconcileInput = {
  userId: string;
  agentSlug: string;
  order: LocalOrderView;
  subscription: StripeSubscriptionView;
};

export type ReconcileDecision =
  | {
      ok: true;
      status: ActivationStatus;
      subscriptionId: string;
      customerId: string | null;
    }
  | {
      ok: false;
      httpStatus: number;
      code: string;
      message: string;
      observedStatus?: ActivationStatus;
    };

/**
 * Décide si l'accès payant peut être (ré)activé pour (userId, agentSlug).
 *
 * Ordre des refus (du plus structurel au plus métier) :
 *   1. aucun abonnement connu localement          → 402 NO_SUBSCRIPTION
 *   2. abonnement introuvable côté Stripe         → 402 SUBSCRIPTION_NOT_FOUND
 *   3. abonnement rattaché à un AUTRE utilisateur → 403 SUBSCRIPTION_USER_MISMATCH
 *   4. abonnement rattaché à un AUTRE produit     → 400 SUBSCRIPTION_AGENT_MISMATCH
 *   5. statut Stripe n'octroyant pas l'accès      → 402 SUBSCRIPTION_NOT_ACTIVE
 *
 * Les métadonnées Stripe ne sont contrôlées que lorsqu'elles sont présentes : un
 * abonnement historique sans metadata reste vérifiable, car l'`id` provient déjà de
 * la ligne `orders` de CET utilisateur (liaison établie côté serveur). Lorsqu'elles
 * sont présentes, elles doivent concorder — un abonnement volé est ainsi rejeté.
 */
export function decideEntitlementReconciliation(input: ReconcileInput): ReconcileDecision {
  const subId = input.order?.stripe_subscription_id ?? null;
  if (!subId) {
    return {
      ok: false,
      httpStatus: 402,
      code: "NO_SUBSCRIPTION",
      message: "Aucun abonnement Stripe n'est rattaché à ce compte.",
    };
  }

  const sub = input.subscription;
  if (!sub || sub.id !== subId) {
    return {
      ok: false,
      httpStatus: 402,
      code: "SUBSCRIPTION_NOT_FOUND",
      message: "L'abonnement Stripe est introuvable ou ne correspond pas au compte.",
    };
  }

  if (sub.metadataUserId !== null && sub.metadataUserId !== input.userId) {
    return {
      ok: false,
      httpStatus: 403,
      code: "SUBSCRIPTION_USER_MISMATCH",
      message: "Cet abonnement ne correspond pas à votre compte.",
    };
  }

  if (sub.metadataAgentSlug !== null && sub.metadataAgentSlug !== input.agentSlug) {
    return {
      ok: false,
      httpStatus: 400,
      code: "SUBSCRIPTION_AGENT_MISMATCH",
      message: "Cet abonnement ne correspond pas à cet employé IA.",
    };
  }

  const status = mapSubscriptionStatus(sub.status);
  if (!isAccessGranted(status)) {
    return {
      ok: false,
      httpStatus: 402,
      code: "SUBSCRIPTION_NOT_ACTIVE",
      message: "L'abonnement n'est pas actif.",
      observedStatus: status,
    };
  }

  return {
    ok: true,
    status,
    subscriptionId: sub.id,
    customerId: sub.customerId ?? input.order?.stripe_customer_id ?? null,
  };
}
