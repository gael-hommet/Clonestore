// src/lib/pierre/release-audit/final-verdict.ts
// B36 — Human-readable final verdict summary builder.
// Pure, synchronous, no DB.

import type { PierreAuditReport, PierreReadinessVerdict } from "./types";
import { VERDICT_THRESHOLDS } from "./readiness-score";

// ── Verdict emoji / label ─────────────────────────────────────────────────────

export function verdictLabel(verdict: PierreReadinessVerdict): string {
  switch (verdict) {
    case "sellable": return "VENDABLE";
    case "almost_sellable": return "PRESQUE VENDABLE";
    case "not_sellable": return "PAS ENCORE VENDABLE";
    case "blocked": return "BLOQUÉ";
  }
}

export function verdictThresholdDescription(): string {
  return (
    `Seuils: ≥${VERDICT_THRESHOLDS.sellable} pts → sellable | ` +
    `≥${VERDICT_THRESHOLDS.almost_sellable} pts → almost_sellable | ` +
    `≥${VERDICT_THRESHOLDS.not_sellable} pts → not_sellable | ` +
    `<${VERDICT_THRESHOLDS.not_sellable} pts ou blocant → blocked`
  );
}

// ── One-page summary ──────────────────────────────────────────────────────────

export function buildFinalVerdictSummary(report: PierreAuditReport): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("PIERRE — AUDIT FINAL B36");
  lines.push(`Généré le: ${report.generated_at}`);
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`VERDICT: ${verdictLabel(report.verdict)} (${report.total_score}/${report.max_score})`);
  lines.push("");
  lines.push(report.sellability_statement);
  lines.push("");
  lines.push("── SCORE PAR DIMENSION ────────────────────────────────────────");
  for (const dim of report.dimensions) {
    const bar = buildScoreBar(dim.earned_points, dim.max_points);
    lines.push(`  ${bar} ${dim.label}: ${dim.earned_points}/${dim.max_points}`);
  }
  lines.push("");
  lines.push(`TOTAL: ${report.total_score}/100`);
  lines.push("");
  lines.push("── POINTS FORTS PROUVÉS ────────────────────────────────────────");
  for (const s of report.strengths.slice(0, 8)) {
    lines.push(`  ✓ ${s}`);
  }
  lines.push("");
  lines.push("── LIMITES HONNÊTES ────────────────────────────────────────────");
  for (const l of report.honest_limits.slice(0, 8)) {
    lines.push(`  ✗ ${l}`);
  }
  lines.push("");
  lines.push("── STRATÉGIE DE LANCEMENT ─────────────────────────────────────");
  lines.push(report.recommended_launch_strategy);
  lines.push("");

  if (report.blocking_gaps.length > 0) {
    lines.push("── BLOCANTS ────────────────────────────────────────────────────");
    for (const g of report.blocking_gaps) {
      lines.push(`  ⛔ ${g.title}`);
      lines.push(`     ${g.description}`);
    }
    lines.push("");
  }

  if (report.high_gaps.length > 0) {
    lines.push("── GAPS CRITIQUES (non-blocants) ───────────────────────────────");
    for (const g of report.high_gaps) {
      lines.push(`  ⚠ ${g.title}`);
      lines.push(`     Mitigation: ${g.mitigation ?? "Aucune mitigation définie"}`);
    }
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(verdictThresholdDescription());
  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}

function buildScoreBar(earned: number, max: number): string {
  const pct = max > 0 ? earned / max : 0;
  const filled = Math.round(pct * 8);
  const empty = 8 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

// ── Verdict comparison ────────────────────────────────────────────────────────

export function isVerdictAtLeast(
  actual: PierreReadinessVerdict,
  threshold: PierreReadinessVerdict,
): boolean {
  const rank: Record<PierreReadinessVerdict, number> = {
    blocked: 0,
    not_sellable: 1,
    almost_sellable: 2,
    sellable: 3,
  };
  return rank[actual] >= rank[threshold];
}

export function verdictRequiresAction(verdict: PierreReadinessVerdict): boolean {
  return verdict === "blocked" || verdict === "not_sellable";
}

export function formatVerdictForCockpit(report: PierreAuditReport): {
  verdict: PierreReadinessVerdict;
  label: string;
  score: number;
  color: "green" | "yellow" | "orange" | "red";
  short_summary: string;
} {
  const color =
    report.verdict === "sellable"
      ? "green"
      : report.verdict === "almost_sellable"
        ? "yellow"
        : report.verdict === "not_sellable"
          ? "orange"
          : "red";

  return {
    verdict: report.verdict,
    label: verdictLabel(report.verdict),
    score: report.total_score,
    color,
    short_summary: report.sellability_statement,
  };
}
