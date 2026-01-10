import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2025-11-17.clover" as any });
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, service, { auth: { persistSession: false } });
}

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

function pick<T>(...vals: Array<T | null | undefined>) {
  for (const v of vals) if (v !== null && v !== undefined) return v;
  return null;
}

async function upsertActive(user_id: string, agent_slug: string, subId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .upsert(
      {
        user_id,
        agent_slug,
        status: "active",
        started_at: now,
        ended_at: null,
        stripe_subscription_id: subId,
      },
      { onConflict: "user_id,agent_slug" }
    );

  if (error) throw new Error(error.message);
}

async function cancelBySubId(subId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", ended_at: now })
    .eq("stripe_subscription_id", subId);

  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return json(400, { error: "Missing stripe-signature" });

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return json(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });

    const rawBody = await req.text();
    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "signature verify failed";
      return json(400, { error: msg });
    }

    // ✅ Activation: on prend DIRECTEMENT metadata sur subscription (fiable en re-embauche)
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const user_id = typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;
      const agent_slug = typeof sub.metadata?.agent_slug === "string" ? sub.metadata.agent_slug : null;

      if (sub.status === "active" && user_id && agent_slug) {
        await upsertActive(user_id, agent_slug, sub.id);
      }

      return json(200, { received: true, type: event.type, sub: sub.id });
    }

    // ✅ Résiliation
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.id) await cancelBySubId(sub.id);
      return json(200, { received: true, type: event.type, sub: sub.id });
    }

    return json(200, { received: true, type: event.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook failed";
    return json(500, { error: msg });
  }
}
















