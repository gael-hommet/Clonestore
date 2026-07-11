// E-R3 §3 — conteneur de dépendances de la route webhook Stripe, avec injection
// RÉSERVÉE AUX TESTS. Permet de tester la VRAIE route POST contre une base PGlite +
// une passerelle Stripe contractuelle, sans exposer l'injection au runtime public.
// La vérification de signature reste inline dans la route (stripe.webhooks.constructEvent).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getStripeWebhookDb } from "./webhook-db";
import type { SubscriptionProof } from "./stripe-webhook-bridge";
import type { OrdersEventLedgerPort } from "@/lib/billing/orders-event-ledger";

export interface OrderWriter {
  upsert(args: { user_id: string; agent_slug: string; status: string; subId: string; customerId: string | null; trial_end?: number | null; current_period_end?: number | null }): Promise<void>;
  updateBySubId(subId: string, update: Record<string, unknown>): Promise<void>;
}

export interface StripeWebhookDeps {
  /** Connexion DB du journal fondateur (dédiée writer / fail-closed en prod). */
  getFounderDb: () => Promise<SqlExecutor>;
  /** Récupère la preuve commerciale Stripe pour un abonnement. */
  fetchProof: (subscriptionId: string) => Promise<SubscriptionProof | null>;
  /** Persistance des commandes marketplace (Supabase en prod). */
  orders: OrderWriter;
  /**
   * Ledger d'idempotence + anti-replay du flux orders. Optionnel : null → comportement
   * legacy (upsert idempotent seul). Non-null → chaque event du flux orders est claimé,
   * dédupliqué et ordonné de façon monotone avant toute mutation.
   */
  ordersLedger?: OrdersEventLedgerPort | null;
  expectedPriceId: string | null;
  expectedProductId: string | null;
}

let injected: StripeWebhookDeps | null = null;

/** TEST ONLY — injecte (ou retire avec null) les dépendances de la route webhook. */
export function __setStripeWebhookDepsForTests(deps: StripeWebhookDeps | null): void {
  injected = deps;
}

export function getInjectedStripeWebhookDeps(): StripeWebhookDeps | null {
  return injected;
}

/** Dépendances par défaut (production) : DB dédiée, preuve via Stripe, commandes Supabase. */
export function defaultStripeWebhookDeps(args: {
  fetchProof: (subscriptionId: string) => Promise<SubscriptionProof | null>;
  orders: OrderWriter;
  ordersLedger?: OrdersEventLedgerPort | null;
}): StripeWebhookDeps {
  return {
    getFounderDb: getStripeWebhookDb,
    fetchProof: args.fetchProof,
    orders: args.orders,
    ordersLedger: args.ordersLedger ?? null,
    expectedPriceId: process.env.STRIPE_PRICE_PIERRE ?? null,
    expectedProductId: process.env.STRIPE_PRODUCT_PIERRE ?? null,
  };
}
