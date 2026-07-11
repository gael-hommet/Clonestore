// src/app/api/orders/resume/route.ts
// « Conserver mon abonnement » — annule une annulation programmée (cancel_at_period_end=false).
//
// Mêmes garanties que /api/orders/cancel : auth serveur, abonnement retrouvé depuis la
// commande, écriture Stripe idempotente, webhook source de vérité.

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
    const result = await applySubscriptionIntent({ admin: auth.admin, userId: auth.userId, agentSlug, intent: "resume" });
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status: result.httpStatus, headers: NO_STORE });
    }
    return NextResponse.json(
      { ok: true, cancel_at_period_end: result.cancelAtPeriodEnd, status: result.status },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[orders/resume] error:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, code: "SERVER_ERROR", error: "Impossible de reprendre l'abonnement pour le moment." }, { status: 500, headers: NO_STORE });
  }
}
