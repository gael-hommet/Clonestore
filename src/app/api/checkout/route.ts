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
import { getOrderStatus, getStripeCustomerIdForUser } from "@/lib/billing/order-activation";
// Mapping User ↔ Stripe Customer : un seul Customer par utilisateur, clés d'idempotence
// déterministes sur les écritures Stripe (POST) pour neutraliser double-clics et retries.
import {
  decideCustomerBinding,
  toCustomerView,
  customerIdempotencyKey,
  checkoutIdempotencyKey,
} from "@/lib/billing/customer-mapping";
// P10 — tarification par pays (opt-in via STRIPE_COUNTRY_PRICING_ENABLED). Server-authoritative.
import { isCountryPricingEnabled } from "@/lib/clonestore/pricing/pricing-flags";
import { resolvePierreCheckoutPricing } from "@/lib/clonestore/pricing/checkout-pricing-server";
import { isP10ProductionAuthorized } from "@/lib/clonestore/production/p10-production-gate";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";
import { paymentExplicitlyBlocked } from "@/lib/clonestore/production/p15-1-payment-mode";
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
// Canonical Analytics Runtime Wiring — checkout_session_created (SERVER_CONFIRMED), additif,
// best-effort BORNÉ, uniquement après création RÉELLE de la session Stripe. Ne bloque jamais le
// paiement. Corrélé au visiteur/session d'origine (cookies signés) et à la réservation.
import { getAnalyticsDbForIngestion } from "@/lib/analytics/runtime";
import { recordCanonicalServerEvent, resolveAnalyticsEnvironment, boundedAnalyticsWrite } from "@/lib/analytics/server-events";
import { readVisitorId, readSessionId } from "@/lib/analytics/identity";
import { upsertConversionLink, hashRef } from "@/lib/analytics/correlation";

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

/** Identité SERVEUR : dérivée du Bearer validé, jamais du body. */
type AuthenticatedUser = { id: string; email: string | null };

async function authenticate(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<AuthenticatedUser> {
  const token = tryReadBearerToken(request);
  if (!token) {
    throw { status: 401, code: "AUTH_REQUIRED", message: "Connexion requise pour continuer." };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw { status: 401, code: "AUTH_INVALID", message: "Session invalide. Veuillez vous reconnecter." };
  }
  return { id: data.user.id, email: data.user.email ?? null };
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
    const { id: userId } = await authenticate(request, supabaseAdmin);

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
    const { id: userId, email: userEmail } = await authenticate(request, supabaseAdmin);

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

    // P15.1 — Mode démo/pré-lancement : si le paiement est EXPLICITEMENT désactivé (CLONESTORE_PAYMENT_MODE=
    // disabled) ou si des clés live sont présentes sans autorisation de production, on NE crée AUCUNE session.
    // Additif : ne se déclenche pas sur « aucune clé » (503 existant). Aucun secret, aucun paiement.
    if (paymentExplicitlyBlocked(process.env)) {
      return json(200, {
        ok: false,
        code: "PAYMENT_DISABLED",
        error: "Le paiement en ligne n'est pas encore ouvert. L'accès payant sera activé après l'activation du compte de paiement Stripe et la validation des documents externes. Vous pouvez demander une démo ou un accès fondateur.",
        paymentMode: "disabled",
        demoUrl: "/demo",
        founderAccessUrl: "/reserver/pierre",
      });
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

    // LEGAL AND COMMERCIAL TRUST CLOSURE (2026-07-24) — acceptance des CGV/confidentialité
    // requise avant toute création de session. Le checkbox client (non précoché) n'est qu'une
    // UX ; l'application est ici, côté serveur, pour qu'aucun appelant ne puisse la contourner.
    // Enregistrée dans la même metadata bag Stripe que le reste (pas de nouvelle table/migration).
    const legalAcceptance = (body as Record<string, unknown>).legal_acceptance as
      | Record<string, unknown>
      | undefined;
    const cgvVersion =
      legalAcceptance && typeof legalAcceptance.cgv_version === "string" ? legalAcceptance.cgv_version : null;
    const privacyVersion =
      legalAcceptance && typeof legalAcceptance.privacy_version === "string"
        ? legalAcceptance.privacy_version
        : null;
    const legalAcceptedAt =
      legalAcceptance && typeof legalAcceptance.accepted_at === "string" ? legalAcceptance.accepted_at : null;
    if (!cgvVersion || !privacyVersion || !legalAcceptedAt || Number.isNaN(Date.parse(legalAcceptedAt))) {
      return json(400, {
        ok: false,
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        error: "Merci d'accepter les CGV et la politique de confidentialité avant de continuer.",
      });
    }

    const isProd = process.env.NODE_ENV === "production";

    // ── P10 : TARIFICATION PAR PAYS (opt-in). Server-authoritative. Le client ne contrôle pas le prix.
    //    Résout le pays de facturation autoritatif, applique le guard (CH↔CHF, FR/BE/LU↔EUR),
    //    dérive le price_id Stripe correct (canon + config, fail-closed, aucun repli inter-devise),
    //    et journalise la décision. Désactivé par défaut → chemin legacy inchangé.
    let priceId: string | null;
    let expectedAmount: number = EXPECTED_PIERRE_PRICE_AMOUNT;
    let expectedCurrency: string | null = "eur";
    let resolvedCountry: string | null = null; // P15 : pays résolu SERVEUR (P10) → propagé en metadata pour la réconciliation

    if (agentSlug === "pierre" && isCountryPricingEnabled()) {
      // La garde de production ne dépend PAS seulement de NODE_ENV : si des clés Stripe LIVE sont
      // présentes, on exige l'autorisation owner quel que soit NODE_ENV (anti-misconfiguration).
      const stripeIsLive = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
      const cp = await resolvePierreCheckoutPricing({
        request, body, userId, at: new Date().toISOString(),
        requireProduction: isProd || stripeIsLive, productionReady: isP10ProductionAuthorized(),
      });
      if (!cp.decision.ok) {
        const d = cp.decision;
        // Soft (200) : sélection requise / non supporté / conflit à revoir. Dur (503) : config/prod.
        const status = d.code === "STRIPE_PRICE_NOT_CONFIGURED" || d.code === "PRODUCTION_DISABLED" ? 503 : 200;
        const pr = d.resolvedCountry ? pricingForCountry(d.resolvedCountry) : { status: "country_required" as const };
        return json(status, {
          ok: false,
          code: d.code,
          error: d.message,
          reviewRequired: d.reviewRequired,
          resolvedCountry: d.resolvedCountry,
          pricing: pr.status === "ok" ? { amount: pr.pricing.amount, currency: pr.pricing.currency, display: pr.pricing.display } : null,
          auditId: cp.auditId,
        });
      }
      priceId = cp.priceId;
      expectedAmount = cp.expectedUnitAmount ?? EXPECTED_PIERRE_PRICE_AMOUNT;
      expectedCurrency = cp.expectedCurrency;
      resolvedCountry = cp.decision.resolvedCountry ?? null;
      if (!priceId) {
        return json(503, { ok: false, code: "STRIPE_PRICE_NOT_CONFIGURED", error: "Le paiement pour ce pays n'est pas encore configuré.", auditId: cp.auditId });
      }
    } else {
      priceId = getPriceId(agentSlug);
      if (!priceId) {
        return json(400, { ok: false, code: "PRICE_NOT_CONFIGURED", error: "Aucun tarif configuré pour cet employé IA." });
      }
    }
    if (!priceId) {
      return json(400, { ok: false, code: "PRICE_NOT_CONFIGURED", error: "Aucun tarif configuré pour cet employé IA." });
    }

    // Verify price amount + currency match expected (currency-aware pour P10 : EUR 449 / CHF 499).
    // Stripe Price amounts are immutable — create a new Price in the dashboard if wrong.
    if (agentSlug === "pierre") {
      try {
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount ?? null;
        const cur = (price.currency ?? "").toLowerCase();
        const amountOk = amount === expectedAmount;
        const currencyOk = !expectedCurrency || cur === expectedCurrency;
        if (!amountOk || !currencyOk) {
          console.warn(`[checkout] PRICE_MISMATCH: expected ${expectedAmount} ${expectedCurrency ?? "?"}, got ${amount} ${cur} for ${priceId}`);
          if (isProd) {
            return json(400, {
              ok: false,
              code: currencyOk ? "PRICE_MISMATCH" : "CURRENCY_MISMATCH",
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
    // P15 : propage le pays résolu SERVEUR (P10) + la devise attendue dans la metadata Stripe (session
    // + subscription) pour que la réconciliation pays fonctionne aussi sur les events subscription.*.
    if (resolvedCountry) metadata.selected_country = resolvedCountry;
    if (expectedCurrency) metadata.expected_currency = expectedCurrency;
    const rawRid = (body as Record<string, unknown>).founder_reservation_id;
    if (agentSlug === "pierre" && typeof rawRid === "string" && rawRid.length > 0) {
      // L'email provient de l'authentification initiale — plus de second appel getUser.
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

    // ── Mapping User ↔ Stripe Customer ────────────────────────────────
    // Sans `customer`, Stripe crée un NOUVEAU Customer à chaque session : un utilisateur qui
    // se réabonne (canceled/past_due) ou double-clique accumulait des Customers en doublon.
    // On réutilise donc l'identité de facturation déjà rattachée au compte (tous produits
    // confondus), après avoir vérifié auprès de Stripe qu'elle existe et lui appartient.
    const existingCustomerId = await getStripeCustomerIdForUser(supabaseAdmin, userId);
    let stripeCustomer: unknown = null;
    if (existingCustomerId) {
      try {
        stripeCustomer = await stripe.customers.retrieve(existingCustomerId);
      } catch {
        stripeCustomer = null; // introuvable → on en recrée un (décision ci-dessous)
      }
    }

    const binding = decideCustomerBinding({
      userId,
      existingCustomerId,
      customer: toCustomerView(stripeCustomer),
    });

    if (!binding.ok) {
      // Customer rattaché à un AUTRE utilisateur : incohérence de données. On refuse plutôt
      // que de créer un doublon qui masquerait la corruption.
      console.error(`[checkout] ${binding.code} user=${userId} customer=${existingCustomerId}`);
      return json(binding.httpStatus, { ok: false, code: binding.code, error: binding.message });
    }

    // Création sous clé d'idempotence : deux requêtes concurrentes → un seul Customer.
    const customerId =
      binding.action === "reuse"
        ? binding.customerId
        : (
            await stripe.customers.create(
              { email: userEmail ?? undefined, metadata: { user_id: userId } },
              { idempotencyKey: customerIdempotencyKey(userId) },
            )
          ).id;

    // ── Programme partenaires : rattachement d'attribution (additif, flag OFF par défaut) ──
    // Server-authoritative : userId vient du Bearer validé, le touch_key du cookie SIGNÉ (la
    // vérité vit en base). Best-effort, jamais bloquant. L'attribution sera VERROUILLÉE à la
    // 1ʳᵉ facture payée par le pont webhook.
    try {
      const { isPartnerProgramEnabled } = await import("@/lib/partner-program/flags");
      if (isPartnerProgramEnabled()) {
        const { readReferralTouchKey } = await import("@/lib/partner-program/server/referral-cookie");
        const touchKey = readReferralTouchKey(request.headers.get("cookie"));
        if (touchKey) {
          const { getPartnerDb, withService } = await import("@/lib/partner-program/server/runtime");
          const { attachAttributionAtSignup } = await import("@/lib/partner-program/server/attribution");
          const db = await getPartnerDb();
          await withService(db, (tx) => attachAttributionAtSignup(tx, { subjectUserId: userId, subjectEmail: userEmail, touchKey }));
        }
      }
    } catch { /* best-effort : ne bloque jamais le checkout */ }

    // user_id comes from the validated Bearer token — never from client body
    // trial_period_days: 7 — card collected now, charged after trial unless cancelled
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        // Customer stable : historique de facturation, Billing Portal et analyses restent cohérents.
        customer: customerId,
        // Rattachement natif Stripe → l'utilisateur est identifiable dans le Dashboard et sur
        // la session, même si la metadata venait à être altérée.
        client_reference_id: userId,
        // P15 : garantit la collecte de l'adresse de facturation → pays de facturation présent pour la
        // réconciliation pays (customer_details.address.country), au lieu de dépendre du pays de la carte.
        billing_address_collection: "required",
        // Recopie l'adresse/nom collectés SUR le Customer. Sans cela, `customers.retrieve().address`
        // reste vide et la réconciliation pays des events subscription.* (P15) perd son signal.
        customer_update: { address: "auto", name: "auto" },
        line_items: [{ price: priceId, quantity: 1 }],
        success_url,
        cancel_url,
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata,
        },
        metadata,
      },
      // Double-clic / retry réseau dans les 24 h → Stripe renvoie la session d'origine
      // au lieu d'en créer une seconde. Le priceId est dans la clé : un changement de tarif
      // (ex. bascule EUR→CHF via P10) crée légitimement une nouvelle session.
      { idempotencyKey: checkoutIdempotencyKey({ userId, agentSlug, priceId }) },
    );

    if (!session.url) {
      return jsonError(500, "Impossible de créer la session de paiement.", "STRIPE_SESSION_ERROR");
    }

    // Canonique (additif, best-effort BORNÉ) : checkout_session_created, après création RÉELLE de
    // la session Stripe. Jamais l'URL Stripe, ni le Price ID, ni le customer, ni le client secret —
    // seulement pays/devise résolus SERVEUR + tranche de montant. Corrélé au visiteur/session
    // d'origine (cookies signés) et à la réservation. N'échoue et ne retarde jamais le checkout.
    {
      const env = resolveAnalyticsEnvironment();
      const cookieHeader = request.headers.get("cookie");
      const visitorId = readVisitorId(cookieHeader);
      const sessionId = readSessionId(cookieHeader);
      const founderReservationId = typeof metadata.founder_reservation_id === "string" ? metadata.founder_reservation_id : null;
      const checkoutRef = hashRef(session.id);
      await boundedAnalyticsWrite(async () => {
        const analyticsDb = await getAnalyticsDbForIngestion();
        if (!analyticsDb) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
        // Lie la session Stripe (hachée) + user + visitor/session à la réservation, pour que le
        // webhook (sans cookie) puisse retrouver l'origine.
        if (founderReservationId) {
          await upsertConversionLink(analyticsDb, {
            reservationId: founderReservationId, environment: env,
            visitorId, sessionId, authenticatedUserId: userId, checkoutSessionRef: checkoutRef,
          });
        }
        return recordCanonicalServerEvent(analyticsDb, {
          eventName: "checkout_session_created",
          stableKey: `checkout-session-created:${session.id}`,
          trustLevel: "SERVER_CONFIRMED",
          countryCode: resolvedCountry,
          currency: expectedCurrency,
          amountMinor: expectedAmount,
          authenticatedUserId: userId,
          visitorId,
          sessionId,
        });
      });
    }

    return json(200, { ok: true, url: session.url });
  } catch (e) {
    if (isAuthError(e)) return jsonError(e.status, e.message, e.code);
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return jsonError(500, msg, "SERVER_ERROR");
  }
}
