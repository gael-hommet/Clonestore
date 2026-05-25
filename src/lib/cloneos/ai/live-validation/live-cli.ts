// src/lib/cloneos/ai/live-validation/live-cli.ts
// B38B — Live OpenAI runner for Vitest (no tsx required).
// Invoked via: vitest run --config vitest.b38b.live.config.ts
// NOT included in npm test (dedicated config file only).
//
// BEHAVIOR:
// - Safety gates are checked FIRST. Zero API calls before full gate validation.
// - If ANY gate fails → throw with all failure messages listed. Never silent fallback.
// - If gates pass → runLiveValidation() is called. Real OpenAI calls happen here.
// - This file NEVER falls back to dry-run mode — live mode is explicit and mandatory.
//
// REQUIRED ENV VARS (all must be set):
//   B38B_LIVE_OPENAI_ENABLED=true
//   OPENAI_API_KEY=sk-...
//   AI_RUNTIME_MODE=production
//   AI_COST_SHIELD_MODE=enforce
//   AI_EMERGENCY_SHUTDOWN=false
//   AI_ANTHROPIC_ENABLED=false
//   AI_PUBLIC_DEMO_ALLOW_REAL_CALLS=false
//   AI_UNPAID_ALLOW_REAL_CALLS=false
//   B38B_MAX_TOTAL_COST_CENTS=75  (max 150)
//   B38B_MAX_SCENARIOS=5
//   B38B_ALLOWED_ACCESS_LEVEL=internal_admin

import { describe, it, expect, beforeAll } from "vitest";
import { getB38BConfig } from "./config";
import { getDefaultScenarioSelection } from "./scenarios";
import { validateB38BSafetyGate } from "./safety";
import { runLiveValidation } from "./runner";
import { formatCostCents, formatCostEuros } from "./cost-report";
import type { LiveValidationReport } from "./types";

// ── Pre-flight safety gate (runs BEFORE any OpenAI call) ─────────────────────

function assertLiveReadiness(): void {
  const failures: string[] = [];

  // 1. Master live switch
  if (process.env["B38B_LIVE_OPENAI_ENABLED"] !== "true") {
    failures.push("B38B_LIVE_OPENAI_ENABLED must be 'true'");
  }

  // 2. OpenAI key
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey || apiKey.trim() === "") {
    failures.push("OPENAI_API_KEY must be set");
  }

  // 3. Runtime mode
  if (process.env["AI_RUNTIME_MODE"] !== "production") {
    failures.push("AI_RUNTIME_MODE must be 'production'");
  }

  // 4. Shield mode
  const shieldMode = process.env["AI_COST_SHIELD_MODE"] ?? "enforce";
  if (shieldMode !== "enforce") {
    failures.push(`AI_COST_SHIELD_MODE must be 'enforce' (got: '${shieldMode}')`);
  }

  // 5. Emergency shutdown
  if (process.env["AI_EMERGENCY_SHUTDOWN"]?.toLowerCase() === "true") {
    failures.push("AI_EMERGENCY_SHUTDOWN is 'true' — all AI calls are globally blocked");
  }

  // 6. Anthropic must be off
  if (process.env["AI_ANTHROPIC_ENABLED"]?.toLowerCase() === "true") {
    failures.push("AI_ANTHROPIC_ENABLED must be 'false' — Anthropic is disabled for B38B");
  }

  // 7. Public demo must not allow real calls
  if (process.env["AI_PUBLIC_DEMO_ALLOW_REAL_CALLS"]?.toLowerCase() === "true") {
    failures.push("AI_PUBLIC_DEMO_ALLOW_REAL_CALLS must be 'false'");
  }

  // 8. Unpaid must not allow real calls
  if (process.env["AI_UNPAID_ALLOW_REAL_CALLS"]?.toLowerCase() === "true") {
    failures.push("AI_UNPAID_ALLOW_REAL_CALLS must be 'false'");
  }

  // 9. Cost cap
  const capRaw = process.env["B38B_MAX_TOTAL_COST_CENTS"];
  if (!capRaw) {
    failures.push("B38B_MAX_TOTAL_COST_CENTS must be set (recommended: 75)");
  } else {
    const cap = parseInt(capRaw, 10);
    if (!Number.isFinite(cap) || cap > 150) {
      failures.push(`B38B_MAX_TOTAL_COST_CENTS=${cap} exceeds absolute max 150¢`);
    }
  }

  // 10. Access level
  const accessLevel = process.env["B38B_ALLOWED_ACCESS_LEVEL"] ?? "internal_admin";
  if (accessLevel !== "internal_admin") {
    failures.push(`B38B_ALLOWED_ACCESS_LEVEL must be 'internal_admin' (got: '${accessLevel}')`);
  }

  if (failures.length > 0) {
    throw new Error(
      [
        "",
        "B38B live refused — required env vars missing or invalid:",
        ...failures.map((f) => `  ✗ ${f}`),
        "",
        "Set all required variables, then rerun: npm run b38b:live-openai",
        "(This is expected when running without live credentials.)",
      ].join("\n"),
    );
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let report: LiveValidationReport;
let setupError: Error | null = null;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("B38B Live OpenAI Validation", () => {
  beforeAll(async () => {
    // Step 1: CLI-level safety check (immediate, no config object needed)
    assertLiveReadiness();

    // Step 2: Load config + scenarios
    const config = getB38BConfig();
    const scenarioCount = Math.min(config.max_scenarios, 10);
    const scenarios = getDefaultScenarioSelection(scenarioCount);

    // Step 3: Safety gate (platform-level, 11 conditions)
    const gate = validateB38BSafetyGate(config, "live", scenarios.length);
    if (!gate.passed) {
      throw new Error(
        [
          "",
          "B38B safety gate failed:",
          ...gate.failures.map((f) => `  ✗ ${f}`),
        ].join("\n"),
      );
    }

    // Step 4: Run live validation (real OpenAI calls happen here)
    const estimatedTotal = scenarios.reduce((s, sc) => s + sc.max_cost_cents, 0);
    console.log("\n" + "=".repeat(64));
    console.log("  B38B LIVE OPENAI VALIDATION");
    console.log("=".repeat(64));
    console.log(`  Scenarios  : ${scenarios.length}`);
    console.log(`  Est. cost  : ~${formatCostCents(estimatedTotal)} (${formatCostEuros(estimatedTotal)})`);
    console.log(`  Cost cap   : ${config.max_total_cost_cents}¢`);
    console.log("  Calling OpenAI...\n");

    try {
      report = await runLiveValidation(config, scenarios);
    } catch (err) {
      setupError = err instanceof Error ? err : new Error(String(err));
      throw setupError;
    }

    // Print report immediately after live run
    console.log("\n  LIVE RESULTS:");
    for (const r of report.results) {
      const status = r.score.hard_fail
        ? "HARD FAIL"
        : r.ok
          ? r.score.verdict
          : "blocked";
      const cost = r.actual_cost_cents > 0
        ? formatCostCents(r.actual_cost_cents)
        : `~${formatCostCents(r.estimated_cost_cents)}`;
      console.log(
        `  [${r.scenario_id.slice(0, 11).padEnd(11)}] score=${r.score.total} ${status} cost=${cost}`,
      );
      if (r.score.hard_fail_reason) {
        console.log(`     HARD FAIL: ${r.score.hard_fail_reason}`);
      }
    }

    console.log("\n  SUMMARY:");
    console.log(`  Passed        : ${report.passed}/${report.scenarios_run}`);
    console.log(`  Hard fails    : ${report.hard_fails}`);
    console.log(`  Average score : ${report.average_score}/100`);
    console.log(
      `  Total cost    : ${formatCostCents(report.total_actual_cost_cents)} actual / ${formatCostCents(report.total_estimated_cost_cents)} estimated`,
    );

    console.log("\n  RECOMMENDATIONS:");
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log(`\n  NEXT STEPS: ${report.next_steps}`);
    console.log("=".repeat(64) + "\n");
  });

  it("live validation completes without crash", () => {
    expect(setupError).toBeNull();
    expect(report).toBeDefined();
    expect(report.run_mode).toBe("live");
    expect(report.scenarios_run).toBeGreaterThan(0);
  });

  it("all live calls used OpenAI or were shield-blocked (never mock bypass)", () => {
    for (const r of report.results) {
      // Provider must be openai, blocked, or skipped — never raw mock
      const validProviders = ["openai", "blocked", "skipped"];
      expect(validProviders).toContain(r.provider);
    }
  });

  it("Anthropic was never used in any live scenario", () => {
    for (const r of report.results) {
      expect(r.provider).not.toBe("anthropic");
    }
  });

  it("cost stayed below B38B_MAX_TOTAL_COST_CENTS", () => {
    const cap = parseInt(process.env["B38B_MAX_TOTAL_COST_CENTS"] ?? "150", 10);
    expect(report.total_actual_cost_cents).toBeLessThanOrEqual(cap);
  });

  it("no hard fail in live results", () => {
    const hardFails = report.results.filter((r) => r.score.hard_fail);
    if (hardFails.length > 0) {
      const reasons = hardFails.map((r) => `${r.scenario_id}: ${r.score.hard_fail_reason}`);
      console.error("\nHARD FAILS DETECTED:");
      for (const reason of reasons) console.error(`  ✗ ${reason}`);
    }
    expect(hardFails).toHaveLength(0);
  });

  it("report has valid generated_at and recommendations", () => {
    expect(report.generated_at).toBeTruthy();
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.next_steps).toBeTruthy();
  });
});
