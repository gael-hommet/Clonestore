// TECH-09 — CloneBrief Executive Summaries — Snapshot
// Construit un snapshot de l'état global des briefings.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneBriefExecutiveSummary,
  CloneBriefSnapshot,
  CloneBriefStatus,
  CloneBriefType,
} from "./clonebrief-types";
import { calculateBriefHealthScore } from "./clonebrief-prioritizer";

// ── Count helpers ─────────────────────────────────────────────────────────────

export function countBriefsByStatus(
  briefs: CloneBriefExecutiveSummary[],
): Record<CloneBriefStatus, number> {
  const counts: Record<CloneBriefStatus, number> = {
    draft: 0,
    ready: 0,
    empty: 0,
    partial: 0,
    blocked: 0,
    failed: 0,
  };
  for (const b of briefs) {
    if (b.status in counts) counts[b.status]++;
  }
  return counts;
}

export function countBriefsByType(
  briefs: CloneBriefExecutiveSummary[],
): Partial<Record<CloneBriefType, number>> {
  const counts: Partial<Record<CloneBriefType, number>> = {};
  for (const b of briefs) {
    counts[b.brief_type] = (counts[b.brief_type] ?? 0) + 1;
  }
  return counts;
}

export function countBriefItemsBySeverity(
  briefs: CloneBriefExecutiveSummary[],
): Record<string, number> {
  const counts: Record<string, number> = {
    info: 0, success: 0, warning: 0, risk: 0, critical: 0,
  };
  for (const b of briefs) {
    for (const item of b.action_items) {
      if (item.severity in counts) counts[item.severity]++;
    }
    for (const item of b.risk_items) {
      if (item.severity in counts) counts[item.severity]++;
    }
    for (const item of b.blocked_items) {
      if (item.severity in counts) counts[item.severity]++;
    }
  }
  return counts;
}

// ── List helpers ──────────────────────────────────────────────────────────────

export function listBriefsNeedingHumanAttention(
  briefs: CloneBriefExecutiveSummary[],
): CloneBriefExecutiveSummary[] {
  return briefs.filter(
    (b) => b.validation_items.length > 0 || b.blocked_items.length > 0,
  );
}

export function listBriefsWithBlockedItems(
  briefs: CloneBriefExecutiveSummary[],
): CloneBriefExecutiveSummary[] {
  return briefs.filter((b) => b.blocked_items.length > 0);
}

export function listRecentBriefs(
  briefs: CloneBriefExecutiveSummary[],
  limit: number = 10,
): CloneBriefExecutiveSummary[] {
  return [...briefs]
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .slice(0, limit);
}

// ── Health ────────────────────────────────────────────────────────────────────

export function buildCloneBriefHealth(
  briefs: CloneBriefExecutiveSummary[],
): { health_score: number; health_status: "healthy" | "degraded" | "critical" | "empty" } {
  if (briefs.length === 0) return { health_score: 50, health_status: "empty" };

  const scores = briefs.map(calculateBriefHealthScore);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const rounded = Math.round(avg);

  const health_status: "healthy" | "degraded" | "critical" =
    rounded >= 80 ? "healthy" : rounded >= 50 ? "degraded" : "critical";

  return { health_score: rounded, health_status };
}

// ── Main snapshot ─────────────────────────────────────────────────────────────

export function buildCloneBriefSnapshot(
  briefs: CloneBriefExecutiveSummary[],
): CloneBriefSnapshot {
  const totalActionItems = briefs.reduce((sum, b) => sum + b.action_items.length, 0);
  const totalRiskItems = briefs.reduce((sum, b) => sum + b.risk_items.length, 0);
  const totalValidationItems = briefs.reduce((sum, b) => sum + b.validation_items.length, 0);
  const totalBlockedItems = briefs.reduce((sum, b) => sum + b.blocked_items.length, 0);
  const attentionNeeded = listBriefsNeedingHumanAttention(briefs).length;
  const { health_score, health_status } = buildCloneBriefHealth(briefs);

  return {
    total_briefs: briefs.length,
    by_status: countBriefsByStatus(briefs),
    by_type: countBriefsByType(briefs),
    total_action_items: totalActionItems,
    total_risk_items: totalRiskItems,
    total_validation_items: totalValidationItems,
    total_blocked_items: totalBlockedItems,
    attention_needed_count: attentionNeeded,
    health_score,
    health_status: briefs.length === 0 ? "empty" : health_status,
    generated_at: new Date().toISOString(),
  };
}
