// src/lib/cloneos/ai/live-validation/runner.ts
// B38B — Core runner. Dry-run does NOT call OpenAI. Live calls via B38A shield + B32 runCloneAI.

import type { LiveValidationScenario, LiveValidationResult, B38BConfig, LiveValidationReport } from "./types";
import type { CloneAIRequest, CloneAIResponse } from "../types";
import type { AiCostShieldDecision } from "../cost-shield/types";
import { validateB38BSafetyGate } from "./safety";
import { scoreLiveValidationResult, redactOutputExcerpt } from "./scoring";
import { createCostTracker } from "./cost-report";
import { buildLiveValidationReport } from "./report";
import { getB38BEnvSummary } from "./config";
import { withAiCostShield } from "../cost-shield/runtime";
import { buildPierreShieldRequest } from "../../../pierre/ai/pierre-cost-policy";
import { estimateAiCostCents } from "../cost-shield/estimator";
import { runCloneAI } from "../runtime";

// ── Build CloneAI request from scenario ───────────────────────────────────────

function buildScenarioAiRequest(scenario: LiveValidationScenario): CloneAIRequest {
  return {
    use_case: scenario.use_case,
    messages: [{ role: "user", content: scenario.prompt }],
    output_mode: "json",
    policy: {
      preferred_provider: "openai",
      model_profile: scenario.model_profile,
      max_output_tokens: 1024,
    },
    metadata: { b38b_validation: true, scenario_id: scenario.id },
  };
}

// ── Build mock response for dry-run ──────────────────────────────────────────

function buildDryRunResponse(scenario: LiveValidationScenario): CloneAIResponse {
  const isSensitive = scenario.is_sensitive_block_test;
  const json = isSensitive
    ? {
        intent: "cas sensible — validation humaine requise",
        summary: "Demande de licenciement immédiat refusée — conseil juridique obligatoire",
        domain: "disciplinaire",
        risk_level: "high",
        missing_info: ["avis RH", "avis juridique", "motif légal"],
        suggested_tasks: [],
        requires_human_validation: true,
      }
    : {
        intent: `dry-run: ${scenario.name}`,
        summary: `Réponse simulée pour scénario ${scenario.id}`,
        domain: "rh_general",
        risk_level: "low",
        missing_info: [],
        suggested_tasks: ["Tâche 1 (simulée)", "Tâche 2 (simulée)"],
        requires_human_validation: scenario.expected_behavior.should_require_human_validation,
      };

  const contentText = isSensitive
    ? `Refus: ce cas est sensible. Validation humaine requise. Conseil juridique recommandé. ${JSON.stringify(json)}`
    : JSON.stringify(json);

  return {
    ok: true,
    provider: "mock",
    model_profile: scenario.model_profile,
    content: contentText,
    json,
    usage: { input_tokens_estimated: 400, output_tokens_estimated: 300, total_tokens_estimated: 700 },
    latency_ms: 1,
    warnings: ["[DRY-RUN] No real API call made."],
    error: null,
  };
}

// ── Run a single scenario ─────────────────────────────────────────────────────

async function runScenario(
  scenario: LiveValidationScenario,
  mode: "live" | "dry-run",
): Promise<LiveValidationResult> {
  const start = Date.now();

  if (mode === "dry-run") {
    const mockResponse = buildDryRunResponse(scenario);
    const score = scoreLiveValidationResult(scenario, mockResponse, 0);

    return {
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      ok: true,
      provider: "mock",
      model: "mock",
      tokens_in: 400,
      tokens_out: 300,
      estimated_cost_cents: 0,
      actual_cost_cents: 0,
      latency_ms: Date.now() - start,
      score,
      issues: ["[DRY-RUN] Simulated — no real API call."],
      excerpt_redacted: redactOutputExcerpt(mockResponse.content),
      shield_decision: null,
      error: null,
    };
  }

  // Live mode: build shield request and wrap runCloneAI
  const shieldReq = buildPierreShieldRequest({
    useCase: scenario.use_case,
    companyId: "b38b_internal_validation",
    userId: "b38b_internal_admin",
    accessLevel: "internal_admin",
    metadata: { b38b_scenario_id: scenario.id },
  });

  const costEstimate = estimateAiCostCents(
    "openai",
    "gpt-4.1",
    shieldReq.input_token_estimate,
    shieldReq.max_output_tokens,
  );

  const shieldReqWithCost = { ...shieldReq, estimated_cost_cents: costEstimate.estimated_cost_cents };
  const aiRequest = buildScenarioAiRequest(scenario);

  const result = await withAiCostShield(shieldReqWithCost, {}, async () => {
    return runCloneAI(aiRequest);
  });

  if (!result.ok) {
    const shieldDecision: AiCostShieldDecision | null =
      "shield_decision" in result ? (result as { shield_decision: AiCostShieldDecision }).shield_decision : null;

    const blockedResponse: CloneAIResponse = {
      ok: false,
      provider: "mock",
      model_profile: scenario.model_profile,
      content: "",
      json: null,
      usage: { input_tokens_estimated: 0, output_tokens_estimated: 0, total_tokens_estimated: 0 },
      latency_ms: Date.now() - start,
      warnings: [],
      error: result.error ?? "Blocked",
    };

    const score = scoreLiveValidationResult(scenario, blockedResponse, 0);
    return {
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      ok: false,
      provider: "blocked",
      model: "blocked",
      tokens_in: 0,
      tokens_out: 0,
      estimated_cost_cents: 0,
      actual_cost_cents: 0,
      latency_ms: Date.now() - start,
      score,
      issues: [`Blocked: ${result.error ?? "unknown"}`],
      excerpt_redacted: "[blocked by shield]",
      shield_decision: shieldDecision,
      error: result.error ?? "Blocked by shield",
    };
  }

  const actualCost = estimateAiCostCents(
    result.provider === "openai" ? "openai" : "mock",
    "gpt-4.1",
    result.usage.input_tokens_estimated,
    result.usage.output_tokens_estimated,
  ).estimated_cost_cents;

  const score = scoreLiveValidationResult(scenario, result, actualCost);

  return {
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    ok: true,
    provider: result.provider,
    model: result.model_profile,
    tokens_in: result.usage.input_tokens_estimated,
    tokens_out: result.usage.output_tokens_estimated,
    estimated_cost_cents: costEstimate.estimated_cost_cents,
    actual_cost_cents: actualCost,
    latency_ms: result.latency_ms,
    score,
    issues: result.warnings ?? [],
    excerpt_redacted: redactOutputExcerpt(result.content),
    shield_decision: null,
    error: null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runDryValidation(
  config: B38BConfig,
  scenarios: LiveValidationScenario[],
): Promise<LiveValidationReport> {
  const safety = validateB38BSafetyGate(config, "dry-run", scenarios.length);
  if (!safety.passed) {
    throw new Error(`B38B safety gate failed (dry-run):\n${safety.failures.join("\n")}`);
  }

  const results: LiveValidationResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario, "dry-run"));
  }

  return buildLiveValidationReport("dry-run", config, results, getB38BEnvSummary());
}

export async function runLiveValidation(
  config: B38BConfig,
  scenarios: LiveValidationScenario[],
): Promise<LiveValidationReport> {
  const safety = validateB38BSafetyGate(config, "live", scenarios.length);
  if (!safety.passed) {
    throw new Error(`B38B safety gate failed (live):\n${safety.failures.join("\n")}`);
  }

  // Pre-check total estimated cost
  const estimatedTotal = scenarios.reduce((s, sc) => s + sc.max_cost_cents, 0);
  if (estimatedTotal > config.max_total_cost_cents) {
    throw new Error(
      `Estimated total (${estimatedTotal}¢) exceeds cap (${config.max_total_cost_cents}¢). Reduce scenario count or increase cap (max 150¢).`,
    );
  }

  const costTracker = createCostTracker();
  const results: LiveValidationResult[] = [];

  for (const scenario of scenarios) {
    if (costTracker.exceedsCap(config.max_total_cost_cents)) {
      results.push({
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        ok: false,
        provider: "skipped",
        model: "skipped",
        tokens_in: 0,
        tokens_out: 0,
        estimated_cost_cents: 0,
        actual_cost_cents: 0,
        latency_ms: 0,
        score: {
          structure: 0,
          pierre_compliance: 0,
          security_cloneguard: 0,
          hr_utility: 0,
          clarity: 0,
          cost_reasonable: 0,
          total: 0,
          verdict: "fail",
          hard_fail: false,
          hard_fail_reason: null,
        },
        issues: ["Skipped — cumulative cost cap reached."],
        excerpt_redacted: "[skipped — cost cap reached]",
        shield_decision: null,
        error: "Cost cap reached.",
      });
      continue;
    }

    const result = await runScenario(scenario, "live");
    costTracker.add(scenario.id, result.actual_cost_cents || result.estimated_cost_cents);
    results.push(result);
  }

  return buildLiveValidationReport("live", config, results, getB38BEnvSummary());
}
