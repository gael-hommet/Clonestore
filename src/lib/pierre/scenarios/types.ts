// src/lib/pierre/scenarios/types.ts
// Pierre Golden Scenarios — Bloc 29
// Pure types: no Supabase, no Next, no async, no side effects.

// ══════════════════════════════════════════════════════════════
// 1. IDENTIFIERS & ENUMS
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioId =
  | "gs_onboarding_complete"
  | "gs_hiring_offer"
  | "gs_absence_justified"
  | "gs_contract_renewal"
  | "gs_trial_activation"
  | "gs_payroll_prep"
  | "gs_employee_360"
  | "gs_document_premium"
  | "gs_cloneguard_allow"
  | "gs_cloneadn_configured"
  | "gs_cloneguard_block"
  | "gs_missing_employee"
  | "gs_invalid_request";

export const PIERRE_GOLDEN_SCENARIO_IDS: PierreGoldenScenarioId[] = [
  "gs_onboarding_complete",
  "gs_hiring_offer",
  "gs_absence_justified",
  "gs_contract_renewal",
  "gs_trial_activation",
  "gs_payroll_prep",
  "gs_employee_360",
  "gs_document_premium",
  "gs_cloneguard_allow",
  "gs_cloneadn_configured",
  "gs_cloneguard_block",
  "gs_missing_employee",
  "gs_invalid_request",
];

// ── Official public IDs (product-facing aliases for the gs_* internal IDs) ────

export type PierreOfficialScenarioId =
  | "onboarding_cdi"
  | "contract_draft"
  | "contract_amendment"
  | "absence_followup"
  | "prepay_summary"
  | "employee_file_summary"
  | "sensitive_case"
  | "offboarding"
  | "candidate_rejection"
  | "executive_hr_briefing"
  | "out_of_scope"
  | "email_without_validation"
  | "incomplete_request";

export const PIERRE_OFFICIAL_SCENARIO_IDS: PierreOfficialScenarioId[] = [
  "onboarding_cdi",
  "contract_draft",
  "contract_amendment",
  "absence_followup",
  "prepay_summary",
  "employee_file_summary",
  "sensitive_case",
  "offboarding",
  "candidate_rejection",
  "executive_hr_briefing",
  "out_of_scope",
  "email_without_validation",
  "incomplete_request",
];

export const OFFICIAL_TO_GS_ALIAS_MAP: Record<PierreOfficialScenarioId, PierreGoldenScenarioId> = {
  onboarding_cdi: "gs_onboarding_complete",
  contract_draft: "gs_hiring_offer",
  contract_amendment: "gs_contract_renewal",
  absence_followup: "gs_absence_justified",
  prepay_summary: "gs_payroll_prep",
  employee_file_summary: "gs_employee_360",
  sensitive_case: "gs_cloneguard_block",
  offboarding: "gs_cloneguard_block",
  candidate_rejection: "gs_hiring_offer",
  executive_hr_briefing: "gs_trial_activation",
  out_of_scope: "gs_missing_employee",
  email_without_validation: "gs_hiring_offer",
  incomplete_request: "gs_invalid_request",
};

export type PierreGoldenScenarioCategory = "positive" | "negative";

export type PierreGoldenScenarioSeverity = "critical" | "high" | "medium" | "low";

export type PierreGoldenScenarioExpectedStatus = "pass" | "fail" | "skip" | "warn";

export type PierreGoldenScenarioArtifactType =
  | "workflow_plan"
  | "brain_output"
  | "employee_360"
  | "document"
  | "cloneguard"
  | "cloneadn"
  | "task_drafts"
  | "validation_error";

export type PierreGoldenScenarioAssertionType =
  | "exists"
  | "not_null"
  | "is_true"
  | "is_false"
  | "equals"
  | "contains"
  | "length_gt"
  | "is_array"
  | "matches_status"
  | "is_string"
  | "is_number";

// ══════════════════════════════════════════════════════════════
// 2. SCENARIO DEFINITION
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioCheck = {
  id: string;
  label: string;
  artifact_type: PierreGoldenScenarioArtifactType;
  path: string;
  assertion: PierreGoldenScenarioAssertionType;
  expected?: unknown;
};

export type PierreGoldenScenarioInput = {
  id: PierreGoldenScenarioId;
  label: string;
  description: string;
  category: PierreGoldenScenarioCategory;
  severity: PierreGoldenScenarioSeverity;
  request_text: string;
  company_context_key: string | null;
  employee_context_key: string | null;
  clone_adn_key: string | null;
  demonstrates: string[];
  modules: PierreGoldenScenarioArtifactType[];
  expected_status: PierreGoldenScenarioExpectedStatus;
  checks: PierreGoldenScenarioCheck[];
};

// ══════════════════════════════════════════════════════════════
// 3. RUN OPTIONS
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioAiMode = "off" | "assist" | "primary";

export type PierreGoldenScenarioRunOptions = {
  scenario_ids?: PierreGoldenScenarioId[];
  ai_mode?: PierreGoldenScenarioAiMode;
  dry_run?: boolean;
  verbose?: boolean;
  timeout_ms?: number;
};

// ══════════════════════════════════════════════════════════════
// 4. ARTIFACTS
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioArtifact = {
  type: PierreGoldenScenarioArtifactType;
  label: string;
  data: Record<string, unknown>;
  valid: boolean;
  error?: string;
};

// ══════════════════════════════════════════════════════════════
// 5. RESULTS
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioCheckResult = {
  check_id: string;
  label: string;
  passed: boolean;
  actual: unknown;
  expected?: unknown;
  error?: string;
};

export type PierreGoldenScenarioResult = {
  scenario_id: PierreGoldenScenarioId;
  label: string;
  category: PierreGoldenScenarioCategory;
  severity: PierreGoldenScenarioSeverity;
  status: PierreGoldenScenarioExpectedStatus;
  expected_status: PierreGoldenScenarioExpectedStatus;
  checks_total: number;
  checks_passed: number;
  checks_failed: number;
  check_results: PierreGoldenScenarioCheckResult[];
  artifacts: PierreGoldenScenarioArtifact[];
  demonstrates: string[];
  duration_ms: number;
  error?: string;
};

export type PierreGoldenScenarioSuiteStatus =
  | "all_pass"
  | "some_fail"
  | "all_fail"
  | "partial";

export type PierreGoldenScenarioSuiteResult = {
  generated_at: string;
  scenarios_total: number;
  scenarios_passed: number;
  scenarios_failed: number;
  scenarios_warned: number;
  scenarios_skipped: number;
  checks_total: number;
  checks_passed: number;
  checks_failed: number;
  results: PierreGoldenScenarioResult[];
  duration_ms: number;
  suite_status: PierreGoldenScenarioSuiteStatus;
  executive_summary: string;
  critical_failures: string[];
  modules_validated: string[];
};

// ══════════════════════════════════════════════════════════════
// 6. REPORT
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioReportLevel =
  | "sellable"
  | "demo_ready"
  | "internal_only"
  | "blocked";

export type PierreGoldenScenarioReport = {
  generated_at: string;
  level: PierreGoldenScenarioReportLevel;
  level_label: string;
  suite_status: PierreGoldenScenarioSuiteStatus;
  score: number;
  scenarios_total: number;
  scenarios_passed: number;
  scenarios_failed: number;
  critical_failures: string[];
  modules_validated: string[];
  executive_summary: string;
  positive_highlights: string[];
  negative_findings: string[];
  recommendation: string;
  sellable: boolean;
};
