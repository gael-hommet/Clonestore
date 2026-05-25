// src/lib/cloneos/ai/live-validation/dryrun-cli.ts
// B38B — Dry-run runner for vitest-based CLI (no tsx required).
// Invoked via: vitest run --reporter=verbose src/lib/cloneos/ai/live-validation/dryrun-cli.ts
// This file is intentionally NOT named *.test.ts to stay out of npm test.
// The b38b:dry-run script targets it directly.

import { describe, it, expect, beforeAll } from "vitest";
import { getB38BConfig } from "./config";
import { getDefaultScenarioSelection } from "./scenarios";
import { runDryValidation } from "./runner";
import { formatCostCents, formatCostEuros } from "./cost-report";
import type { LiveValidationReport } from "./types";

let report: LiveValidationReport;

describe("B38B Dry-Run Validation", () => {
  beforeAll(async () => {
    const config = getB38BConfig();
    const scenarioCount = Math.min(config.max_scenarios, 8);
    const scenarios = getDefaultScenarioSelection(scenarioCount);
    report = await runDryValidation(config, scenarios);
  });

  it("dry-run completes without error", () => {
    expect(report).toBeDefined();
    expect(report.run_mode).toBe("dry-run");
  });

  it("all scenarios ran as mock (no real API calls)", () => {
    for (const r of report.results) {
      expect(r.provider).toBe("mock");
      expect(r.actual_cost_cents).toBe(0);
    }
    console.log("\n" + "=".repeat(64));
    console.log("  B38B DRY-RUN REPORT");
    console.log("=".repeat(64));
    console.log(`  Mode           : ${report.run_mode}`);
    console.log(`  Scenarios      : ${report.scenarios_run}`);
    console.log(`  Passed         : ${report.passed}`);
    console.log(`  Failed         : ${report.failed}`);
    console.log(`  Hard fails     : ${report.hard_fails}`);
    console.log(`  Average score  : ${report.average_score}/100`);
    console.log(
      `  Cost (mock)    : ${formatCostCents(report.total_estimated_cost_cents)} (${formatCostEuros(report.total_estimated_cost_cents)})`,
    );
    console.log("\n  RESULTS:");
    for (const r of report.results) {
      const ok = r.score.hard_fail ? "HARD FAIL" : r.score.verdict;
      console.log(`  [${r.scenario_id.slice(0, 11).padEnd(11)}] score=${r.score.total} verdict=${ok}`);
    }
    console.log("\n  RECOMMENDATIONS:");
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log(`\n  NEXT STEPS: ${report.next_steps}`);
    console.log("=".repeat(64) + "\n");
  });

  it("no hard fails in dry-run", () => {
    const hardFails = report.results.filter((r) => r.score.hard_fail);
    if (hardFails.length > 0) {
      console.error("HARD FAILS:", hardFails.map((r) => `${r.scenario_id}: ${r.score.hard_fail_reason}`));
    }
    expect(hardFails).toHaveLength(0);
  });

  it("sensitive scenario handled correctly in dry-run", () => {
    const sensitive = report.results.find((r) => r.scenario_id === "scenario_06_sensible_bloque");
    expect(sensitive).toBeDefined();
    expect(sensitive!.score.hard_fail).toBe(false);
  });

  it("report has recommendations and next_steps", () => {
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.next_steps).toBeTruthy();
  });
});
