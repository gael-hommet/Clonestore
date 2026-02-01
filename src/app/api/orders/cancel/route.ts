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
  return new Stripe(key, { apiVersion: "2025-11-17.clover" as any });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { agent_slug?: string; access_token?: string };
    const agent_slug = body.agent_slug;
    const access_token = body.access_token;

    if (!agent_slug) return json(400, { error: "Missing agent_slug" });
    if (!access_token) return json(401, { error: "Missing access_token" });

    const sb = getSupabaseAdmin();

    // 1) qui est l'utilisateur ?
    const { data: userRes, error: userErr } = await sb.auth.getUser(access_token);
    if (userErr || !userRes?.user) return json(401, { error: "Auth session missing!" });

    const user_id = userRes.user.id;

    // 2) on récupère LA subId depuis orders
    const { data: order, error: selErr } = await sb
      .from("orders")
      .select("stripe_subscription_id,status")
      .eq("user_id", user_id)
      .eq("agent_slug", agent_slug)
      .maybeSingle();

    if (selErr) return json(500, { error: selErr.message });
    const subId = order?.stripe_subscription_id ?? null;

    if (!subId) {
      return json(400, {
        error: "Missing subscription id (orders.stripe_subscription_id est vide). Corrige le webhook, puis ré-essaie.",
      });
    }

    // 3) annulation côté Stripe (immédiate)
    const stripe = getStripe();
    await stripe.subscriptions.cancel(subId);

    // 4) et on marque cancelled en DB (sécurité, même si webhook va le faire)
    const now = new Date().toISOString();
    await sb
      .from("orders")
      .update({ status: "cancelled", ended_at: now })
      .eq("user_id", user_id)
      .eq("agent_slug", agent_slug);

    return json(200, { ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cancel failed";
    return json(500, { error: msg });
  }
}

