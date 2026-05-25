// src/lib/pierre/release-audit/audit-runtime.ts
// B36 — Orchestrator: builds the full PierreAuditBuildResult.
// Pure, synchronous, no DB, no API calls.

import type {
  PierreAuditBuildInput,
  PierreAuditBuildResult,
  PierreAuditReport,
} from "./types";
import { buildPierreFeatureMatrix, filterBlockingEvidence } from "./pierre-feature-matrix";
import { buildWorkflowCoverage, scoreWorkflowCoverage } from "./workflow-coverage";
import {
  computeReadinessScore,
  deriveVerdict,
  buildSellabilityStatement,
  buildLaunchStrategy,
} from "./readiness-score";
import { buildGapRegister, filterBlockingGaps, filterHighGaps } from "./risk-register";
import { buildStrengths, buildHonestLimits } from "./evidence-map";

export function buildPierreAuditReport(
  input: PierreAuditBuildInput = {},
): PierreAuditBuildResult {
  const startMs = Date.now();

  const includeWorkflows = input.include_workflow_coverage !== false;
  const includeGaps = input.include_gap_register !== false;
  const includeEvidence = input.include_evidence !== false;

  // ── Phase 1: Raw data ──────────────────────────────────────────────────────

  const evidence = includeEvidence ? buildPierreFeatureMatrix() : [];
  const workflowCoverage = includeWorkflows ? buildWorkflowCoverage() : [];
  const gapRegister = includeGaps ? buildGapRegister() : [];

  // ── Phase 2: Scoring ───────────────────────────────────────────────────────

  const { dimensions, total_score, max_score } = computeReadinessScore(evidence, workflowCoverage);

  const effectiveScore =
    typeof input.override_score === "number"
      ? Math.max(0, Math.min(100, input.override_score))
      : total_score;

  // ── Phase 3: Blockers and verdict ─────────────────────────────────────────

  const blockingEvidence = filterBlockingEvidence(evidence);
  const blockingGaps = filterBlockingGaps(gapRegister);
  const highGaps = filterHighGaps(gapRegister);

  const hasBlocker = blockingEvidence.length > 0 || blockingGaps.length > 0;

  const verdict = deriveVerdict(effectiveScore, hasBlocker);
  const sellabilityStatement = buildSellabilityStatement(verdict, effectiveScore);
  const launchStrategy = buildLaunchStrategy(verdict);

  // ── Phase 4: Qualitative summaries ────────────────────────────────────────

  const strengths = buildStrengths();
  const honestLimits = buildHonestLimits();

  // ── Phase 5: Workflow stats ────────────────────────────────────────────────

  const wfStats = scoreWorkflowCoverage(workflowCoverage);

  // ── Assemble report ────────────────────────────────────────────────────────

  const report: PierreAuditReport = {
    generated_at: new Date().toISOString(),
    verdict,
    total_score: effectiveScore,
    max_score,
    dimensions,
    evidence,
    workflow_coverage: workflowCoverage,
    gap_register: gapRegister,
    blocking_gaps: blockingGaps,
    high_gaps: highGaps,
    strengths,
    honest_limits: honestLimits,
    recommended_launch_strategy: launchStrategy,
    sellability_statement: sellabilityStatement,
  };

  const buildDurationMs = Date.now() - startMs;

  return {
    report,
    verdict,
    score: effectiveScore,
    build_duration_ms: buildDurationMs,
    gap_count: gapRegister.length,
    blocker_count: blockingGaps.length,
    workflow_coverage_pct: wfStats.coverage_pct,
  };
}

// ── Convenience accessors ─────────────────────────────────────────────────────

export function getPierreAuditScore(): number {
  return buildPierreAuditReport().score;
}

export function getPierreAuditVerdict(): string {
  return buildPierreAuditReport().verdict;
}

export function getPierreWorkflowCoveragePct(): number {
  return buildPierreAuditReport().workflow_coverage_pct;
}
