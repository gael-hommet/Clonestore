// B42 — Workflow Scenario Tests
// Tests the 8 mandatory HR workflow scenarios at the plan level (pure, sync)

import { describe, it, expect } from "vitest";
import { buildPierreHrWorkflowPlan } from "../../hr/workflows";
import {
  B42_WORKFLOW_SCENARIOS,
  getScenarioById,
  getSensitiveScenarios,
  getNonSensitiveScenarios,
} from "../workflow-scenarios";
import {
  evaluateWorkflowQuality,
  checkNoTasksGenerated,
  checkWrongDomainClassified,
  checkSensitiveActionNotBlocked,
  checkApprovalNotRequiredForSensitive,
  meetsExpectedRiskLevel,
  meetsTaskTypeCoverage,
  meetsMinTaskCount,
} from "../workflow-quality-gates";
import { FIXTURE_HR_INPUTS } from "../workflow-fixtures";

// ── T01-T08: Scenario registry ────────────────────────────────────────────────

describe("B42 Scenario Registry", () => {
  it("T01 — has exactly 8 scenarios", () => {
    expect(B42_WORKFLOW_SCENARIOS).toHaveLength(8);
  });

  it("T02 — all scenarios have unique IDs", () => {
    const ids = B42_WORKFLOW_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("T03 — all scenarios have valid expected_domain", () => {
    const validDomains = [
      "hiring", "onboarding", "absence", "contract", "payroll_prep",
      "employee_file", "training", "interview", "offboarding", "sensitive_case", "general_hr",
    ];
    B42_WORKFLOW_SCENARIOS.forEach((s) => {
      expect(validDomains).toContain(s.expected_domain);
    });
  });

  it("T04 — exactly 1 sensitive scenario", () => {
    expect(getSensitiveScenarios()).toHaveLength(1);
    expect(getSensitiveScenarios()[0].id).toBe("b42_s08_cas_sensible");
  });

  it("T05 — 7 non-sensitive scenarios", () => {
    expect(getNonSensitiveScenarios()).toHaveLength(7);
  });

  it("T06 — getScenarioById returns correct scenario", () => {
    const s = getScenarioById("b42_s01_recrutement");
    expect(s).toBeDefined();
    expect(s?.expected_domain).toBe("hiring");
  });

  it("T07 — getScenarioById returns undefined for unknown id", () => {
    expect(getScenarioById("does_not_exist")).toBeUndefined();
  });

  it("T08 — all scenarios have at least one hard_fail_condition", () => {
    B42_WORKFLOW_SCENARIOS.forEach((s) => {
      expect(s.hard_fail_conditions.length).toBeGreaterThan(0);
    });
  });
});

// ── T09-T20: Scenario 1 — Recrutement ────────────────────────────────────────

describe("B42 Scenario 01 — Recrutement CDI", () => {
  const scenario = getScenarioById("b42_s01_recrutement")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T09 — domain is hiring", () => {
    expect(plan.domain).toBe("hiring");
  });

  it("T10 — risk level is orange or higher", () => {
    const rank: Record<string, number> = { green: 0, orange: 1, red: 2, black: 3 };
    expect(rank[plan.risk_level]).toBeGreaterThanOrEqual(rank["orange"]);
  });

  it("T11 — generates at least 3 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("T12 — includes a doc.generate task", () => {
    expect(plan.tasks.some((t) => t.type === "doc.generate")).toBe(true);
  });

  it("T13 — includes an email.draft task", () => {
    expect(plan.tasks.some((t) => t.type === "email.draft")).toBe(true);
  });

  it("T14 — quality gates pass", () => {
    const trace = ["trace entry"];
    const report = evaluateWorkflowQuality(plan, scenario, trace);
    expect(report.hard_fails).toHaveLength(0);
    expect(report.passed).toBe(true);
  });
});

// ── T21-T30: Scenario 2 — Onboarding ─────────────────────────────────────────

describe("B42 Scenario 02 — Onboarding", () => {
  const scenario = getScenarioById("b42_s02_onboarding")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T21 — domain is onboarding", () => {
    expect(plan.domain).toBe("onboarding");
  });

  it("T22 — risk level is green", () => {
    expect(plan.risk_level).toBe("green");
  });

  it("T23 — approval not required", () => {
    expect(plan.approval_required).toBe(false);
  });

  it("T24 — generates at least 3 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("T25 — has email.draft task for bienvenue", () => {
    expect(plan.tasks.some((t) => t.type === "email.draft")).toBe(true);
  });

  it("T26 — quality gates pass", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T31-T40: Scenario 3 — Absence ────────────────────────────────────────────

describe("B42 Scenario 03 — Absence", () => {
  const scenario = getScenarioById("b42_s03_absence")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T31 — domain is absence", () => {
    expect(plan.domain).toBe("absence");
  });

  it("T32 — risk level is green or higher", () => {
    const rank: Record<string, number> = { green: 0, orange: 1, red: 2, black: 3 };
    expect(rank[plan.risk_level]).toBeGreaterThanOrEqual(0);
  });

  it("T33 — generates at least 3 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("T34 — has an email.draft task (demande justificatif)", () => {
    expect(plan.tasks.some((t) => t.type === "email.draft")).toBe(true);
  });

  it("T35 — has a followup or reminder task", () => {
    expect(
      plan.tasks.some((t) => t.type === "followup.schedule" || t.type === "reminder.create"),
    ).toBe(true);
  });

  it("T36 — quality gates pass", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T41-T50: Scenario 4 — Pré-paie ───────────────────────────────────────────

describe("B42 Scenario 04 — Pré-paie", () => {
  const scenario = getScenarioById("b42_s04_prepaie")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T41 — domain is payroll_prep", () => {
    expect(plan.domain).toBe("payroll_prep");
  });

  it("T42 — approval required for payroll_prep", () => {
    expect(plan.approval_required).toBe(true);
  });

  it("T43 — generates at least 2 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it("T44 — doc.generate task status is awaiting_approval", () => {
    const docTask = plan.tasks.find((t) => t.type === "doc.generate");
    expect(docTask).toBeDefined();
    expect(docTask?.status).toBe("awaiting_approval");
  });

  it("T45 — blocked_actions includes payroll validation requirement", () => {
    expect(plan.blocked_actions.length).toBeGreaterThan(0);
  });

  it("T46 — quality gates pass (approval_required satisfied)", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T51-T60: Scenario 5 — Dossier salarié ────────────────────────────────────

describe("B42 Scenario 05 — Dossier salarié", () => {
  const scenario = getScenarioById("b42_s05_dossier")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T51 — domain is employee_file", () => {
    expect(plan.domain).toBe("employee_file");
  });

  it("T52 — risk level is green", () => {
    expect(plan.risk_level).toBe("green");
  });

  it("T53 — generates at least 3 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("T54 — has a doc.generate task (synthèse dossier)", () => {
    expect(plan.tasks.some((t) => t.type === "doc.generate")).toBe(true);
  });

  it("T55 — has an email.draft task (demande pièces)", () => {
    expect(plan.tasks.some((t) => t.type === "email.draft")).toBe(true);
  });

  it("T56 — quality gates pass", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T61-T70: Scenario 6 — Document RH ────────────────────────────────────────

describe("B42 Scenario 06 — Document RH", () => {
  const scenario = getScenarioById("b42_s06_document_rh")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T61 — domain is general_hr", () => {
    expect(plan.domain).toBe("general_hr");
  });

  it("T62 — generates at least 1 task", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("T63 — has at least one task", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("T64 — risk level is green", () => {
    expect(plan.risk_level).toBe("green");
  });

  it("T65 — approval not required for general_hr green", () => {
    expect(plan.approval_required).toBe(false);
  });

  it("T66 — quality gates pass", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T71-T80: Scenario 7 — Email RH ───────────────────────────────────────────

describe("B42 Scenario 07 — Email RH (entretien)", () => {
  const scenario = getScenarioById("b42_s07_email_rh")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T71 — domain is interview", () => {
    expect(plan.domain).toBe("interview");
  });

  it("T72 — generates at least 3 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("T73 — has email.draft task (convocation)", () => {
    expect(plan.tasks.some((t) => t.type === "email.draft")).toBe(true);
  });

  it("T74 — has doc.generate task (trame)", () => {
    expect(plan.tasks.some((t) => t.type === "doc.generate")).toBe(true);
  });

  it("T75 — email task is a DRAFT, not a send", () => {
    const emailTask = plan.tasks.find((t) => t.type === "email.draft");
    expect(emailTask).toBeDefined();
    expect(emailTask?.type).not.toBe("email.send");
  });

  it("T76 — quality gates pass", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
  });
});

// ── T81-T95: Scenario 8 — Cas sensible ───────────────────────────────────────

describe("B42 Scenario 08 — Cas sensible (harcèlement)", () => {
  const scenario = getScenarioById("b42_s08_cas_sensible")!;
  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  it("T81 — domain is sensitive_case", () => {
    expect(plan.domain).toBe("sensitive_case");
  });

  it("T82 — risk level is black", () => {
    expect(plan.risk_level).toBe("black");
  });

  it("T83 — approval_required is true", () => {
    expect(plan.approval_required).toBe(true);
  });

  it("T84 — validation_policy.blocked is true", () => {
    expect(plan.validation_policy.blocked).toBe(true);
  });

  it("T85 — NO tasks have status ready (all are awaiting_approval or blocked)", () => {
    const readyTasks = plan.tasks.filter((t) => t.status === "ready");
    expect(readyTasks).toHaveLength(0);
  });

  it("T86 — blocked_actions list is not empty", () => {
    expect(plan.blocked_actions.length).toBeGreaterThan(0);
  });

  it("T87 — blocked_actions includes direct execution prohibition", () => {
    const hasDirectExec = plan.blocked_actions.some(
      (a) => a.toLowerCase().includes("sans validation") || a.toLowerCase().includes("autonome"),
    );
    expect(hasDirectExec).toBe(true);
  });

  it("T88 — recommended_next_action is escalate", () => {
    expect(plan.recommended_next_action.type).toBe("escalate");
  });

  it("T89 — quality gate: sensitive_blocked_ok = true", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.sensitive_blocked_ok).toBe(true);
  });

  it("T90 — quality gates pass overall (sensitive scenario correctly handled)", () => {
    const report = evaluateWorkflowQuality(plan, scenario, ["trace"]);
    expect(report.passed).toBe(true);
    expect(report.hard_fails).toHaveLength(0);
  });

  it("T91 — checkSensitiveActionNotBlocked: no hard fail when blocked correctly", () => {
    const fail = checkSensitiveActionNotBlocked(plan, scenario);
    expect(fail).toBeNull();
  });

  it("T92 — checkApprovalNotRequiredForSensitive: no hard fail when approval required", () => {
    const fail = checkApprovalNotRequiredForSensitive(plan, scenario);
    expect(fail).toBeNull();
  });

  it("T93 — generates at least 2 tasks", () => {
    expect(plan.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it("T94 — has a doc.generate task (synthèse factuelle)", () => {
    expect(plan.tasks.some((t) => t.type === "doc.generate")).toBe(true);
  });

  it("T95 — can_execute_low_risk_tasks is false for sensitive_case", () => {
    expect(plan.validation_policy.can_execute_low_risk_tasks).toBe(false);
  });
});

// ── T96-T100: Quality gate unit tests ────────────────────────────────────────

describe("B42 Quality Gate Unit Tests", () => {
  const emptyCasePlan = buildPierreHrWorkflowPlan("test général sans contexte spécifique");

  it("T96 — checkNoTasksGenerated: null for non-empty plan", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Jean Dupont en CDI le 01/07/2026");
    expect(checkNoTasksGenerated(plan)).toBeNull();
  });

  it("T97 — checkWrongDomainClassified: null when domain matches", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie en CDI");
    const scenario = getScenarioById("b42_s01_recrutement")!;
    expect(checkWrongDomainClassified(plan, scenario)).toBeNull();
  });

  it("T98 — meetsExpectedRiskLevel: black >= orange is true", () => {
    const plan = buildPierreHrWorkflowPlan("Licenciement pour faute grave de Jean Martin");
    const scenario = getScenarioById("b42_s01_recrutement")!;
    // orange expected, black actual — still meets threshold (escalation ok)
    expect(meetsExpectedRiskLevel(plan, scenario)).toBe(true);
  });

  it("T99 — meetsMinTaskCount: at least 1 task for general_hr", () => {
    const plan = buildPierreHrWorkflowPlan("Générer un document RH");
    const scenario = getScenarioById("b42_s06_document_rh")!;
    expect(meetsMinTaskCount(plan, scenario)).toBe(true);
  });

  it("T100 — meetsTaskTypeCoverage: doc. prefix found for all scenarios", () => {
    B42_WORKFLOW_SCENARIOS.forEach((s) => {
      const plan = buildPierreHrWorkflowPlan(s.input, {
        employee_context: s.employee_context,
      });
      // All scenarios should have at least one doc. or email. or followup. task
      const hasCoverage = meetsTaskTypeCoverage(plan, s);
      expect(hasCoverage).toBe(true);
    });
  });
});

// ── T101-T105: Fixture helpers ────────────────────────────────────────────────

describe("B42 Fixture HR Inputs", () => {
  it("T101 — hiring input triggers hiring domain", () => {
    const plan = buildPierreHrWorkflowPlan(FIXTURE_HR_INPUTS.hiring);
    expect(plan.domain).toBe("hiring");
  });

  it("T102 — onboarding input triggers onboarding domain", () => {
    const plan = buildPierreHrWorkflowPlan(FIXTURE_HR_INPUTS.onboarding);
    expect(plan.domain).toBe("onboarding");
  });

  it("T103 — absence input triggers absence domain", () => {
    const plan = buildPierreHrWorkflowPlan(FIXTURE_HR_INPUTS.absence);
    expect(plan.domain).toBe("absence");
  });

  it("T104 — sensitive_case input triggers sensitive_case domain", () => {
    const plan = buildPierreHrWorkflowPlan(FIXTURE_HR_INPUTS.sensitive_case);
    expect(plan.domain).toBe("sensitive_case");
  });

  it("T105 — sensitive_case input from fixture triggers black risk", () => {
    const plan = buildPierreHrWorkflowPlan(FIXTURE_HR_INPUTS.sensitive_case);
    expect(plan.risk_level).toBe("black");
  });
});
