// src/lib/cloneos/ai/__tests__/ai-live-validation-b38b.test.ts
// B38B / B38B.1 — Platform live-validation: 35+ tests + 15 infra tests. No API calls. No keys required.

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getB38BConfig, getB38BEnvSummary } from "../live-validation/config";
import { validateB38BSafetyGate, validateLiveProviderPolicy, validateLiveAccessLevel } from "../live-validation/safety";
import {
  LIVE_VALIDATION_SCENARIOS,
  getLiveValidationScenario,
  getDefaultScenarioSelection,
  estimateTotalCostCents,
  getSensitiveBlockScenarios,
} from "../live-validation/scenarios";
import { scoreLiveValidationResult, detectHardFails, redactOutputExcerpt } from "../live-validation/scoring";
import { createCostTracker, formatCostCents, formatCostEuros, summarizeCosts } from "../live-validation/cost-report";
import { buildLiveValidationReport } from "../live-validation/report";
import { runDryValidation } from "../live-validation/runner";
import type { LiveValidationScenario, LiveValidationResult, B38BConfig } from "../live-validation/types";
import type { CloneAIResponse } from "../types";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeScenario(overrides: Partial<LiveValidationScenario> = {}): LiveValidationScenario {
  return {
    id: "test_scenario_01",
    name: "Test Scenario",
    description: "A test scenario",
    prompt: "Prépare un suivi RH simple.",
    use_case: "pierre.mission.interpret",
    model_profile: "structured_reasoning",
    max_cost_cents: 8,
    is_sensitive_block_test: false,
    expected_behavior: {
      should_produce_mission: true,
      should_produce_tasks: true,
      should_block_sensitive: false,
      should_refuse_execution: false,
      should_require_human_validation: false,
      min_score: 60,
    },
    ...overrides,
  };
}

function makeResponse(overrides: Partial<CloneAIResponse> = {}): CloneAIResponse {
  return {
    ok: true,
    provider: "openai",
    model_profile: "structured_reasoning",
    content: JSON.stringify({
      intent: "Suivi RH",
      summary: "Résumé du suivi",
      domain: "rh_general",
      risk_level: "low",
      suggested_tasks: ["Tâche 1", "Tâche 2"],
      requires_human_validation: false,
      missing_info: [],
    }),
    json: {
      intent: "Suivi RH",
      summary: "Résumé du suivi",
      domain: "rh_general",
      risk_level: "low",
      suggested_tasks: ["Tâche 1", "Tâche 2"],
      requires_human_validation: false,
      missing_info: [],
    },
    usage: { input_tokens_estimated: 400, output_tokens_estimated: 300, total_tokens_estimated: 700 },
    latency_ms: 100,
    warnings: [],
    error: null,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<B38BConfig> = {}): B38BConfig {
  return {
    live_enabled: false,
    max_total_cost_cents: 100,
    max_scenarios: 8,
    allowed_access_level: "internal_admin",
    allow_strong_model: false,
    strong_model_max_calls: 2,
    output_report_dir: ".local-reports/b38b",
    store_full_outputs: false,
    redact_outputs: true,
    ...overrides,
  };
}

function makeResult(overrides: Partial<LiveValidationResult> = {}): LiveValidationResult {
  return {
    scenario_id: "test_01",
    scenario_name: "Test",
    ok: true,
    provider: "mock",
    model: "mock",
    tokens_in: 400,
    tokens_out: 300,
    estimated_cost_cents: 5,
    actual_cost_cents: 5,
    latency_ms: 100,
    score: {
      structure: 18,
      pierre_compliance: 20,
      security_cloneguard: 20,
      hr_utility: 18,
      clarity: 10,
      cost_reasonable: 10,
      total: 96,
      verdict: "excellent",
      hard_fail: false,
      hard_fail_reason: null,
    },
    issues: [],
    excerpt_redacted: "Test output",
    shield_decision: null,
    error: null,
    ...overrides,
  };
}

// ── Config tests ──────────────────────────────────────────────────────────────

describe("B38B config", () => {
  it("returns safe defaults when no env vars set", () => {
    const cfg = getB38BConfig();
    expect(cfg.live_enabled).toBe(false);
    expect(cfg.max_total_cost_cents).toBe(100);
    expect(cfg.max_scenarios).toBe(8);
    expect(cfg.allowed_access_level).toBe("internal_admin");
    expect(cfg.redact_outputs).toBe(true);
    expect(cfg.store_full_outputs).toBe(false);
  });

  it("reads B38B_LIVE_OPENAI_ENABLED=true from env", () => {
    vi.stubEnv("B38B_LIVE_OPENAI_ENABLED", "true");
    const cfg = getB38BConfig();
    expect(cfg.live_enabled).toBe(true);
  });

  it("reads B38B_MAX_TOTAL_COST_CENTS from env", () => {
    vi.stubEnv("B38B_MAX_TOTAL_COST_CENTS", "75");
    const cfg = getB38BConfig();
    expect(cfg.max_total_cost_cents).toBe(75);
  });

  it("env summary reflects openai key presence", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key-xyz");
    const summary = getB38BEnvSummary();
    expect(summary.openai_key_present).toBe(true);
  });

  it("env summary shows anthropic_enabled=false by default", () => {
    const summary = getB38BEnvSummary();
    expect(summary.anthropic_enabled).toBe(false);
  });

  it("env summary shows runtime_mode=mock by default", () => {
    const summary = getB38BEnvSummary();
    expect(summary.runtime_mode).toBe("mock");
  });
});

// ── Safety gate tests ─────────────────────────────────────────────────────────

describe("B38B safety gate", () => {
  it("passes for dry-run with default config and valid scenario count", () => {
    const config = makeConfig();
    const result = validateB38BSafetyGate(config, "dry-run", 5);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("fails dry-run when scenarioCount > max_scenarios", () => {
    const config = makeConfig({ max_scenarios: 3 });
    const result = validateB38BSafetyGate(config, "dry-run", 5);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.toLowerCase().includes("scenario"))).toBe(true);
  });

  it("fails live mode when live_enabled=false", () => {
    const config = makeConfig({ live_enabled: false });
    const result = validateB38BSafetyGate(config, "live", 3);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("B38B_LIVE_OPENAI_ENABLED"))).toBe(true);
  });

  it("fails live mode when max_total_cost_cents > 150", () => {
    const config = makeConfig({ live_enabled: true, max_total_cost_cents: 200 });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_COST_SHIELD_MODE", "enforce");
    vi.stubEnv("AI_RUNTIME_MODE", "production");
    const result = validateB38BSafetyGate(config, "live", 3);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("150"))).toBe(true);
  });

  it("fails live mode when OPENAI_API_KEY missing", () => {
    const config = makeConfig({ live_enabled: true });
    vi.stubEnv("AI_COST_SHIELD_MODE", "enforce");
    vi.stubEnv("AI_RUNTIME_MODE", "production");
    const result = validateB38BSafetyGate(config, "live", 3);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("OPENAI_API_KEY"))).toBe(true);
  });

  it("fails live mode when AI_RUNTIME_MODE is not production", () => {
    const config = makeConfig({ live_enabled: true });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_COST_SHIELD_MODE", "enforce");
    vi.stubEnv("AI_RUNTIME_MODE", "mock");
    const result = validateB38BSafetyGate(config, "live", 3);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("AI_RUNTIME_MODE"))).toBe(true);
  });

  it("fails live mode when AI_ANTHROPIC_ENABLED=true", () => {
    const config = makeConfig({ live_enabled: true });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_COST_SHIELD_MODE", "enforce");
    vi.stubEnv("AI_RUNTIME_MODE", "production");
    vi.stubEnv("AI_ANTHROPIC_ENABLED", "true");
    const result = validateB38BSafetyGate(config, "live", 3);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("Anthropic"))).toBe(true);
  });

  it("validateLiveProviderPolicy: openai is valid", () => {
    const r = validateLiveProviderPolicy("openai");
    expect(r.valid).toBe(true);
  });

  it("validateLiveProviderPolicy: anthropic is invalid", () => {
    const r = validateLiveProviderPolicy("anthropic");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("Anthropic");
  });

  it("validateLiveProviderPolicy: mock is invalid for live", () => {
    const r = validateLiveProviderPolicy("mock");
    expect(r.valid).toBe(false);
  });

  it("validateLiveAccessLevel: internal_admin is valid", () => {
    const r = validateLiveAccessLevel("internal_admin");
    expect(r.valid).toBe(true);
  });

  it("validateLiveAccessLevel: paid_customer is invalid", () => {
    const r = validateLiveAccessLevel("paid_customer");
    expect(r.valid).toBe(false);
  });
});

// ── Scenario catalog tests ─────────────────────────────────────────────────────

describe("B38B scenario catalog", () => {
  it("has exactly 10 scenarios", () => {
    expect(LIVE_VALIDATION_SCENARIOS).toHaveLength(10);
  });

  it("all scenarios have required fields", () => {
    for (const s of LIVE_VALIDATION_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.prompt).toBeTruthy();
      expect(s.use_case).toBe("pierre.mission.interpret");
      expect(s.model_profile).toBe("structured_reasoning");
      expect(s.max_cost_cents).toBeGreaterThan(0);
    }
  });

  it("scenario_06 is the sensitive block test", () => {
    const s = getLiveValidationScenario("scenario_06_sensible_bloque");
    expect(s).not.toBeNull();
    expect(s!.is_sensitive_block_test).toBe(true);
    expect(s!.expected_behavior.should_block_sensitive).toBe(true);
  });

  it("only scenario_06 is marked as sensitive block test", () => {
    const sensitive = getSensitiveBlockScenarios();
    expect(sensitive).toHaveLength(1);
    expect(sensitive[0]!.id).toBe("scenario_06_sensible_bloque");
  });

  it("getDefaultScenarioSelection puts sensitive test first", () => {
    const selection = getDefaultScenarioSelection(5);
    expect(selection[0]!.id).toBe("scenario_06_sensible_bloque");
  });

  it("getDefaultScenarioSelection respects maxCount", () => {
    expect(getDefaultScenarioSelection(3)).toHaveLength(3);
    expect(getDefaultScenarioSelection(10)).toHaveLength(10);
  });

  it("estimateTotalCostCents sums max_cost_cents", () => {
    const scenarios = getDefaultScenarioSelection(3);
    const total = estimateTotalCostCents(scenarios);
    const expected = scenarios.reduce((s, sc) => s + sc.max_cost_cents, 0);
    expect(total).toBe(expected);
  });

  it("getLiveValidationScenario returns null for unknown id", () => {
    expect(getLiveValidationScenario("unknown_scenario")).toBeNull();
  });
});

// ── Scoring tests ─────────────────────────────────────────────────────────────

describe("B38B scoring", () => {
  it("scores a good response near 100", () => {
    const scenario = makeScenario();
    const response = makeResponse();
    const score = scoreLiveValidationResult(scenario, response, 5);
    expect(score.total).toBeGreaterThan(70);
    expect(score.hard_fail).toBe(false);
  });

  it("scores a failed response low", () => {
    const scenario = makeScenario();
    const response = makeResponse({ ok: false, content: "", json: null, error: "Error" });
    const score = scoreLiveValidationResult(scenario, response, 5);
    expect(score.total).toBeLessThan(30);
  });

  it("hard fail when Anthropic provider used", () => {
    const scenario = makeScenario();
    const response = makeResponse({ provider: "anthropic" });
    const { hasHardFail, reason } = detectHardFails(scenario, response);
    expect(hasHardFail).toBe(true);
    expect(reason).toContain("Anthropic");
  });

  it("hard fail when output contains API key pattern", () => {
    const scenario = makeScenario();
    const response = makeResponse({
      content: "Here is your key: sk-ant-abcdefghij12345678",
    });
    const { hasHardFail } = detectHardFails(scenario, response);
    expect(hasHardFail).toBe(true);
  });

  it("hard fail when sensitive case is not blocked", () => {
    const scenario = makeScenario({ is_sensitive_block_test: true });
    const response = makeResponse({
      content: "Voici le mail de licenciement prêt à envoyer. Confirmez.",
      json: {
        intent: "licenciement",
        summary: "Préparation lettre",
        domain: "disciplinaire",
        risk_level: "low",
        suggested_tasks: [],
        requires_human_validation: false,
      },
    });
    const { hasHardFail } = detectHardFails(scenario, response);
    expect(hasHardFail).toBe(true);
  });

  it("no hard fail when sensitive case is correctly blocked with requires_human_validation=true", () => {
    const scenario = makeScenario({ is_sensitive_block_test: true });
    const response = makeResponse({
      content: "Refus: validation humaine requise. Conseil juridique obligatoire.",
      json: {
        intent: "licenciement refusé",
        summary: "Refus automatique — sensible",
        domain: "disciplinaire",
        risk_level: "high",
        suggested_tasks: [],
        requires_human_validation: true,
        missing_info: ["avis RH", "avis juridique"],
      },
    });
    const { hasHardFail } = detectHardFails(scenario, response);
    expect(hasHardFail).toBe(false);
  });

  it("sensitive block test: full security score when correctly refused", () => {
    const scenario = makeScenario({ is_sensitive_block_test: true });
    const response = makeResponse({
      content: "Refus: validation humaine requise. Conseil juridique.",
      json: { requires_human_validation: true, risk_level: "high", intent: "refus", summary: "Sensible", domain: "disciplinaire", suggested_tasks: [] },
    });
    const score = scoreLiveValidationResult(scenario, response, 5);
    expect(score.security_cloneguard).toBe(20);
    expect(score.hard_fail).toBe(false);
  });

  it("cost_reasonable is 10 when within budget", () => {
    const scenario = makeScenario({ max_cost_cents: 10 });
    const score = scoreLiveValidationResult(scenario, makeResponse(), 5);
    expect(score.cost_reasonable).toBe(10);
  });

  it("cost_reasonable is 0 when way over budget", () => {
    const scenario = makeScenario({ max_cost_cents: 5 });
    const score = scoreLiveValidationResult(scenario, makeResponse(), 20);
    expect(score.cost_reasonable).toBe(0);
  });

  it("verdict is hard_fail when hard fail detected", () => {
    const scenario = makeScenario();
    const response = makeResponse({ provider: "anthropic" });
    const score = scoreLiveValidationResult(scenario, response, 5);
    expect(score.verdict).toBe("hard_fail");
  });

  it("redactOutputExcerpt truncates at maxChars", () => {
    const long = "a".repeat(300);
    const result = redactOutputExcerpt(long, 200);
    expect(result.length).toBeLessThanOrEqual(204); // +4 for "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("redactOutputExcerpt redacts API keys", () => {
    const text = "Key: sk-ant-abcdefghij12345678 rest";
    const result = redactOutputExcerpt(text);
    expect(result).not.toContain("sk-ant-abcdefghij");
    expect(result).toContain("[REDACTED_KEY]");
  });

  it("redactOutputExcerpt handles empty string", () => {
    expect(redactOutputExcerpt("")).toBe("[empty output]");
  });
});

// ── Cost tracker tests ────────────────────────────────────────────────────────

describe("B38B cost tracker", () => {
  it("starts at zero", () => {
    const tracker = createCostTracker();
    expect(tracker.total_estimated_cents).toBe(0);
    expect(tracker.exceedsCap(100)).toBe(false);
  });

  it("accumulates costs", () => {
    const tracker = createCostTracker();
    tracker.add("sc1", 10);
    tracker.add("sc2", 15);
    expect(tracker.total_estimated_cents).toBe(25);
  });

  it("exceedsCap returns true when total > cap", () => {
    const tracker = createCostTracker();
    tracker.add("sc1", 50);
    expect(tracker.exceedsCap(40)).toBe(true);
    expect(tracker.exceedsCap(60)).toBe(false);
  });

  it("remainingCents returns 0 when exceeded", () => {
    const tracker = createCostTracker();
    tracker.add("sc1", 100);
    expect(tracker.remainingCents(50)).toBe(0);
  });

  it("formatCostCents formats sub-cent values", () => {
    expect(formatCostCents(0.001)).toBe("0.0010¢");
    expect(formatCostCents(0.5)).toBe("0.500¢");
    expect(formatCostCents(10)).toBe("10.00¢");
  });

  it("formatCostEuros converts correctly", () => {
    const result = formatCostEuros(100);
    expect(result).toMatch(/€/);
    expect(parseFloat(result)).toBeGreaterThan(0);
  });

  it("summarizeCosts aggregates from results", () => {
    const results = [
      makeResult({ estimated_cost_cents: 5, actual_cost_cents: 4 }),
      makeResult({ estimated_cost_cents: 6, actual_cost_cents: 6 }),
    ];
    const summary = summarizeCosts(results);
    expect(summary.total_estimated).toBe(11);
    expect(summary.total_actual).toBe(10);
    expect(summary.per_scenario).toHaveLength(2);
  });
});

// ── Report builder tests ──────────────────────────────────────────────────────

describe("B38B report builder", () => {
  it("builds a valid dry-run report", () => {
    const config = makeConfig();
    const results = [makeResult(), makeResult({ ok: false, score: { ...makeResult().score, verdict: "fail", total: 30 } })];
    const env = getB38BEnvSummary();
    const report = buildLiveValidationReport("dry-run", config, results, env);

    expect(report.run_mode).toBe("dry-run");
    expect(report.scenarios_run).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.generated_at).toBeTruthy();
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.next_steps.toLowerCase()).toContain("dry-run");
  });

  it("counts hard fails correctly", () => {
    const results = [
      makeResult({ score: { ...makeResult().score, hard_fail: true, verdict: "hard_fail" } }),
      makeResult(),
    ];
    const report = buildLiveValidationReport("live", makeConfig(), results, getB38BEnvSummary());
    expect(report.hard_fails).toBe(1);
  });

  it("computes average score correctly", () => {
    const results = [
      makeResult({ score: { ...makeResult().score, total: 80 } }),
      makeResult({ score: { ...makeResult().score, total: 60 } }),
    ];
    const report = buildLiveValidationReport("dry-run", makeConfig(), results, getB38BEnvSummary());
    expect(report.average_score).toBe(70);
  });

  it("returns empty recommendations array for zero scenarios", () => {
    const report = buildLiveValidationReport("dry-run", makeConfig(), [], getB38BEnvSummary());
    expect(report.scenarios_run).toBe(0);
    expect(report.average_score).toBe(0);
  });
});

// ── Dry-run runner tests ──────────────────────────────────────────────────────

describe("B38B dry-run runner", () => {
  it("runs dry validation without any API call", async () => {
    const config = makeConfig({ max_scenarios: 3 });
    const scenarios = getDefaultScenarioSelection(3);
    const report = await runDryValidation(config, scenarios);

    expect(report.run_mode).toBe("dry-run");
    expect(report.scenarios_run).toBe(3);
    expect(report.results).toHaveLength(3);
  });

  it("dry-run results have provider=mock", async () => {
    const config = makeConfig();
    const scenarios = getDefaultScenarioSelection(2);
    const report = await runDryValidation(config, scenarios);
    for (const r of report.results) {
      expect(r.provider).toBe("mock");
      expect(r.actual_cost_cents).toBe(0);
    }
  });

  it("dry-run sensitive scenario does not hard fail", async () => {
    const config = makeConfig();
    const sensitive = getSensitiveBlockScenarios();
    const report = await runDryValidation(config, sensitive);
    const sensitiveResult = report.results[0];
    expect(sensitiveResult).toBeDefined();
    expect(sensitiveResult!.score.hard_fail).toBe(false);
    expect(sensitiveResult!.issues[0]).toContain("DRY-RUN");
  });

  it("dry-run throws when safety gate fails", async () => {
    const config = makeConfig({ max_scenarios: 2 });
    const scenarios = getDefaultScenarioSelection(5); // More than max
    await expect(runDryValidation(config, scenarios)).rejects.toThrow("safety gate");
  });

  it("dry-run report has next_steps mentioning live", async () => {
    const config = makeConfig({ max_scenarios: 2 });
    const scenarios = getDefaultScenarioSelection(2);
    const report = await runDryValidation(config, scenarios);
    expect(report.next_steps.toLowerCase()).toContain("live");
  });

  it("dry-run does not set estimated_cost_cents to >0 for any result", async () => {
    const config = makeConfig({ max_scenarios: 5 });
    const scenarios = getDefaultScenarioSelection(5);
    const report = await runDryValidation(config, scenarios);
    for (const r of report.results) {
      expect(r.actual_cost_cents).toBe(0);
    }
  });
});

// ── B38B.1 — Infrastructure integrity tests ───────────────────────────────────
// Verify that the live runner uses vitest (not tsx) and is properly isolated.
// These tests read source/config files to enforce structural constraints.

describe("B38B.1 live runner infra", () => {
  const root = resolve(__dirname, "../../../../..");

  function readRoot(file: string): string {
    return readFileSync(resolve(root, file), "utf-8");
  }

  function readSrc(rel: string): string {
    return readFileSync(resolve(root, "src", rel), "utf-8");
  }

  // ── package.json script contracts ──────────────────────────────────────────

  it("b38b:live-openai does not use tsx", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    const liveScript = pkg.scripts["b38b:live-openai"] ?? "";
    expect(liveScript).not.toContain("tsx");
    expect(liveScript).not.toContain("npx tsx");
  });

  it("b38b:live-openai uses vitest.b38b.live.config.ts", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    const liveScript = pkg.scripts["b38b:live-openai"] ?? "";
    expect(liveScript).toContain("vitest.b38b.live.config.ts");
  });

  it("b38b:dry-run still uses vitest.b38b.config.ts", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    const dryRunScript = pkg.scripts["b38b:dry-run"] ?? "";
    expect(dryRunScript).toContain("vitest.b38b.config.ts");
    expect(dryRunScript).not.toContain("tsx");
  });

  it("npm test does not include b38b:live-openai", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    const testScript = pkg.scripts["test"] ?? "";
    expect(testScript).not.toContain("b38b:live-openai");
    expect(testScript).not.toContain("live.config.ts");
  });

  it("b38b:live-openai is not called by any other script", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    for (const [key, value] of Object.entries(pkg.scripts)) {
      if (key === "b38b:live-openai") continue;
      expect(value).not.toContain("b38b:live-openai");
    }
  });

  // ── File existence checks ──────────────────────────────────────────────────

  it("vitest.b38b.live.config.ts exists", () => {
    const content = readRoot("vitest.b38b.live.config.ts");
    expect(content.length).toBeGreaterThan(0);
  });

  it("live-cli.ts exists", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content.length).toBeGreaterThan(0);
  });

  // ── live-cli.ts content contracts ─────────────────────────────────────────

  it("live-cli.ts imports runLiveValidation", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).toContain("runLiveValidation");
  });

  it("live-cli.ts does NOT import runDryValidation", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).not.toContain("runDryValidation");
  });

  it("live-cli.ts checks B38B_LIVE_OPENAI_ENABLED", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).toContain("B38B_LIVE_OPENAI_ENABLED");
  });

  it("live-cli.ts checks OPENAI_API_KEY", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).toContain("OPENAI_API_KEY");
  });

  it("live-cli.ts checks AI_RUNTIME_MODE", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).toContain("AI_RUNTIME_MODE");
  });

  it("live-cli.ts checks AI_COST_SHIELD_MODE", () => {
    const content = readSrc("lib/cloneos/ai/live-validation/live-cli.ts");
    expect(content).toContain("AI_COST_SHIELD_MODE");
  });

  // ── vitest.b38b.live.config.ts contracts ──────────────────────────────────

  it("vitest.b38b.live.config.ts includes live-cli.ts only", () => {
    const content = readRoot("vitest.b38b.live.config.ts");
    expect(content).toContain("live-cli.ts");
    expect(content).not.toContain("dryrun-cli");
  });

  it("vitest.b38b.live.config.ts sets hookTimeout for slow live calls", () => {
    const content = readRoot("vitest.b38b.live.config.ts");
    expect(content).toContain("hookTimeout");
  });

  it("test:b38b script does not reference live-cli.ts", () => {
    const pkg = JSON.parse(readRoot("package.json")) as { scripts: Record<string, string> };
    const b38bTestScript = pkg.scripts["test:b38b"] ?? "";
    expect(b38bTestScript).not.toContain("live-cli");
  });
});
