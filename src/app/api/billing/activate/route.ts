// src/app/api/billing/activate/route.ts
// Réconciliation d'entitlement — « resynchronise mon accès depuis Stripe ».
//
// B41 avait corrigé l'usurpation d'identité (user_id venait du body). Il restait une
// faille d'OCTROI : la route écrivait `status: "active"` sans JAMAIS interroger Stripe,
// donc tout utilisateur authentifié obtenait Pierre gratuitement. Elle vérifie désormais
// la vérité Stripe côté serveur avant toute écriture.
//
// Invariants :
//   • user_id provient EXCLUSIVEMENT du Bearer validé (jamais du body) ;
//   • aucun accès payant sans abonnement Stripe réel, lié au compte, actif/trialing ;
//   • aucune écriture en base sur refus (fail-closed) ;
//   • idempotente (upsert sur user_id,agent_slug) ;
//   • Stripe non configuré → 503, jamais d'octroi.
//
// Le webhook reste la source primaire. Cette route est le chemin de RATTRAPAGE quand un
// webhook a été perdu ; elle ne peut que refléter Stripe, jamais le devancer.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  createOrderAdminClient,
  getOrderStatus,
  upsertOrderActivation,
} from "@/lib/billing/order-activation";
import {
  decideEntitlementReconciliation,
  type StripeSubscriptionView,
} from "@/lib/billing/entitlement-reconciliation";
import { normalizeAgentSlug } from "@/lib/checkout/checkout-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

function fail(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status, headers: NO_STORE });
}

function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

/** Lecture serveur de l'abonnement Stripe. Retourne null s'il est introuvable. */
async function fetchSubscription(subId: string): Promise<StripeSubscriptionView> {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    const meta = sub.metadata ?? {};
    return {
      id: sub.id,
      status: sub.status ?? null,
      customerId: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
      metadataUserId: typeof meta["user_id"] === "string" ? meta["user_id"] : null,
      metadataAgentSlug: typeof meta["agent_slug"] === "string" ? meta["agent_slug"] : null,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. Stripe doit être configuré — sinon aucune vérité n'est vérifiable → fail-closed.
  if (!process.env.STRIPE_SECRET_KEY) {
    return fail(503, "STRIPE_NOT_CONFIGURED", "Le paiement n'est pas configuré sur cet environnement.");
  }

  // 2. Identité : Bearer validé côté serveur, jamais le body.
  const token = readBearer(req);
  if (!token) return fail(401, "AUTH_REQUIRED", "Authentification requise.");

  let admin;
  try {
    admin = createOrderAdminClient();
  } catch {
    return fail(503, "BACKEND_NOT_CONFIGURED", "Service indisponible.");
  }

  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) return fail(401, "AUTH_INVALID", "Session invalide ou expirée.");
  const userId = auth.user.id;

  // 3. Produit visé (non sensible — n'influence pas l'identité).
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const agentSlug = normalizeAgentSlug(typeof body.agent_slug === "string" ? body.agent_slug : null);
  if (!agentSlug) return fail(400, "AGENT_SLUG_REQUIRED", "Employé IA introuvable.");

  try {
    // 4. Abonnement connu localement (liaison serveur user → subscription).
    const order = await getOrderStatus(admin, userId, agentSlug);
    const subId = order?.stripe_subscription_id ?? null;

    // 5. Vérité Stripe (aucun appel réseau si rien à vérifier).
    const subscription = subId ? await fetchSubscription(subId) : null;

    // 6. Décision PURE, fail-closed.
    const decision = decideEntitlementReconciliation({
      userId,
      agentSlug,
      order: order ? { stripe_subscription_id: order.stripe_subscription_id, stripe_customer_id: order.stripe_customer_id } : null,
      subscription,
    });

    if (!decision.ok) {
      // AUCUNE écriture en base sur refus.
      return NextResponse.json(
        { ok: false, code: decision.code, error: decision.message, status: decision.observedStatus ?? null },
        { status: decision.httpStatus, headers: NO_STORE },
      );
    }

    // 7. Reflet idempotent de la vérité Stripe.
    await upsertOrderActivation(admin, {
      user_id: userId,
      agent_slug: agentSlug,
      status: decision.status,
      stripe_subscription_id: decision.subscriptionId,
      stripe_customer_id: decision.customerId,
    });

    return NextResponse.json(
      { ok: true, activated: true, status: decision.status, agent_slug: agentSlug },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[billing/activate] error:", e instanceof Error ? e.message : "unknown");
    return fail(500, "SERVER_ERROR", "Impossible de réconcilier l'accès pour le moment.");
  }
}
