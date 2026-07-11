// src/app/api/billing/subscription/route.ts
// GET — état d'abonnement de l'utilisateur pour l'UI de facturation.
//
// La vérité est lue EN DIRECT depuis Stripe (statut, cancel_at_period_end, fin de période,
// essai), jamais reconstruite depuis le navigateur, et ne renvoie AUCUN identifiant Stripe.
// Si aucun abonnement n'est rattaché → état « none » (pas une erreur).

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getOrderStatus } from "@/lib/billing/order-activation";
import { summarizeSubscription } from "@/lib/billing/subscription-actions";
import { extractSubscriptionCurrentPeriodEnd } from "@/lib/billing/stripe-event-fields";
import { authenticateBilling, NO_STORE } from "@/lib/billing/route-auth";
import { normalizeAgentSlug } from "@/lib/checkout/checkout-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = {
  ok: true as const,
  subscription: {
    uiState: "none" as const,
    activationStatus: "none" as const,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    trialEnd: null,
    canCancel: false,
    canResume: false,
  },
};

export async function GET(req: Request) {
  const auth = await authenticateBilling(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const agentSlug = normalizeAgentSlug(url.searchParams.get("agent_slug")) ?? "pierre";

  try {
    const order = await getOrderStatus(auth.admin, auth.userId, agentSlug);
    const subId = order?.stripe_subscription_id ?? null;

    // Pas d'abonnement, ou Stripe non configuré → état « none » (jamais d'erreur bloquante).
    if (!subId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(EMPTY, { headers: NO_STORE });
    }

    const stripe = getStripe();
    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(subId);
    } catch {
      return NextResponse.json(EMPTY, { headers: NO_STORE });
    }

    // Appartenance : si la metadata porte un user_id, il doit concorder.
    const metaUser = typeof sub.metadata?.["user_id"] === "string" ? sub.metadata["user_id"] : null;
    if (metaUser !== null && metaUser !== auth.userId) {
      return NextResponse.json(EMPTY, { headers: NO_STORE });
    }

    const summary = summarizeSubscription({
      status: sub.status ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      currentPeriodEnd: extractSubscriptionCurrentPeriodEnd(sub as unknown as Record<string, unknown>),
      trialEnd: typeof sub.trial_end === "number" ? sub.trial_end : null,
    });

    return NextResponse.json({ ok: true, subscription: summary }, { headers: NO_STORE });
  } catch (e) {
    console.error("[billing/subscription] error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, code: "SERVER_ERROR", error: "Statut indisponible." }, { status: 500, headers: NO_STORE });
  }
}
