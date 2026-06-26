// TECH-08 — CloneOS Command Center — Snapshot
// Agrège un ensemble de résultats de commandes en statistiques.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandCenterResult,
  CloneOSCommandSnapshot,
  CloneOSCommandStatus,
  CloneOSCommandDomain,
  CloneOSCommandRiskLevel,
} from "./cloneos-command-types";

// ── Compteurs ─────────────────────────────────────────────────────────────────

export function countCommandsByStatus(
  results: CloneOSCommandCenterResult[],
): Record<CloneOSCommandStatus, number> {
  const counts: Record<CloneOSCommandStatus, number> = {
    received: 0,
    classified: 0,
    routed: 0,
    planned: 0,
    guarded: 0,
    trace_ready: 0,
    ready_for_execution: 0,
    requires_validation: 0,
    blocked: 0,
    refused: 0,
    failed: 0,
  };
  for (const r of results) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  return counts;
}

export function countCommandsByDomain(
  results: CloneOSCommandCenterResult[],
): Partial<Record<CloneOSCommandDomain, number>> {
  const counts: Partial<Record<CloneOSCommandDomain, number>> = {};
  for (const r of results) {
    if (r.classified_command) {
      const d = r.classified_command.domain;
      counts[d] = (counts[d] ?? 0) + 1;
    }
  }
  return counts;
}

export function countCommandsByEmployee(
  results: CloneOSCommandCenterResult[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) {
    const slug = r.selected_route?.employee_slug ?? "__none__";
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

export function countCommandsByRisk(
  results: CloneOSCommandCenterResult[],
): Record<CloneOSCommandRiskLevel, number> {
  const counts: Record<CloneOSCommandRiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const r of results) {
    if (r.classified_command) {
      const risk = r.classified_command.risk_level;
      counts[risk] = (counts[risk] ?? 0) + 1;
    }
  }
  return counts;
}

// ── Filtres ───────────────────────────────────────────────────────────────────

export function listCommandsNeedingValidation(
  results: CloneOSCommandCenterResult[],
): CloneOSCommandCenterResult[] {
  return results.filter((r) => r.status === "requires_validation");
}

export function listBlockedCommands(
  results: CloneOSCommandCenterResult[],
): CloneOSCommandCenterResult[] {
  return results.filter((r) => r.status === "blocked" || r.status === "refused");
}

// ── Score de santé ────────────────────────────────────────────────────────────

function computeCommandCenterHealthScore(results: CloneOSCommandCenterResult[]): number {
  if (results.length === 0) return 50;

  const refused = results.filter((r) => r.status === "refused").length;
  const blocked = results.filter((r) => r.status === "blocked").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const needsValidation = results.filter((r) => r.status === "requires_validation").length;

  let score = 100;
  score -= Math.min(refused * 15, 45);
  score -= Math.min(blocked * 10, 30);
  score -= Math.min(failed * 10, 20);
  score -= needsValidation > 5 ? 5 : 0;

  return Math.max(0, Math.min(100, score));
}

// ── Snapshot principal ────────────────────────────────────────────────────────

export function buildCloneOSCommandSnapshot(
  results: CloneOSCommandCenterResult[],
): CloneOSCommandSnapshot {
  const byStatus = countCommandsByStatus(results);
  const byDomain = countCommandsByDomain(results);
  const byEmployee = countCommandsByEmployee(results);
  const byRisk = countCommandsByRisk(results);

  const validationNeededCount = listCommandsNeedingValidation(results).length;
  const blockedCount = results.filter((r) => r.status === "blocked").length;
  const refusedCount = results.filter((r) => r.status === "refused").length;

  const healthScore = computeCommandCenterHealthScore(results);
  let healthStatus: CloneOSCommandSnapshot["health_status"] = "empty";
  if (results.length > 0) {
    if (healthScore >= 80) healthStatus = "healthy";
    else if (healthScore >= 50) healthStatus = "degraded";
    else healthStatus = "critical";
  }

  return {
    total_commands: results.length,
    by_status: byStatus,
    by_domain: byDomain,
    by_employee: byEmployee,
    by_risk: byRisk,
    validation_needed_count: validationNeededCount,
    blocked_count: blockedCount,
    refused_count: refusedCount,
    health_score: healthScore,
    health_status: healthStatus,
    generated_at: new Date().toISOString(),
  };
}

export function buildCloneOSCommandCenterHealth(
  results: CloneOSCommandCenterResult[],
): { score: number; status: CloneOSCommandSnapshot["health_status"]; summary: string } {
  const snapshot = buildCloneOSCommandSnapshot(results);
  return {
    score: snapshot.health_score,
    status: snapshot.health_status,
    summary: `${snapshot.total_commands} commandes — `
      + `${snapshot.refused_count} refusées, `
      + `${snapshot.blocked_count} bloquées, `
      + `${snapshot.validation_needed_count} en attente de validation.`,
  };
}
