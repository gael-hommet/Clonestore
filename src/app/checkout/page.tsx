import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;

    // 🔎 Lire le body en JSON (sinon {}, pour éviter crash)
    const body = await req.json().catch(() => ({}));

    // ✅ ultra tolérant sur les noms
    const user_id =
      body?.user_id ??
      body?.userId ??
      body?.uid ??
      body?.user ??
      null;

    const agent_slug =
      body?.agent_slug ??
      body?.agentSlug ??
      body?.agent ??
      body?.slug ??
      null;

    if (!user_id || !agent_slug) {
      return NextResponse.json(
        {
          error: "Paramètres manquants (user_id et agent_slug).",
          received: body, // 👈 ça te dit EXACTEMENT ce que l’API a reçu
        },
        { status: 400 }
      );
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: "STRIPE_PRICE_ID manquant (vérifie .env.local)" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || `${origin}/paiement/success`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${origin}/paiement/cancel`,
      metadata: { user_id, agent_slug },
      subscription_data: { metadata: { user_id, agent_slug } },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[checkout] error:", e);
    return NextResponse.json(
      { error: e?.message || "Erreur Stripe (checkout session)" },
      { status: 500 }
    );
  }
}







