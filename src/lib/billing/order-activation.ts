// src/lib/billing/order-activation.ts
// B31.8 — Server-side order upsert helpers. No client code. No secrets exposed.
// Shared between webhook (primary) and confirm route (fallback).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ActivationStatus } from "./stripe-activation";

// ── Supabase admin ──────────────────────────────────────────────

export function createOrderAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Upsert payload ──────────────────────────────────────────────

export type UpsertOrderParams = {
  user_id: string;
  agent_slug: string;
  status: ActivationStatus;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  started_at?: string;
  ended_at?: string | null;
};

// Upserts on (user_id, agent_slug) — idempotent, safe to call multiple times.
// user_id MUST come from a validated server-side source (Supabase token or Stripe metadata).
export async function upsertOrderActivation(
  supabase: SupabaseClient,
  params: UpsertOrderParams
): Promise<void> {
  const payload: Record<string, unknown> = {
    user_id: params.user_id,
    agent_slug: params.agent_slug,
    status: params.status,
    stripe_subscription_id: params.stripe_subscription_id,
    stripe_customer_id: params.stripe_customer_id ?? null,
    started_at: params.started_at ?? new Date().toISOString(),
    ended_at: params.ended_at ?? null,
  };

  const { error } = await supabase
    .from("orders")
    .upsert(payload, { onConflict: "user_id,agent_slug" });

  if (error) throw new Error(error.message);
}

// Update an existing order by subscription ID — for subscription lifecycle events.
export async function updateOrderBySubscriptionId(
  supabase: SupabaseClient,
  subscriptionId: string,
  update: { status: ActivationStatus; ended_at?: string | null }
): Promise<void> {
  const payload: Record<string, unknown> = { status: update.status };
  if ("ended_at" in update) payload["ended_at"] = update.ended_at ?? null;

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("stripe_subscription_id", subscriptionId);

  if (error) throw new Error(error.message);
}

// Read the current order status for a user + agent. Returns null if no row.
export type OrderStatusResult = {
  status: ActivationStatus;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  started_at: string | null;
  ended_at: string | null;
} | null;

/**
 * Retourne le Stripe Customer déjà rattaché à cet utilisateur, tous produits confondus.
 *
 * L'identité de facturation Stripe est portée par l'UTILISATEUR, pas par le produit : un
 * client qui possède Pierre puis achète Clara doit rester le même Customer. La recherche
 * ignore donc `agent_slug`. Retourne null si aucune ligne `orders` ne porte de customer
 * (cas du tout premier achat), ou en cas d'erreur de lecture — l'appelant créera alors un
 * Customer sous clé d'idempotence, ce qui reste sûr.
 */
export async function getStripeCustomerIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const id = data[0]?.stripe_customer_id;
  return typeof id === "string" && id ? id : null;
}

export async function getOrderStatus(
  supabase: SupabaseClient,
  userId: string,
  agentSlug: string
): Promise<OrderStatusResult> {
  const { data, error } = await supabase
    .from("orders")
    .select("status,stripe_subscription_id,stripe_customer_id,started_at,ended_at")
    .eq("user_id", userId)
    .eq("agent_slug", agentSlug)
    .maybeSingle();

  if (error || !data) return null;

  return {
    status: (data.status as ActivationStatus) ?? "none",
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    stripe_customer_id: data.stripe_customer_id ?? null,
    started_at: data.started_at ?? null,
    ended_at: data.ended_at ?? null,
  };
}
