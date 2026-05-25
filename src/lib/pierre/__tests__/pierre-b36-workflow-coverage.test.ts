// src/lib/pierre/__tests__/pierre-b36-workflow-coverage.test.ts
// B36 — Workflow coverage: 27 workflows, scoring, gaps

import { describe, it, expect } from "vitest";
import { buildWorkflowCoverage, scoreWorkflowCoverage } from "../release-audit/workflow-coverage";
import type { PierreWorkflowId } from "../release-audit/types";

const ALL_WORKFLOW_IDS: PierreWorkflowId[] = [
  "wf_onboarding_docs",
  "wf_onboarding_checklist",
  "wf_hiring_offer",
  "wf_hiring_contract",
  "wf_contract_amendment",
  "wf_contract_renewal",
  "wf_trial_activation",
  "wf_trial_extension",
  "wf_absence_justify",
  "wf_absence_request",
  "wf_leave_management",
  "wf_payroll_prep",
  "wf_payroll_variables",
  "wf_employee_360",
  "wf_employee_file_update",
  "wf_offboarding_process",
  "wf_offboarding_docs",
  "wf_training_plan",
  "wf_interview_scheduling",
  "wf_performance_review",
  "wf_internal_communication",
  "wf_hr_helpdesk",
  "wf_disciplinary_case",
  "wf_sensitive_case",
  "wf_compliance_check",
  "wf_reporting",
  "wf_multi_site_coordination",
];

describe("buildWorkflowCoverage", () => {
  it("returns exactly 27 workflows", () => {
    const wf = buildWorkflowCoverage();
    expect(wf).toHaveLength(27);
  });

  it("covers all 27 known workflow IDs", () => {
    const wf = buildWorkflowCoverage();
    const ids = wf.map((w) => w.workflow_id);
    for (const id of ALL_WORKFLOW_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("every workflow has a non-empty label and domain", () => {
    const wf = buildWorkflowCoverage();
    for (const w of wf) {
      expect(w.label.length).toBeGreaterThan(0);
      expect(w.domain.length).toBeGreaterThan(0);
    }
  });

  it("all workflow scores are between 0 and 4", () => {
    const wf = buildWorkflowCoverage();
    for (const w of wf) {
      expect(w.score).toBeGreaterThanOrEqual(0);
      expect(w.score).toBeLessThanOrEqual(4);
    }
  });

  it("status is consistent with score", () => {
    const wf = buildWorkflowCoverage();
    for (const w of wf) {
      if (w.score === 4) expect(w.status).toBe("proven");
      else if (w.score >= 2) expect(["partial", "proven"]).toContain(w.status);
      else if (w.score === 1) expect(["mock_only", "partial"]).toContain(w.status);
      else expect(["gap", "mock_only"]).toContain(w.status);
    }
  });

  it("employee_360 is fully covered (score 4)", () => {
    const wf = buildWorkflowCoverage();
    const emp360 = wf.find((w) => w.workflow_id === "wf_employee_360");
    expect(emp360).toBeDefined();
    expect(emp360!.score).toBe(4);
    expect(emp360!.status).toBe("proven");
  });

  it("sensitive_case is well covered (score >= 3)", () => {
    const wf = buildWorkflowCoverage();
    const sensitive = wf.find((w) => w.workflow_id === "wf_sensitive_case");
    expect(sensitive).toBeDefined();
    expect(sensitive!.score).toBeGreaterThanOrEqual(3);
  });

  it("leave_management, training_plan, reporting, compliance_check have score <= 1", () => {
    const wf = buildWorkflowCoverage();
    const lowScoreIds: PierreWorkflowId[] = ["wf_leave_management", "wf_training_plan", "wf_reporting", "wf_compliance_check"];
    for (const id of lowScoreIds) {
      const w = wf.find((x) => x.workflow_id === id);
      expect(w).toBeDefined();
      expect(w!.score).toBeLessThanOrEqual(1);
    }
  });

  it("golden scenario workflows have test_proof defined", () => {
    const wf = buildWorkflowCoverage();
    const goldenIds: PierreWorkflowId[] = [
      "wf_onboarding_docs",
      "wf_hiring_offer",
      "wf_absence_justify",
      "wf_contract_renewal",
      "wf_trial_activation",
      "wf_payroll_prep",
      "wf_employee_360",
      "wf_sensitive_case",
    ];
    for (const id of goldenIds) {
      const w = wf.find((x) => x.workflow_id === id);
      expect(w).toBeDefined();
      expect(w!.test_proof).not.toBeNull();
    }
  });

  it("all workflows with gaps have at least one gap listed", () => {
    const wf = buildWorkflowCoverage();
    const partial = wf.filter((w) => w.score < 4);
    for (const w of partial) {
      expect(w.gaps.length).toBeGreaterThan(0);
    }
  });

  it("fully covered workflows have no gaps", () => {
    const wf = buildWorkflowCoverage();
    const full = wf.filter((w) => w.score === 4);
    for (const w of full) {
      expect(w.gaps).toHaveLength(0);
    }
  });
});

describe("scoreWorkflowCoverage", () => {
  it("returns consistent totals for current coverage", () => {
    const wf = buildWorkflowCoverage();
    const stats = scoreWorkflowCoverage(wf);
    expect(stats.total_workflows).toBe(27);
    expect(stats.max_score).toBe(27 * 4);
    expect(stats.total_score).toBeGreaterThan(0);
    expect(stats.total_score).toBeLessThanOrEqual(stats.max_score);
  });

  it("coverage_pct is between 40 and 85", () => {
    const wf = buildWorkflowCoverage();
    const stats = scoreWorkflowCoverage(wf);
    expect(stats.coverage_pct).toBeGreaterThanOrEqual(40);
    expect(stats.coverage_pct).toBeLessThanOrEqual(85);
  });

  it("fully_covered + partial + minimal + not_covered === total_workflows", () => {
    const wf = buildWorkflowCoverage();
    const stats = scoreWorkflowCoverage(wf);
    const sum = stats.fully_covered + stats.partial + stats.minimal + stats.not_covered;
    expect(sum).toBe(stats.total_workflows);
  });

  it("fully_covered count matches workflows with score 4", () => {
    const wf = buildWorkflowCoverage();
    const stats = scoreWorkflowCoverage(wf);
    const expected = wf.filter((w) => w.score === 4).length;
    expect(stats.fully_covered).toBe(expected);
  });

  it("at least 1 workflow is fully covered (wf_employee_360)", () => {
    const wf = buildWorkflowCoverage();
    const stats = scoreWorkflowCoverage(wf);
    expect(stats.fully_covered).toBeGreaterThanOrEqual(1);
  });

  it("empty coverage array returns zero scores", () => {
    const stats = scoreWorkflowCoverage([]);
    expect(stats.total_score).toBe(0);
    expect(stats.coverage_pct).toBe(0);
  });
});
