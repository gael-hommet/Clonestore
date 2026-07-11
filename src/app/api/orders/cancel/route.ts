// src/app/api/orders/cancel/route.ts
// Annulation d'abonnement en LIBRE-SERVICE = cancel_at_period_end (décision produit).
//
// Le client garde Pierre jusqu'au terme déjà payé et peut se rétracter via /api/orders/resume.
// L'annulation IMMÉDIATE n'existe QUE côté admin interne (permission + audit).
//
// Durcissement (remplace la version B31) :
//   • auth EXCLUSIVEMENT serveur (Bearer) — plus de token dans le body ;
//   • aucun subscription_id fourni par le frontend — retrouvé depuis la commande ;
//   • écriture Stripe sous clé d'idempotence ;
//   • aucune mutation locale inventée : le webhook reste la source de vérité ;
//   • plus de message interne exposé, plus de `as any`.

import { NextResponse } from "next/server";
import { applySubscriptionIntent } from "@/lib/billing/subscription-service";
import { authenticateBilling, NO_STORE } from "@/lib/billing/route-auth";
import { normalizeAgentSlug } from "@/lib/checkout/checkout-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await authenticateBilling(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const agentSlug = normalizeAgentSlug(typeof body.agent_slug === "string" ? body.agent_slug : null);
  if (!agentSlug) {
    return NextResponse.json({ ok: false, code: "AGENT_SLUG_REQUIRED", error: "Employé IA introuvable." }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await applySubscriptionIntent({ admin: auth.admin, userId: auth.userId, agentSlug, intent: "cancel_at_period_end" });
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status: result.httpStatus, headers: NO_STORE });
    }
    return NextResponse.json(
      { ok: true, cancel_at_period_end: result.cancelAtPeriodEnd, status: result.status },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[orders/cancel] error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, code: "SERVER_ERROR", error: "Impossible de programmer l'annulation pour le moment." }, { status: 500, headers: NO_STORE });
  }
}
