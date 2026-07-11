// src/lib/clonestore/pricing/checkout-pricing-server.ts
// P10 §5 — Orchestration SERVEUR de la tarification par pays au checkout. Extrait les signaux
// de la requête (jamais de confiance au prix/pays client), résout le pays de facturation vérifié
// (lecture seule P8, best-effort), applique le guard, résout le VRAI price_id Stripe (canon +
// config), et journalise la décision (audit privacy-safe). Server-only.

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { getClientIp } from "@/lib/founder-access/request-utils";
import { readStripePriceConfig, resolveStripePriceIdForCountry } from "./stripe-pricing-config";
import { evaluateCheckoutCountryGuard, type CheckoutGuardDecision } from "./checkout-country-guard";
import { recordPricingDecision, type PricingDecisionOutcome, type PricingAuditSink } from "./pricing-audit";
import { expectedUnitAmountForCountry, expectedStripeCurrencyForCountry, type Currency } from "./country-pricing";

const strOf = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Pays d'immatriculation de l'entreprise vérifiée (lecture seule P8, best-effort). Null si 0/plusieurs
 *  entreprises actives ou en cas d'erreur (jamais bloquant). Ne MODIFIE rien. */
async function lookupVerifiedCompanyCountry(userId: string): Promise<string | null> {
  try {
    const db = await getRuntimeDb();
    const { rows } = await db.query<{ registration_country: string | null }>(
      `select c.registration_country
         from pierre_rt_companies c
         join pierre_rt_members m on m.company_id = c.id
        where m.user_id = $1 and m.status = 'active'
          and c.status not in ('suspended','cancelled','archived')
        limit 2`,
      [userId],
    );
    if (rows.length === 1) return rows[0].registration_country ?? null; // 0 ou >1 → ambigu → non utilisé
    return null;
  } catch {
    return null; // best-effort : jamais bloquant
  }
}

export interface PierreCheckoutPricing {
  readonly decision: CheckoutGuardDecision;
  readonly priceId: string | null;          // price_id Stripe résolu (serveur) quand ok
  readonly auditId: string;
  readonly resolvedCountry: string | null;
  readonly currency: Currency | null;
  readonly expectedUnitAmount: number | null; // attendu (centimes/rappen) pour le guard de prix
  readonly expectedCurrency: string | null;    // "eur" | "chf"
  readonly outcome: PricingDecisionOutcome;
}

/**
 * Résout la tarification par pays pour un checkout Pierre. Le client NE contrôle PAS le prix :
 * signaux = sélection (revalidée) + géo (log) + entreprise vérifiée (fort). Retourne la décision
 * du guard + le price_id Stripe autoritatif (si ok) + l'auditId.
 */
export async function resolvePierreCheckoutPricing(args: {
  request: Request;
  body: Record<string, unknown>;
  userId: string | null;
  at: string;
  requireProduction?: boolean;
  productionReady?: boolean;
  auditSink?: PricingAuditSink;
}): Promise<PierreCheckoutPricing> {
  const { request, body, userId, at } = args;

  const geoCountry = request.headers.get("x-vercel-ip-country") ?? request.headers.get("x-country") ?? null;
  const acceptLanguage = request.headers.get("accept-language"); // (dispo pour l'audit ; guard = signaux forts)
  const selectedCountry = strOf(body.country) ?? strOf(body.selected_country) ?? strOf(body.billing_country) ?? null;
  const requestedPriceKey = strOf(body.price_key) ?? null;      // client — NON de confiance
  const requestedPriceId = strOf(body.price_id) ?? strOf(body.priceId) ?? null; // client — ignoré
  const requestedCurrency = strOf(body.currency) ?? null;       // client — NON de confiance
  const companyCountry = userId ? await lookupVerifiedCompanyCountry(userId) : null;

  const cfg = readStripePriceConfig();
  const stripe = { eurConfigured: !!cfg.eurPriceId, chfConfigured: !!cfg.chfPriceId };

  const decision = evaluateCheckoutCountryGuard({
    selectedCountry, geoCountry, companyCountry, requestedPriceKey, requestedPriceId, requestedCurrency,
    stripe, requireProduction: args.requireProduction, productionReady: args.productionReady,
  });

  let priceId: string | null = null;
  if (decision.ok && decision.resolvedCountry) {
    const res = resolveStripePriceIdForCountry(decision.resolvedCountry);
    priceId = res.ok ? res.priceId : null;
  }

  const outcome: PricingDecisionOutcome = decision.ok ? "allowed"
    : decision.reviewRequired ? "review_required"
    : decision.code === "COUNTRY_REQUIRED" ? "country_required"
    : "blocked";

  const auditId = recordPricingDecision({
    requestId: request.headers.get("x-request-id"),
    userId,
    selectedCountry,
    resolvedCountry: decision.resolvedCountry,
    geoCountry,
    companyCountry,
    requestedPriceKey,
    resolvedPriceKey: decision.resolvedPriceKey,
    currency: decision.currency,
    decision: outcome,
    reasonCode: decision.code,
    ip: getClientIp(request),
    at,
  }, { sink: args.auditSink });

  return {
    decision,
    priceId,
    auditId,
    resolvedCountry: decision.resolvedCountry,
    currency: decision.currency,
    expectedUnitAmount: expectedUnitAmountForCountry(decision.resolvedCountry),
    expectedCurrency: expectedStripeCurrencyForCountry(decision.resolvedCountry),
    outcome,
  };
}

export { strOf as _strOf }; // (exposé pour tests unitaires ciblés si besoin)
