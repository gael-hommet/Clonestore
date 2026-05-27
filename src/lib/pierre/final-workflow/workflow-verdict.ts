// B42 — Final verdict builder

import type { PierreWorkflowExecutionResult, PierreWorkflowVerdict, WorkflowHardFail } from "./types";

// ── Known gaps (documented limits) ───────────────────────────────────────────

const B42_DOCUMENTED_GAPS = [
  "Real Supabase adapters not wired — runtime uses fake adapters in tests (to wire in B43+)",
  "AI content generation uses payload placeholders — real Claude/OpenAI call not made (by design: B40+)",
  "Email send not wired to Resend — draft-only mode enforced (B39 policy)",
  "PDF generation uses artifact_pending mode — no real PDF renderer (B43+)",
  "Rate limiting not wired in workflow runtime — enforced at route level (B41)",
  "Cron-triggered workflow execution not tested — tested separately via cron routes",
];

// ── Verdict builder ───────────────────────────────────────────────────────────

export function buildWorkflowVerdict(
  results: PierreWorkflowExecutionResult[],
): PierreWorkflowVerdict {
  const timestamp = new Date().toISOString();

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  const allHardFails: WorkflowHardFail[] = results.flatMap((r) => r.hard_fails);
  const uniqueHardFails = [...new Set(allHardFails)];

  const hardFailsDetail = results
    .filter((r) => r.hard_fails.length > 0)
    .map((r) => ({
      scenario_id: r.scenario_id,
      scenario_name: r.scenario_name,
      fails: r.hard_fails,
    }));

  const allPassed = failed.length === 0 && uniqueHardFails.length === 0;
  const safeToCLoseB42 = allPassed;

  const summaryParts: string[] = [
    `B42 Final Workflow Verdict — ${timestamp}`,
    `Scenarios: ${results.length} tested, ${passed.length} passed, ${failed.length} failed`,
    `Hard fails: ${uniqueHardFails.length}`,
    allPassed
      ? "ALL 8 WORKFLOWS PASSED — B42 SAFE TO CLOSE"
      : `FAILED: ${failed.map((r) => r.scenario_name).join(", ")}`,
  ];

  return {
    bloc: "B42",
    timestamp,
    workflows_tested: results.length,
    workflows_passed: passed.length,
    workflows_failed: failed.length,
    hard_fail_count: uniqueHardFails.length,
    all_passed: allPassed,
    safe_to_close_b42: safeToCLoseB42,
    results,
    summary: summaryParts.join(" | "),
    hard_fails_detail: hardFailsDetail,
    gaps: B42_DOCUMENTED_GAPS,
  };
}

// ── Verdict formatter ─────────────────────────────────────────────────────────

export function formatVerdictReport(verdict: PierreWorkflowVerdict): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("B42 — FINAL WORKFLOW COMPLETION — VERDICT");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push(`Timestamp : ${verdict.timestamp}`);
  lines.push(`Scenarios : ${verdict.workflows_tested} testés`);
  lines.push(`Passed    : ${verdict.workflows_passed} / ${verdict.workflows_tested}`);
  lines.push(`Failed    : ${verdict.workflows_failed}`);
  lines.push(`Hard fails: ${verdict.hard_fail_count}`);
  lines.push(`Status    : ${verdict.all_passed ? "✅ ALL PASSED" : "❌ FAILED"}`);
  lines.push(`B42 Close : ${verdict.safe_to_close_b42 ? "✅ SAFE" : "⛔ NOT SAFE"}`);
  lines.push("");

  lines.push("── Scenarios ──────────────────────────────────────────────");
  for (const r of verdict.results) {
    const icon = r.passed ? "✅" : "❌";
    lines.push(`  ${icon} [${r.scenario_id}] ${r.scenario_name}`);
    lines.push(`     domain=${r.domain} risk=${r.risk_level} tasks=${r.plan.tasks.length} duration=${r.duration_ms}ms`);
    if (!r.passed) {
      lines.push(`     FAILS: ${r.hard_fails.join(", ")}`);
    }
  }

  if (verdict.gaps.length > 0) {
    lines.push("");
    lines.push("── Documented gaps ────────────────────────────────────────");
    for (const gap of verdict.gaps) {
      lines.push(`  ⚠ ${gap}`);
    }
  }

  lines.push("═══════════════════════════════════════════════════════════");
  return lines.join("\n");
}
