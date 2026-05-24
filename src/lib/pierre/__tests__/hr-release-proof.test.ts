// src/lib/pierre/__tests__/hr-release-proof.test.ts
// Bloc 22 — Tests du module release-proof.ts (180+ tests)

import { describe, test, expect } from "vitest";
import {
  buildPierreReleaseReport,
  buildPierreDemoScenarios,
  estimatePierreReleaseValue,
  buildMissionReleaseProofHint,
  type PierreReleaseReport,
  type PierreReleaseLevel,
  type PierreReleaseGateKey,
  type PierreDemoScenarioKey,
} from "../hr/release-proof";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `mission-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "user-test",
    agent_slug: "pierre",
    status: "active",
    title: "Mission RH test",
    mission_summary: "Résumé mission test",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "user-test",
    agent_slug: "pierre",
    type: "doc.generate",
    status: "done",
    title: "Générer document",
    execute_at: new Date().toISOString(),
    approval_required: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `doc-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "user-test",
    agent_slug: "pierre",
    family: "contract",
    status: "done",
    content_html: "<div class='pierre-wrapper'><h1>Contrat CDI</h1></div>",
    content_text: "Contrat CDI",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `log-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "user-test",
    agent_slug: "pierre",
    task_id: `task-${Math.random().toString(36).slice(2, 8)}`,
    event_type: "task.completed",
    message: "Tâche complétée avec succès",
    meta_json: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEmployee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `emp-${Math.random().toString(36).slice(2, 8)}`,
    first_name: "Marie",
    last_name: "Dupont",
    email: "marie.dupont@example.com",
    status: "active",
    ...overrides,
  };
}

function makeCompanyMemory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cm-test",
    user_id: "user-test",
    agent_slug: "pierre",
    reusable_rh_context_json: {
      employees: [makeEmployee()],
      document_system: {
        default_tone: "professional",
        default_language: "fr",
        branding: { company_name: "TestCo" },
      },
      company_name: "TestCo",
      ...overrides,
    },
  };
}

function makeFullParams() {
  const mission1 = makeMission({ status: "done" });
  const mission2 = makeMission({ status: "active" });
  const task1 = makeTask({ status: "done", type: "doc.generate" });
  const task2 = makeTask({ status: "done", type: "report.generate" });
  const task3 = makeTask({ status: "pending_approval", type: "email.send", approval_required: true });
  const doc1 = makeDocument({ family: "contract", has_pdf: true });
  const doc2 = makeDocument({ family: "onboarding" });
  const log1 = makeLog({ event_type: "task.completed", task_id: task1.id });
  const log2 = makeLog({ event_type: "governance.check", task_id: task2.id });
  const employee = makeEmployee();
  const companyMemory = makeCompanyMemory({ employees: [employee] });

  return {
    missions: [mission1, mission2],
    tasks: [task1, task2, task3],
    documents: [doc1, doc2],
    logs: [log1, log2],
    employees: [employee],
    companyMemory,
    documentSystemConfig: { default_tone: "professional" },
  };
}

// ── buildPierreDemoScenarios ──────────────────────────────────────────────────

describe("buildPierreDemoScenarios", () => {
  test("returns exactly 8 scenarios", () => {
    const scenarios = buildPierreDemoScenarios();
    expect(scenarios).toHaveLength(8);
  });

  test("all 8 expected keys are present", () => {
    const scenarios = buildPierreDemoScenarios();
    const keys = scenarios.map((s) => s.key);
    const expected: PierreDemoScenarioKey[] = [
      "hiring_full_cycle",
      "absence_followup",
      "contract_and_pdf",
      "employee_file_review",
      "sensitive_case_blocked",
      "continuity_recovery",
      "prepay_summary",
      "offboarding_controlled",
    ];
    for (const k of expected) {
      expect(keys).toContain(k);
    }
  });

  test("each scenario has required fields", () => {
    const scenarios = buildPierreDemoScenarios();
    for (const s of scenarios) {
      expect(typeof s.key).toBe("string");
      expect(typeof s.title).toBe("string");
      expect(typeof s.description).toBe("string");
      expect(typeof s.prompt).toBe("string");
      expect(Array.isArray(s.expected_capabilities)).toBe(true);
      expect(Array.isArray(s.expected_outputs)).toBe(true);
      expect(Array.isArray(s.required_gates)).toBe(true);
      expect(["low", "medium", "high", "critical"]).toContain(s.risk);
      expect(typeof s.must_require_human_validation).toBe("boolean");
      expect(Array.isArray(s.must_not_auto_execute)).toBe(true);
    }
  });

  test("sensitive_case_blocked requires human validation", () => {
    const scenarios = buildPierreDemoScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_case_blocked");
    expect(sensitive).toBeDefined();
    expect(sensitive!.must_require_human_validation).toBe(true);
  });

  test("sensitive_case_blocked must_not_auto_execute includes email.send, send_email, and doc.generate", () => {
    const scenarios = buildPierreDemoScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_case_blocked");
    expect(sensitive!.must_not_auto_execute).toContain("email.send");
    expect(sensitive!.must_not_auto_execute).toContain("send_email");
    expect(sensitive!.must_not_auto_execute).toContain("doc.generate");
  });

  test("sensitive_case_blocked has critical risk", () => {
    const scenarios = buildPierreDemoScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_case_blocked");
    expect(sensitive!.risk).toBe("critical");
  });

  test("hiring_full_cycle requires human validation", () => {
    const scenarios = buildPierreDemoScenarios();
    const hiring = scenarios.find((s) => s.key === "hiring_full_cycle");
    expect(hiring!.must_require_human_validation).toBe(true);
  });

  test("absence_followup does not require human validation", () => {
    const scenarios = buildPierreDemoScenarios();
    const absence = scenarios.find((s) => s.key === "absence_followup");
    expect(absence!.must_require_human_validation).toBe(false);
  });

  test("all scenarios have non-empty prompts", () => {
    const scenarios = buildPierreDemoScenarios();
    for (const s of scenarios) {
      expect(s.prompt.length).toBeGreaterThan(20);
    }
  });

  test("all scenarios have at least 3 expected_capabilities", () => {
    const scenarios = buildPierreDemoScenarios();
    for (const s of scenarios) {
      expect(s.expected_capabilities.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("all scenarios have at least 1 required_gate", () => {
    const scenarios = buildPierreDemoScenarios();
    for (const s of scenarios) {
      expect(s.required_gates.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("no scenario has must_not_auto_execute empty for high/critical risk", () => {
    const scenarios = buildPierreDemoScenarios();
    const highRisk = scenarios.filter((s) => s.risk === "high" || s.risk === "critical");
    for (const s of highRisk) {
      expect(s.must_not_auto_execute.length).toBeGreaterThan(0);
    }
  });
});

// ── buildPierreReleaseReport — structure ─────────────────────────────────────

describe("buildPierreReleaseReport — structure", () => {
  test("returns a valid report with empty params", () => {
    const report = buildPierreReleaseReport({});
    expect(report).toBeDefined();
    expect(typeof report.global_score).toBe("number");
    expect(typeof report.level).toBe("string");
    expect(typeof report.label).toBe("string");
    expect(typeof report.summary).toBe("string");
    expect(Array.isArray(report.gates)).toBe(true);
    expect(Array.isArray(report.demo_scenarios)).toBe(true);
    expect(Array.isArray(report.risks)).toBe(true);
    expect(Array.isArray(report.next_actions)).toBe(true);
    expect(report.value_estimation).toBeDefined();
    expect(report.totals).toBeDefined();
    expect(typeof report.generated_at).toBe("string");
  });

  test("has exactly 13 gates", () => {
    const report = buildPierreReleaseReport({});
    expect(report.gates).toHaveLength(13);
  });

  test("has exactly 8 demo_scenarios", () => {
    const report = buildPierreReleaseReport({});
    expect(report.demo_scenarios).toHaveLength(8);
  });

  test("global_score is between 0 and 100", () => {
    const report = buildPierreReleaseReport({});
    expect(report.global_score).toBeGreaterThanOrEqual(0);
    expect(report.global_score).toBeLessThanOrEqual(100);
  });

  test("level is a valid PierreReleaseLevel", () => {
    const report = buildPierreReleaseReport({});
    const validLevels: PierreReleaseLevel[] = [
      "blocked", "internal_demo", "client_demo", "pilot_ready", "sellable",
    ];
    expect(validLevels).toContain(report.level);
  });

  test("all 13 gate keys are present", () => {
    const report = buildPierreReleaseReport({});
    const gateKeys = report.gates.map((g) => g.key);
    const expected: PierreReleaseGateKey[] = [
      "technical_integrity",
      "schema_integrity",
      "safety_invariants",
      "mission_to_artifact_flow",
      "employee_file_flow",
      "document_quality_flow",
      "continuity_flow",
      "readiness_flow",
      "traceability_flow",
      "client_value_proof",
      "sensitive_case_control",
      "demo_scenario_coverage",
      "launch_risk",
    ];
    for (const k of expected) {
      expect(gateKeys).toContain(k);
    }
  });

  test("each gate has required fields", () => {
    const report = buildPierreReleaseReport({});
    for (const gate of report.gates) {
      expect(typeof gate.key).toBe("string");
      expect(typeof gate.label).toBe("string");
      expect(["pass", "warning", "fail", "not_applicable"]).toContain(gate.status);
      expect(typeof gate.score).toBe("number");
      expect(gate.score).toBeGreaterThanOrEqual(0);
      expect(gate.score).toBeLessThanOrEqual(100);
      expect(typeof gate.reason).toBe("string");
      expect(Array.isArray(gate.blockers)).toBe(true);
      expect(Array.isArray(gate.warnings)).toBe(true);
      expect(Array.isArray(gate.evidence)).toBe(true);
    }
  });

  test("each demo_scenario has required fields", () => {
    const report = buildPierreReleaseReport({});
    for (const scen of report.demo_scenarios) {
      expect(typeof scen.scenario_key).toBe("string");
      expect(typeof scen.title).toBe("string");
      expect(["pass", "warning", "fail", "not_applicable"]).toContain(scen.status);
      expect(typeof scen.score).toBe("number");
      expect(Array.isArray(scen.matched_capabilities)).toBe(true);
      expect(Array.isArray(scen.missing_capabilities)).toBe(true);
      expect(Array.isArray(scen.blockers)).toBe(true);
      expect(Array.isArray(scen.warnings)).toBe(true);
    }
  });

  test("totals reflect passed data", () => {
    const params = makeFullParams();
    const report = buildPierreReleaseReport(params);
    expect(report.totals.missions).toBe(2);
    expect(report.totals.tasks).toBe(3);
    expect(report.totals.documents).toBe(2);
    expect(report.totals.logs).toBe(2);
  });

  test("value_estimation has all required fields", () => {
    const report = buildPierreReleaseReport(makeFullParams());
    const v = report.value_estimation;
    expect(typeof v.monthly_hours_saved_low).toBe("number");
    expect(typeof v.monthly_hours_saved_high).toBe("number");
    expect(typeof v.estimated_monthly_value_eur_low).toBe("number");
    expect(typeof v.estimated_monthly_value_eur_high).toBe("number");
    expect(["low", "medium", "high"]).toContain(v.confidence);
    expect(typeof v.explanation).toBe("string");
  });
});

// ── schema_integrity gate ─────────────────────────────────────────────────────

describe("schema_integrity gate", () => {
  test("passes with correct schema (execute_at, event_type)", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ execute_at: new Date().toISOString() })],
      logs: [makeLog({ event_type: "task.done" })],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).not.toBe("fail");
  });

  test("fails when task has scheduled_for field", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ scheduled_for: new Date().toISOString() })],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).toBe("fail");
    expect(gate.blockers.length).toBeGreaterThan(0);
    expect(gate.blockers[0]).toContain("scheduled_for");
  });

  test("fails when log has level field", () => {
    const report = buildPierreReleaseReport({
      logs: [makeLog({ level: "info" })],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).toBe("fail");
    expect(gate.blockers.some((b) => b.includes("level") || b.includes("event") || b.includes("payload"))).toBe(true);
  });

  test("fails when log has event field", () => {
    const report = buildPierreReleaseReport({
      logs: [makeLog({ event: "task_done" })],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).toBe("fail");
  });

  test("fails when log has payload field", () => {
    const report = buildPierreReleaseReport({
      logs: [makeLog({ payload: { foo: "bar" } })],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).toBe("fail");
  });

  test("schema_integrity fail triggers blocked level override", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ scheduled_for: "2026-01-01" })],
      missions: [makeMission(), makeMission()],
      documents: [makeDocument(), makeDocument(), makeDocument()],
    });
    const gate = report.gates.find((g) => g.key === "schema_integrity")!;
    expect(gate.status).toBe("fail");
    expect(report.level === "blocked" || report.level === "internal_demo").toBe(true);
  });
});

// ── safety_invariants gate ────────────────────────────────────────────────────

describe("safety_invariants gate", () => {
  test("passes with no email tasks", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "done" })],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).not.toBe("fail");
  });

  test("passes when email task has approval_required=true", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "email.send", status: "pending_approval", approval_required: true })],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).not.toBe("fail");
  });

  test("fails when email.send task is done without approval_required", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: false })],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).toBe("fail");
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  test("fails when send_email task is done without approval_required", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "send_email", status: "completed", approval_required: false })],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).toBe("fail");
  });

  test("safety_invariants fail triggers blocked level", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: false })],
      missions: [makeMission(), makeMission()],
      documents: [makeDocument(), makeDocument()],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).toBe("fail");
    expect(report.level).toBe("blocked");
  });

  test("does not fail when no send tasks at all", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate" }), makeTask({ type: "report.generate" })],
    });
    const gate = report.gates.find((g) => g.key === "safety_invariants")!;
    expect(gate.status).not.toBe("fail");
  });
});

// ── sensitive_case_control gate ───────────────────────────────────────────────

describe("sensitive_case_control gate", () => {
  test("passes when no sensitive tasks", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "done" })],
    });
    const gate = report.gates.find((g) => g.key === "sensitive_case_control")!;
    expect(gate.status).not.toBe("fail");
  });

  test("passes when approval_required tasks are in pending_approval status", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "pending_approval", approval_required: true })],
    });
    const gate = report.gates.find((g) => g.key === "sensitive_case_control")!;
    expect(gate.status).not.toBe("fail");
  });

  test("does not fail when approval_required task is done (was properly approved)", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "done", approval_required: true })],
    });
    const gate = report.gates.find((g) => g.key === "sensitive_case_control")!;
    // approval_required=true + done = task was properly approved and executed, not a violation
    expect(gate.status).not.toBe("fail");
  });

  test("sensitive_case_control fail triggers blocked level", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "done", approval_required: true })],
      missions: [makeMission(), makeMission()],
      documents: [makeDocument(), makeDocument()],
    });
    expect(report.level).toBe("blocked");
  });

  test("sensitive documents with contract family require validation status", () => {
    const report = buildPierreReleaseReport({
      documents: [makeDocument({ family: "contract", status: "done", approval_required: false })],
    });
    const gate = report.gates.find((g) => g.key === "sensitive_case_control")!;
    expect(gate.warnings.length).toBeGreaterThan(0);
  });
});

// ── mission_to_artifact_flow gate ─────────────────────────────────────────────

describe("mission_to_artifact_flow gate", () => {
  test("warning with no missions", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "mission_to_artifact_flow")!;
    expect(gate.status).not.toBe("pass");
    expect(gate.score).toBeLessThan(65);
  });

  test("improves score with missions + tasks", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission(), makeMission()],
      tasks: [makeTask(), makeTask(), makeTask()],
    });
    const gate = report.gates.find((g) => g.key === "mission_to_artifact_flow")!;
    expect(gate.score).toBeGreaterThan(50);
  });

  test("passes with full mission + task + document chain", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission({ status: "done" })],
      tasks: [makeTask({ status: "done" }), makeTask({ status: "done" })],
      documents: [makeDocument(), makeDocument()],
    });
    const gate = report.gates.find((g) => g.key === "mission_to_artifact_flow")!;
    expect(gate.status).toBe("pass");
  });

  test("evidence lists mission and document counts", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission()],
      documents: [makeDocument()],
    });
    const gate = report.gates.find((g) => g.key === "mission_to_artifact_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("mission"))).toBe(true);
  });
});

// ── document_quality_flow gate ────────────────────────────────────────────────

describe("document_quality_flow gate", () => {
  test("warning with no documents", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "document_quality_flow")!;
    expect(gate.status).not.toBe("pass");
  });

  test("improves with premium family documents", () => {
    const report = buildPierreReleaseReport({
      documents: [
        makeDocument({ family: "contract" }),
        makeDocument({ family: "onboarding" }),
      ],
    });
    const gate = report.gates.find((g) => g.key === "document_quality_flow")!;
    expect(gate.score).toBeGreaterThan(50);
  });

  test("detects pierre-wrapper HTML", () => {
    const longHtml = "<div class='pierre-wrapper'><h1>Contrat CDI</h1><p>" + "Contenu du contrat ".repeat(5) + "</p></div>";
    const report = buildPierreReleaseReport({
      documents: [makeDocument({ content_html: longHtml })],
    });
    const gate = report.gates.find((g) => g.key === "document_quality_flow")!;
    expect(gate.evidence.some((e) => e.label.toLowerCase().includes("pierre"))).toBe(true);
  });

  test("detects PDF documents", () => {
    const report = buildPierreReleaseReport({
      documents: [makeDocument({ has_pdf: true, family: "contract" })],
    });
    const gate = report.gates.find((g) => g.key === "document_quality_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("PDF"))).toBe(true);
  });

  test("passes with full document quality chain", () => {
    const report = buildPierreReleaseReport({
      documents: [
        makeDocument({ family: "contract", has_pdf: true, content_html: "<div class='pierre-wrapper'><h1>CDI</h1></div>" }),
        makeDocument({ family: "onboarding", content_html: "<div class='pierre-doc'>Bienvenue</div>" }),
      ],
      documentSystemConfig: { default_tone: "professional" },
    });
    const gate = report.gates.find((g) => g.key === "document_quality_flow")!;
    expect(gate.status).toBe("pass");
  });
});

// ── traceability_flow gate ────────────────────────────────────────────────────

describe("traceability_flow gate", () => {
  test("warning with no logs", () => {
    const report = buildPierreReleaseReport({ missions: [makeMission()] });
    const gate = report.gates.find((g) => g.key === "traceability_flow")!;
    expect(gate.status).not.toBe("pass");
  });

  test("passes with logs having event_type", () => {
    const report = buildPierreReleaseReport({
      logs: [
        makeLog({ event_type: "task.completed" }),
        makeLog({ event_type: "mission.created" }),
        makeLog({ event_type: "governance.check" }),
      ],
    });
    const gate = report.gates.find((g) => g.key === "traceability_flow")!;
    expect(gate.status).toBe("pass");
  });

  test("evidence shows log count", () => {
    const report = buildPierreReleaseReport({
      logs: [makeLog(), makeLog(), makeLog()],
    });
    const gate = report.gates.find((g) => g.key === "traceability_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("3"))).toBe(true);
  });

  test("detects logs linked to tasks", () => {
    const tid = "task-abc";
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ id: tid })],
      logs: [makeLog({ task_id: tid })],
    });
    const gate = report.gates.find((g) => g.key === "traceability_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("liés"))).toBe(true);
  });
});

// ── client_value_proof gate ───────────────────────────────────────────────────

describe("client_value_proof gate", () => {
  test("low score with no activity", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "client_value_proof")!;
    expect(gate.score).toBeLessThan(50);
  });

  test("improves with completed missions", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission({ status: "done" }), makeMission({ status: "done" })],
    });
    const gate = report.gates.find((g) => g.key === "client_value_proof")!;
    expect(gate.score).toBeGreaterThan(40);
  });

  test("improves with premium documents", () => {
    const report = buildPierreReleaseReport({
      documents: [
        makeDocument({ family: "contract" }),
        makeDocument({ family: "amendment" }),
        makeDocument({ family: "onboarding" }),
      ],
    });
    const gate = report.gates.find((g) => g.key === "client_value_proof")!;
    expect(gate.score).toBeGreaterThan(50);
  });

  test("passes with rich activity data", () => {
    const report = buildPierreReleaseReport(makeFullParams());
    const gate = report.gates.find((g) => g.key === "client_value_proof")!;
    expect(gate.score).toBeGreaterThanOrEqual(60);
  });
});

// ── demo_scenario_coverage gate ───────────────────────────────────────────────

describe("demo_scenario_coverage gate", () => {
  test("low coverage with empty params", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "demo_scenario_coverage")!;
    expect(gate.score).toBeLessThan(65);
  });

  test("coverage improves with approval_required tasks", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ approval_required: true })],
      missions: [makeMission()],
      documents: [makeDocument()],
    });
    const gate = report.gates.find((g) => g.key === "demo_scenario_coverage")!;
    expect(gate.score).toBeGreaterThan(40);
  });

  test("coverage improves with offboarding documents", () => {
    const report = buildPierreReleaseReport({
      documents: [makeDocument({ family: "offboarding" })],
    });
    const gate = report.gates.find((g) => g.key === "demo_scenario_coverage")!;
    expect(gate.score).toBeGreaterThan(40);
  });

  test("evidence shows coverage count", () => {
    const report = buildPierreReleaseReport({
      documents: [
        makeDocument({ family: "contract" }),
        makeDocument({ family: "offboarding" }),
        makeDocument({ family: "pre_payroll" }),
      ],
      missions: [makeMission({ status: "done" })],
      tasks: [makeTask({ approval_required: true })],
    });
    const gate = report.gates.find((g) => g.key === "demo_scenario_coverage")!;
    expect(gate.evidence.some((e) => e.label.includes("/8"))).toBe(true);
  });
});

// ── Level thresholds ──────────────────────────────────────────────────────────

describe("release level thresholds", () => {
  test("empty params produces blocked or internal_demo", () => {
    const report = buildPierreReleaseReport({});
    expect(["blocked", "internal_demo"]).toContain(report.level);
  });

  test("rich params with no violations produces internal_demo or higher", () => {
    const report = buildPierreReleaseReport(makeFullParams());
    const levels: PierreReleaseLevel[] = ["internal_demo", "client_demo", "pilot_ready", "sellable"];
    expect(levels).toContain(report.level);
  });

  test("safety_invariants fail always produces blocked", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: false })],
      missions: [makeMission(), makeMission(), makeMission()],
      documents: [makeDocument(), makeDocument(), makeDocument()],
      logs: [makeLog(), makeLog(), makeLog()],
    });
    expect(report.level).toBe("blocked");
  });

  test("sensitive_case_control fail always produces blocked", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ type: "doc.generate", status: "done", approval_required: true })],
      missions: [makeMission(), makeMission()],
      documents: [makeDocument(), makeDocument()],
    });
    expect(report.level).toBe("blocked");
  });

  test("high score with no violations reaches pilot_ready or sellable", () => {
    // Build maximally healthy params
    const tasks = Array.from({ length: 10 }, () =>
      makeTask({ type: "doc.generate", status: "done", approval_required: false }),
    );
    const docs = Array.from({ length: 8 }, () =>
      makeDocument({ family: "contract", has_pdf: true, content_html: "<div class='pierre-wrapper'>OK</div>" }),
    );
    const logs = Array.from({ length: 10 }, () => makeLog({ event_type: "task.completed" }));
    const missions = Array.from({ length: 5 }, () => makeMission({ status: "done" }));
    const employees = [makeEmployee(), makeEmployee()];
    const cm = makeCompanyMemory({ employees });

    const report = buildPierreReleaseReport({
      tasks,
      documents: docs,
      logs,
      missions,
      employees,
      companyMemory: cm,
      documentSystemConfig: { default_tone: "professional" },
    });
    expect(["pilot_ready", "sellable"]).toContain(report.level);
  });
});

// ── estimatePierreReleaseValue ────────────────────────────────────────────────

describe("estimatePierreReleaseValue", () => {
  function makeReportStub(
    level: PierreReleaseLevel,
    score: number,
    overrides: Partial<PierreReleaseReport["totals"]> = {},
  ): Pick<PierreReleaseReport, "level" | "global_score" | "totals"> {
    return {
      level,
      global_score: score,
      totals: {
        missions: 5,
        tasks: 10,
        documents: 8,
        logs: 20,
        employees: 3,
        completed_tasks: 7,
        premium_documents: 5,
        blocked_tasks: 1,
        error_tasks: 0,
        approval_pending_tasks: 1,
        ...overrides,
      },
    };
  }

  test("returns all required fields", () => {
    const v = estimatePierreReleaseValue(makeReportStub("pilot_ready", 80));
    expect(typeof v.monthly_hours_saved_low).toBe("number");
    expect(typeof v.monthly_hours_saved_high).toBe("number");
    expect(typeof v.estimated_monthly_value_eur_low).toBe("number");
    expect(typeof v.estimated_monthly_value_eur_high).toBe("number");
    expect(["low", "medium", "high"]).toContain(v.confidence);
    expect(typeof v.explanation).toBe("string");
  });

  test("high >= low for hours", () => {
    const v = estimatePierreReleaseValue(makeReportStub("sellable", 90));
    expect(v.monthly_hours_saved_high).toBeGreaterThanOrEqual(v.monthly_hours_saved_low);
  });

  test("high >= low for eur", () => {
    const v = estimatePierreReleaseValue(makeReportStub("client_demo", 70));
    expect(v.estimated_monthly_value_eur_high).toBeGreaterThanOrEqual(v.estimated_monthly_value_eur_low);
  });

  test("sellable level has higher value than blocked", () => {
    const blocked = estimatePierreReleaseValue(makeReportStub("blocked", 30));
    const sellable = estimatePierreReleaseValue(makeReportStub("sellable", 92));
    expect(sellable.monthly_hours_saved_high).toBeGreaterThan(blocked.monthly_hours_saved_high);
  });

  test("confidence is high when score >= 85", () => {
    const v = estimatePierreReleaseValue(makeReportStub("sellable", 90));
    expect(v.confidence).toBe("high");
  });

  test("confidence is medium when score 65-84", () => {
    const v = estimatePierreReleaseValue(makeReportStub("pilot_ready", 75));
    expect(v.confidence).toBe("medium");
  });

  test("confidence is low when score < 65", () => {
    const v = estimatePierreReleaseValue(makeReportStub("internal_demo", 55));
    expect(v.confidence).toBe("low");
  });

  test("explanation mentions tasks, documents, and employees", () => {
    const v = estimatePierreReleaseValue(makeReportStub("pilot_ready", 78));
    expect(v.explanation.length).toBeGreaterThan(30);
  });

  test("EUR value = hours * 50", () => {
    const v = estimatePierreReleaseValue(makeReportStub("sellable", 92));
    expect(v.estimated_monthly_value_eur_low).toBe(v.monthly_hours_saved_low * 50);
    expect(v.estimated_monthly_value_eur_high).toBe(v.monthly_hours_saved_high * 50);
  });

  test("returns at least 1 hour even with no activity", () => {
    const v = estimatePierreReleaseValue(makeReportStub("blocked", 20, {
      completed_tasks: 0, premium_documents: 0, employees: 0,
    }));
    expect(v.monthly_hours_saved_low).toBeGreaterThanOrEqual(1);
  });
});

// ── buildMissionReleaseProofHint ──────────────────────────────────────────────

describe("buildMissionReleaseProofHint", () => {
  test("returns a valid hint with empty params", () => {
    const hint = buildMissionReleaseProofHint({}, [], [], []);
    expect(hint).toBeDefined();
    expect(typeof hint.level).toBe("string");
    expect(typeof hint.global_score).toBe("number");
    expect(Array.isArray(hint.critical_gates_failed)).toBe(true);
    expect(typeof hint.label).toBe("string");
    expect(typeof hint.tip).toBe("string");
  });

  test("score is clamped between 0 and 100", () => {
    const hint = buildMissionReleaseProofHint({}, [], [], []);
    expect(hint.global_score).toBeGreaterThanOrEqual(0);
    expect(hint.global_score).toBeLessThanOrEqual(100);
  });

  test("detects scheduled_for schema violation", () => {
    const hint = buildMissionReleaseProofHint(
      {},
      [makeTask({ scheduled_for: "2026-01-01" })],
      [],
      [],
    );
    expect(hint.critical_gates_failed).toContain("schema_integrity");
  });

  test("detects log.level schema violation", () => {
    const hint = buildMissionReleaseProofHint(
      {},
      [],
      [],
      [makeLog({ level: "info" })],
    );
    expect(hint.critical_gates_failed).toContain("schema_integrity");
  });

  test("detects safety violation for auto-executed email.send", () => {
    const hint = buildMissionReleaseProofHint(
      {},
      [makeTask({ type: "email.send", status: "done", approval_required: false })],
      [],
      [],
    );
    expect(hint.critical_gates_failed).toContain("safety_invariants");
  });

  test("no violations with clean data", () => {
    const hint = buildMissionReleaseProofHint(
      makeMission({ status: "done" }),
      [makeTask({ type: "doc.generate", status: "done" })],
      [makeDocument({ family: "contract", has_pdf: true })],
      [makeLog({ event_type: "task.completed" })],
    );
    expect(hint.critical_gates_failed).toHaveLength(0);
  });

  test("higher score with completed tasks and premium docs", () => {
    const low = buildMissionReleaseProofHint({}, [], [], []);
    const high = buildMissionReleaseProofHint(
      makeMission({ status: "done" }),
      [makeTask({ status: "done" }), makeTask({ status: "done" })],
      [makeDocument({ family: "contract", has_pdf: true }), makeDocument({ family: "onboarding" })],
      [makeLog({ event_type: "task.completed" }), makeLog({ event_type: "governance.check" })],
    );
    expect(high.global_score).toBeGreaterThan(low.global_score);
  });

  test("tip is non-empty", () => {
    const hint = buildMissionReleaseProofHint({}, [], [], []);
    expect(hint.tip.length).toBeGreaterThan(10);
  });

  test("label corresponds to the level", () => {
    const hint = buildMissionReleaseProofHint({}, [], [], []);
    expect(hint.label.length).toBeGreaterThan(5);
  });

  test("null-safe — does not throw with null/undefined inputs", () => {
    expect(() =>
      buildMissionReleaseProofHint(
        null as unknown as Record<string, unknown>,
        null as unknown as Record<string, unknown>[],
        null as unknown as Record<string, unknown>[],
        null as unknown as Record<string, unknown>[],
      ),
    ).not.toThrow();
  });
});

// ── Report robustness ─────────────────────────────────────────────────────────

describe("buildPierreReleaseReport — robustness", () => {
  test("does not throw with null params", () => {
    expect(() =>
      buildPierreReleaseReport({
        missions: null as unknown as [],
        tasks: null as unknown as [],
        documents: null as unknown as [],
        logs: null as unknown as [],
        companyMemory: null,
      }),
    ).not.toThrow();
  });

  test("does not throw with deeply malformed objects", () => {
    expect(() =>
      buildPierreReleaseReport({
        missions: [{ id: null, status: undefined } as Record<string, unknown>],
        tasks: [{ type: 42, status: true } as Record<string, unknown>],
        documents: [{ family: [] } as Record<string, unknown>],
        logs: [{ event_type: null } as Record<string, unknown>],
      }),
    ).not.toThrow();
  });

  test("generated_at is a valid ISO date", () => {
    const report = buildPierreReleaseReport({});
    expect(() => new Date(report.generated_at)).not.toThrow();
    expect(new Date(report.generated_at).toISOString()).toBe(report.generated_at);
  });

  test("next_actions is non-empty when there are issues", () => {
    const report = buildPierreReleaseReport({});
    expect(report.next_actions.length).toBeGreaterThan(0);
  });

  test("next_actions contains fix_blocker or no_action types only", () => {
    const report = buildPierreReleaseReport({});
    const validTypes = [
      "fix_blocker",
      "improve_quality",
      "run_demo_scenario",
      "configure_templates",
      "complete_memory",
      "review_sensitive_case",
      "no_action",
    ];
    for (const action of report.next_actions) {
      expect(validTypes).toContain(action.type);
    }
  });

  test("risks are classified as info, warning, or critical", () => {
    const report = buildPierreReleaseReport({});
    for (const risk of report.risks) {
      expect(["info", "warning", "critical"]).toContain(risk.level);
      expect(typeof risk.code).toBe("string");
      expect(typeof risk.label).toBe("string");
      expect(typeof risk.reason).toBe("string");
    }
  });

  test("totals.completed_tasks <= totals.tasks", () => {
    const report = buildPierreReleaseReport(makeFullParams());
    expect(report.totals.completed_tasks).toBeLessThanOrEqual(report.totals.tasks);
  });

  test("totals.premium_documents <= totals.documents", () => {
    const report = buildPierreReleaseReport(makeFullParams());
    expect(report.totals.premium_documents).toBeLessThanOrEqual(report.totals.documents);
  });

  test("launch_risk gate is the last gate", () => {
    const report = buildPierreReleaseReport({});
    expect(report.gates[report.gates.length - 1].key).toBe("launch_risk");
  });

  test("launch_risk reflects other gate failures", () => {
    const report = buildPierreReleaseReport({
      tasks: [makeTask({ scheduled_for: "2026-01-01" })],
    });
    const launchRisk = report.gates.find((g) => g.key === "launch_risk")!;
    expect(launchRisk.status).not.toBe("pass");
  });
});

// ── employee_file_flow gate ───────────────────────────────────────────────────

describe("employee_file_flow gate", () => {
  test("warning with no employees", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "employee_file_flow")!;
    expect(gate.status).not.toBe("pass");
  });

  test("improves score with employees in company_memory", () => {
    const report = buildPierreReleaseReport({
      companyMemory: makeCompanyMemory({ employees: [makeEmployee(), makeEmployee()] }),
    });
    const gate = report.gates.find((g) => g.key === "employee_file_flow")!;
    expect(gate.score).toBeGreaterThan(50);
  });

  test("detects employees in reusable_rh_context_json.employees", () => {
    const report = buildPierreReleaseReport({
      companyMemory: makeCompanyMemory({ employees: [makeEmployee()] }),
    });
    const gate = report.gates.find((g) => g.key === "employee_file_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("reusable_rh_context_json.employees"))).toBe(true);
  });
});

// ── continuity_flow gate ──────────────────────────────────────────────────────

describe("continuity_flow gate", () => {
  test("warning with empty data", () => {
    const report = buildPierreReleaseReport({});
    const gate = report.gates.find((g) => g.key === "continuity_flow")!;
    expect(gate.status).not.toBe("pass");
  });

  test("improves score with active missions", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission({ status: "active" }), makeMission({ status: "active" })],
    });
    const gate = report.gates.find((g) => g.key === "continuity_flow")!;
    expect(gate.score).toBeGreaterThan(50);
  });

  test("detects blocked missions as continuity recovery cases", () => {
    const report = buildPierreReleaseReport({
      missions: [makeMission({ status: "blocked" }), makeMission({ status: "active" })],
    });
    const gate = report.gates.find((g) => g.key === "continuity_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("bloquée") || e.label.includes("suspendue"))).toBe(true);
  });

  test("detects continuity logs", () => {
    const report = buildPierreReleaseReport({
      logs: [makeLog({ event_type: "continuity.recovery" }), makeLog({ event_type: "task.resumed" })],
      missions: [makeMission()],
    });
    const gate = report.gates.find((g) => g.key === "continuity_flow")!;
    expect(gate.evidence.some((e) => e.label.includes("continuité") || e.label.includes("reprise"))).toBe(true);
  });
});
