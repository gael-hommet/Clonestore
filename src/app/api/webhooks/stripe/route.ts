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
// Phase E — founder reservation webhook bridge (E-R2/E-R3).
import { WebhookDatabaseError } from "@/lib/founder-access/webhook-db";
import { applyFounderStripeWebhook } from "@/lib/founder-access/stripe-webhook-bridge";
import { getInjectedStripeWebhookDeps, defaultStripeWebhookDeps, type StripeWebhookDeps } from "@/lib/founder-access/stripe-webhook-deps";
// CloneStory — CS-FINAL 3 : pont contribution commerciale (additif, best-effort,
// universe isolé). N'agit que si le compte porte une attribution CloneStory ; ne casse
// JAMAIS le checkout principal (toute erreur est avalée à l'intérieur du pont).
import { bridgeClonestoryCommercial } from "@/lib/clonestory/founding-partners/server/stripe-commercial-bridge";
// P8.7.4 — additive Pierre commercial bridge. INERT unless the event carries explicit pierre_synthetic=true
// controlled-journey metadata; fully error-swallowed; never affects the orders/founder/CloneStory flows.
import { bridgePierreCommercial } from "@/lib/pierre/v1/pierre-stripe-commercial-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Récupère la preuve commerciale (prix/montant/devise/intervalle) depuis Stripe pour un
// abonnement donné. Best-effort : si l'API n'est pas joignable, retourne null (la preuve
// sera considérée manquante → pas d'activation en production).
async function fetchSubscriptionProof(stripe: Stripe, subId: string): Promise<{ priceId: string | null; amountCents: number | null; currency: string | null; interval: string | null; productId: string | null } | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
    const item = sub.items?.data?.[0];
    const price = item?.price;
    const product = price?.product;
    return {
      priceId: price?.id ?? null,
      amountCents: typeof price?.unit_amount === "number" ? price.unit_amount : null,
      currency: price?.currency ?? null,
      interval: price?.recurring?.interval ?? null,
      productId: typeof product === "string" ? product : (product?.id ?? null),
    };
  } catch {
    return null;
  }
}

// ── Pont VÉRITÉ Stripe → réservation fondateur (E.4 + E-R2) ─────────────────
// Délègue à applyFounderStripeWebhook (logique extraite + testable avec base réelle).
// N'agit QUE si la metadata Stripe porte founder_reservation_id. Connexion DÉDIÉE.
async function bridgeFounderEvent(deps: StripeWebhookDeps, args: {
  meta: Record<string, string> | null;
  event: Stripe.Event;
  rawStatus: string;
  subId: string | null;
  customerId: string | null;
  isGrantCandidate: boolean;
  currentPeriodEnd?: number | null;
}): Promise<void> {
  if (!args.meta?.["founder_reservation_id"]) return; // pas une activation fondateur
  const db = await deps.getFounderDb(); // §1/§3 — DB dédiée writer (fail-closed prod, jamais pierre_rt_app)
  await applyFounderStripeWebhook(
    db,
    {
      eventId: args.event.id, eventType: args.event.type, eventCreated: args.event.created,
      livemode: args.event.livemode, apiVersion: args.event.api_version ?? null,
      metadata: args.meta, rawStatus: args.rawStatus, subscriptionId: args.subId, customerId: args.customerId,
      currentPeriodEnd: args.currentPeriodEnd ?? null, isGrantCandidate: args.isGrantCandidate,
    },
    {
      expectedPriceId: deps.expectedPriceId,
      expectedProductId: deps.expectedProductId,
      envIsProduction: process.env.NODE_ENV === "production",
      fetchProof: deps.fetchProof,
    },
  );
}

/** Dépendances effectives : injectées (tests) ou par défaut (prod : Supabase + Stripe). */
function resolveDeps(): StripeWebhookDeps {
  const injected = getInjectedStripeWebhookDeps();
  if (injected) return injected;
  return defaultStripeWebhookDeps({
    fetchProof: (subId: string) => fetchSubscriptionProof(getStripe(), subId),
    orders: {
      upsert: (a) => upsertOrderStatus(a),
      updateBySubId: (subId, update) => updateOrderBySubId(subId, update),
    },
  });
}

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

    // Dépendances (injectables en test) résolues APRÈS vérification de signature.
    const deps = resolveDeps();

    // ── CloneStory CS-FINAL 3 : contribution commerciale (additif, best-effort) ──
    // Couvre invoice.paid (paiement autoritatif), remboursements, litiges, expiration.
    // Idempotent (ledger d'event Stripe) ; n'agit que si une attribution existe ;
    // n'affecte ni l'ordre principal, ni le statut HTTP renvoyé à Stripe.
    await bridgeClonestoryCommercial(event, {
      resolveSubscriptionMeta: async (subId: string) => {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          const m = (sub.metadata ?? {}) as Record<string, string>;
          return { userId: m["user_id"] ?? null, agentSlug: m["agent_slug"] ?? null };
        } catch {
          return null;
        }
      },
    });

    // ── P8.7.4 Pierre commercial bridge (additive, best-effort, INERT for real traffic) ──
    // Only acts on events explicitly tagged pierre_synthetic=true + pierre_product_key=pierre + a valid
    // pierre_company_id (the controlled journey). Governed billing-webhook role; never the admin/service role.
    // It swallows its own errors and never changes the status returned to Stripe.
    await bridgePierreCommercial(event);

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

      await deps.orders.upsert({
        user_id: validation.user_id,
        agent_slug: validation.agent_slug,
        status: validation.status,
        subId: validation.subscription_id,
        customerId: getString(obj, "customer"),
      });

      // Vérité fondateur (Phase E.4 + E-R2) : activer la réservation si l'event
      // la concerne (preuve requise). Doit être exécuté AVANT le pont BLOC 3
      // pour garantir que la réservation fondateur est persistée d'abord.
      const stripeMetaRaw = getMetadata(obj);
      await bridgeFounderEvent(deps, {
        meta: stripeMetaRaw, event,
        rawStatus: validation.status, subId: validation.subscription_id,
        customerId: getString(obj, "customer"), isGrantCandidate: true,
      });

      // ── BLOC 3 : pont conversion (additif, best-effort) ─────────
      // N'agit QUE si la metadata Stripe contient conversion_session_id
      // ET le backend conversion est disponible. Idempotent, ne bloque pas.
      if (stripeMetaRaw?.["conversion_session_id"] && isConversionBackendAvailable()) {
        bridgeCheckoutCompleted({ metadata: stripeMetaRaw, orderId: validation.subscription_id });
        if (isAccessGranted(validation.status)) {
          bridgePierreActivated({ sessionId: stripeMetaRaw["conversion_session_id"] });
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

      await deps.orders.upsert({
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
        await deps.orders.updateBySubId(subId, { status, ended_at: null });
      } else if (isAccessRevoked(status)) {
        const now = new Date().toISOString();
        await deps.orders.updateBySubId(subId, { status, ended_at: now });
      } else if (status === "past_due") {
        await deps.orders.updateBySubId(subId, { status: "past_due" });
      }

      await bridgeFounderEvent(deps, {
        meta: getMetadata(obj), event,
        rawStatus: stripeStatus ?? "", subId, customerId: getString(obj, "customer"),
        isGrantCandidate: isAccessGranted(status), currentPeriodEnd: getNumber(obj, "current_period_end"),
      });

      return json(200, { received: true, type: event.type, subId, status });
    }

    // ── customer.subscription.deleted ─────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "id");
      if (subId) {
        const now = new Date().toISOString();
        await deps.orders.updateBySubId(subId, { status: "canceled", ended_at: now });
      }

      await bridgeFounderEvent(deps, {
        meta: getMetadata(obj), event,
        rawStatus: "canceled", subId, customerId: getString(obj, "customer"), isGrantCandidate: false,
      });

      return json(200, { received: true, type: event.type, subId });
    }

    // ── invoice.payment_failed ─────────────────────────────────
    if (event.type === "invoice.payment_failed") {
      const obj: unknown = event.data.object;
      if (!isRecord(obj)) return json(200, { received: true });

      const subId = getString(obj, "subscription");
      if (subId) {
        await deps.orders.updateBySubId(subId, { status: "past_due" });
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
    // §1/§5 — DB webhook dédiée non configurée/prête en production → 503 (Stripe retry), jamais 200.
    if (e instanceof WebhookDatabaseError) {
      console.error("[webhook] dedicated DB not ready (fail-closed):", e.name);
      return json(503, { error: "webhook_database_not_ready" });
    }
    const msg = e instanceof Error ? e.message : "Webhook failed";
    console.error("[webhook] error:", msg);
    return json(500, { error: msg });
  }
}
