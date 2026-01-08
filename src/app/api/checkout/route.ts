import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover" as any,
});

const PRICE_BY_AGENT: Record<string, string | undefined> = {
  pierre: process.env.STRIPE_PRICE_PIERRE,
  clara: process.env.STRIPE_PRICE_CLARA,
  alex: process.env.STRIPE_PRICE_ALEX,
  emma: process.env.STRIPE_PRICE_EMMA,
  noah: process.env.STRIPE_PRICE_NOAH,
};

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const body = await req.json().catch(() => ({}));

    const user_id =
      body?.user_id ?? body?.userId ?? body?.uid ?? body?.user ?? null;

    const agent_slug =
      body?.agent_slug ?? body?.agentSlug ?? body?.agent ?? body?.slug ?? null;

    if (!user_id || !agent_slug) {
      return NextResponse.json(
        { error: "Paramètres manquants (user_id, agent_slug).", received: body },
        { status: 400 }
      );
    }

    const priceId = PRICE_BY_AGENT[agent_slug];
    if (!priceId) {
      return NextResponse.json(
        { error: `Aucun price configuré pour agent_slug=${agent_slug}` },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${origin}/agents/${agent_slug}?success=1`,
      cancel_url: `${origin}/paiement/cancel`,

      // IMPORTANT : metadata sur session ET sur subscription
      metadata: { user_id, agent_slug },
      subscription_data: { metadata: { user_id, agent_slug } },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[checkout] error:", e);
    return NextResponse.json(
      { error: e?.message || "Erreur Stripe (checkout)" },
      { status: 500 }
    );
  }
}






