// src/lib/clonestore/phase3-final-qa/phase3-final-qa-report.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Report Builder
//
// Module pur. Pas de Supabase, pas de write, pas d'import Pierre.

import type {
  Phase3FinalQaReport,
  Phase3FinalQaReleaseBoundary,
  Phase3FinalQaNextPhaseRecommendation,
  Phase3FinalQaStep,
  Phase3FinalQaInvariantResult,
  Phase3FinalQaVerdict,
} from "./phase3-final-qa-types";
import {
  buildPhase3FinalQaChecklist,
  buildPhase3FinalQaDomainSummaries,
  buildPhase3FinalQaVerdict,
} from "./phase3-final-qa-checklist";
import {
  getPhase3FinalQaBlockingInvariants,
} from "./phase3-final-qa-invariants";

// ── Release boundary ──────────────────────────────────────────────────────────

export function buildPhase3FinalQaReleaseBoundary(): Phase3FinalQaReleaseBoundary {
  return {
    phase3_can_close: true,
    conditions: [
      "Phase 3 peut se clore si les tests et le build passent et si les invariants tiennent.",
      "Lancement public externe non validé.",
      "L'activation de la persistance serveur nécessite encore SQL/flag/evidence côté Supabase (manuel).",
      "CloneVoice reste non actif production.",
      "Le moteur Pierre reste inchangé.",
      "Phase 4 ne peut démarrer qu'après un GO sur P3.22.",
    ],
    public_launch_external_validated: false,
    server_persistence_manual_activation_required: true,
    clonevoice_production_active: false,
    pierre_engine_unchanged: true,
    phase4_can_start_after_go: true,
  };
}

// ── Next phase ────────────────────────────────────────────────────────────────

export function buildPhase3FinalQaNextPhaseRecommendation(): Phase3FinalQaNextPhaseRecommendation {
  return {
    recommended_phase: "PHASE 4 — CloneOS / Pierre Runtime Operational Integration",
    rationale:
      "La Phase 3 a posé les couches read-only, design et activation manuelle. "
      + "La Phase 4 peut commencer l'intégration runtime opérationnelle gouvernée, "
      + "après un GO sur le gate P3.22.",
    alternatives: [
      "Phase 4.1 — CloneOS Mission Runtime Readiness / Pierre Mission Execution Hardening",
      "Go-Live Final Hardening externe (si Phase 4 est complétée plus tard) — lancement public externe non validé pour l'instant",
    ],
  };
}

// ── Report builder ────────────────────────────────────────────────────────────

export type Phase3FinalQaReportInput = {
  steps?: Phase3FinalQaStep[];
  invariant_results?: Phase3FinalQaInvariantResult[];
};

export function buildPhase3FinalQaReport(
  input: Phase3FinalQaReportInput = {}
): Phase3FinalQaReport {
  const steps = input.steps ?? buildPhase3FinalQaChecklist().steps;
  const invariantResults = input.invariant_results ?? [];

  const domainSummaries = buildPhase3FinalQaDomainSummaries(steps);
  const blockingSteps = steps
    .filter((s) => s.severity === "blocking" && s.status === "failed")
    .map((s) => s.id);
  const blockingInvariants = getPhase3FinalQaBlockingInvariants(invariantResults).map((r) => r.invariant_id);

  let verdict: Phase3FinalQaVerdict = buildPhase3FinalQaVerdict(steps);
  if (blockingInvariants.length > 0) verdict = "blocked";

  const report: Phase3FinalQaReport = {
    verdict,
    generated_at: new Date().toISOString(),
    domain_summaries: domainSummaries,
    invariant_results: invariantResults,
    blocking_steps: blockingSteps,
    blocking_invariants: blockingInvariants,
    release_boundary: buildPhase3FinalQaReleaseBoundary(),
    next_phase: buildPhase3FinalQaNextPhaseRecommendation(),
    message: "",
  };
  report.message = summarizePhase3FinalQaReport(report);
  return report;
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizePhase3FinalQaReport(report: Phase3FinalQaReport): string {
  const lines = [
    `[Phase 3 Final QA Gate Report] Verdict : ${report.verdict.toUpperCase()}`,
    `  Domaines : ${report.domain_summaries.length}`,
    `  Étapes bloquantes échouées : ${report.blocking_steps.length}`,
    `  Invariants bloquants non satisfaits : ${report.blocking_invariants.length}`,
    `  Phase 3 peut se clore : ${report.release_boundary.phase3_can_close}`,
    `  Prochaine phase : ${report.next_phase.recommended_phase}`,
    `  Lancement public externe : non validé.`,
  ];
  return lines.join("\n");
}

// ── Go / No-Go ────────────────────────────────────────────────────────────────

export function buildPhase3FinalQaGoNoGoMessage(report: Phase3FinalQaReport): string {
  const go = report.verdict === "pass" || report.verdict === "needs_review";
  const decision = report.verdict === "pass" ? "GO" : report.verdict === "needs_review" ? "GO (needs review)" : "NO-GO";
  return [
    `Phase 3 Final QA Gate — Décision : ${decision}`,
    go
      ? "Phase 3 peut se clore après validation tests/build et evidence manuelle."
      : "Phase 3 ne peut pas se clore — corriger les blocages avant Phase 4.",
    "Lancement public externe : non validé. CloneVoice non actif. Pierre moteur inchangé.",
  ].join("\n");
}
