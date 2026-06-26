// src/lib/clonestore/phase3-final-qa/phase3-final-qa-types.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Types
//
// Module pur. Gate de fermeture de la Phase 3.
// Pas de Supabase, pas d'API, pas de réseau, pas de write, pas d'import Pierre.

// ── Clés de phase ─────────────────────────────────────────────────────────────

export type Phase3FinalQaPhaseKey =
  | "phase3_1" | "phase3_2" | "phase3_3" | "phase3_4" | "phase3_5"
  | "phase3_6" | "phase3_7" | "phase3_8" | "phase3_9" | "phase3_10"
  | "phase3_11" | "phase3_12" | "phase3_13" | "phase3_14" | "phase3_15"
  | "phase3_16" | "phase3_17" | "phase3_18" | "phase3_19" | "phase3_20"
  | "phase3_21" | "phase3_22";

// ── Domaines ──────────────────────────────────────────────────────────────────

export type Phase3FinalQaDomain =
  | "messages"
  | "cloneos_history"
  | "onboarding"
  | "enterprise_footprint"
  | "pierre_context"
  | "profile_agents"
  | "employee_context_registry"
  | "manual_activation"
  | "security"
  | "qa"
  | "release_boundary";

// ── Sévérité / statut / verdict ───────────────────────────────────────────────

export type Phase3FinalQaSeverity = "blocking" | "warning" | "info";

export type Phase3FinalQaStatus = "pending" | "passed" | "failed" | "skipped";

export type Phase3FinalQaVerdict = "pass" | "fail" | "needs_review" | "blocked";

// ── Step ──────────────────────────────────────────────────────────────────────

export type Phase3FinalQaStep = {
  id: string;
  label: string;
  domain: Phase3FinalQaDomain;
  severity: Phase3FinalQaSeverity;
  status: Phase3FinalQaStatus;
  expected_result: string;
  verification_hint: string;
  phase_key?: Phase3FinalQaPhaseKey;
};

export type Phase3FinalQaChecklist = {
  steps: Phase3FinalQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.22";
};

export type Phase3FinalQaDomainSummary = {
  domain: Phase3FinalQaDomain;
  total: number;
  passed: number;
  pending: number;
  failed: number;
  blocking_failed: number;
};

// ── Invariants ────────────────────────────────────────────────────────────────

export type Phase3FinalQaInvariant = {
  id: string;
  label: string;
  domain: Phase3FinalQaDomain;
  severity: Phase3FinalQaSeverity;
  description: string;
  // Motif attendu (présence) ou interdit (absence) — décrit en clair.
  expectation: "must_be_present" | "must_be_absent";
  hint: string;
};

export type Phase3FinalQaInvariantResult = {
  invariant_id: string;
  satisfied: boolean;
  severity: Phase3FinalQaSeverity;
  detail: string;
};

// ── Report ────────────────────────────────────────────────────────────────────

export type Phase3FinalQaReleaseBoundary = {
  phase3_can_close: boolean;
  conditions: string[];
  public_launch_external_validated: false;
  server_persistence_manual_activation_required: true;
  clonevoice_production_active: false;
  pierre_engine_unchanged: true;
  phase4_can_start_after_go: true;
};

export type Phase3FinalQaNextPhaseRecommendation = {
  recommended_phase: string;
  rationale: string;
  alternatives: string[];
};

export type Phase3FinalQaReport = {
  verdict: Phase3FinalQaVerdict;
  generated_at: string;
  domain_summaries: Phase3FinalQaDomainSummary[];
  invariant_results: Phase3FinalQaInvariantResult[];
  blocking_steps: string[];
  blocking_invariants: string[];
  release_boundary: Phase3FinalQaReleaseBoundary;
  next_phase: Phase3FinalQaNextPhaseRecommendation;
  message: string;
};

// ── Evidence ──────────────────────────────────────────────────────────────────

export type Phase3FinalQaEvidenceTemplate = {
  gate_date: string;
  environment: "local" | "staging" | "production";
  commit_or_branch: string;
  tsc_result: "clean" | "errors" | "not_checked";
  phase_tests_result: string;
  pfinal02_result: string;
  npm_test_result: string;
  build_result: "clean" | "errors" | "not_checked";
  no_write_no_execution_confirmed: boolean;
  pierre_engine_api_untouched_confirmed: boolean;
  clonevoice_not_active_confirmed: boolean;
  cloneos_not_executed_confirmed: boolean;
  localstorage_fallback_confirmed: boolean;
  manual_activation_confirmed: boolean;
  sql_auto_applied: false;
  env_auto_modified: false;
  go_live_proofs_modified: false;
  public_launch_external_status: "not_validated";
  decision: "PASS" | "FAIL" | "NEEDS_REVIEW" | "PENDING";
  notes: string;
  screenshots_or_refs: string[];
};
