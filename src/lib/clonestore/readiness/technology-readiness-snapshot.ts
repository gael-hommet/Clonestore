// TECH-11 — Technology Readiness Final Gate — Snapshot
// Snapshot condensé du rapport de readiness.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessReport,
  TechnologyReadinessSnapshot,
  TechnologyReadinessTechnologyResult,
  TechnologyReadinessInvariantResult,
  TechnologyReadinessBlockerType,
} from "./technology-readiness-types";

// ── Builder snapshot ──────────────────────────────────────────────────────────

/**
 * Construit un snapshot depuis un rapport.
 */
export function buildTechnologyReadinessSnapshot(
  report: TechnologyReadinessReport,
): TechnologyReadinessSnapshot {
  const counts = countTechnologiesByStatus(report);
  const invariantPassed = report.invariants.filter((i) => i.status === "pass").length;

  return {
    total_technologies: report.technologies.length,
    ready_count: counts.ready,
    partial_count: counts.partial,
    roadmap_count: counts.roadmap,
    blocked_count: counts.blocked,
    invariant_count: report.invariants.length,
    invariant_passed_count: invariantPassed,
    internal_blockers_count: report.internal_blockers.length,
    external_blockers_count: report.external_blockers.length,
    public_launch_ready: false,
    foundation_ready: report.platform_technology_foundation_ready,
    pierre_ready: report.pierre_product_ready,
    overall_score: report.overall_score,
    generated_at: new Date().toISOString(),
  };
}

// ── Comptages ─────────────────────────────────────────────────────────────────

/**
 * Compte les technologies par statut.
 */
export function countTechnologiesByStatus(
  report: TechnologyReadinessReport,
): { ready: number; partial: number; roadmap: number; blocked: number; not_applicable: number } {
  return {
    ready: report.technologies.filter((t) => t.status === "ready").length,
    partial: report.technologies.filter((t) => t.status === "partial").length,
    roadmap: report.technologies.filter((t) => t.status === "roadmap").length,
    blocked: report.technologies.filter((t) => t.status === "blocked").length,
    not_applicable: report.technologies.filter((t) => t.status === "not_applicable").length,
  };
}

/**
 * Compte les checks par statut.
 */
export function countChecksByStatus(
  report: TechnologyReadinessReport,
): { pass: number; fail: number; warning: number; skip: number } {
  const allChecks = [
    ...report.technologies.flatMap((t) => t.checks),
    ...report.employees.flatMap((e) => e.checks),
  ];
  return {
    pass: allChecks.filter((c) => c.status === "pass").length,
    fail: allChecks.filter((c) => c.status === "fail").length,
    warning: allChecks.filter((c) => c.status === "warning").length,
    skip: allChecks.filter((c) => c.status === "skip").length,
  };
}

/**
 * Compte les blockers par type.
 */
export function countBlockersByType(
  report: TechnologyReadinessReport,
): Partial<Record<TechnologyReadinessBlockerType, number>> {
  const counts: Partial<Record<TechnologyReadinessBlockerType, number>> = {};
  for (const blocker of report.external_blockers) {
    counts[blocker.type] = (counts[blocker.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Liste les items bloquants (invariants absolus échoués + technologies bloquées).
 */
export function listBlockingReadinessItems(
  report: TechnologyReadinessReport,
): Array<{ type: "invariant" | "technology" | "external"; label: string }> {
  const items: Array<{ type: "invariant" | "technology" | "external"; label: string }> = [];

  // Invariants absolus échoués
  for (const inv of report.invariants) {
    if (inv.is_absolute && inv.status === "fail") {
      items.push({ type: "invariant", label: inv.label });
    }
  }

  // Technologies core bloquées
  for (const tech of report.technologies) {
    if (tech.required_for_employee_runtime && tech.status === "blocked") {
      items.push({ type: "technology", label: tech.display_name });
    }
  }

  // Blockers externes
  for (const blocker of report.external_blockers) {
    items.push({ type: "external", label: blocker.label });
  }

  return items;
}

/**
 * Liste les avertissements.
 */
export function listWarnings(report: TechnologyReadinessReport): string[] {
  return report.warnings;
}

/**
 * Liste les prochaines étapes.
 */
export function listNextSteps(report: TechnologyReadinessReport): string[] {
  return report.next_steps;
}

/**
 * Technologies prêtes ou partielles (implémentées).
 */
export function listImplementedTechnologies(
  report: TechnologyReadinessReport,
): TechnologyReadinessTechnologyResult[] {
  return report.technologies.filter(
    (t) => t.status === "ready" || t.status === "partial",
  );
}

/**
 * Technologies sur roadmap (non bloquantes si honnêtement déclarées).
 */
export function listRoadmapTechnologies(
  report: TechnologyReadinessReport,
): TechnologyReadinessTechnologyResult[] {
  return report.technologies.filter((t) => t.status === "roadmap");
}

/**
 * Invariants absolus passés.
 */
export function listPassedAbsoluteInvariants(
  report: TechnologyReadinessReport,
): TechnologyReadinessInvariantResult[] {
  return report.invariants.filter((i) => i.is_absolute && i.status === "pass");
}

/**
 * Invariants absolus échoués.
 */
export function listFailedAbsoluteInvariants(
  report: TechnologyReadinessReport,
): TechnologyReadinessInvariantResult[] {
  return report.invariants.filter((i) => i.is_absolute && i.status === "fail");
}
