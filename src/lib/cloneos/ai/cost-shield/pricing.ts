// src/lib/cloneos/ai/cost-shield/pricing.ts
// B38A — Cost Shield pricing table. Conservative estimates only.
// When uncertain, we overestimate — better to over-protect Gael's 9.74€ budget.
// Centralised here so there's exactly one place to update if OpenAI changes prices.

import type { AiCostShieldProvider } from "./types";

// ── Rate shape ────────────────────────────────────────────────────────────────

export type CostShieldRate = {
  provider: AiCostShieldProvider;
  model_id: string;
  label: string;
  input_cents_per_1k: number;   // USD cents per 1000 input tokens
  output_cents_per_1k: number;  // USD cents per 1000 output tokens
  is_premium: boolean;
  is_enabled: boolean;
};

// ── Price table ───────────────────────────────────────────────────────────────
// Conservative (rounded up slightly) as of 2026-05.
// Anthropic rates included for future use but marked disabled.

const RATES: CostShieldRate[] = [
  // ── OpenAI (enabled) ────────────────────────────────────────────────────────
  {
    provider: "openai",
    model_id: "gpt-4.1",
    label: "GPT-4.1 (strong)",
    input_cents_per_1k: 0.20,
    output_cents_per_1k: 0.80,
    is_premium: false,
    is_enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4.1-mini",
    label: "GPT-4.1-mini (fast)",
    input_cents_per_1k: 0.04,
    output_cents_per_1k: 0.16,
    is_premium: false,
    is_enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4.1-nano",
    label: "GPT-4.1-nano (micro)",
    input_cents_per_1k: 0.01,
    output_cents_per_1k: 0.04,
    is_premium: false,
    is_enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4o",
    label: "GPT-4o",
    input_cents_per_1k: 0.25,
    output_cents_per_1k: 1.00,
    is_premium: false,
    is_enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4o-mini",
    label: "GPT-4o-mini",
    input_cents_per_1k: 0.015,
    output_cents_per_1k: 0.060,
    is_premium: false,
    is_enabled: true,
  },
  // ── Anthropic (disabled until B38B+) ─────────────────────────────────────
  {
    provider: "anthropic",
    model_id: "claude-opus-4-7",
    label: "Claude Opus 4.7 (premium)",
    input_cents_per_1k: 1.50,
    output_cents_per_1k: 7.50,
    is_premium: true,
    is_enabled: false, // Disabled — AI_ANTHROPIC_ENABLED=false
  },
  {
    provider: "anthropic",
    model_id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    input_cents_per_1k: 0.30,
    output_cents_per_1k: 1.50,
    is_premium: false,
    is_enabled: false,
  },
  {
    provider: "anthropic",
    model_id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    input_cents_per_1k: 0.08,
    output_cents_per_1k: 0.40,
    is_premium: false,
    is_enabled: false,
  },
  // ── Mock (always 0 cost) ───────────────────────────────────────────────────
  {
    provider: "mock",
    model_id: "mock",
    label: "Mock provider",
    input_cents_per_1k: 0,
    output_cents_per_1k: 0,
    is_premium: false,
    is_enabled: true,
  },
];

// Fallback: conservative overestimate for unknown models
const FALLBACK_RATE: CostShieldRate = {
  provider: "openai",
  model_id: "unknown",
  label: "Unknown model (conservative estimate)",
  input_cents_per_1k: 0.30,   // Overestimate deliberately
  output_cents_per_1k: 1.20,
  is_premium: false,
  is_enabled: true,
};

// ── Lookup ────────────────────────────────────────────────────────────────────

export function getRateForModel(provider: AiCostShieldProvider, modelId: string): CostShieldRate {
  if (provider === "mock") return RATES.find((r) => r.provider === "mock")!;

  // Exact match
  const exact = RATES.find((r) => r.provider === provider && r.model_id === modelId);
  if (exact) return exact;

  // Prefix match (deployment variants like "gpt-4.1-2025-04-14")
  const prefix = RATES.find(
    (r) => r.provider === provider && (modelId.startsWith(r.model_id) || r.model_id.startsWith(modelId)),
  );
  if (prefix) return prefix;

  return FALLBACK_RATE;
}

export function isPremiumModel(provider: AiCostShieldProvider, modelId: string): boolean {
  return getRateForModel(provider, modelId).is_premium;
}

export function isModelEnabled(provider: AiCostShieldProvider, modelId: string): boolean {
  return getRateForModel(provider, modelId).is_enabled;
}

export function listEnabledRates(): CostShieldRate[] {
  return RATES.filter((r) => r.is_enabled);
}
