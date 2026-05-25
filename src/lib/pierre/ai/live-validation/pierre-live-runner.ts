// src/lib/pierre/ai/live-validation/pierre-live-runner.ts
// B38B — Pierre layer: thin runner adapter on top of platform runner.
// Enriches results with Pierre context + Pierre scoring.

import type { LiveValidationReport, B38BConfig } from "../../../cloneos/ai/live-validation/types";
import type { LiveValidationScenario } from "../../../cloneos/ai/live-validation/types";
import { runDryValidation, runLiveValidation } from "../../../cloneos/ai/live-validation/runner";
import { getB38BConfig } from "../../../cloneos/ai/live-validation/config";
import {
  getDefaultPierreScenarioSelection,
  validatePierreScenarioSet,
} from "./pierre-scenarios";
import { buildPierreScoringReport, scorePierreScenario } from "./pierre-live-scoring";
import type { PierreEnrichedScore } from "./pierre-live-scoring";

// ── Pierre dry-run wrapper ────────────────────────────────────────────────────

export async function runPierreDryValidation(
  maxScenarios = 5,
  configOverride?: Partial<B38BConfig>,
): Promise<LiveValidationReport> {
  const config = { ...getB38BConfig(), ...configOverride };
  const contexts = getDefaultPierreScenarioSelection(Math.min(maxScenarios, config.max_scenarios));
  const scenarios: LiveValidationScenario[] = contexts.map((ctx) => ctx.scenario);

  return runDryValidation(config, scenarios);
}

// ── Pierre live wrapper ───────────────────────────────────────────────────────

export async function runPierreLiveValidation(
  maxScenarios = 5,
  configOverride?: Partial<B38BConfig>,
): Promise<LiveValidationReport> {
  const config = { ...getB38BConfig(), ...configOverride };
  const contexts = getDefaultPierreScenarioSelection(Math.min(maxScenarios, config.max_scenarios));
  const scenarios: LiveValidationScenario[] = contexts.map((ctx) => ctx.scenario);

  const validation = validatePierreScenarioSet(scenarios);
  if (!validation.valid) {
    // Missing sensitive block test is a warning, not a hard block
    const hardErrors = validation.errors.filter((e) => !e.includes("sensitive block test"));
    if (hardErrors.length > 0) {
      throw new Error(`Pierre scenario set invalid:\n${hardErrors.join("\n")}`);
    }
  }

  return runLiveValidation(config, scenarios);
}

// ── Pierre enriched dry-run (adds Pierre scoring layer) ──────────────────────

export type PierreDryRunReport = {
  base_report: LiveValidationReport;
  pierre_scores: PierreEnrichedScore[];
  pierre_scoring_report: ReturnType<typeof buildPierreScoringReport>;
};

export async function runPierreEnrichedDryValidation(
  maxScenarios = 5,
  configOverride?: Partial<B38BConfig>,
): Promise<PierreDryRunReport> {
  const config = { ...getB38BConfig(), ...configOverride };
  const contexts = getDefaultPierreScenarioSelection(Math.min(maxScenarios, config.max_scenarios));
  const scenarios: LiveValidationScenario[] = contexts.map((ctx) => ctx.scenario);

  const base_report = await runDryValidation(config, scenarios);

  // Build Pierre-enriched scores from the base results
  const pierre_scores: PierreEnrichedScore[] = base_report.results.map((result, i) => {
    const ctx = contexts[i];
    if (!ctx) {
      throw new Error(`No Pierre context for scenario at index ${i}`);
    }

    // Reconstruct a minimal CloneAIResponse from the result for Pierre scoring
    const mockResponse = {
      ok: result.ok,
      provider: result.provider as "openai" | "anthropic" | "mock",
      model_profile: "structured_reasoning" as const,
      content: result.excerpt_redacted ?? "",
      json: null as Record<string, unknown> | null,
      usage: {
        input_tokens_estimated: result.tokens_in,
        output_tokens_estimated: result.tokens_out,
        total_tokens_estimated: result.tokens_in + result.tokens_out,
      },
      latency_ms: result.latency_ms,
      warnings: result.issues ?? [],
      error: result.error,
    };

    return scorePierreScenario(ctx, mockResponse, result.estimated_cost_cents);
  });

  const pierre_scoring_report = buildPierreScoringReport(pierre_scores);

  return { base_report, pierre_scores, pierre_scoring_report };
}

// ── Validation gate before running live ──────────────────────────────────────

export function validatePierreReadinessForLive(maxScenarios: number): {
  ready: boolean;
  reasons: string[];
} {
  const config = getB38BConfig();
  const reasons: string[] = [];

  if (!config.live_enabled) {
    reasons.push("B38B_LIVE_OPENAI_ENABLED is not set to true.");
  }
  if (config.max_total_cost_cents > 150) {
    reasons.push(`B38B_MAX_TOTAL_COST_CENTS (${config.max_total_cost_cents}) exceeds absolute max 150.`);
  }
  if (maxScenarios > config.max_scenarios) {
    reasons.push(`Requested ${maxScenarios} scenarios but config allows max ${config.max_scenarios}.`);
  }
  if (process.env["AI_RUNTIME_MODE"] !== "production") {
    reasons.push("AI_RUNTIME_MODE must be 'production' for live run.");
  }
  if (!process.env["OPENAI_API_KEY"]) {
    reasons.push("OPENAI_API_KEY is not set.");
  }

  return { ready: reasons.length === 0, reasons };
}
