// src/app/api/billing/portal/route.ts
// Crée une session Stripe Billing Portal pour l'utilisateur authentifié.
//
// Le Customer est résolu EXCLUSIVEMENT depuis la relation serveur (orders) — le frontend
// ne peut jamais fournir de customer_id. Vérification d'appartenance avant ouverture.
// Fail-closed : Stripe non configuré → 503 ; aucun customer → 409 (rien à gérer).

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/base-url";
import { getStripeCustomerIdForUser } from "@/lib/billing/order-activation";
import { decideCustomerBinding, toCustomerView } from "@/lib/billing/customer-mapping";
import { authenticateBilling, NO_STORE } from "@/lib/billing/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return fail(503, "STRIPE_NOT_CONFIGURED", "Le paiement n'est pas configuré sur cet environnement.");
  }

  const auth = await authenticateBilling(req);
  if (!auth.ok) return auth.response;

  try {
    const customerId = await getStripeCustomerIdForUser(auth.admin, auth.userId);
    if (!customerId) {
      return fail(409, "NO_CUSTOMER", "Aucun compte de facturation à gérer pour le moment.");
    }

    const stripe = getStripe();

    // Appartenance : le Customer doit exister chez Stripe et être celui de l'utilisateur.
    let customerRaw: unknown = null;
    try {
      customerRaw = await stripe.customers.retrieve(customerId);
    } catch {
      customerRaw = null;
    }
    const binding = decideCustomerBinding({
      userId: auth.userId,
      existingCustomerId: customerId,
      customer: toCustomerView(customerRaw),
    });
    // Ici, seul « reuse » est acceptable : un customer introuvable/supprimé/étranger
    // ne doit pas ouvrir de portail.
    if (!binding.ok || binding.action !== "reuse") {
      return fail(409, "CUSTOMER_UNAVAILABLE", "Compte de facturation indisponible.");
    }

    const returnUrl = new URL("/mon-clonestore/facturation", getBaseUrl()).toString();
    const session = await stripe.billingPortal.sessions.create({
      customer: binding.customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      return fail(502, "PORTAL_SESSION_ERROR", "Impossible d'ouvrir l'espace de facturation.");
    }
    return NextResponse.json({ ok: true, url: session.url }, { headers: NO_STORE });
  } catch (e) {
    // Un Billing Portal non configuré dans le Dashboard renvoie une erreur Stripe explicite.
    const msg = e instanceof Error ? e.message : "";
    if (/configuration/i.test(msg) && /portal/i.test(msg)) {
      return fail(503, "PORTAL_NOT_CONFIGURED", "L'espace de facturation n'est pas encore configuré.");
    }
    console.error("[billing/portal] error:", msg || "unknown");
    return fail(500, "SERVER_ERROR", "Impossible d'ouvrir l'espace de facturation pour le moment.");
  }
}
