// src/lib/cloneos/ai/cost.ts
// B32 — AI cost estimation. Pure, no async, no DB.
// Cost rates in USD cents per 1000 tokens (input / output).
// These are approximate rates — update via env overrides if pricing changes.

import type { CloneAIProviderId, AiCostEstimate, AiCostTier } from "./types";

// ── Cost rates (cents per 1000 tokens) ───────────────────────────────────────
// Source: public pricing as of 2026-05. Update if providers change rates.

type CostRate = {
  input_cents_per_1k: number;
  output_cents_per_1k: number;
};

const COST_RATES: Record<string, CostRate> = {
  // Anthropic
  "claude-opus-4-7":           { input_cents_per_1k: 1.500, output_cents_per_1k: 7.500 },
  "claude-sonnet-4-6":         { input_cents_per_1k: 0.300, output_cents_per_1k: 1.500 },
  "claude-haiku-4-5-20251001": { input_cents_per_1k: 0.080, output_cents_per_1k: 0.400 },
  "claude-haiku-4-5":          { input_cents_per_1k: 0.080, output_cents_per_1k: 0.400 },
  // OpenAI
  "gpt-4.1":                   { input_cents_per_1k: 0.200, output_cents_per_1k: 0.800 },
  "gpt-4.1-mini":              { input_cents_per_1k: 0.040, output_cents_per_1k: 0.160 },
  "gpt-4.1-nano":              { input_cents_per_1k: 0.010, output_cents_per_1k: 0.040 },
  "gpt-4o":                    { input_cents_per_1k: 0.250, output_cents_per_1k: 1.000 },
  "gpt-4o-mini":               { input_cents_per_1k: 0.015, output_cents_per_1k: 0.060 },
  // Embeddings (no output cost)
  "text-embedding-3-large":    { input_cents_per_1k: 0.013, output_cents_per_1k: 0.000 },
  "text-embedding-3-small":    { input_cents_per_1k: 0.002, output_cents_per_1k: 0.000 },
};

const FALLBACK_RATE: CostRate = { input_cents_per_1k: 0.200, output_cents_per_1k: 0.800 };

function getRateForModel(modelId: string): CostRate {
  if (typeof modelId !== "string") return FALLBACK_RATE;
  // exact match
  if (COST_RATES[modelId]) return COST_RATES[modelId];
  // prefix match (e.g. custom deployment names)
  for (const [key, rate] of Object.entries(COST_RATES)) {
    if (modelId.startsWith(key) || key.startsWith(modelId)) return rate;
  }
  return FALLBACK_RATE;
}

function classifyCostTier(cents: number): AiCostTier {
  if (cents < 0.01) return "negligible";
  if (cents < 0.10) return "low";
  if (cents < 1.00) return "medium";
  return "high";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function estimateAiCost(
  provider: CloneAIProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): AiCostEstimate {
  const safeInput = typeof inputTokens === "number" && inputTokens >= 0 ? inputTokens : 0;
  const safeOutput = typeof outputTokens === "number" && outputTokens >= 0 ? outputTokens : 0;

  const rate = getRateForModel(modelId);
  const inputCost = (safeInput / 1000) * rate.input_cents_per_1k;
  const outputCost = (safeOutput / 1000) * rate.output_cents_per_1k;
  const totalCents = Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places

  return {
    provider,
    model_id: modelId,
    input_tokens: safeInput,
    output_tokens: safeOutput,
    estimated_cost_cents: totalCents,
    cost_tier: classifyCostTier(totalCents),
  };
}

export function formatCostCents(cents: number): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "0.0000¢";
  if (cents < 0.01) return `${cents.toFixed(4)}¢`;
  if (cents < 1.00) return `${cents.toFixed(3)}¢`;
  return `${cents.toFixed(2)}¢`;
}

export function formatCostEuros(cents: number, exchangeRate = 0.92): string {
  const euros = (cents / 100) * exchangeRate;
  if (euros < 0.001) return "<0.001€";
  return `${euros.toFixed(4)}€`;
}

export function getKnownModelIds(): string[] {
  return Object.keys(COST_RATES);
}

export function isKnownModel(modelId: string): boolean {
  return typeof modelId === "string" && COST_RATES[modelId] !== undefined;
}
