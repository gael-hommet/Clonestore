import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, service, { auth: { persistSession: false } });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function getMetadata(obj: Record<string, unknown>): Record<string, unknown> | null {
  const meta = obj["metadata"];
  return isRecord(meta) ? meta : null;
}

async function upsertActive(args: {
  user_id: string;
  agent_slug: string;
  subId: string;
  customerId: string | null;
}) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("orders")
    .upsert(
      {
        user_id: args.user_id,
        agent_slug: args.agent_slug,
        status: "active",
        started_at: now,
        ended_at: null,
        stripe_subscription_id: args.subId,
        stripe_customer_id: args.customerId,
      },
      { onConflict: "user_id,agent_slug" }
    );

  if (error) throw new Error(error.message);
}

async function setCancelledBySubId(subId: string) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("orders")
    .update({ status: "cancelled", ended_at: now })
    .eq("stripe_subscription_id", subId);

  if (error) throw new Error(error.message);
}

async function setPastDueBySubId(subId: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("orders")
    .update({ status: "past_due" })
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
      const msg = e instanceof Error ? e.message : "Webhook signature verification failed";
      return json(400, { error: msg });
    }

    // ✅ 0) CHECKOUT COMPLETED = source de vérité
    if (event.type === "checkout.session.completed") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true, note: "Invalid object" });

      const mode = getString(obj, "mode"); // "subscription"
      const payment_status = getString(obj, "payment_status"); // "paid"
      const subId = getString(obj, "subscription");
      const customerId = getString(obj, "customer");

      const meta = getMetadata(obj);
      const user_id = meta && typeof meta["user_id"] === "string" ? (meta["user_id"] as string) : null;
      const agent_slug = meta && typeof meta["agent_slug"] === "string" ? (meta["agent_slug"] as string) : null;

      // On active seulement si paiement OK + subscription id présent
      if (mode === "subscription" && payment_status === "paid" && subId && user_id && agent_slug) {
        await upsertActive({ user_id, agent_slug, subId, customerId });
      }

      return json(200, { received: true, type: event.type, subId, payment_status });
    }

    // ✅ 1) SUBSCRIPTION updated : utile pour past_due / etc.
    if (event.type === "customer.subscription.updated") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true, note: "Invalid object" });

      const subId = getString(obj, "id");
      const status = getString(obj, "status");
      if (!subId) return json(200, { received: true, note: "Missing subscription id" });

      if (status === "past_due") {
        await setPastDueBySubId(subId);
      }

      return json(200, { received: true, type: event.type, subId, status });
    }

    // ✅ 2) SUBSCRIPTION DELETED
    if (event.type === "customer.subscription.deleted") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true, note: "Invalid object" });

      const subId = getString(obj, "id");
      if (subId) await setCancelledBySubId(subId);

      return json(200, { received: true, type: event.type, subId });
    }

    // ✅ 3) PAYMENT FAILED => past_due
    if (event.type === "invoice.payment_failed") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true, note: "Invalid object" });

      const subId = getString(obj, "subscription");
      if (subId) await setPastDueBySubId(subId);

      return json(200, { received: true, type: event.type, subId });
    }

    return json(200, { received: true, type: event.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook failed";
    return json(500, { error: msg });
  }
}





















