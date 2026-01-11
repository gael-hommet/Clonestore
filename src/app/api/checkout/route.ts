import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2025-11-17.clover" });
}

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

type Body = {
  user_id: string;
  agent_slug: string;
};

function getPriceId(agentSlug: string) {
  // adapte si tu as plusieurs prix
  if (agentSlug === "pierre") return process.env.STRIPE_PRICE_PIERRE;
  if (agentSlug === "clara") return process.env.STRIPE_PRICE_CLARA;
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;
    const user_id = typeof body.user_id === "string" ? body.user_id : null;
    const agent_slug = typeof body.agent_slug === "string" ? body.agent_slug : null;

    if (!user_id || !agent_slug) return json(400, { error: "Missing user_id/agent_slug" });

    const priceId = getPriceId(agent_slug);
    if (!priceId) return json(400, { error: "Missing Stripe price for agent" });

    const stripe = getStripe();
    const base = getBaseUrl();

    const success_url = new URL("/paiement/success", base).toString();
    const cancel_url = new URL("/paiement/cancel", base).toString();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      // IMPORTANT : metadata sur subscription (fiable pour webhooks)
      subscription_data: {
        metadata: { user_id, agent_slug },
      },
      metadata: { user_id, agent_slug },
    });

    if (!session.url) return json(500, { error: "No checkout url" });
    return json(200, { url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Checkout error";
    return json(500, { error: msg });
  }
}








