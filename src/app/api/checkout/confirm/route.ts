// src/app/api/checkout/confirm/route.ts
// B31.8 — Secure Stripe session confirmation fallback.
// POST only. Bearer required. Verifies session against Stripe server-side.
// Does NOT bypass Stripe — requires real payment or trial confirmation from Stripe.
// Idempotent: safe to call multiple times (upsert on user_id,agent_slug).
// This supplements the webhook — webhook remains the primary source in production.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  mapPaymentStatusToActivation,
  isAccessGranted,
} from "@/lib/billing/stripe-activation";
import { upsertOrderActivation } from "@/lib/billing/order-activation";
// P15 — billing-country reconciliation on the confirm activation path (additive, flag-gated).
import { extractCountrySignalsFromSession, evaluateCheckoutReconciliationGate } from "@/lib/clonestore/production/p15-checkout-reconciliation-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Helpers ─────────────────────────────────────────────────────

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

// ── Supabase admin ──────────────────────────────────────────────

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Bearer auth ─────────────────────────────────────────────────

async function authenticateBearer(
  request: NextRequest,
  supabaseAdmin: SupabaseClient
): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") {
    throw { status: 401, code: "AUTH_REQUIRED", message: "Connexion requise." };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token.trim());
  if (error || !data.user) {
    throw { status: 401, code: "AUTH_INVALID", message: "Session invalide. Reconnectez-vous." };
  }
  return data.user.id;
}

// ── Stripe ──────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw { status: 503, code: "STRIPE_NOT_CONFIGURED", message: "Paiement non configuré." };
  return new Stripe(key, { apiVersion: "2025-11-17.clover" as Stripe.LatestApiVersion });
}

// ── POST /api/checkout/confirm ──────────────────────────────────

type ConfirmError = { status: number; code: string; message: string };

function isConfirmError(e: unknown): e is ConfirmError {
  return typeof e === "object" && e !== null && "status" in e && "code" in e;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();

    // 1. Authenticate — user_id comes from Bearer token, never from body
    const userId = await authenticateBearer(request, supabaseAdmin);

    // 2. Parse body
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
    const rawSlug = typeof body.agent_slug === "string" ? body.agent_slug.trim().toLowerCase() : "pierre";
    const agentSlug = rawSlug || "pierre";

    if (!sessionId) {
      return jsonError(400, "SESSION_ID_REQUIRED", "session_id manquant.");
    }

    // 3. Retrieve Stripe session — server-side with secret key
    const stripe = getStripe();
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
    } catch {
      return jsonError(400, "SESSION_NOT_FOUND", "Session de paiement introuvable.");
    }

    // 4. Validate session shape
    if (session.mode !== "subscription") {
      return jsonError(400, "CHECKOUT_NOT_SUBSCRIPTION", "Mode de paiement inattendu.");
    }

    // 5. Verify metadata user_id matches authenticated user
    const meta = session.metadata ?? {};
    const metaUserId = typeof meta["user_id"] === "string" ? meta["user_id"] : null;
    const metaAgentSlug = typeof meta["agent_slug"] === "string" ? meta["agent_slug"] : null;

    if (!metaUserId || metaUserId !== userId) {
      return jsonError(403, "SESSION_USER_MISMATCH", "Cette session ne correspond pas à votre compte.");
    }

    if (!metaAgentSlug || metaAgentSlug !== agentSlug) {
      return jsonError(400, "SESSION_AGENT_MISMATCH", "Employé IA introuvable dans cette session.");
    }

    // 6. Verify payment_status — Stripe must confirm payment/trial
    const paymentStatus = session.payment_status;
    if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
      return jsonError(
        402,
        "CHECKOUT_NOT_CONFIRMED",
        "Le paiement n'a pas encore été confirmé par Stripe."
      );
    }

    // 7. Determine activation status
    const activationStatus = mapPaymentStatusToActivation(paymentStatus);
    if (!isAccessGranted(activationStatus)) {
      return jsonError(
        402,
        "SUBSCRIPTION_NOT_ACTIVE",
        "L'abonnement n'est pas encore actif."
      );
    }

    // 8. Get subscription ID
    const sub = session.subscription;
    const subscriptionId =
      typeof sub === "string" ? sub : (sub as Stripe.Subscription | null)?.id ?? null;

    if (!subscriptionId) {
      return jsonError(400, "SUBSCRIPTION_MISSING", "Abonnement Stripe introuvable.");
    }

    // 9. Get customer ID
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null;

    // 9b. P15 — réconciliation pays (flag-gated). Un conflit fort (CH facturé EUR, FR/BE/LU en CHF,
    // conflit entreprise, devise incohérente) N'ACTIVE PAS l'accès payant : on renvoie review_required
    // (pas d'écriture d'ordre actif). Flag OFF (défaut) → comportement inchangé, audit loggé.
    const reconSignals = extractCountrySignalsFromSession(session as unknown as Record<string, unknown>);
    const reconGate = evaluateCheckoutReconciliationGate({
      companyCountry: reconSignals.companyCountry,
      selectedCountry: reconSignals.selectedCountry,
      stripeBillingCountry: reconSignals.stripeBillingCountry,
      stripeTaxCountry: reconSignals.stripeTaxCountry,
      chargedCurrency: reconSignals.chargedCurrency,
    }, { env: process.env });
    console.log("[checkout/confirm][p15-reconciliation]", JSON.stringify(reconGate.audit));
    if (!reconGate.shouldActivate) {
      return json(200, { ok: true, activated: false, review_required: true, code: reconGate.decision.code, status: reconGate.activationStatus });
    }

    // 10. Upsert orders — idempotent
    await upsertOrderActivation(supabaseAdmin, {
      user_id: userId,
      agent_slug: agentSlug,
      status: activationStatus,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    });

    return json(200, {
      ok: true,
      activated: true,
      status: activationStatus,
      agent_slug: agentSlug,
    });
  } catch (e) {
    if (isConfirmError(e)) return jsonError(e.status, e.code, e.message);
    const msg = e instanceof Error ? e.message : "Erreur serveur.";
    console.error("[checkout/confirm] error:", msg);
    return jsonError(500, "SERVER_ERROR", "Impossible de confirmer l'activation pour le moment.");
  }
}
