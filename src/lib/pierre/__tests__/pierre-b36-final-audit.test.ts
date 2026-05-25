// src/lib/pierre/__tests__/pierre-b36-final-audit.test.ts
// B36 — Final audit: feature matrix, evidence, scoring, verdict

import { describe, it, expect } from "vitest";
import { buildPierreFeatureMatrix, filterBlockingEvidence, filterEvidenceByArea } from "../release-audit/pierre-feature-matrix";
import { computeReadinessScore, deriveVerdict, buildSellabilityStatement, buildLaunchStrategy, VERDICT_THRESHOLDS } from "../release-audit/readiness-score";
import { buildPierreAuditReport, getPierreAuditScore, getPierreAuditVerdict } from "../release-audit/audit-runtime";
import { buildFinalVerdictSummary, isVerdictAtLeast, verdictRequiresAction, formatVerdictForCockpit, verdictLabel } from "../release-audit/final-verdict";
import { buildStrengths, buildHonestLimits, buildProofSummary } from "../release-audit/evidence-map";

// ── Feature matrix ────────────────────────────────────────────────────────────

describe("buildPierreFeatureMatrix", () => {
  it("returns a non-empty evidence list", () => {
    const matrix = buildPierreFeatureMatrix();
    expect(matrix.length).toBeGreaterThan(10);
  });

  it("every evidence item has required fields", () => {
    const matrix = buildPierreFeatureMatrix();
    for (const ev of matrix) {
      expect(ev.id).toBeTruthy();
      expect(ev.area).toBeTruthy();
      expect(ev.label).toBeTruthy();
      expect(ev.status).toMatch(/^(proven|partial|mock_only|gap|not_applicable)$/);
      expect(ev.criticality).toMatch(/^(blocker|high|medium|low|info)$/);
      expect(typeof ev.score_contribution).toBe("number");
      expect(typeof ev.max_contribution).toBe("number");
      expect(ev.score_contribution).toBeLessThanOrEqual(ev.max_contribution);
      expect(Array.isArray(ev.gaps)).toBe(true);
    }
  });

  it("governance signals are all proven", () => {
    const matrix = buildPierreFeatureMatrix();
    const govSignals = matrix.filter((e) => e.area === "governance");
    expect(govSignals.length).toBeGreaterThan(0);
    for (const g of govSignals) {
      expect(g.status).toBe("proven");
    }
  });

  it("email_send and real_providers are not fully proven (partial, mock_only, or gap)", () => {
    // B37: Resend adapter added → email_send is now 'partial' (infrastructure ready, live key pending)
    const matrix = buildPierreFeatureMatrix();
    const emailSignals = matrix.filter((e) => e.area === "email_send" || e.area === "real_providers");
    expect(emailSignals.length).toBeGreaterThan(0);
    for (const s of emailSignals) {
      expect(["mock_only", "gap", "partial"]).toContain(s.status);
    }
  });

  it("filterBlockingEvidence returns empty for current matrix (no declared blockers)", () => {
    const matrix = buildPierreFeatureMatrix();
    const blockers = filterBlockingEvidence(matrix);
    expect(blockers).toHaveLength(0);
  });

  it("filterEvidenceByArea returns only matching area items", () => {
    const matrix = buildPierreFeatureMatrix();
    const govOnly = filterEvidenceByArea(matrix, "governance");
    expect(govOnly.every((e) => e.area === "governance")).toBe(true);
    expect(govOnly.length).toBeGreaterThan(0);
  });

  it("tests/build evidence items are proven", () => {
    const matrix = buildPierreFeatureMatrix();
    const testItems = matrix.filter((e) => e.area === "tests" || e.area === "build");
    expect(testItems.length).toBeGreaterThan(0);
    for (const t of testItems) {
      expect(t.status).toBe("proven");
    }
  });
});

// ── Readiness score ───────────────────────────────────────────────────────────

describe("computeReadinessScore", () => {
  it("returns 8 dimensions", () => {
    const matrix = buildPierreFeatureMatrix();
    const { dimensions } = computeReadinessScore(matrix, []);
    expect(dimensions).toHaveLength(8);
  });

  it("total max_score is 100", () => {
    const matrix = buildPierreFeatureMatrix();
    const { max_score } = computeReadinessScore(matrix, []);
    expect(max_score).toBe(100);
  });

  it("total_score is between 60 and 100 for current matrix", () => {
    const matrix = buildPierreFeatureMatrix();
    const { dimensions } = computeReadinessScore(matrix, []);
    const { total_score } = computeReadinessScore(matrix, []);
    expect(total_score).toBeGreaterThanOrEqual(60);
    expect(total_score).toBeLessThanOrEqual(100);
    expect(dimensions.length).toBe(8);
  });

  it("each dimension has earned_points <= max_points", () => {
    const matrix = buildPierreFeatureMatrix();
    const { dimensions } = computeReadinessScore(matrix, []);
    for (const d of dimensions) {
      expect(d.earned_points).toBeLessThanOrEqual(d.max_points);
      expect(d.earned_points).toBeGreaterThanOrEqual(0);
    }
  });

  it("governance dimension scores ≥ 13/15", () => {
    const matrix = buildPierreFeatureMatrix();
    const { dimensions } = computeReadinessScore(matrix, []);
    const govDim = dimensions.find((d) => d.id === "dim_governance");
    expect(govDim).toBeDefined();
    expect(govDim!.earned_points).toBeGreaterThanOrEqual(13);
  });
});

describe("deriveVerdict", () => {
  it("score 95, no blocker → sellable", () => {
    expect(deriveVerdict(95, false)).toBe("sellable");
  });

  it("score 80, no blocker → almost_sellable", () => {
    expect(deriveVerdict(80, false)).toBe("almost_sellable");
  });

  it("score 60, no blocker → not_sellable", () => {
    expect(deriveVerdict(60, false)).toBe("not_sellable");
  });

  it("score 40, no blocker → blocked", () => {
    expect(deriveVerdict(40, false)).toBe("blocked");
  });

  it("score 95, has blocker → blocked", () => {
    expect(deriveVerdict(95, true)).toBe("blocked");
  });

  it("threshold boundary: score === 90 → sellable", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.sellable, false)).toBe("sellable");
  });

  it("threshold boundary: score === 75 → almost_sellable", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.almost_sellable, false)).toBe("almost_sellable");
  });
});

describe("buildSellabilityStatement", () => {
  it("returns a non-empty string for each verdict", () => {
    const verdicts = ["sellable", "almost_sellable", "not_sellable", "blocked"] as const;
    for (const v of verdicts) {
      const stmt = buildSellabilityStatement(v, 79);
      expect(typeof stmt).toBe("string");
      expect(stmt.length).toBeGreaterThan(10);
    }
  });

  it("includes score in statement", () => {
    const stmt = buildSellabilityStatement("almost_sellable", 79);
    expect(stmt).toContain("79");
  });
});

describe("buildLaunchStrategy", () => {
  it("returns a non-empty string for each verdict", () => {
    const verdicts = ["sellable", "almost_sellable", "not_sellable", "blocked"] as const;
    for (const v of verdicts) {
      expect(buildLaunchStrategy(v).length).toBeGreaterThan(10);
    }
  });
});

// ── Full audit runtime ─────────────────────────────────────────────────────────

describe("buildPierreAuditReport", () => {
  it("returns a complete report without options", () => {
    const result = buildPierreAuditReport();
    expect(result.report).toBeDefined();
    expect(result.verdict).toMatch(/^(sellable|almost_sellable|not_sellable|blocked)$/);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.build_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("gap_count > 0 (honest audit has gaps)", () => {
    const result = buildPierreAuditReport();
    expect(result.gap_count).toBeGreaterThan(0);
  });

  it("blocker_count === 0 (no declared blockers in current matrix)", () => {
    const result = buildPierreAuditReport();
    expect(result.blocker_count).toBe(0);
  });

  it("workflow_coverage_pct is between 40 and 100", () => {
    const result = buildPierreAuditReport();
    expect(result.workflow_coverage_pct).toBeGreaterThanOrEqual(40);
    expect(result.workflow_coverage_pct).toBeLessThanOrEqual(100);
  });

  it("override_score forces a different score", () => {
    const result = buildPierreAuditReport({ override_score: 40 });
    expect(result.score).toBe(40);
    expect(result.verdict).toBe("blocked");
  });

  it("override_score: 95 → sellable", () => {
    const result = buildPierreAuditReport({ override_score: 95 });
    expect(result.verdict).toBe("sellable");
  });

  it("report has strengths and honest_limits", () => {
    const result = buildPierreAuditReport();
    expect(result.report.strengths.length).toBeGreaterThan(5);
    expect(result.report.honest_limits.length).toBeGreaterThan(3);
  });

  it("getPierreAuditScore returns a number", () => {
    expect(typeof getPierreAuditScore()).toBe("number");
  });

  it("getPierreAuditVerdict returns a valid verdict", () => {
    expect(["sellable", "almost_sellable", "not_sellable", "blocked"]).toContain(
      getPierreAuditVerdict(),
    );
  });
});

// ── Final verdict ─────────────────────────────────────────────────────────────

describe("buildFinalVerdictSummary", () => {
  it("returns a multi-line string", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(typeof summary).toBe("string");
    expect(summary.split("\n").length).toBeGreaterThan(10);
  });

  it("includes score in summary", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(summary).toContain(String(result.score));
  });
});

describe("isVerdictAtLeast", () => {
  it("sellable >= sellable", () => expect(isVerdictAtLeast("sellable", "sellable")).toBe(true));
  it("sellable >= almost_sellable", () => expect(isVerdictAtLeast("sellable", "almost_sellable")).toBe(true));
  it("almost_sellable >= not_sellable", () => expect(isVerdictAtLeast("almost_sellable", "not_sellable")).toBe(true));
  it("blocked < not_sellable", () => expect(isVerdictAtLeast("blocked", "not_sellable")).toBe(false));
  it("not_sellable < almost_sellable", () => expect(isVerdictAtLeast("not_sellable", "almost_sellable")).toBe(false));
});

describe("verdictRequiresAction", () => {
  it("blocked requires action", () => expect(verdictRequiresAction("blocked")).toBe(true));
  it("not_sellable requires action", () => expect(verdictRequiresAction("not_sellable")).toBe(true));
  it("sellable does not require action", () => expect(verdictRequiresAction("sellable")).toBe(false));
  it("almost_sellable does not require action", () => expect(verdictRequiresAction("almost_sellable")).toBe(false));
});

describe("formatVerdictForCockpit", () => {
  it("sellable → green", () => {
    const result = buildPierreAuditReport({ override_score: 95 });
    const formatted = formatVerdictForCockpit(result.report);
    expect(formatted.color).toBe("green");
    expect(formatted.verdict).toBe("sellable");
  });

  it("blocked → red", () => {
    const result = buildPierreAuditReport({ override_score: 30 });
    const formatted = formatVerdictForCockpit(result.report);
    expect(formatted.color).toBe("red");
    expect(formatted.verdict).toBe("blocked");
  });
});

describe("verdictLabel", () => {
  it("returns non-empty string for each verdict", () => {
    const verdicts = ["sellable", "almost_sellable", "not_sellable", "blocked"] as const;
    for (const v of verdicts) {
      expect(verdictLabel(v).length).toBeGreaterThan(0);
    }
  });
});

// ── Evidence map ──────────────────────────────────────────────────────────────

describe("buildStrengths and buildHonestLimits", () => {
  it("strengths list has at least 10 items", () => {
    expect(buildStrengths().length).toBeGreaterThanOrEqual(10);
  });

  it("honest_limits list has at least 5 items", () => {
    expect(buildHonestLimits().length).toBeGreaterThanOrEqual(5);
  });

  it("buildProofSummary returns a non-empty string", () => {
    const s = buildProofSummary();
    expect(typeof s).toBe("string");
    expect(s).toContain("4685");
  });

  it("honest_limits mentions real email gap", () => {
    const limits = buildHonestLimits();
    const hasEmailGap = limits.some((l) => l.toLowerCase().includes("email"));
    expect(hasEmailGap).toBe(true);
  });
});
