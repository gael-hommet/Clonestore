// src/lib/pierre/release-audit/workflow-coverage.ts
// B36 — Coverage matrix for 27 HR workflows.
// Pure, synchronous, no DB.

import type { PierreWorkflowCoverage, PierreWorkflowId } from "./types";

function wf(
  workflow_id: PierreWorkflowId,
  label: string,
  domain: string,
  score: number, // 0-4
  pierre_handles: string[],
  gaps: string[],
  test_proof: string | null,
): PierreWorkflowCoverage {
  const status =
    score === 4
      ? "proven"
      : score >= 2
        ? "partial"
        : score === 1
          ? "mock_only"
          : "gap";
  return { workflow_id, label, domain, status, pierre_handles, gaps, test_proof, score };
}

// Workflow max score: 4 = fully covered, 3 = strong partial, 2 = partial, 1 = minimal/mock, 0 = absent

export function buildWorkflowCoverage(): PierreWorkflowCoverage[] {
  return [
    // ── Onboarding ──────────────────────────────────────────────────────────
    wf(
      "wf_onboarding_docs",
      "Onboarding — document generation (welcome letter, contract summary)",
      "onboarding",
      3,
      ["Generate welcome letter from template", "Generate contract summary", "Classify document risk level", "Log in audit trail"],
      ["No real email delivery to new hire", "No signature collection", "IT provisioning not automated"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_onboarding_complete",
    ),
    wf(
      "wf_onboarding_checklist",
      "Onboarding — onboarding checklist and task sequencing",
      "onboarding",
      2,
      ["Task sequence generation for onboarding", "Approval gates on sensitive steps"],
      ["No checklist tracking UI proven", "No integration with calendar/HRIS for scheduling"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts",
    ),

    // ── Hiring ──────────────────────────────────────────────────────────────
    wf(
      "wf_hiring_offer",
      "Hiring — offer letter generation",
      "hiring",
      3,
      ["Generate offer letter from template", "Set compensation and role fields", "Human approval required before send"],
      ["No direct ATS integration", "No offer tracking/signature"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_hiring_offer",
    ),
    wf(
      "wf_hiring_contract",
      "Hiring — employment contract generation",
      "hiring",
      2,
      ["CDI/CDD template selection", "Fill contract fields from employee data", "Risk classification (orange/red)"],
      ["Template only — no legal review engine", "No DPAE automation", "No eSign"],
      "src/lib/clonestore/documents/__tests__/premium-documents.test.ts",
    ),

    // ── Contract ────────────────────────────────────────────────────────────
    wf(
      "wf_contract_amendment",
      "Contract — amendment generation",
      "contract",
      2,
      ["Amendment template generation", "CloneGuard risk check", "Approval gate enforced"],
      ["No diff against original contract", "No legal compliance check"],
      "src/lib/pierre/__tests__/premium-artifacts.test.ts",
    ),
    wf(
      "wf_contract_renewal",
      "Contract — renewal processing (CDD → CDI or extension)",
      "contract",
      3,
      ["Renewal detection from mission context", "Document generation", "Audit log entry", "Risk-appropriate approval gate"],
      ["No automatic renewal reminder scheduling", "No payroll impact calculation"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_contract_renewal",
    ),

    // ── Trial ────────────────────────────────────────────────────────────────
    wf(
      "wf_trial_activation",
      "Trial period — activation and tracking",
      "contract",
      3,
      ["Trial period activation", "Status tracking", "End-of-trial notification draft", "Approval gate"],
      ["No calendar integration for trial end date", "No manager notification automation"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_trial_activation",
    ),
    wf(
      "wf_trial_extension",
      "Trial period — extension request",
      "contract",
      2,
      ["Extension document generation", "Risk classification", "HR validation required"],
      ["No legal max extension enforcement", "No automatic notice to employee"],
      "src/lib/pierre/__tests__/hr-trial-activation.test.ts",
    ),

    // ── Absence ──────────────────────────────────────────────────────────────
    wf(
      "wf_absence_justify",
      "Absence — justification processing",
      "absence",
      3,
      ["Justification document intake", "Risk classification", "Audit trail entry", "Employee file update draft"],
      ["No HR system sync", "No balance auto-deduction"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_absence_justified",
    ),
    wf(
      "wf_absence_request",
      "Absence — leave request processing",
      "absence",
      2,
      ["Leave request classification", "Approval gate", "Document generation"],
      ["No calendar system integration", "No leave balance checking"],
      "src/lib/pierre/__tests__/hr-employee-file.test.ts",
    ),
    wf(
      "wf_leave_management",
      "Leave management — RTT, congés payés, sick leave tracking",
      "leave",
      1,
      ["Leave domain classification", "Risk-appropriate routing"],
      ["No leave balance tracking", "No legal calendar integration", "No payroll impact calculation"],
      null,
    ),

    // ── Payroll ──────────────────────────────────────────────────────────────
    wf(
      "wf_payroll_prep",
      "Payroll — variables preparation and summary",
      "payroll_prep",
      3,
      ["Payroll variable collection from employee file", "Summary document generation", "Risk classification", "Approval gate"],
      ["No direct payroll software integration (Silae, Sage, ADP, etc.)", "No DSN generation"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_payroll_prep",
    ),
    wf(
      "wf_payroll_variables",
      "Payroll — variable elements (primes, overtime, expenses)",
      "payroll_prep",
      2,
      ["Variable element detection from context", "Summary draft generation"],
      ["No calculation engine", "No legal cap enforcement (heures sup, etc.)"],
      "src/lib/pierre/__tests__/hr-contracts.test.ts",
    ),

    // ── Employee file ────────────────────────────────────────────────────────
    wf(
      "wf_employee_360",
      "Employee 360 — full profile synthesis",
      "employee_file",
      4,
      ["Full employee profile synthesis", "Mission history", "Risk scoring", "Document listing", "CloneADN preferences applied"],
      [],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_employee_360",
    ),
    wf(
      "wf_employee_file_update",
      "Employee file — information update",
      "employee_file",
      3,
      ["Field update detection from mission", "Validation policy enforcement", "Audit log entry"],
      ["No real DB write proven in unit tests", "No change notification to employee"],
      "src/lib/pierre/__tests__/hr-employee-file.test.ts",
    ),

    // ── Offboarding ──────────────────────────────────────────────────────────
    wf(
      "wf_offboarding_process",
      "Offboarding — process initiation and coordination",
      "offboarding",
      2,
      ["Offboarding detection from context", "Risk escalation (red/black)", "CloneGuard enforcement"],
      ["No formal offboarding task sequence", "No exit interview scheduling", "No IT deprovisioning workflow"],
      "src/lib/pierre/context/employee-context.ts — offboarding risk detection",
    ),
    wf(
      "wf_offboarding_docs",
      "Offboarding — documents (attestation, solde tout compte)",
      "offboarding",
      2,
      ["Document template selection", "CloneGuard risk block for termination", "Human approval enforced"],
      ["Certificate of employment template partial", "Solde tout compte not automated", "No severance calculation"],
      "src/lib/pierre/__tests__/premium-artifacts.test.ts",
    ),

    // ── Training / interview ─────────────────────────────────────────────────
    wf(
      "wf_training_plan",
      "Training — plan generation and CPF information",
      "training",
      1,
      ["Training domain classification", "Plan summary draft"],
      ["No CPF platform integration", "No OPCO connector", "No budget tracking"],
      null,
    ),
    wf(
      "wf_interview_scheduling",
      "Interview — scheduling coordination",
      "interview",
      1,
      ["Interview domain classification", "Communication draft"],
      ["No calendar integration", "No video conferencing link generation", "No candidate portal"],
      null,
    ),
    wf(
      "wf_performance_review",
      "Performance review — preparation and documentation",
      "performance_ops",
      1,
      ["Performance domain classification", "Document draft generation"],
      ["No structured review template", "No manager/employee form", "No objective tracking"],
      null,
    ),

    // ── Communication / helpdesk ─────────────────────────────────────────────
    wf(
      "wf_internal_communication",
      "Internal communication — HR announcements and memos",
      "internal_communication",
      3,
      ["Communication draft with CloneADN tone", "Preferred format applied", "Formal closing and signature"],
      ["Real email delivery mocked", "No mass send to employee group"],
      "src/lib/pierre/__tests__/golden-scenarios-crossblock.test.ts",
    ),
    wf(
      "wf_hr_helpdesk",
      "HR helpdesk — employee questions and quick answers",
      "hr_helpdesk",
      2,
      ["Question classification", "Domain routing", "Response draft generation"],
      ["No knowledge base integration", "No ticket system connector"],
      null,
    ),

    // ── Sensitive / compliance ───────────────────────────────────────────────
    wf(
      "wf_disciplinary_case",
      "Disciplinary case — warning letter, formal notice",
      "sensitive_case",
      2,
      ["CloneGuard hard block on automation", "Human approval mandatory", "Audit trail required"],
      ["No legal step sequencing (convocation, délai de réflexion)", "No disciplinary timeline enforcement"],
      "src/lib/pierre/__tests__/hr-cloneguard.test.ts",
    ),
    wf(
      "wf_sensitive_case",
      "Sensitive case — harassment, conflict, discrimination",
      "sensitive_case",
      3,
      ["Hard block by CloneGuard (black risk)", "Escalation to HR manager enforced", "Audit log preserved"],
      ["No case management workflow", "No investigation template", "No legal timeline enforcement"],
      "src/lib/pierre/__tests__/golden-scenarios.test.ts — gs_cloneguard_block",
    ),
    wf(
      "wf_compliance_check",
      "Compliance — labor law compliance check on HR decisions",
      "compliance_workflow",
      1,
      ["Risk classification with compliance domain", "ClonePolicy enforcement"],
      ["No legal database integration", "No automatic law update monitoring", "No region-specific rules engine"],
      null,
    ),

    // ── Reporting / multi-site ───────────────────────────────────────────────
    wf(
      "wf_reporting",
      "Reporting — HR KPIs and operational reporting",
      "reporting",
      1,
      ["Reporting domain classification", "Summary generation from employee data"],
      ["No report generation engine", "No charts/dashboards", "No BDES integration"],
      null,
    ),
    wf(
      "wf_multi_site_coordination",
      "Multi-site coordination — HR ops across locations",
      "multi_site_coordination",
      1,
      ["Multi-site domain classification", "Company_id scoped isolation"],
      ["No site-specific rule differentiation", "No inter-site communication logic"],
      null,
    ),
  ];
}

export function scoreWorkflowCoverage(coverage: PierreWorkflowCoverage[]): {
  total_workflows: number;
  fully_covered: number;
  partial: number;
  minimal: number;
  not_covered: number;
  coverage_pct: number;
  total_score: number;
  max_score: number;
} {
  const total_workflows = coverage.length;
  const fully_covered = coverage.filter((w) => w.score === 4).length;
  const partial = coverage.filter((w) => w.score === 2 || w.score === 3).length;
  const minimal = coverage.filter((w) => w.score === 1).length;
  const not_covered = coverage.filter((w) => w.score === 0).length;
  const total_score = coverage.reduce((sum, w) => sum + w.score, 0);
  const max_score = total_workflows * 4;
  const coverage_pct = max_score > 0 ? Math.round((total_score / max_score) * 100) : 0;
  return { total_workflows, fully_covered, partial, minimal, not_covered, coverage_pct, total_score, max_score };
}
