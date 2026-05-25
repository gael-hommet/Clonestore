// src/lib/pierre/__tests__/pierre-live-validation-b38b.test.ts
// B38B — Pierre live-validation layer: 22+ tests. No API calls. No keys required.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  enrichScenarioWithPierreContext,
  getAllPierreScenarioContexts,
  getPierreScenarioContext,
  getDefaultPierreScenarioSelection,
  getSensitivePierreScenarios,
  getPierreHighSensitivityScenarios,
  validatePierreScenarioSet,
  LIVE_VALIDATION_SCENARIOS,
} from "../ai/live-validation/pierre-scenarios";
import {
  auditPierreJsonFields,
  auditPierreCompliance,
  scorePierreScenario,
  buildPierreScoringReport,
} from "../ai/live-validation/pierre-live-scoring";
import {
  runPierreDryValidation,
  validatePierreReadinessForLive,
} from "../ai/live-validation/pierre-live-runner";
import type { LiveValidationScenario } from "../../cloneos/ai/live-validation/types";
import type { CloneAIResponse } from "../../cloneos/ai/types";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeScenario(overrides: Partial<LiveValidationScenario> = {}): LiveValidationScenario {
  return {
    id: "pierre_test_01",
    name: "Pierre Test",
    description: "Test",
    prompt: "Test prompt",
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
      summary: "Résumé",
      domain: "rh_general",
      risk_level: "low",
      suggested_tasks: ["Tâche 1"],
      requires_human_validation: false,
      missing_info: [],
    }),
    json: {
      intent: "Suivi RH",
      summary: "Résumé",
      domain: "rh_general",
      risk_level: "low",
      suggested_tasks: ["Tâche 1"],
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

// ── Pierre scenario enrichment tests ─────────────────────────────────────────

describe("Pierre scenario enrichment", () => {
  it("enriches all 10 scenarios", () => {
    const contexts = getAllPierreScenarioContexts();
    expect(contexts).toHaveLength(10);
  });

  it("scenario_06 gets pierre_sensitivity=high", () => {
    const ctx = getPierreScenarioContext("scenario_06_sensible_bloque");
    expect(ctx).not.toBeNull();
    expect(ctx!.pierre_sensitivity).toBe("high");
  });

  it("standard scenario gets pierre_sensitivity=low", () => {
    const ctx = getPierreScenarioContext("scenario_01_recrutement");
    expect(ctx).not.toBeNull();
    expect(ctx!.pierre_sensitivity).toBe("low");
  });

  it("prepaie scenario gets pierre_sensitivity=medium (requires human validation)", () => {
    const ctx = getPierreScenarioContext("scenario_04_prepaie");
    expect(ctx).not.toBeNull();
    expect(ctx!.pierre_sensitivity).toBe("medium");
  });

  it("enriched context has pierre_domain set", () => {
    const ctx = getPierreScenarioContext("scenario_01_recrutement");
    expect(ctx!.pierre_domain).toBe("recrutement");
  });

  it("enriched context has pierre_expected_json_fields for tasks", () => {
    const ctx = getPierreScenarioContext("scenario_01_recrutement");
    expect(ctx!.pierre_expected_json_fields).toContain("suggested_tasks");
    expect(ctx!.pierre_expected_json_fields).toContain("intent");
  });

  it("sensitive scenario has requires_human_validation in expected fields", () => {
    const ctx = getPierreScenarioContext("scenario_06_sensible_bloque");
    expect(ctx!.pierre_expected_json_fields).toContain("requires_human_validation");
  });

  it("enriched context has pierre_compliance_notes", () => {
    const ctx = getPierreScenarioContext("scenario_06_sensible_bloque");
    expect(ctx!.pierre_compliance_notes.toLowerCase()).toContain("refuse");
  });

  it("getDefaultPierreScenarioSelection puts sensitive test first", () => {
    const selection = getDefaultPierreScenarioSelection(5);
    expect(selection[0]!.scenario.id).toBe("scenario_06_sensible_bloque");
  });

  it("getSensitivePierreScenarios returns only is_sensitive_block_test=true", () => {
    const sensitive = getSensitivePierreScenarios();
    expect(sensitive).toHaveLength(1);
    expect(sensitive[0]!.scenario.is_sensitive_block_test).toBe(true);
  });

  it("getPierreHighSensitivityScenarios returns only high sensitivity", () => {
    const high = getPierreHighSensitivityScenarios();
    expect(high.every((ctx) => ctx.pierre_sensitivity === "high")).toBe(true);
  });

  it("getPierreScenarioContext returns null for unknown id", () => {
    expect(getPierreScenarioContext("unknown_id")).toBeNull();
  });
});

// ── Pierre scenario set validation ───────────────────────────────────────────

describe("Pierre scenario set validation", () => {
  it("passes for a valid set with sensitive test included", () => {
    const scenarios = LIVE_VALIDATION_SCENARIOS.slice(0, 5);
    // Ensure the sensitive scenario is included
    const withSensitive = [
      LIVE_VALIDATION_SCENARIOS.find((s) => s.is_sensitive_block_test)!,
      ...scenarios.filter((s) => !s.is_sensitive_block_test).slice(0, 4),
    ];
    const result = validatePierreScenarioSet(withSensitive);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails for empty scenario set", () => {
    const result = validatePierreScenarioSet([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("No scenarios"))).toBe(true);
  });

  it("fails when more than 10 scenarios", () => {
    const scenarios = Array.from({ length: 12 }, (_, i) =>
      makeScenario({ id: `s${i}`, is_sensitive_block_test: i === 0 }),
    );
    const result = validatePierreScenarioSet(scenarios);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("10"))).toBe(true);
  });

  it("warns when no sensitive block test scenario", () => {
    const scenarios = LIVE_VALIDATION_SCENARIOS.filter((s) => !s.is_sensitive_block_test).slice(0, 3);
    const result = validatePierreScenarioSet(scenarios);
    expect(result.errors.some((e) => e.includes("sensitive block test"))).toBe(true);
  });
});

// ── Pierre JSON field audit ───────────────────────────────────────────────────

describe("Pierre JSON field audit", () => {
  it("reports all fields present for complete response", () => {
    const scenario = makeScenario();
    const ctx = enrichScenarioWithPierreContext(scenario);
    const response = makeResponse();
    const audit = auditPierreJsonFields(ctx, response);
    expect(audit.has_intent).toBe(true);
    expect(audit.has_summary).toBe(true);
    expect(audit.has_domain).toBe(true);
    expect(audit.has_risk_level).toBe(true);
    expect(audit.has_suggested_tasks).toBe(true);
  });

  it("reports missing fields when JSON is incomplete", () => {
    const scenario = makeScenario({ expected_behavior: { ...makeScenario().expected_behavior, should_require_human_validation: true } });
    const ctx = enrichScenarioWithPierreContext(scenario);
    const response = makeResponse({
      json: { intent: "test", summary: "test" }, // missing many fields
      content: '{"intent":"test","summary":"test"}',
    });
    const audit = auditPierreJsonFields(ctx, response);
    expect(audit.json_complete).toBe(false);
    expect(audit.missing_expected_fields.length).toBeGreaterThan(0);
  });

  it("handles null json gracefully", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const response = makeResponse({ json: null, content: "" });
    const audit = auditPierreJsonFields(ctx, response);
    expect(audit.has_intent).toBe(false);
    expect(audit.json_complete).toBe(false);
  });
});

// ── Pierre compliance audit ───────────────────────────────────────────────────

describe("Pierre compliance audit", () => {
  it("marks compliant for clean response", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const audit = auditPierreCompliance(ctx, makeResponse());
    expect(audit.overall_compliant).toBe(true);
    expect(audit.violations).toHaveLength(0);
    expect(audit.no_auto_send).toBe(true);
  });

  it("detects auto-send violation", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const response = makeResponse({ content: "J'envoie le mail maintenant." });
    const audit = auditPierreCompliance(ctx, response);
    expect(audit.no_auto_send).toBe(false);
    expect(audit.violations).toContain("Pierre proposed auto-sending an email.");
  });

  it("detects sensitive case correctly refused", () => {
    const scenario = makeScenario({ is_sensitive_block_test: true });
    const ctx = enrichScenarioWithPierreContext(scenario);
    const response = makeResponse({
      content: "Refus: validation humaine requise. Conseil juridique obligatoire.",
      json: { requires_human_validation: true, risk_level: "high", intent: "refus", summary: "x", domain: "d", suggested_tasks: [] },
    });
    const audit = auditPierreCompliance(ctx, response);
    expect(audit.sensitive_correctly_refused).toBe(true);
    expect(audit.overall_compliant).toBe(true);
  });

  it("detects sensitive case NOT refused as violation", () => {
    const scenario = makeScenario({ is_sensitive_block_test: true });
    const ctx = enrichScenarioWithPierreContext(scenario);
    const response = makeResponse({
      content: "Voici le mail de licenciement.",
      json: { requires_human_validation: false, risk_level: "low", intent: "licenciement", summary: "x", domain: "d", suggested_tasks: [] },
    });
    const audit = auditPierreCompliance(ctx, response);
    expect(audit.sensitive_correctly_refused).toBe(false);
    expect(audit.violations.length).toBeGreaterThan(0);
  });
});

// ── Pierre enriched scoring ───────────────────────────────────────────────────

describe("Pierre enriched scoring", () => {
  it("returns base_score + field_audit + compliance_audit", () => {
    const scenario = makeScenario();
    const ctx = enrichScenarioWithPierreContext(scenario);
    const enriched = scorePierreScenario(ctx, makeResponse(), 5);
    expect(enriched.base_score).toBeDefined();
    expect(enriched.field_audit).toBeDefined();
    expect(enriched.compliance_audit).toBeDefined();
    expect(enriched.pierre_quality_summary).toBeTruthy();
  });

  it("quality summary reflects excellent verdict", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const enriched = scorePierreScenario(ctx, makeResponse(), 5);
    if (enriched.base_score.verdict === "excellent") {
      expect(enriched.pierre_quality_summary).toContain("xcellent");
    }
  });

  it("buildPierreScoringReport: pass when all compliant and high score", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const enriched = scorePierreScenario(ctx, makeResponse(), 5);
    const report = buildPierreScoringReport([enriched]);
    expect(["pass", "partial"]).toContain(report.overall_verdict);
    expect(report.hard_fails).toBe(0);
    expect(report.compliance_violations).toBe(0);
  });

  it("buildPierreScoringReport: fail when hard_fail present", () => {
    const ctx = enrichScenarioWithPierreContext(makeScenario());
    const response = makeResponse({ provider: "anthropic" }); // triggers hard fail
    const enriched = scorePierreScenario(ctx, response, 5);
    const report = buildPierreScoringReport([enriched]);
    expect(report.hard_fails).toBe(1);
    expect(report.overall_verdict).toBe("fail");
  });
});

// ── Pierre runner tests ───────────────────────────────────────────────────────

describe("Pierre dry-run runner", () => {
  it("runs without error with default config", async () => {
    const report = await runPierreDryValidation(3);
    expect(report.run_mode).toBe("dry-run");
    expect(report.scenarios_run).toBe(3);
  });

  it("dry-run results are all mock", async () => {
    const report = await runPierreDryValidation(2);
    for (const r of report.results) {
      expect(r.provider).toBe("mock");
    }
  });

  it("validatePierreReadinessForLive fails without env vars", () => {
    const result = validatePierreReadinessForLive(5);
    expect(result.ready).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("validatePierreReadinessForLive lists missing OPENAI_API_KEY as reason", () => {
    const result = validatePierreReadinessForLive(5);
    const hasKeyReason = result.reasons.some((r) => r.includes("OPENAI_API_KEY"));
    expect(hasKeyReason).toBe(true);
  });
});
