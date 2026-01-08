import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover" as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

async function syncSubscription(sub: any) {
  const subId = sub?.id ?? null;
  const stripeStatus = sub?.status ?? null; // active | canceled | past_due | etc.
  const cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);

  const currentPeriodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const user_id = sub?.metadata?.user_id ?? null;
  const agent_slug = sub?.metadata?.agent_slug ?? null;

  console.log("[syncSubscription]", { subId, stripeStatus, cancelAtPeriodEnd, user_id, agent_slug });

  if (!user_id || !agent_slug) {
    console.log("[syncSubscription] missing metadata -> ignored", { subId });
    return;
  }

  const isActive = stripeStatus === "active" || stripeStatus === "trialing";

  const now = new Date().toISOString();

  const row = {
    user_id,
    agent_slug,
    status: isActive ? "active" : stripeStatus === "past_due" ? "past_due" : "cancelled",
    stripe_subscription_id: subId,
    // si active => ended_at null, sauf si cancel_at_period_end => fin de période
    ended_at: isActive ? (cancelAtPeriodEnd ? currentPeriodEnd : null) : now,
    updated_at: now,
    // On remet started_at quand ça redevient actif (ré-embauche)
    started_at: isActive ? now : undefined,
  };

  const { error } = await supabaseAdmin
    .from("orders")
    .upsert(row, { onConflict: "user_id,agent_slug" });

  if (error) throw new Error("Supabase upsert failed: " + error.message);

  console.log("[syncSubscription] ✅ upsert OK", { subId, user_id, agent_slug, status: row.status });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "Missing stripe-signature header" });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return json(400, { error: `Signature failed: ${err?.message || "unknown"}` });
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as any;
      await syncSubscription(sub);
      return json(200, { received: true, type: event.type, subId: sub?.id });
    }

    return json(200, { received: true, ignored: true, type: event.type });
  } catch (err: any) {
    console.error("[webhook fatal]", err);
    return json(500, { error: err?.message || "Webhook handler failed" });
  }
}















