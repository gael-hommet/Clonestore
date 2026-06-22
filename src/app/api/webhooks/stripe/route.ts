// src/app/api/webhooks/stripe/route.ts
// B31.7 — Stripe webhook handler. Source of truth for Supabase order activation.
// Handles: checkout.session.completed (paid + trial), subscription.created,
//          subscription.updated, subscription.deleted, invoice.payment_failed.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  validateCheckoutSession,
  mapSubscriptionStatus,
  isAccessGranted,
  isAccessRevoked,
} from "@/lib/billing/stripe-activation";
// BLOC 3 — pont conversion (additif, ne change pas la signature / ordre / DB).
import {
  bridgeCheckoutCompleted,
  bridgeCheckoutFailed,
  bridgePierreActivated,
} from "@/lib/clonestore/conversion/checkout-bridge";
import { isConversionBackendAvailable } from "@/lib/clonestore/conversion/storage";

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

function getMetadata(obj: Record<string, unknown>): Record<string, string> | null {
  const meta = obj["metadata"];
  if (!isRecord(meta)) return null;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

function getNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" ? v : null;
}

// ── DB helpers ──────────────────────────────────────────────────

async function upsertOrderStatus(args: {
  user_id: string;
  agent_slug: string;
  status: string;
  subId: string;
  customerId: string | null;
  trial_end?: number | null;
  current_period_end?: number | null;
}) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    user_id: args.user_id,
    agent_slug: args.agent_slug,
    status: args.status,
    started_at: now,
    ended_at: null,
    stripe_subscription_id: args.subId,
    stripe_customer_id: args.customerId,
  };

  const { error } = await sb
    .from("orders")
    .upsert(payload, { onConflict: "user_id,agent_slug" });

  if (error) throw new Error(error.message);
}

async function updateOrderBySubId(
  subId: string,
  update: Record<string, unknown>
) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("orders")
    .update(update)
    .eq("stripe_subscription_id", subId);

  if (error) throw new Error(error.message);
}

// ── Main webhook handler ────────────────────────────────────────

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

    // ── checkout.session.completed ─────────────────────────────
    // Handles both immediate payment (paid) and trial (no_payment_required).
    if (event.type === "checkout.session.completed") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const validation = validateCheckoutSession(obj);

      if (!validation.valid || !validation.user_id || !validation.agent_slug || !validation.subscription_id) {
        console.log("[webhook] checkout.session.completed skipped:", validation.reason ?? "invalid");
        return json(200, { received: true, skipped: true, reason: validation.reason });
      }

      await upsertOrderStatus({
        user_id: validation.user_id,
        agent_slug: validation.agent_slug,
        status: validation.status,
        subId: validation.subscription_id,
        customerId: getString(obj, "customer"),
      });

      // ── BLOC 3 : pont conversion (additif, best-effort) ─────────
      // N'agit QUE si la metadata Stripe contient conversion_session_id
      // ET le backend conversion est disponible. Idempotent, ne bloque pas.
      const meta = getMetadata(obj);
      if (meta?.["conversion_session_id"] && isConversionBackendAvailable()) {
        bridgeCheckoutCompleted({ metadata: meta, orderId: validation.subscription_id });
        if (isAccessGranted(validation.status)) {
          bridgePierreActivated({ sessionId: meta["conversion_session_id"] });
        }
      }

      return json(200, {
        received: true,
        type: event.type,
        status: validation.status,
        sub: validation.subscription_id,
      });
    }

    // ── customer.subscription.created ─────────────────────────
    // Fallback: fires after checkout for some Stripe configurations.
    if (event.type === "customer.subscription.created") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "id");
      const stripeStatus = getString(obj, "status");
      const customerId = getString(obj, "customer");
      const status = mapSubscriptionStatus(stripeStatus);

      if (!subId || !isAccessGranted(status)) {
        return json(200, { received: true, skipped: true, reason: `status=${stripeStatus}` });
      }

      // Try to get user_id/agent_slug from subscription metadata
      const meta = getMetadata(obj);
      const user_id = meta?.["user_id"] ?? null;
      const agent_slug = meta?.["agent_slug"] ?? null;

      if (!user_id || !agent_slug) {
        // metadata missing on subscription — checkout.session.completed should cover this
        return json(200, { received: true, skipped: true, reason: "No metadata on subscription" });
      }

      await upsertOrderStatus({
        user_id,
        agent_slug,
        status,
        subId,
        customerId,
        trial_end: getNumber(obj, "trial_end"),
        current_period_end: getNumber(obj, "current_period_end"),
      });

      return json(200, { received: true, type: event.type, status, subId });
    }

    // ── customer.subscription.updated ─────────────────────────
    // Handles: trial→active, active→past_due, active→canceled, etc.
    if (event.type === "customer.subscription.updated") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "id");
      const stripeStatus = getString(obj, "status");
      const status = mapSubscriptionStatus(stripeStatus);

      if (!subId) return json(200, { received: true, skipped: true, reason: "Missing sub ID" });

      if (isAccessGranted(status)) {
        // Keep order active/trialing
        await updateOrderBySubId(subId, { status, ended_at: null });
      } else if (isAccessRevoked(status)) {
        const now = new Date().toISOString();
        await updateOrderBySubId(subId, { status, ended_at: now });
      } else if (status === "past_due") {
        await updateOrderBySubId(subId, { status: "past_due" });
      }

      return json(200, { received: true, type: event.type, subId, status });
    }

    // ── customer.subscription.deleted ─────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "id");
      if (subId) {
        const now = new Date().toISOString();
        await updateOrderBySubId(subId, { status: "canceled", ended_at: now });
      }

      return json(200, { received: true, type: event.type, subId });
    }

    // ── invoice.payment_failed ─────────────────────────────────
    if (event.type === "invoice.payment_failed") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "subscription");
      if (subId) {
        await updateOrderBySubId(subId, { status: "past_due" });
      }

      // BLOC 3 : pont conversion failed (best-effort, ne bloque pas).
      const meta = getMetadata(obj);
      if (meta?.["conversion_session_id"] && isConversionBackendAvailable()) {
        bridgeCheckoutFailed({
          sessionId: meta["conversion_session_id"],
          reason: "invoice.payment_failed",
          orderId: subId,
        });
      }

      return json(200, { received: true, type: event.type, subId });
    }

    return json(200, { received: true, type: event.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook failed";
    console.error("[webhook] error:", msg);
    return json(500, { error: msg });
  }
}
