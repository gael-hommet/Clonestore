// src/lib/billing/subscription-service.ts
// Application serveur des actions de cycle de vie d'abonnement (cancel/resume).
// Résout l'abonnement depuis la commande de l'utilisateur, vérifie l'appartenance
// auprès de Stripe, puis écrit sous clé d'idempotence. Le webhook reste la source de
// vérité ; cette fonction NE réécrit PAS l'état local (il sera reflété par l'event Stripe).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getOrderStatus } from "./order-activation";
import {
  authorizeSubscriptionAction,
  subscriptionUpdateIdempotencyKey,
  type StripeSubscriptionActionView,
} from "./subscription-actions";

export type SubscriptionIntent = "cancel_at_period_end" | "resume";

export type ApplyResult =
  | { ok: true; cancelAtPeriodEnd: boolean; status: string | null }
  | { ok: false; httpStatus: number; code: string; message: string };

async function fetchActionView(subId: string): Promise<StripeSubscriptionActionView> {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    return {
      id: sub.id,
      status: sub.status ?? null,
      metadataUserId: typeof sub.metadata?.["user_id"] === "string" ? sub.metadata["user_id"] : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    };
  } catch {
    return null;
  }
}

/**
 * Programme l'annulation en fin de période (intent=cancel_at_period_end) ou l'annule
 * (intent=resume) pour l'abonnement de l'utilisateur. Fail-closed : Stripe non configuré,
 * abonnement absent, introuvable ou étranger → refus SANS écriture.
 */
export async function applySubscriptionIntent(args: {
  admin: SupabaseClient;
  userId: string;
  agentSlug: string;
  intent: SubscriptionIntent;
}): Promise<ApplyResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, httpStatus: 503, code: "STRIPE_NOT_CONFIGURED", message: "Le paiement n'est pas configuré." };
  }

  const order = await getOrderStatus(args.admin, args.userId, args.agentSlug);
  const localSubId = order?.stripe_subscription_id ?? null;
  const subscription = localSubId ? await fetchActionView(localSubId) : null;

  const authz = authorizeSubscriptionAction({ userId: args.userId, localSubscriptionId: localSubId, subscription });
  if (!authz.ok) {
    return { ok: false, httpStatus: authz.httpStatus, code: authz.code, message: authz.message };
  }

  const cancelAtPeriodEnd = args.intent === "cancel_at_period_end";
  const stripe = getStripe();
  const updated = await stripe.subscriptions.update(
    authz.subscriptionId,
    { cancel_at_period_end: cancelAtPeriodEnd },
    { idempotencyKey: subscriptionUpdateIdempotencyKey({ subscriptionId: authz.subscriptionId, intent: args.intent }) },
  );

  return { ok: true, cancelAtPeriodEnd: updated.cancel_at_period_end === true, status: updated.status ?? null };
}
