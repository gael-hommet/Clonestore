// TECH-02 — Employee Runtime Readiness
// Pure module: no Supabase, no Next, no async, no side effects. No throw.
//
// Computes runtime readiness for each registered employee.
// Readiness is based on:
//   1. Contract validity (all required fields present and valid)
//   2. Required technologies declared and known
//   3. Internal blockers (within employee control)
//   4. Product runtime state (is the engine functional?)
//
// IMPORTANT:
//   public_launch_ready is NEVER set by this module.
//   Public launch readiness is controlled exclusively by the Go-Live gate
//   (GO-LIVE 01 → GO-LIVE 10). External blockers (legal, RLS, Stripe) are
//   listed in launch_readiness.external_blockers but do not affect the
//   product_runtime_ready verdict here.

import type { EmployeeRuntimeContract, EmployeeSlug } from "./employee-runtime-contract";
import { VALID_EMPLOYEE_TECHNOLOGY_SLUGS } from "./employee-runtime-contract";
import {
  EMPLOYEE_RUNTIME_REGISTRY,
  getEmployeeRuntimeContract,
} from "./employee-registry";

// ── Readiness status ──────────────────────────────────────────────────────────

export type EmployeeReadinessStatus =
  | "ready"         // all hard requirements met, no internal blockers
  | "partial_ready" // hard requirements met, soft requirements partial
  | "blocked"       // one or more hard requirements failed or internal blocker exists
  | "roadmap";      // employee is not yet built (status = roadmap/concept)

// ── Readiness result ──────────────────────────────────────────────────────────

export type EmployeeRuntimeReadinessResult = {
  slug: EmployeeSlug;
  display_name: string;
  domain: string;
  status: EmployeeReadinessStatus;
  product_runtime_ready: boolean;
  /**
   * Always false in this context.
   * Public launch readiness is controlled by the Go-Live gate (GO-LIVE 01–10),
   * not by the employee contract.
   */
  public_launch_ready: false;
  demo_ready: boolean;
  hard_requirements_met: boolean;
  hard_requirements_count: number;
  hard_requirements_ok_count: number;
  soft_requirements_count: number;
  soft_requirements_ok_count: number;
  score: number;       // 0–100 product runtime readiness score
  blockers: string[];  // internal blockers only
  warnings: string[];
  external_blockers: string[]; // listed for awareness, do not affect score
  checked_at: string;
};

// ── Verdict ───────────────────────────────────────────────────────────────────

export type EmployeeRuntimeReadinessVerdict = {
  ok: boolean;
  total_employees: number;
  active_employees: number;
  ready_employees: number;
  partial_ready_employees: number;
  blocked_employees: number;
  roadmap_employees: number;
  overall_score: number;
  results: EmployeeRuntimeReadinessResult[];
  checked_at: string;
};

// ── Known technology implementation status ────────────────────────────────────
// Based on TECH-01 real audit findings.
// This is a static snapshot — updated when technology implementations change.
// Scores represent actual product readiness (not aspirational).

const TECHNOLOGY_READINESS_BASELINE: Record<string, number> = {
  cloneos: 85,          // real — Pierre runtime functional
  cloneadn: 80,         // real — empreinte B44 functional
  cloneguard: 85,       // real — full pipeline Pierre
  clonetrace: 80,       // real — audit trail Pierre functional
  clonecontinuum: 65,   // Pierre-only, partially implemented
  clonetrust: 60,       // Pierre-only, integrated in CloneGuard pipeline
  clonereview: 10,      // definition only, no implementation
  clonesignals: 5,      // definition only
  clonelearn: 5,        // definition only
  clonevoice: 15,       // UI status only, no voice pipeline
  clonechat: 50,        // Pierre cockpit exists, not unified
  clonebrief: 5,        // definition only
};

// ── buildEmployeeRuntimeReadiness ─────────────────────────────────────────────
// Computes readiness for a single employee.

export function buildEmployeeRuntimeReadiness(
  slug: string,
): EmployeeRuntimeReadinessResult | null {
  const contract = getEmployeeRuntimeContract(slug);
  if (!contract) return null;

  const now = new Date().toISOString();
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Roadmap employees — not yet built
  if (contract.status === "roadmap" || contract.status === "disabled" || contract.status === "deprecated") {
    return {
      slug: contract.slug,
      display_name: contract.display_name,
      domain: contract.domain,
      status: "roadmap",
      product_runtime_ready: false,
      public_launch_ready: false,
      demo_ready: false,
      hard_requirements_met: false,
      hard_requirements_count: 0,
      hard_requirements_ok_count: 0,
      soft_requirements_count: 0,
      soft_requirements_ok_count: 0,
      score: 0,
      blockers: [`Employee ${slug} is in status "${contract.status}" — not yet operational.`],
      warnings: [],
      external_blockers: contract.launch_readiness?.external_blockers ?? [],
      checked_at: now,
    };
  }

  // Evaluate technology requirements
  const hardReqs = contract.required_technologies.filter((t) => t.required);
  const softReqs = contract.required_technologies.filter((t) => !t.required);

  let hardOkCount = 0;
  let softOkCount = 0;

  for (const tech of hardReqs) {
    const isKnown = VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has(tech.slug as Parameters<typeof VALID_EMPLOYEE_TECHNOLOGY_SLUGS.has>[0]);
    const baseline = TECHNOLOGY_READINESS_BASELINE[tech.slug] ?? 0;
    const meetsMinimum = baseline >= tech.minimum_readiness;

    if (!isKnown) {
      blockers.push(`Hard requirement technology "${tech.slug}" is unknown.`);
    } else if (!meetsMinimum) {
      blockers.push(
        `Hard requirement "${tech.slug}" readiness ${baseline}/100 < minimum ${tech.minimum_readiness}/100.`,
      );
    } else {
      hardOkCount++;
    }
  }

  for (const tech of softReqs) {
    const baseline = TECHNOLOGY_READINESS_BASELINE[tech.slug] ?? 0;
    const meetsMinimum = tech.minimum_readiness === 0 || baseline >= tech.minimum_readiness;
    if (meetsMinimum) {
      softOkCount++;
    } else {
      warnings.push(
        `Optional requirement "${tech.slug}" readiness ${baseline}/100 (minimum: ${tech.minimum_readiness}/100) — partially available.`,
      );
    }
  }

  // Internal blockers from contract
  for (const ib of contract.launch_readiness.internal_blockers) {
    blockers.push(`Internal blocker: ${ib}`);
  }

  const hardRequirementsMet = hardOkCount === hardReqs.length;

  // Score calculation:
  //   Hard requirements:  65% of score (each = 65/hardCount)
  //   Soft requirements:  20% of score (each = 20/softCount)
  //   Contract quality:   15% of score (always awarded if contract is valid)
  const hardScore = hardReqs.length > 0
    ? (hardOkCount / hardReqs.length) * 65
    : 65;
  const softScore = softReqs.length > 0
    ? (softOkCount / softReqs.length) * 20
    : 20;
  const contractScore = 15; // valid contract contributes 15 pts
  const score = Math.round(hardScore + softScore + contractScore);

  // Determine status
  let status: EmployeeReadinessStatus;
  if (!hardRequirementsMet || blockers.length > 0) {
    status = "blocked";
  } else if (softOkCount === softReqs.length) {
    status = "ready";
  } else {
    status = "partial_ready";
  }

  return {
    slug: contract.slug,
    display_name: contract.display_name,
    domain: contract.domain,
    status,
    product_runtime_ready: hardRequirementsMet && blockers.length === 0,
    public_launch_ready: false,   // ALWAYS false — Go-Live gate controls this
    demo_ready: contract.launch_readiness.demo_ready,
    hard_requirements_met: hardRequirementsMet,
    hard_requirements_count: hardReqs.length,
    hard_requirements_ok_count: hardOkCount,
    soft_requirements_count: softReqs.length,
    soft_requirements_ok_count: softOkCount,
    score,
    blockers,
    warnings,
    external_blockers: contract.launch_readiness.external_blockers,
    checked_at: now,
  };
}

// ── buildAllEmployeeRuntimeReadiness ─────────────────────────────────────────
// Computes readiness for all registered employees.

export function buildAllEmployeeRuntimeReadiness(): EmployeeRuntimeReadinessResult[] {
  return EMPLOYEE_RUNTIME_REGISTRY
    .map((e) => buildEmployeeRuntimeReadiness(e.slug))
    .filter((r): r is EmployeeRuntimeReadinessResult => r !== null);
}

// ── getEmployeeRuntimeReadinessVerdict ────────────────────────────────────────
// Returns an overall readiness verdict for all registered employees.
// Note: public_launch_ready is never included — that is Go-Live gate territory.

export function getEmployeeRuntimeReadinessVerdict(): EmployeeRuntimeReadinessVerdict {
  const results = buildAllEmployeeRuntimeReadiness();
  const now = new Date().toISOString();

  const activeEmployees = results.filter(
    (r) => r.status !== "roadmap",
  ).length;
  const readyEmployees = results.filter((r) => r.status === "ready").length;
  const partialReadyEmployees = results.filter((r) => r.status === "partial_ready").length;
  const blockedEmployees = results.filter((r) => r.status === "blocked").length;
  const roadmapEmployees = results.filter((r) => r.status === "roadmap").length;

  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;

  return {
    ok: blockedEmployees === 0 && activeEmployees > 0,
    total_employees: EMPLOYEE_RUNTIME_REGISTRY.length,
    active_employees: activeEmployees,
    ready_employees: readyEmployees,
    partial_ready_employees: partialReadyEmployees,
    blocked_employees: blockedEmployees,
    roadmap_employees: roadmapEmployees,
    overall_score: overallScore,
    results,
    checked_at: now,
  };
}
