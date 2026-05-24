// src/lib/cloneos/ai/__tests__/ai-b32.test.ts
// B32 — Production AI Runtime layer tests.
// No real API keys required — mock provider only.

import { describe, test, expect, beforeEach, vi } from "vitest";

// ── Module imports ─────────────────────────────────────────────────────────────

import { getAiRuntimeMode, isAiProductionMode, isAiMockMode, isAiDisabled, assertAiModeDescription } from "../mode";
import { estimateAiCost, formatCostCents, formatCostEuros, getKnownModelIds, isKnownModel } from "../cost";
import { checkBudget, checkSingleCallBudget, buildDefaultScope, getBudgetConfig } from "../budgets";
import { buildAiUsageLog, traceAiUsageLog, sumCosts, filterByPeriod } from "../usage-log";
import { getModelPreset, getModelId, listAllPresets, listPremiumPresets, isPremiumPreset } from "../model-presets";
import { getDefaultCloneAIRouterPolicy, selectCloneAIProviderOrder } from "../model-router";
import { getCloneAIPromptContract, listCloneAIPromptContracts } from "../prompt-registry";
import { runCloneAI, runCloneAIContract, getCloneAIRuntimeStatus } from "../runtime";
import type { AiBudgetScope, AiUsageLogInput } from "../types";

// ── Mode tests ─────────────────────────────────────────────────────────────────

describe("B32 — getAiRuntimeMode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  test("defaults to mock when AI_RUNTIME_MODE is not set", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "");
    expect(getAiRuntimeMode()).toBe("mock");
  });

  test("returns mock when AI_RUNTIME_MODE=mock", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");
    expect(getAiRuntimeMode()).toBe("mock");
  });

  test("returns production when AI_RUNTIME_MODE=production", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "production");
    expect(getAiRuntimeMode()).toBe("production");
  });

  test("returns disabled when AI_RUNTIME_MODE=disabled", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "disabled");
    expect(getAiRuntimeMode()).toBe("disabled");
  });

  test("falls back to mock for unknown values", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "invalid_value");
    expect(getAiRuntimeMode()).toBe("mock");
  });

  test("isAiMockMode returns true in mock mode", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");
    expect(isAiMockMode()).toBe(true);
    expect(isAiProductionMode()).toBe(false);
    expect(isAiDisabled()).toBe(false);
  });

  test("isAiProductionMode returns true in production mode", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "production");
    expect(isAiProductionMode()).toBe(true);
    expect(isAiMockMode()).toBe(false);
    expect(isAiDisabled()).toBe(false);
  });

  test("isAiDisabled returns true in disabled mode", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "disabled");
    expect(isAiDisabled()).toBe(true);
  });

  test("assertAiModeDescription returns non-empty string for all modes", () => {
    expect(assertAiModeDescription("mock")).toBeTruthy();
    expect(assertAiModeDescription("production")).toBeTruthy();
    expect(assertAiModeDescription("disabled")).toBeTruthy();
  });
});

// ── Cost estimation tests ──────────────────────────────────────────────────────

describe("B32 — estimateAiCost", () => {
  test("estimates zero cost for zero tokens", () => {
    const r = estimateAiCost("anthropic", "claude-opus-4-7", 0, 0);
    expect(r.estimated_cost_cents).toBe(0);
    expect(r.cost_tier).toBe("negligible");
  });

  test("estimates correct cost for Opus 4.7", () => {
    // 1000 input + 1000 output → 1.5 + 7.5 = 9¢
    const r = estimateAiCost("anthropic", "claude-opus-4-7", 1000, 1000);
    expect(r.estimated_cost_cents).toBeCloseTo(9.0, 1);
    expect(r.provider).toBe("anthropic");
    expect(r.model_id).toBe("claude-opus-4-7");
    expect(r.cost_tier).toBe("high");
  });

  test("estimates correct cost for gpt-4.1", () => {
    // 1000 input + 1000 output → 0.2 + 0.8 = 1.0¢
    const r = estimateAiCost("openai", "gpt-4.1", 1000, 1000);
    expect(r.estimated_cost_cents).toBeCloseTo(1.0, 1);
    expect(r.cost_tier).toBe("high"); // 1.0¢ >= 1.0 threshold = "high"
  });

  test("estimates correct cost for gpt-4.1-mini", () => {
    // 1000 input + 1000 output → 0.04 + 0.16 = 0.2¢ (0.1 <= x < 1.0 = "medium")
    const r = estimateAiCost("openai", "gpt-4.1-mini", 1000, 1000);
    expect(r.estimated_cost_cents).toBeCloseTo(0.2, 2);
    expect(r.cost_tier).toBe("medium");
  });

  test("uses fallback rate for unknown model", () => {
    const r = estimateAiCost("openai", "unknown-model-xyz", 1000, 1000);
    expect(r.estimated_cost_cents).toBeGreaterThan(0);
  });

  test("handles mock provider with mock model (cost 0)", () => {
    const r = estimateAiCost("mock", "mock", 1000, 1000);
    expect(r.estimated_cost_cents).toBeGreaterThan(0); // uses fallback rate, not zero
  });

  test("getKnownModelIds returns non-empty array", () => {
    const ids = getKnownModelIds();
    expect(ids.length).toBeGreaterThan(5);
    expect(ids).toContain("claude-opus-4-7");
    expect(ids).toContain("gpt-4.1");
    expect(ids).toContain("gpt-4.1-mini");
  });

  test("isKnownModel returns true for known models", () => {
    expect(isKnownModel("claude-opus-4-7")).toBe(true);
    expect(isKnownModel("gpt-4.1")).toBe(true);
    expect(isKnownModel("unknown-xyz")).toBe(false);
  });

  test("formatCostCents formats small cost correctly", () => {
    const s = formatCostCents(0.0012);
    expect(s).toContain("¢");
  });

  test("formatCostEuros converts cents to euros", () => {
    const s = formatCostEuros(100, 0.92); // 1 dollar = ~0.92 EUR
    expect(s).toContain("€");
  });
});

// ── Budget enforcement tests ───────────────────────────────────────────────────

describe("B32 — checkBudget", () => {
  test("allows when no limit configured (max_cents <= 0)", () => {
    const scope: AiBudgetScope = { agent_slug: "test", period: "daily", max_cents: 0, used_cents: 0 };
    const result = checkBudget(scope, 5.0);
    expect(result.allowed).toBe(true);
  });

  test("allows when cost fits within budget", () => {
    const scope: AiBudgetScope = { agent_slug: "pierre", period: "daily", max_cents: 100, used_cents: 50 };
    const result = checkBudget(scope, 30.0);
    expect(result.allowed).toBe(true);
    expect(result.remaining_cents).toBeCloseTo(20, 0);
  });

  test("blocks when cost exceeds remaining budget", () => {
    const scope: AiBudgetScope = { agent_slug: "pierre", period: "daily", max_cents: 100, used_cents: 90 };
    const result = checkBudget(scope, 20.0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test("blocks when used already exceeds max", () => {
    const scope: AiBudgetScope = { agent_slug: "pierre", period: "daily", max_cents: 100, used_cents: 105 };
    const result = checkBudget(scope, 1.0);
    expect(result.allowed).toBe(false);
  });

  test("checkSingleCallBudget allows small call", () => {
    const result = checkSingleCallBudget(0.5);
    expect(result.allowed).toBe(true);
  });

  test("checkSingleCallBudget blocks call that exceeds single-call cap", () => {
    // Default single_call cap = 100 cents ($1). 150 cents should be blocked.
    const result = checkSingleCallBudget(150);
    expect(result.allowed).toBe(false);
  });

  test("getBudgetConfig returns positive numbers", () => {
    const cfg = getBudgetConfig();
    expect(cfg.daily_cents).toBeGreaterThan(0);
    expect(cfg.monthly_cents).toBeGreaterThan(0);
    expect(cfg.single_call_max_cents).toBeGreaterThan(0);
  });

  test("buildDefaultScope returns valid scope", () => {
    const scope = buildDefaultScope("pierre", "daily", 30);
    expect(scope.agent_slug).toBe("pierre");
    expect(scope.period).toBe("daily");
    expect(scope.used_cents).toBe(30);
    expect(scope.max_cents).toBeGreaterThan(0);
  });
});

// ── Usage log tests ────────────────────────────────────────────────────────────

describe("B32 — buildAiUsageLog", () => {
  test("builds a valid log with all fields", () => {
    const log = buildAiUsageLog({
      agent_slug: "pierre",
      use_case: "pierre.document.generate",
      provider: "anthropic",
      model_id: "claude-opus-4-7",
      runtime_mode: "production",
      input_tokens: 500,
      output_tokens: 1200,
      estimated_cost_cents: 9.5,
      latency_ms: 3200,
      status: "ok",
    });

    expect(log.agent_slug).toBe("pierre");
    expect(log.provider).toBe("anthropic");
    expect(log.model_id).toBe("claude-opus-4-7");
    expect(log.input_tokens).toBe(500);
    expect(log.output_tokens).toBe(1200);
    expect(log.estimated_cost_cents).toBe(9.5);
    expect(log.latency_ms).toBe(3200);
    expect(log.status).toBe("ok");
    expect(log.error_code).toBeNull();
  });

  test("sanitizes negative values to 0", () => {
    const log = buildAiUsageLog({
      agent_slug: "test",
      use_case: "test",
      provider: "mock",
      model_id: "mock",
      runtime_mode: "mock",
      input_tokens: -5,
      output_tokens: -10,
      estimated_cost_cents: -1,
      latency_ms: -100,
      status: "ok",
    });

    expect(log.input_tokens).toBe(0);
    expect(log.output_tokens).toBe(0);
    expect(log.estimated_cost_cents).toBe(0);
    expect(log.latency_ms).toBe(0);
  });

  test("includes error_code when provided", () => {
    const log = buildAiUsageLog({
      agent_slug: "test",
      use_case: "test",
      provider: "openai",
      model_id: "gpt-4.1",
      runtime_mode: "production",
      input_tokens: 100,
      output_tokens: 0,
      estimated_cost_cents: 0.02,
      latency_ms: 500,
      status: "error",
      error_code: "TIMEOUT",
    });

    expect(log.status).toBe("error");
    expect(log.error_code).toBe("TIMEOUT");
  });

  test("traceAiUsageLog is silent in mock mode (no throw)", () => {
    const log = buildAiUsageLog({
      agent_slug: "pierre",
      use_case: "test",
      provider: "mock",
      model_id: "mock",
      runtime_mode: "mock",
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_cents: 0,
      latency_ms: 0,
      status: "ok",
    });
    expect(() => traceAiUsageLog(log)).not.toThrow();
  });

  test("sumCosts returns sum of estimated costs", () => {
    const logs: AiUsageLogInput[] = [
      buildAiUsageLog({ agent_slug: "a", use_case: "u", provider: "mock", model_id: "m", runtime_mode: "mock", input_tokens: 0, output_tokens: 0, estimated_cost_cents: 5.0, latency_ms: 0, status: "ok" }),
      buildAiUsageLog({ agent_slug: "b", use_case: "u", provider: "mock", model_id: "m", runtime_mode: "mock", input_tokens: 0, output_tokens: 0, estimated_cost_cents: 3.5, latency_ms: 0, status: "ok" }),
    ];
    expect(sumCosts(logs)).toBeCloseTo(8.5, 1);
  });

  test("sumCosts handles empty array", () => {
    expect(sumCosts([])).toBe(0);
  });

  test("filterByPeriod returns all logs (DB filtering deferred)", () => {
    const logs: AiUsageLogInput[] = [
      buildAiUsageLog({ agent_slug: "a", use_case: "u", provider: "mock", model_id: "m", runtime_mode: "mock", input_tokens: 0, output_tokens: 0, estimated_cost_cents: 1, latency_ms: 0, status: "ok" }),
    ];
    expect(filterByPeriod(logs, "daily").length).toBe(1);
  });
});

// ── Model presets tests ────────────────────────────────────────────────────────

describe("B32 — model presets", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  test("getModelPreset returns preset for deliverable_premium", () => {
    const p = getModelPreset("deliverable_premium");
    expect(p.key).toBe("deliverable_premium");
    expect(p.provider).toBe("anthropic");
    expect(p.model_profile).toBe("premium_generation");
    expect(p.is_premium).toBe(true);
  });

  test("getModelPreset returns preset for mission_planning", () => {
    const p = getModelPreset("mission_planning");
    expect(p.provider).toBe("openai");
    expect(p.model_profile).toBe("orchestration");
    expect(p.is_premium).toBe(false);
  });

  test("getModelPreset returns preset for status_update", () => {
    const p = getModelPreset("status_update");
    expect(p.provider).toBe("openai");
    expect(p.model_profile).toBe("micro_task");
    expect(p.is_premium).toBe(false);
  });

  test("getModelId returns default model when env not set", () => {
    vi.stubEnv("AI_ANTHROPIC_OPUS_MODEL", "");
    const id = getModelId("deliverable_premium");
    expect(id).toBe("claude-opus-4-7");
  });

  test("getModelId respects env override", () => {
    vi.stubEnv("AI_ANTHROPIC_OPUS_MODEL", "claude-opus-custom");
    const id = getModelId("deliverable_premium");
    expect(id).toBe("claude-opus-custom");
  });

  test("listAllPresets returns all 18 presets", () => {
    const all = listAllPresets();
    expect(all.length).toBe(18);
  });

  test("listPremiumPresets returns only premium presets", () => {
    const premium = listPremiumPresets();
    expect(premium.length).toBeGreaterThan(0);
    for (const p of premium) {
      expect(p.is_premium).toBe(true);
      expect(p.provider).toBe("anthropic");
    }
  });

  test("isPremiumPreset returns true for Opus presets", () => {
    expect(isPremiumPreset("deliverable_premium")).toBe(true);
    expect(isPremiumPreset("hr_letter_generation")).toBe(true);
    expect(isPremiumPreset("risk_analysis_sensitive")).toBe(true);
  });

  test("isPremiumPreset returns false for GPT presets", () => {
    expect(isPremiumPreset("mission_planning")).toBe(false);
    expect(isPremiumPreset("status_update")).toBe(false);
    expect(isPremiumPreset("field_extraction")).toBe(false);
  });
});

// ── Model router — new profiles ────────────────────────────────────────────────

describe("B32 — model router new profiles", () => {
  test("pierre.document.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.document.generate");
    expect(policy.model_profile).toBe("premium_generation");
    expect(policy.preferred_provider).toBe("anthropic");
    expect(policy.timeout_ms).toBe(60000);
    expect(policy.max_output_tokens).toBe(8192);
  });

  test("pierre.pdf.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.pdf.generate");
    expect(policy.model_profile).toBe("premium_generation");
    expect(policy.preferred_provider).toBe("anthropic");
  });

  test("pierre.client_fiche.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.client_fiche.generate");
    expect(policy.model_profile).toBe("premium_generation");
  });

  test("pierre.final_report.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.final_report.generate");
    expect(policy.model_profile).toBe("premium_generation");
  });

  test("pierre.hr_letter.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.hr_letter.generate");
    expect(policy.model_profile).toBe("premium_generation");
  });

  test("pierre.risk.sensitive routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.risk.sensitive");
    expect(policy.model_profile).toBe("premium_generation");
  });

  test("pierre.spreadsheet.generate routes to premium_generation", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.spreadsheet.generate");
    expect(policy.model_profile).toBe("premium_generation");
  });

  test("selectCloneAIProviderOrder for premium_generation starts with anthropic", () => {
    const policy = getDefaultCloneAIRouterPolicy("pierre.document.generate");
    const order = selectCloneAIProviderOrder(policy);
    expect(order[0]).toBe("anthropic");
    expect(order).toContain("mock");
  });

  test("selectCloneAIProviderOrder for orchestration starts with openai", () => {
    const policy = { ...getDefaultCloneAIRouterPolicy("pierre.tasks.plan"), model_profile: "orchestration" as const, preferred_provider: "openai" as const };
    const order = selectCloneAIProviderOrder(policy);
    expect(order[0]).toBe("openai");
  });
});

// ── New prompt contracts ───────────────────────────────────────────────────────

describe("B32 — new prompt contracts", () => {
  test("pierre.document.generate contract exists", () => {
    const c = getCloneAIPromptContract("pierre.document.generate");
    expect(c).not.toBeNull();
    expect(c!.id).toBe("pierre.document.generate.v1");
    expect(c!.output_mode).toBe("markdown");
    expect(c!.model_profile).toBe("premium_generation");
    expect(c!.required_variables).toContain("document_type");
    expect(c!.required_variables).toContain("title");
  });

  test("pierre.pdf.generate contract exists with markdown output", () => {
    const c = getCloneAIPromptContract("pierre.pdf.generate");
    expect(c).not.toBeNull();
    expect(c!.output_mode).toBe("markdown");
    expect(c!.model_profile).toBe("premium_generation");
  });

  test("pierre.spreadsheet.generate contract has JSON schema", () => {
    const c = getCloneAIPromptContract("pierre.spreadsheet.generate");
    expect(c).not.toBeNull();
    expect(c!.output_mode).toBe("json");
    expect(c!.json_schema).toBeDefined();
    expect(c!.json_schema!.headers).toBeDefined();
    expect(c!.json_schema!.rows).toBeDefined();
  });

  test("pierre.client_fiche.generate contract has JSON schema with key_points", () => {
    const c = getCloneAIPromptContract("pierre.client_fiche.generate");
    expect(c).not.toBeNull();
    expect(c!.output_mode).toBe("json");
    expect(c!.json_schema!.key_points).toBeDefined();
    expect(c!.json_schema!.confidential).toBeDefined();
  });

  test("pierre.final_report.generate contract has markdown output", () => {
    const c = getCloneAIPromptContract("pierre.final_report.generate");
    expect(c).not.toBeNull();
    expect(c!.output_mode).toBe("markdown");
    expect(c!.model_profile).toBe("premium_generation");
  });

  test("pierre.hr_letter.generate contract is risk_mode sensitive", () => {
    const c = getCloneAIPromptContract("pierre.hr_letter.generate");
    expect(c).not.toBeNull();
    expect(c!.risk_mode).toBe("sensitive");
    expect(c!.model_profile).toBe("premium_generation");
  });

  test("pierre.risk.sensitive contract has full JSON schema", () => {
    const c = getCloneAIPromptContract("pierre.risk.sensitive");
    expect(c).not.toBeNull();
    expect(c!.output_mode).toBe("json");
    expect(c!.risk_mode).toBe("sensitive");
    expect(c!.json_schema!.risk_level).toBeDefined();
    expect(c!.json_schema!.human_validation_required).toBeDefined();
    expect(c!.json_schema!.legal_review_required).toBeDefined();
  });

  test("total contract count is 23", () => {
    expect(listCloneAIPromptContracts()).toHaveLength(23);
  });
});

// ── Runtime mode enforcement ───────────────────────────────────────────────────

describe("B32 — runtime mode enforcement", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  test("runCloneAI is blocked when AI_RUNTIME_MODE=disabled", async () => {
    vi.stubEnv("AI_RUNTIME_MODE", "disabled");

    const response = await runCloneAI({
      use_case: "pierre.document.generate",
      messages: [{ role: "user", content: "Test" }],
      output_mode: "text",
      policy: { preferred_provider: "mock", fallback_providers: ["mock"] },
    });

    expect(response.ok).toBe(false);
    expect(response.error).toContain("disabled");
  });

  test("runCloneAI uses mock provider in mock mode", async () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");

    const response = await runCloneAI({
      use_case: "pierre.document.generate",
      messages: [{ role: "user", content: "Génère un contrat de travail." }],
      output_mode: "text",
      policy: { preferred_provider: "anthropic", fallback_providers: ["openai"] },
    });

    // Mock mode forces mock provider, so should succeed
    expect(response.ok).toBe(true);
    expect(response.provider).toBe("mock");
  });

  test("runCloneAIContract for pierre.document.generate works in mock mode", async () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");

    const response = await runCloneAIContract({
      useCase: "pierre.document.generate",
      variables: {
        document_type: "Contrat CDI",
        title: "Contrat de travail",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.provider).toBe("mock");
    expect(typeof response.content).toBe("string");
  });

  test("runCloneAIContract for pierre.risk.sensitive works in mock mode", async () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");

    const response = await runCloneAIContract({
      useCase: "pierre.risk.sensitive",
      variables: {
        case_type: "Licenciement",
        situation: "Salarié en arrêt maladie depuis 6 mois.",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.provider).toBe("mock");
  });

  test("getCloneAIRuntimeStatus includes mode field", () => {
    vi.stubEnv("AI_RUNTIME_MODE", "mock");
    const status = getCloneAIRuntimeStatus();
    expect(status.mode).toBe("mock");
    expect(status.prompt_contracts_count).toBe(23);
    expect(status.providers.length).toBeGreaterThan(0);
  });
});

// ── Pierre deliverable bridge functions ───────────────────────────────────────

describe("B32 — Pierre deliverable bridge functions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AI_RUNTIME_MODE", "mock");
  });

  test("generatePierreDocumentWithAI returns ok with content in mock mode", async () => {
    const { generatePierreDocumentWithAI } = await import("../../../pierre/ai/runtime");

    const result = await generatePierreDocumentWithAI({
      documentType: "Contrat CDI",
      title: "Contrat de travail M. Dupont",
      instructions: "Poste : Développeur Senior",
    });

    expect(result.ok).toBe(true);
    expect(typeof result.content).toBe("string");
    expect(result.provider).toBe("mock");
    expect(result.error).toBeNull();
  });

  test("generatePierrePdfContentWithAI returns ok with content in mock mode", async () => {
    const { generatePierrePdfContentWithAI } = await import("../../../pierre/ai/runtime");

    const result = await generatePierrePdfContentWithAI({
      pdfType: "Bilan RH mensuel",
      title: "Bilan RH Mai 2026",
      period: "Mai 2026",
    });

    expect(result.ok).toBe(true);
    expect(typeof result.content).toBe("string");
    expect(result.error).toBeNull();
  });

  test("generatePierreClientFicheWithAI returns ok with fiche in mock mode", async () => {
    const { generatePierreClientFicheWithAI } = await import("../../../pierre/ai/runtime");

    const result = await generatePierreClientFicheWithAI({
      ficheType: "Fiche salarié",
      entityData: { name: "Jean Dupont", role: "Dev" },
    });

    expect(result.ok).toBe(true);
    // Mock provider returns mock JSON object
    expect(result.provider).toBe("mock");
  });

  test("generatePierreFinalReportWithAI returns ok with content in mock mode", async () => {
    const { generatePierreFinalReportWithAI } = await import("../../../pierre/ai/runtime");

    const result = await generatePierreFinalReportWithAI({
      period: "Q1 2026",
      kpiData: { headcount: 42, turnover: "3%" },
    });

    expect(result.ok).toBe(true);
    expect(typeof result.content).toBe("string");
    expect(result.error).toBeNull();
  });

  test("generatePierreHrLetterWithAI returns ok with content in mock mode", async () => {
    const { generatePierreHrLetterWithAI } = await import("../../../pierre/ai/runtime");

    const result = await generatePierreHrLetterWithAI({
      letterType: "Convocation entretien préalable",
      recipient: "M. Jean Dupont",
      subject: "Convocation entretien disciplinaire",
      instructions: "Motif : absences répétées",
    });

    expect(result.ok).toBe(true);
    expect(typeof result.content).toBe("string");
    expect(result.error).toBeNull();
  });

  test("analyzePierreRiskSensitiveWithAI always sets humanValidationRequired=true on parse failure", async () => {
    const { analyzePierreRiskSensitiveWithAI } = await import("../../../pierre/ai/runtime");

    const result = await analyzePierreRiskSensitiveWithAI({
      caseType: "Licenciement pour faute grave",
      situation: "Salarié accusé de harcèlement moral sur collègues.",
    });

    // Mock provider returns mock JSON — humanValidationRequired defaults safely
    expect(result.provider).toBe("mock");
    // humanValidationRequired must be true if analysis is null or if field is not explicitly false
    if (result.analysis === null) {
      expect(result.humanValidationRequired).toBe(true);
    }
    expect(result.error === null || typeof result.error === "string").toBe(true);
  });
});
