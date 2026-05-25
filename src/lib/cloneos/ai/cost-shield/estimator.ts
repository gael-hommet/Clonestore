// src/lib/cloneos/ai/cost-shield/estimator.ts
// B38A — Cost estimation for the shield. Conservative: always >= 0, overestimates unknown.
// No external calls. No async. Safe for pre-flight checks.

import type { AiCostShieldProvider } from "./types";
import { getRateForModel } from "./pricing";

// ── Token estimation defaults ─────────────────────────────────────────────────

// If caller doesn't know token count, we use conservative defaults.
const DEFAULT_INPUT_TOKENS = 1000;   // 1k tokens input if unknown
const DEFAULT_OUTPUT_TOKENS = 2048;  // 2k tokens output if unknown (conservative)

// ── Cost computation ──────────────────────────────────────────────────────────

export type CostEstimateResult = {
  provider: AiCostShieldProvider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
  is_premium: boolean;
  is_conservative: boolean; // true if defaults were used
};

export function estimateAiCostCents(
  provider: AiCostShieldProvider,
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): CostEstimateResult {
  // mock is always free
  if (provider === "mock") {
    return {
      provider: "mock",
      model,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_cents: 0,
      is_premium: false,
      is_conservative: false,
    };
  }

  const safeInput =
    typeof inputTokens === "number" && inputTokens >= 0 ? inputTokens : DEFAULT_INPUT_TOKENS;
  const safeOutput =
    typeof outputTokens === "number" && outputTokens >= 0 ? outputTokens : DEFAULT_OUTPUT_TOKENS;

  const isConservative =
    typeof inputTokens !== "number" ||
    inputTokens < 0 ||
    typeof outputTokens !== "number" ||
    outputTokens < 0;

  const rate = getRateForModel(provider, model);

  const inputCost = (safeInput / 1000) * rate.input_cents_per_1k;
  const outputCost = (safeOutput / 1000) * rate.output_cents_per_1k;

  // Round up to 4 decimal places — no truncation that would undercount
  const totalCents = Math.ceil((inputCost + outputCost) * 10000) / 10000;

  return {
    provider,
    model,
    input_tokens: safeInput,
    output_tokens: safeOutput,
    estimated_cost_cents: Math.max(0, totalCents),
    is_premium: rate.is_premium,
    is_conservative: isConservative,
  };
}

// ── Request-level helper ──────────────────────────────────────────────────────
// Computes estimate from a shield request if estimated_cost_cents is 0 (not pre-computed).

export function resolveRequestCostEstimate(
  provider: AiCostShieldProvider,
  model: string,
  inputTokenEstimate: number,
  maxOutputTokens: number,
  precomputedCents: number,
): number {
  if (precomputedCents > 0) return precomputedCents;
  return estimateAiCostCents(provider, model, inputTokenEstimate, maxOutputTokens)
    .estimated_cost_cents;
}
