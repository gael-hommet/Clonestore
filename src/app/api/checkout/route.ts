import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  user_id: string;
  agent_slug: string;
};

// ✅ Stripe est créé UNIQUEMENT dans une fonction, jamais au top-level
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2025-11-17.clover" as unknown as Stripe.LatestApiVersion });
}

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CheckoutBody>;

    const user_id = typeof body.user_id === "string" ? body.user_id : null;
    const agent_slug = typeof body.agent_slug === "string" ? body.agent_slug : null;

    if (!user_id || !agent_slug) {
      return json(400, { error: "Missing user_id or agent_slug" });
    }

    // ✅ ici seulement on initialise Stripe (donc jamais pendant le build)
    const stripe = getStripe();

    // ⚠️ Mets ici ton priceId réel selon l’agent
    // (tu peux déjà mettre un mapping minimal)
    const PRICE_BY_AGENT: Record<string, string> = {
      pierre: process.env.STRIPE_PRICE_PIERRE || "",
      clara: process.env.STRIPE_PRICE_CLARA || "",
    };

    const price = PRICE_BY_AGENT[agent_slug];
    if (!price) {
      return json(500, { error: `Missing price for agent ${agent_slug}` });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/paiement/success`,
      cancel_url: `${baseUrl}/paiement/cancel`,
      subscription_data: {
        metadata: { user_id, agent_slug },
      },
      metadata: { user_id, agent_slug },
    });

    return json(200, { url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Checkout error";
    // ✅ si STRIPE_SECRET_KEY manque, on le voit clairement
    return json(500, { error: msg });
  }
}







