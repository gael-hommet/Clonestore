// P-FINAL 01 — Phase 4 — Adapter Registry.
// Registry of all known real adapters in the CloneStore codebase.
// Pure: no Supabase, no Next, no async, no throw.
// Source of truth from Phase 0 audit (P-FINAL 01).

import type { AdapterDefinition, AdapterCategory, AdapterCriticality } from "./adapter-types";

export const ADAPTER_REGISTRY: AdapterDefinition[] = [
  // ── Database ──────────────────────────────────────────────────────────────
  {
    id: "supabase_client",
    name: "Supabase Client",
    file_path: "src/lib/supabase.ts",
    category: "database",
    criticality: "critical",
    status: "real",
    has_mock_fallback: false,
    description: "Main Supabase client — createBrowserClient and createServerClient",
    blocking_if_mock_in_production: true,
    used_by: ["pierre auth", "billing", "RGPD", "cockpit", "all data routes"],
  },
  {
    id: "supabase_auth",
    name: "Pierre Supabase Auth",
    file_path: "src/lib/pierre/auth.ts",
    category: "auth",
    criticality: "critical",
    status: "real",
    has_mock_fallback: false,
    description: "Server-side auth with company_id resolution — never trusts client input",
    blocking_if_mock_in_production: true,
    used_by: ["pierre API routes", "cockpit", "documents", "tasks"],
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  {
    id: "order_activation",
    name: "Order Activation",
    file_path: "src/lib/billing/order-activation.ts",
    category: "billing",
    criticality: "critical",
    status: "real",
    has_mock_fallback: false,
    description: "Activates subscription after Stripe payment — writes to Supabase",
    blocking_if_mock_in_production: true,
    used_by: ["stripe/confirm route", "stripe/activate route"],
  },
  {
    id: "stripe_activation",
    name: "Stripe Activation Mapper",
    file_path: "src/lib/billing/stripe-activation.ts",
    category: "billing",
    criticality: "critical",
    status: "real",
    has_mock_fallback: false,
    description: "Pure mapper: Stripe webhook payload → CloneStore activation event",
    blocking_if_mock_in_production: true,
    used_by: ["order-activation"],
  },

  // ── RGPD ──────────────────────────────────────────────────────────────────
  {
    id: "rgpd_export",
    name: "Pierre RGPD Export",
    file_path: "src/lib/pierre/security/pierre-rgpd-export.ts",
    category: "database",
    criticality: "important",
    status: "real",
    has_mock_fallback: true,
    description: "Exports all personal data for a user — injectable Supabase adapter",
    blocking_if_mock_in_production: false,
    used_by: ["RGPD export API route"],
  },
  {
    id: "rgpd_purge",
    name: "Pierre RGPD Purge",
    file_path: "src/lib/pierre/security/pierre-rgpd-purge.ts",
    category: "database",
    criticality: "important",
    status: "real",
    has_mock_fallback: true,
    description: "Purges all personal data for a user — injectable Supabase adapter",
    blocking_if_mock_in_production: false,
    used_by: ["RGPD purge API route"],
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  {
    id: "pierre_core",
    name: "Pierre Core Engine",
    file_path: "src/lib/pierre/pierre-core.ts",
    category: "ai",
    criticality: "critical",
    status: "real",
    has_mock_fallback: false,
    description: "Pierre main task execution engine — calls AI provider",
    blocking_if_mock_in_production: true,
    used_by: ["pierre task API", "missions"],
  },

  // ── Observability ──────────────────────────────────────────────────────────
  {
    id: "ai_cost_tracker",
    name: "AI Cost Tracker",
    file_path: "src/lib/pierre/observability/ai-cost-tracker.ts",
    category: "observability",
    criticality: "important",
    status: "real",
    has_mock_fallback: false,
    description: "Tracks AI API cost events to cloneos_ai_cost_events table",
    blocking_if_mock_in_production: false,
    used_by: ["pierre core", "AI pipeline"],
  },
];

export function getAllAdapters(): AdapterDefinition[] {
  return ADAPTER_REGISTRY;
}

export function getCriticalAdapters(): AdapterDefinition[] {
  return ADAPTER_REGISTRY.filter((a) => a.criticality === "critical");
}

export function getAdaptersByCategory(category: AdapterCategory): AdapterDefinition[] {
  return ADAPTER_REGISTRY.filter((a) => a.category === category);
}

export function getAdapterById(id: string): AdapterDefinition | undefined {
  return ADAPTER_REGISTRY.find((a) => a.id === id);
}

export function getBlockingAdapters(): AdapterDefinition[] {
  return ADAPTER_REGISTRY.filter((a) => a.blocking_if_mock_in_production);
}

export function getAdaptersByCriticality(criticality: AdapterCriticality): AdapterDefinition[] {
  return ADAPTER_REGISTRY.filter((a) => a.criticality === criticality);
}
