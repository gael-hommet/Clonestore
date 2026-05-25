// src/lib/pierre/__tests__/pierre-b36-release-verdict.test.ts
// B36 — Release verdict: gap register, full audit integration

import { describe, it, expect } from "vitest";
import { buildGapRegister, filterBlockingGaps, filterHighGaps, filterGapsByArea } from "../release-audit/risk-register";
import { buildPierreAuditReport } from "../release-audit/audit-runtime";
import { buildFinalVerdictSummary, verdictLabel, formatVerdictForCockpit } from "../release-audit/final-verdict";

// ── Gap register ──────────────────────────────────────────────────────────────

describe("buildGapRegister", () => {
  it("returns at least 10 gaps", () => {
    const gaps = buildGapRegister();
    expect(gaps.length).toBeGreaterThanOrEqual(10);
  });

  it("every gap has required fields", () => {
    const gaps = buildGapRegister();
    for (const g of gaps) {
      expect(g.id.length).toBeGreaterThan(0);
      expect(g.area).toBeTruthy();
      expect(g.criticality).toMatch(/^(blocker|high|medium|low|info)$/);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
      expect(g.impact.length).toBeGreaterThan(0);
      expect(typeof g.is_blocking_verdict).toBe("boolean");
    }
  });

  it("gap IDs are unique", () => {
    const gaps = buildGapRegister();
    const ids = gaps.map((g) => g.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("no gaps are declared as blockers in current state", () => {
    const gaps = buildGapRegister();
    const blockers = gaps.filter((g) => g.is_blocking_verdict);
    expect(blockers).toHaveLength(0);
  });

  it("has high criticality gaps", () => {
    const gaps = buildGapRegister();
    const highGaps = gaps.filter((g) => g.criticality === "high");
    expect(highGaps.length).toBeGreaterThan(0);
  });

  it("real email gap is present (B37: criticality downgraded to medium — adapter added)", () => {
    const gaps = buildGapRegister();
    const emailGap = gaps.find((g) => g.id === "gap_real_email");
    expect(emailGap).toBeDefined();
    expect(emailGap!.criticality).toBe("medium"); // B37: Resend adapter ready, was "high"
    expect(emailGap!.mitigation).not.toBeNull();
  });

  it("real file extraction gap is present", () => {
    const gaps = buildGapRegister();
    const fileGap = gaps.find((g) => g.id === "gap_real_file_extraction");
    expect(fileGap).toBeDefined();
    expect(fileGap!.area).toBe("files");
  });

  it("all high gaps have a non-null mitigation", () => {
    const gaps = buildGapRegister();
    const high = gaps.filter((g) => g.criticality === "high");
    for (const g of high) {
      expect(g.mitigation).not.toBeNull();
      expect(g.mitigation!.length).toBeGreaterThan(10);
    }
  });
});

describe("filterBlockingGaps", () => {
  it("returns empty for current gap register", () => {
    const gaps = buildGapRegister();
    expect(filterBlockingGaps(gaps)).toHaveLength(0);
  });

  it("returns gaps when a blocker is injected", () => {
    const gaps = buildGapRegister();
    const withBlocker = [
      ...gaps,
      {
        id: "gap_injected_blocker",
        area: "build" as const,
        criticality: "blocker" as const,
        title: "Test blocker",
        description: "Injected for test",
        impact: "Blocks everything",
        mitigation: null,
        is_blocking_verdict: true,
      },
    ];
    expect(filterBlockingGaps(withBlocker).length).toBeGreaterThan(0);
  });
});

describe("filterHighGaps", () => {
  it("returns non-empty list from current gaps", () => {
    const gaps = buildGapRegister();
    expect(filterHighGaps(gaps).length).toBeGreaterThan(0);
  });

  it("all returned items have criticality high and are not verdict blockers", () => {
    const gaps = buildGapRegister();
    for (const g of filterHighGaps(gaps)) {
      expect(g.criticality).toBe("high");
      expect(g.is_blocking_verdict).toBe(false);
    }
  });
});

describe("filterGapsByArea", () => {
  it("returns only matching area", () => {
    const gaps = buildGapRegister();
    const emailGaps = filterGapsByArea(gaps, "email_send");
    expect(emailGaps.every((g) => g.area === "email_send")).toBe(true);
    expect(emailGaps.length).toBeGreaterThan(0);
  });
});

// ── Full audit integration ─────────────────────────────────────────────────────

describe("buildPierreAuditReport — full integration", () => {
  it("report contains all major sections", () => {
    const result = buildPierreAuditReport();
    const { report } = result;
    expect(Array.isArray(report.dimensions)).toBe(true);
    expect(Array.isArray(report.evidence)).toBe(true);
    expect(Array.isArray(report.workflow_coverage)).toBe(true);
    expect(Array.isArray(report.gap_register)).toBe(true);
    expect(Array.isArray(report.blocking_gaps)).toBe(true);
    expect(Array.isArray(report.high_gaps)).toBe(true);
    expect(Array.isArray(report.strengths)).toBe(true);
    expect(Array.isArray(report.honest_limits)).toBe(true);
    expect(typeof report.recommended_launch_strategy).toBe("string");
    expect(typeof report.sellability_statement).toBe("string");
    expect(typeof report.generated_at).toBe("string");
  });

  it("report.generated_at is a valid ISO date string", () => {
    const result = buildPierreAuditReport();
    expect(() => new Date(result.report.generated_at)).not.toThrow();
    expect(new Date(result.report.generated_at).getFullYear()).toBeGreaterThan(2020);
  });

  it("report total_score matches result.score", () => {
    const result = buildPierreAuditReport();
    expect(result.report.total_score).toBe(result.score);
  });

  it("verdict is consistent with score: almost_sellable for ~79 pts", () => {
    const result = buildPierreAuditReport();
    if (result.score >= 90) {
      expect(result.verdict).toBe("sellable");
    } else if (result.score >= 75) {
      expect(result.verdict).toBe("almost_sellable");
    } else if (result.score >= 50) {
      expect(result.verdict).toBe("not_sellable");
    } else {
      expect(result.verdict).toBe("blocked");
    }
  });

  it("include_workflow_coverage: false → empty workflow_coverage", () => {
    const result = buildPierreAuditReport({ include_workflow_coverage: false });
    expect(result.report.workflow_coverage).toHaveLength(0);
  });

  it("include_gap_register: false → empty gap_register", () => {
    const result = buildPierreAuditReport({ include_gap_register: false });
    expect(result.report.gap_register).toHaveLength(0);
  });

  it("include_evidence: false → empty evidence", () => {
    const result = buildPierreAuditReport({ include_evidence: false });
    expect(result.report.evidence).toHaveLength(0);
  });
});

// ── Final verdict output ──────────────────────────────────────────────────────

describe("buildFinalVerdictSummary — integration", () => {
  it("summary contains VERDICT line", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(summary).toContain("VERDICT");
  });

  it("summary contains strategy section", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(summary).toContain("STRATÉGIE");
  });

  it("summary contains strengths section", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(summary).toContain("POINTS FORTS");
  });

  it("summary contains honest limits section", () => {
    const result = buildPierreAuditReport();
    const summary = buildFinalVerdictSummary(result.report);
    expect(summary).toContain("LIMITES HONNÊTES");
  });
});

describe("formatVerdictForCockpit — all verdicts", () => {
  const scenarios: { score: number; expected_color: "green" | "yellow" | "orange" | "red" }[] = [
    { score: 95, expected_color: "green" },
    { score: 80, expected_color: "yellow" },
    { score: 60, expected_color: "orange" },
    { score: 30, expected_color: "red" },
  ];

  for (const { score, expected_color } of scenarios) {
    it(`score ${score} → color ${expected_color}`, () => {
      const result = buildPierreAuditReport({ override_score: score });
      const formatted = formatVerdictForCockpit(result.report);
      expect(formatted.color).toBe(expected_color);
    });
  }

  it("cockpit format has all required fields", () => {
    const result = buildPierreAuditReport();
    const formatted = formatVerdictForCockpit(result.report);
    expect(formatted.verdict).toBeTruthy();
    expect(formatted.label).toBeTruthy();
    expect(typeof formatted.score).toBe("number");
    expect(formatted.color).toMatch(/^(green|yellow|orange|red)$/);
    expect(formatted.short_summary.length).toBeGreaterThan(10);
  });
});

describe("verdictLabel completeness", () => {
  it("all four verdict labels are non-empty French strings", () => {
    const pairs: [import("../release-audit/types").PierreReadinessVerdict, string][] = [
      ["sellable", "VENDABLE"],
      ["almost_sellable", "PRESQUE VENDABLE"],
      ["not_sellable", "PAS ENCORE VENDABLE"],
      ["blocked", "BLOQUÉ"],
    ];
    for (const [v, expected] of pairs) {
      expect(verdictLabel(v)).toBe(expected);
    }
  });
});
