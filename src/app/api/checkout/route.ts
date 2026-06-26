// src/app/api/checkout/route.ts
// Checkout session creation — B31.4.
// user_id is ALWAYS derived from the Bearer token. Never trusted from the body.
// agent_slug comes from body (POST) or query param (GET).

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBaseUrl } from "@/lib/base-url";
import { hasPierreAccess } from "@/lib/pierre/access";
import { normalizeAgentSlug } from "@/lib/checkout/checkout-helpers";
import { EXPECTED_PIERRE_PRICE_AMOUNT, TRIAL_PERIOD_DAYS } from "@/lib/billing/stripe-activation";
import { getOrderStatus } from "@/lib/billing/order-activation";
// BLOC 3 — pont conversion (additif, ne change pas l'auth/billing existante).
import { readConversionSessionId } from "@/lib/clonestore/conversion/session";
import {
  bridgeCheckoutStarted,
  buildConversionCheckoutMetadata,
} from "@/lib/clonestore/conversion/checkout-bridge";
import { getConversionSession, isConversionBackendAvailable } from "@/lib/clonestore/conversion/storage";
// Phase E — founder reservation strict validation (E-R1 §8)
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { getReservationForActivation } from "@/lib/founder-access/store";
import { getFounderPhase } from "@/lib/founder-access/commercial";
import { normalizeEmail } from "@/lib/founder-access/validation";
import { evaluateFounderCheckout, type CheckoutEligibility } from "@/lib/founder-access/checkout-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// E-R1 §8 — Quand `founder_reservation_id` est PRÉSENT, la validation est STRICTE
// (logique pure dans checkout-eligibility.ts). Tout cas invalide → erreur.
async function validateFounderReservation(
  raw: unknown, userId: string, userEmail: string | null,
): Promise<CheckoutEligibility> {
  if (typeof raw !== "string" || !FA_UUID_RE.test(raw)) {
    return { ok: false, code: "FOUNDER_RESERVATION_INVALID", message: "Réservation fondatrice invalide." };
  }
  const db = await getRuntimeDb();
  const reservation = await getReservationForActivation(db, raw);
  return evaluateFounderCheckout({
    reservation, phase: getFounderPhase(), userId,
    userEmailNormalized: userEmail ? normalizeEmail(userEmail) : null,
  });
}

// ── Supabase admin ──────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

async function authenticate(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const token = tryReadBearerToken(request);
  if (!token) {
    throw { status: 401, code: "AUTH_REQUIRED", message: "Connexion requise pour continuer." };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw { status: 401, code: "AUTH_INVALID", message: "Session invalide. Veuillez vous reconnecter." };
  }
  return data.user.id;
}

// ── Stripe ──────────────────────────────────────────────────────

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-11-17.clover" as Stripe.LatestApiVersion });
}

function getPriceId(agentSlug: string): string | null {
  if (agentSlug === "pierre") return process.env.STRIPE_PRICE_PIERRE ?? null;
  if (agentSlug === "clara") return process.env.STRIPE_PRICE_CLARA ?? null;
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

function jsonError(status: number, message: string, code: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

type AuthError = { status: number; code: string; message: string };

function isAuthError(e: unknown): e is AuthError {
  return typeof e === "object" && e !== null && "status" in e && "code" in e;
}

// ── GET /api/checkout?agent_slug=pierre ─────────────────────────
// Proactive access status check. Bearer required. No side effects.

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticate(request, supabaseAdmin);

    const rawSlug = request.nextUrl.searchParams.get("agent_slug");
    const agentSlug = normalizeAgentSlug(rawSlug);

    if (!agentSlug) {
      return jsonError(400, "Employé IA introuvable.", "AGENT_SLUG_REQUIRED");
    }

    let active = false;
    let orderStatus = "none";
    if (agentSlug === "pierre") {
      const res = await hasPierreAccess(supabaseAdmin, userId);
      active = res.ok;
      if (active) {
        const order = await getOrderStatus(supabaseAdmin, userId, agentSlug);
        orderStatus = order?.status ?? "active";
      }
    }

    return json(200, {
      ok: true,
      agent_slug: agentSlug,
      active,
      status: orderStatus,
      can_checkout: !active,
      redirect_url: active ? "/agents/pierre/use" : null,
    });
  } catch (e) {
    if (isAuthError(e)) return jsonError(e.status, e.message, e.code);
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return jsonError(500, msg, "SERVER_ERROR");
  }
}

// ── POST /api/checkout ──────────────────────────────────────────
// Creates a Stripe checkout session. Bearer required. user_id from token only.

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticate(request, supabaseAdmin);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawSlug = typeof body.agent_slug === "string" ? body.agent_slug : null;
    const agentSlug = normalizeAgentSlug(rawSlug);

    if (!agentSlug) {
      return jsonError(400, "Employé IA introuvable.", "AGENT_SLUG_REQUIRED");
    }

    // Check if already active — avoids duplicate checkout
    if (agentSlug === "pierre") {
      const res = await hasPierreAccess(supabaseAdmin, userId);
      if (res.ok) {
        return json(200, {
          ok: true,
          already_active: true,
          redirect_url: "/agents/pierre/use",
        });
      }
    }

    // Stripe must be configured
    const stripe = getStripeClient();
    if (!stripe) {
      return json(503, {
        ok: false,
        code: "STRIPE_NOT_CONFIGURED",
        error: "Le paiement n'est pas encore configuré sur cet environnement.",
      });
    }

    const priceId = getPriceId(agentSlug);
    if (!priceId) {
      return json(400, {
        ok: false,
        code: "PRICE_NOT_CONFIGURED",
        error: "Aucun tarif configuré pour cet employé IA.",
      });
    }

    // Verify price amount matches expected (449 EUR for pierre).
    // Stripe Price amounts are immutable — create a new Price in the dashboard if wrong.
    if (agentSlug === "pierre") {
      try {
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount ?? null;
        if (amount !== EXPECTED_PIERRE_PRICE_AMOUNT) {
          console.warn(
            `[checkout] PRICE_MISMATCH: expected ${EXPECTED_PIERRE_PRICE_AMOUNT} cents, got ${amount} for ${priceId}`
          );
          const isProd = process.env.NODE_ENV === "production";
          if (isProd) {
            return json(400, {
              ok: false,
              code: "PRICE_MISMATCH",
              error: "Le tarif Pierre n'est pas correctement configuré sur cet environnement.",
            });
          }
        }
      } catch (priceErr) {
        console.warn("[checkout] Could not verify price amount:", priceErr instanceof Error ? priceErr.message : priceErr);
        // Non-blocking in dev/test — proceed with checkout
      }
    }

    const base = getBaseUrl();
    // {CHECKOUT_SESSION_ID} is a Stripe template variable — substituted with the real ID after payment.
    const success_url = new URL(
      `/paiement/success?agent=${agentSlug}&session_id={CHECKOUT_SESSION_ID}`,
      base
    ).toString();
    const cancel_url = new URL(`/paiement/cancel?agent=${agentSlug}`, base).toString();

    // Liaison fondateur (Phase E.4 + E-R1 §8) — STRICTE quand un rid est fourni.
    const metadata: Record<string, string> = { user_id: userId, agent_slug: agentSlug };
    const rawRid = (body as Record<string, unknown>).founder_reservation_id;
    if (agentSlug === "pierre" && typeof rawRid === "string" && rawRid.length > 0) {
      let userEmail: string | null = null;
      try {
        const { data: u } = await supabaseAdmin.auth.getUser(tryReadBearerToken(request) ?? undefined);
        userEmail = u.user?.email ?? null;
      } catch { userEmail = null; }
      const check = await validateFounderReservation(rawRid, userId, userEmail);
      if (!check.ok) return jsonError(400, check.message, check.code);
      metadata.founder_reservation_id = check.reservationId;
    }

    // ── BLOC 3 : conversion metadata + bridge (additif, non bloquant) ───
    // Source = cookie signé `cs_conversion_session`. Aucune valeur lue depuis
    // le body navigateur. Si pas de session conversion : checkout normal sans
    // metadata marketing (visiteur organique).
    const conversionSessionId = readConversionSessionId(request.headers.get("cookie"));
    const conversionSession = conversionSessionId && isConversionBackendAvailable()
      ? getConversionSession(conversionSessionId)
      : null;
    if (conversionSession) {
      const built = buildConversionCheckoutMetadata({
        conversionSessionId: conversionSession.id,
        userId,
        agentSlug,
        founderReservationId: metadata.founder_reservation_id ?? null,
      });
      if (built.ok) {
        // Merge additif : les clés Phase E (user_id, agent_slug, founder_reservation_id)
        // sont conservées ; les clés BLOC 3 (campaign, cohort, variant, funnel_version,
        // prospect_token) s'ajoutent.
        for (const [k, v] of Object.entries(built.metadata)) {
          if (!metadata[k]) metadata[k] = v;
        }
        metadata.conversion_session_id = conversionSession.id;
      }
      // best-effort : émettre checkout_started côté serveur (idempotent).
      bridgeCheckoutStarted({ sessionId: conversionSession.id, userId, tenantId: null });
    }

    // user_id comes from the validated Bearer token — never from client body
    // trial_period_days: 7 — card collected now, charged after trial unless cancelled
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata,
      },
      metadata,
    });

    if (!session.url) {
      return jsonError(500, "Impossible de créer la session de paiement.", "STRIPE_SESSION_ERROR");
    }

    return json(200, { ok: true, url: session.url });
  } catch (e) {
    if (isAuthError(e)) return jsonError(e.status, e.message, e.code);
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return jsonError(500, msg, "SERVER_ERROR");
  }
}
