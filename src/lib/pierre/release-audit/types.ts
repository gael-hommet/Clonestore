// src/lib/pierre/release-audit/types.ts
// B36 — Pierre Final Audit: commercial launch readiness verdict.
// Pure types. No DB, no async, no side effects.

// ── Audit area ────────────────────────────────────────────────────────────────

export type PierreAuditArea =
  | "mission_engine"
  | "task_engine"
  | "hr_workflows"
  | "governance"
  | "audit_trail"
  | "continuity"
  | "documents"
  | "files"
  | "channels"
  | "context_pack"
  | "billing"
  | "access_control"
  | "ai_runtime"
  | "email_send"
  | "real_providers"
  | "ui_cockpit"
  | "tests"
  | "build"
  | "golden_scenarios"
  | "cloneadn";

// ── Audit status ──────────────────────────────────────────────────────────────

export type PierreAuditStatus =
  | "proven"       // Code + tests exist and pass
  | "partial"      // Feature exists but coverage or depth is incomplete
  | "mock_only"    // Implementation is mocked — real provider not connected
  | "gap"          // Feature expected but absent from repo
  | "not_applicable";

// ── Launch criticality ────────────────────────────────────────────────────────

export type PierreLaunchCriticality =
  | "blocker"     // Must be resolved before any launch — verdict becomes "blocked"
  | "high"        // Significantly degrades sellability if unresolved
  | "medium"      // Reduces polish / confidence but product still works
  | "low"         // Nice to have
  | "info";       // Informational — no impact on verdict

// ── Audit evidence ────────────────────────────────────────────────────────────

export type PierreAuditEvidence = {
  id: string;
  area: PierreAuditArea;
  label: string;
  status: PierreAuditStatus;
  criticality: PierreLaunchCriticality;
  evidence: string;        // What proves this claim (file path, test count, API route)
  gaps: string[];          // Honest gap list — never empty-wash
  score_contribution: number; // Points contributed to total (0 when gap/blocker)
  max_contribution: number;   // Max points possible for this evidence item
};

// ── HR workflow coverage ──────────────────────────────────────────────────────

export type PierreWorkflowId =
  | "wf_onboarding_docs"
  | "wf_onboarding_checklist"
  | "wf_hiring_offer"
  | "wf_hiring_contract"
  | "wf_contract_amendment"
  | "wf_contract_renewal"
  | "wf_trial_activation"
  | "wf_trial_extension"
  | "wf_absence_justify"
  | "wf_absence_request"
  | "wf_leave_management"
  | "wf_payroll_prep"
  | "wf_payroll_variables"
  | "wf_employee_360"
  | "wf_employee_file_update"
  | "wf_offboarding_process"
  | "wf_offboarding_docs"
  | "wf_training_plan"
  | "wf_interview_scheduling"
  | "wf_performance_review"
  | "wf_internal_communication"
  | "wf_hr_helpdesk"
  | "wf_disciplinary_case"
  | "wf_sensitive_case"
  | "wf_compliance_check"
  | "wf_reporting"
  | "wf_multi_site_coordination";

export type PierreWorkflowCoverage = {
  workflow_id: PierreWorkflowId;
  label: string;
  domain: string;
  status: PierreAuditStatus;
  pierre_handles: string[];   // What Pierre can do for this workflow
  gaps: string[];             // Honest remaining gaps
  test_proof: string | null;  // Reference to test file / scenario
  score: number;              // 0-4 per workflow (4 = fully covered, 0 = not covered)
};

// ── Score dimensions ──────────────────────────────────────────────────────────

export type PierreScoreDimension = {
  id: string;
  label: string;
  max_points: number;
  earned_points: number;
  status: PierreAuditStatus;
  summary: string;
  evidence_ids: string[];
};

// ── Gap register entry ────────────────────────────────────────────────────────

export type PierreGapEntry = {
  id: string;
  area: PierreAuditArea;
  criticality: PierreLaunchCriticality;
  title: string;
  description: string;
  impact: string;
  mitigation: string | null;   // How to handle for launch (manual process, disclaimer, etc.)
  is_blocking_verdict: boolean;
};

// ── Readiness verdict ─────────────────────────────────────────────────────────

export type PierreReadinessVerdict =
  | "sellable"        // 90-100: Pierre can be sold at 449€/month today
  | "almost_sellable" // 75-89: Real value, honest limitations, sellable with caveats
  | "not_sellable"    // 50-74: Too many gaps for a paid product
  | "blocked";        // <50 or has blocker gap: must fix before any sale

// ── Final audit report ────────────────────────────────────────────────────────

export type PierreAuditReport = {
  generated_at: string;
  verdict: PierreReadinessVerdict;
  total_score: number;             // 0-100
  max_score: number;               // always 100
  dimensions: PierreScoreDimension[];
  evidence: PierreAuditEvidence[];
  workflow_coverage: PierreWorkflowCoverage[];
  gap_register: PierreGapEntry[];
  blocking_gaps: PierreGapEntry[];
  high_gaps: PierreGapEntry[];
  strengths: string[];             // What Pierre does provably well
  honest_limits: string[];         // What Pierre cannot do yet
  recommended_launch_strategy: string;
  sellability_statement: string;   // One-line honest verdict
};

// ── Build input / result ──────────────────────────────────────────────────────

export type PierreAuditBuildInput = {
  override_score?: number | null;  // For testing only — forces a score
  include_workflow_coverage?: boolean;
  include_gap_register?: boolean;
  include_evidence?: boolean;
};

export type PierreAuditBuildResult = {
  report: PierreAuditReport;
  verdict: PierreReadinessVerdict;
  score: number;
  build_duration_ms: number;
  gap_count: number;
  blocker_count: number;
  workflow_coverage_pct: number; // 0-100
};
