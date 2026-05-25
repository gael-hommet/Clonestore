#!/usr/bin/env npx tsx
// scripts/b38b-openai-live-validation.ts
// B38B — CLI entry point for live OpenAI validation.
// TWO MODES:
//   dry-run  (default): no API call, uses mock responses, works without any key
//   live             : calls OpenAI via B38A shield — requires explicit env vars
//
// Usage:
//   npx tsx scripts/b38b-openai-live-validation.ts --dry-run
//   npx tsx scripts/b38b-openai-live-validation.ts --live
//
// Required env for live mode:
//   B38B_LIVE_OPENAI_ENABLED=true
//   OPENAI_API_KEY=sk-...
//   AI_RUNTIME_MODE=production
//   AI_COST_SHIELD_MODE=enforce
//   B38B_MAX_TOTAL_COST_CENTS=75  (conservative start)

import { getB38BConfig } from "../src/lib/cloneos/ai/live-validation/config";
import { getDefaultScenarioSelection } from "../src/lib/cloneos/ai/live-validation/scenarios";
import { runDryValidation, runLiveValidation } from "../src/lib/cloneos/ai/live-validation/runner";
import { formatCostCents, formatCostEuros } from "../src/lib/cloneos/ai/live-validation/cost-report";
import type { LiveValidationReport, LiveValidationResult } from "../src/lib/cloneos/ai/live-validation/types";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isLive = args.includes("--live");
const isDryRun = args.includes("--dry-run") || !isLive;
const maxScenarios = (() => {
  const idx = args.indexOf("--max-scenarios");
  if (idx >= 0 && args[idx + 1]) return parseInt(args[idx + 1]!, 10);
  return undefined;
})();

// ── Print helpers ─────────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function printHeader(mode: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(`  B38B — Pierre Live Validation  [${mode.toUpperCase()}]`);
  console.log("=".repeat(72));
}

function printEnvSummary(report: LiveValidationReport): void {
  const env = report.env_summary;
  console.log("\n  ENV SUMMARY");
  console.log(`  live_enabled          : ${env.live_enabled}`);
  console.log(`  runtime_mode          : ${env.runtime_mode}`);
  console.log(`  openai_key_present    : ${env.openai_key_present}`);
  console.log(`  shield_mode           : ${env.shield_mode}`);
  console.log(`  emergency_shutdown    : ${env.emergency_shutdown}`);
  console.log(`  anthropic_enabled     : ${env.anthropic_enabled}`);
  console.log(`  max_total_cost_cents  : ${env.max_total_cost_cents}¢`);
  console.log(`  max_scenarios         : ${env.max_scenarios}`);
}

function verdictIcon(verdict: string, hardFail: boolean): string {
  if (hardFail || verdict === "hard_fail") return "💀 HARD FAIL";
  if (verdict === "excellent") return "✅ excellent";
  if (verdict === "acceptable") return "✔  acceptable";
  if (verdict === "weak") return "⚠  weak";
  return "❌ fail";
}

function printResults(results: LiveValidationResult[]): void {
  console.log("\n  SCENARIO RESULTS");
  console.log("  " + "-".repeat(68));
  console.log(
    "  " +
      pad("ID", 12) +
      pad("Score", 7) +
      pad("Verdict", 16) +
      pad("Cost", 10) +
      "Issues",
  );
  console.log("  " + "-".repeat(68));

  for (const r of results) {
    const icon = verdictIcon(r.score.verdict, r.score.hard_fail);
    const cost = r.actual_cost_cents > 0 ? formatCostCents(r.actual_cost_cents) : `~${formatCostCents(r.estimated_cost_cents)}`;
    const issueCount = r.issues.length > 0 ? `${r.issues.length} issue(s)` : "";
    console.log(
      "  " +
        pad(r.scenario_id.slice(0, 11), 12) +
        pad(String(r.score.total), 7) +
        pad(icon, 16) +
        pad(cost, 10) +
        issueCount,
    );
    if (r.score.hard_fail && r.score.hard_fail_reason) {
      console.log(`     → ${r.score.hard_fail_reason}`);
    }
  }
}

function printSummary(report: LiveValidationReport): void {
  console.log("\n  SUMMARY");
  console.log(`  Scenarios run  : ${report.scenarios_run}`);
  console.log(`  Passed         : ${report.passed}`);
  console.log(`  Failed         : ${report.failed}`);
  console.log(`  Hard fails     : ${report.hard_fails}`);
  console.log(`  Average score  : ${report.average_score}/100`);
  console.log(
    `  Cost estimated : ${formatCostCents(report.total_estimated_cost_cents)} (${formatCostEuros(report.total_estimated_cost_cents)})`,
  );
  if (report.total_actual_cost_cents > 0) {
    console.log(
      `  Cost actual    : ${formatCostCents(report.total_actual_cost_cents)} (${formatCostEuros(report.total_actual_cost_cents)})`,
    );
  }
}

function printRecommendations(report: LiveValidationReport): void {
  console.log("\n  RECOMMENDATIONS");
  for (const rec of report.recommendations) {
    console.log(`  • ${rec}`);
  }
  console.log(`\n  NEXT STEPS: ${report.next_steps}`);
}

function printExcerpts(results: LiveValidationResult[]): void {
  const failed = results.filter((r) => !r.ok || r.score.verdict === "fail" || r.score.hard_fail);
  if (failed.length === 0) return;

  console.log("\n  FAILED SCENARIO EXCERPTS");
  for (const r of failed) {
    console.log(`\n  [${r.scenario_id}] ${r.scenario_name}`);
    if (r.error) console.log(`  Error: ${r.error}`);
    if (r.excerpt_redacted) console.log(`  Output: ${r.excerpt_redacted}`);
    for (const issue of r.issues) console.log(`  Issue: ${issue}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = isLive ? "live" : "dry-run";
  printHeader(mode);

  const config = getB38BConfig();
  const scenarioCount = Math.min(maxScenarios ?? config.max_scenarios, config.max_scenarios);
  const scenarios = getDefaultScenarioSelection(scenarioCount);

  console.log(`\n  Mode      : ${mode}`);
  console.log(`  Scenarios : ${scenarios.length} selected (max ${config.max_scenarios})`);
  console.log(`  Cost cap  : ${config.max_total_cost_cents}¢`);

  if (isDryRun) {
    console.log("\n  [DRY-RUN] No real API call will be made.\n");
  } else {
    // Live mode: safety check
    const openaiKey = process.env["OPENAI_API_KEY"];
    const liveEnabled = process.env["B38B_LIVE_OPENAI_ENABLED"];
    const runtimeMode = process.env["AI_RUNTIME_MODE"];

    if (!liveEnabled || liveEnabled !== "true") {
      console.error("\n  ❌ ERROR: B38B_LIVE_OPENAI_ENABLED must be 'true' for live mode.");
      process.exit(1);
    }
    if (!openaiKey) {
      console.error("\n  ❌ ERROR: OPENAI_API_KEY is not set.");
      process.exit(1);
    }
    if (runtimeMode !== "production") {
      console.error("\n  ❌ ERROR: AI_RUNTIME_MODE must be 'production' for live mode.");
      process.exit(1);
    }

    const estimatedTotal = scenarios.reduce((s, sc) => s + sc.max_cost_cents, 0);
    console.log(`\n  ⚠  LIVE MODE — This will call OpenAI and consume budget.`);
    console.log(`  Estimated total: ~${formatCostCents(estimatedTotal)} (${formatCostEuros(estimatedTotal)})`);
    console.log(`  Budget cap: ${config.max_total_cost_cents}¢\n`);
  }

  let report: LiveValidationReport;

  try {
    if (isDryRun) {
      report = await runDryValidation(config, scenarios);
    } else {
      report = await runLiveValidation(config, scenarios);
    }
  } catch (err) {
    console.error("\n  ❌ FATAL ERROR:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  printEnvSummary(report);
  printResults(report.results);
  printSummary(report);
  printRecommendations(report);
  printExcerpts(report.results);

  console.log("\n" + "=".repeat(72) + "\n");

  // Exit code: 1 if any hard fail or all failed
  const hasHardFail = report.results.some((r) => r.score.hard_fail);
  const allFailed = report.passed === 0 && report.scenarios_run > 0;
  if (hasHardFail || allFailed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
