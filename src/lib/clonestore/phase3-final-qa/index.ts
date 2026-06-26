// src/lib/clonestore/phase3-final-qa/index.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Point d'entrée
//
// Module pur. Gate de fermeture de la Phase 3.
// Pas de Supabase, pas de write, pas d'exécution, pas d'import Pierre.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Phase3FinalQaPhaseKey,
  Phase3FinalQaDomain,
  Phase3FinalQaSeverity,
  Phase3FinalQaStatus,
  Phase3FinalQaVerdict,
  Phase3FinalQaStep,
  Phase3FinalQaChecklist,
  Phase3FinalQaDomainSummary,
  Phase3FinalQaInvariant,
  Phase3FinalQaInvariantResult,
  Phase3FinalQaReport,
  Phase3FinalQaReleaseBoundary,
  Phase3FinalQaNextPhaseRecommendation,
  Phase3FinalQaEvidenceTemplate,
} from "./phase3-final-qa-types";

// ── Checklist ─────────────────────────────────────────────────────────────────
export {
  buildPhase3FinalQaChecklist,
  buildPhase3FinalQaDomainSummaries,
  buildPhase3FinalQaVerdict,
  getPhase3FinalQaBlockingSteps,
  summarizePhase3FinalQaChecklist,
} from "./phase3-final-qa-checklist";

// ── Invariants ────────────────────────────────────────────────────────────────
export {
  buildPhase3FinalQaInvariants,
  evaluatePhase3FinalQaInvariantFromText,
  summarizePhase3FinalQaInvariants,
  getPhase3FinalQaBlockingInvariants,
} from "./phase3-final-qa-invariants";

// ── Report ────────────────────────────────────────────────────────────────────
export type { Phase3FinalQaReportInput } from "./phase3-final-qa-report";
export {
  buildPhase3FinalQaReport,
  buildPhase3FinalQaReleaseBoundary,
  buildPhase3FinalQaNextPhaseRecommendation,
  summarizePhase3FinalQaReport,
  buildPhase3FinalQaGoNoGoMessage,
} from "./phase3-final-qa-report";

// ── Evidence ──────────────────────────────────────────────────────────────────
export {
  buildPhase3FinalQaEvidenceTemplate,
  validatePhase3FinalQaEvidenceTemplate,
  summarizePhase3FinalQaEvidence,
} from "./phase3-final-qa-evidence";

// ── QA (méta) ─────────────────────────────────────────────────────────────────
export type {
  Phase3FinalQaQaStepId,
  Phase3FinalQaQaStep,
  Phase3FinalQaQaVerdict,
  Phase3FinalQaQaChecklist,
  Phase3FinalQaQaSummary,
} from "./phase3-final-qa-qa";

export {
  buildPhase3FinalQaQaChecklist,
  buildPhase3FinalQaQaVerdict,
  getPhase3FinalQaQaBlockingSteps,
  summarizePhase3FinalQaQaVerdict,
} from "./phase3-final-qa-qa";
