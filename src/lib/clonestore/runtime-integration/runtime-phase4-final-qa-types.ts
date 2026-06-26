// src/lib/clonestore/runtime-integration/runtime-phase4-final-qa-types.ts
// PHASE 4.12 — Phase 4 Final QA Gate / Runtime Closure — Types
//
// DESIGN-ONLY / CLOSURE. Gate final qui verrouille PHASE 4.1 → 4.11.
// N'ajoute aucune capacité runtime active. Aucune route. Aucun write.
// Aucune mission réelle. Aucune exécution. Aucun moteur Pierre.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimePhase4FinalQaPhase = "4.12";

export type RuntimePhase4FinalQaStatus =
  | "not_started" | "auditing" | "passed" | "needs_review" | "blocked" | "closed";

export type RuntimePhase4FinalQaVerdict =
  | "phase4_closed" | "ready_for_phase5" | "needs_review" | "blocked";

export type RuntimePhase4FinalQaScope =
  | "design" | "simulation" | "gated_runtime" | "closure";

export type RuntimePhase4FinalQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimePhase4FinalQaStepStatus = "pending" | "passed" | "failed" | "skipped";

export type RuntimePhase4FinalQaInvariantId =
  | "no_real_mission_created"
  | "no_runtime_execution"
  | "no_cloneos_execution"
  | "no_pierre_engine_call"
  | "no_ai_call"
  | "no_email_sent"
  | "no_document_generated"
  | "no_clonevoice_activation"
  | "no_unflagged_db_write"
  | "no_sql_auto_apply"
  | "no_env_auto_change"
  | "no_flag_auto_activation"
  | "no_go_live_proof_auto_change"
  | "no_public_external_launch_validation"
  | "scale_80k_not_proven"
  | "human_validation_required_before_controlled_mission"
  | "promotion_not_applied"
  | "approval_not_applied"
  | "localstorage_fallback_preserved"
  | "feature_flags_default_false"
  | "rls_design_only_where_applicable";

export type RuntimePhase4FinalQaBlockId =
  | "phase4_1_runtime_foundation"
  | "phase4_2_simulation_endpoint"
  | "phase4_3_mission_draft_contract"
  | "phase4_4_draft_persistence_design"
  | "phase4_5_draft_safe_apply"
  | "phase4_6_manual_activation_qa"
  | "phase4_7_restore_ui"
  | "phase4_8_promotion_contract"
  | "phase4_9_controlled_mission_preview_ui"
  | "phase4_10_controlled_mission_persistence_design"
  | "phase4_11_human_validation_workflow"
  | "phase4_12_final_qa_gate";

// ── Composants ────────────────────────────────────────────────────────────────

export type RuntimePhase4FinalQaStep = {
  id: string;
  label: string;
  description: string;
  severity: RuntimePhase4FinalQaStepSeverity;
  status: RuntimePhase4FinalQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimePhase4FinalQaInvariant = {
  id: RuntimePhase4FinalQaInvariantId;
  label: string;
  description: string;
  severity: RuntimePhase4FinalQaStepSeverity;
  expected: string;
  observed: string;
  status: RuntimePhase4FinalQaStepStatus;
  evidence: string;
  remediation: string;
};

export type RuntimePhase4FinalQaBlockSummary = {
  id: RuntimePhase4FinalQaBlockId;
  phase_number: string;
  title: string;
  status: RuntimePhase4FinalQaStepStatus;
  scope: RuntimePhase4FinalQaScope;
  main_files: string[];
  docs: string[];
  tests: string[];
  scripts: string[];
  sql_drafts: string[];
  routes: string[];
  invariants: RuntimePhase4FinalQaInvariantId[];
  activated_now: string[];
  not_activated: string[];
  risk_note: string;
};

export type RuntimePhase4FinalQaIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimePhase4FinalQaRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimePhase4FinalQaAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimePhase4FinalQaClosure = {
  phase: RuntimePhase4FinalQaPhase;
  verdict: RuntimePhase4FinalQaVerdict;
  closed_at: string;
  blocks: RuntimePhase4FinalQaBlockSummary[];
  invariants: RuntimePhase4FinalQaInvariant[];
  issues: RuntimePhase4FinalQaIssue[];
  recommendations: RuntimePhase4FinalQaRecommendation[];
  actions: RuntimePhase4FinalQaAction[];
  phase4_closed: boolean;
  ready_for_phase5: boolean;
  // ── Invariants littéraux ──────────────────────────────────────────────────
  public_launch_external_validated: false;
  scale_80k_not_proven: true;
  runtime_execution_enabled: false;
  real_mission_created: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  clonevoice_active: false;
  read_only: true;
};

export type RuntimePhase4FinalQaGate = {
  phase: RuntimePhase4FinalQaPhase;
  status: RuntimePhase4FinalQaStatus;
  verdict: RuntimePhase4FinalQaVerdict;
  blocks: RuntimePhase4FinalQaBlockSummary[];
  invariants: RuntimePhase4FinalQaInvariant[];
  closure: RuntimePhase4FinalQaClosure;
  expected_docs: string[];
  expected_scripts: string[];
  expected_tests: string[];
  expected_sql_drafts: string[];
  allowed_routes: string[];
  forbidden_routes: string[];
  generated_at: string;
  read_only: true;
};

export type RuntimePhase4FinalQaSnapshot = {
  phase: RuntimePhase4FinalQaPhase;
  status: RuntimePhase4FinalQaStatus;
  verdict: RuntimePhase4FinalQaVerdict;
  phase4_closed: boolean;
  ready_for_phase5: boolean;
  blocks_total: number;
  blocks_passed: number;
  invariants_total: number;
  invariants_passed: number;
  read_only: true;
};
