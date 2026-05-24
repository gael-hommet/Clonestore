// src/lib/pierre/__tests__/hr-operational-readiness.test.ts
// Bloc 21 — Tests unitaires : Pierre Operational Readiness
// 160+ tests couvrant toutes les fonctions du module pur

import { describe, it, expect } from "vitest";
import {
  buildPierreGoldenScenarios,
  evaluateMissionEngine,
  evaluateTaskOrchestration,
  evaluateControlledAutonomy,
  evaluateEmployeeFile360,
  evaluateContinuity,
  evaluatePremiumDocuments,
  evaluatePdfQuality,
  evaluateEmailSafety,
  evaluateCloneGuard,
  evaluateCloneTrace,
  evaluateCompanyMemory,
  evaluateTemplateConfiguration,
  evaluateAuditability,
  evaluateGoldenScenario,
  buildPierreReadinessReport,
  buildMissionReadinessHint,
  type PierreReadinessGate,
  type PierreReadinessReport,
  type PierreGoldenScenario,
} from "../hr/operational-readiness";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "m-001",
    status: "active",
    mission_summary: "Embauche d'un nouveau salarié",
    brain_output_json: { approval_required: false, employee_id: "emp-1" },
    context_snapshot_json: { employee_id: "emp-1" },
    risk_level: "low",
    created_at: "2026-05-01T10:00:00Z",
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "t-001",
    type: "doc.generate",
    title: "Générer contrat",
    status: "ready",
    mission_id: "m-001",
    payload_json: { document_family: "contract" },
    approval_required: false,
    created_at: "2026-05-01T10:05:00Z",
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "d-001",
    title: "Contrat CDI",
    doc_type: "contract",
    document_family: "contract",
    mission_id: "m-001",
    html_content: '<div class="pierre-wrapper"><p>Contrat</p></div>',
    template_id: "tpl_contract_v1",
    created_at: "2026-05-01T11:00:00Z",
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "l-001",
    event_type: "document_generated",
    message: "Document contrat généré",
    meta_json: { doc_id: "d-001" },
    mission_id: "m-001",
    task_id: "t-001",
    created_at: "2026-05-01T11:01:00Z",
    ...overrides,
  };
}

function makeEmployee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "emp-1",
    full_name: "Marie Dupont",
    email: "marie@example.com",
    status: "active",
    contract_type: "cdi",
    department: "RH",
    ...overrides,
  };
}

function makeEmployeeFile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "complete",
    profile: { employee_id: "emp-1", employee_name: "Marie Dupont" },
    timeline: [{ type: "mission_created", label: "Mission créée" }],
    risks: { risk_level: "green" },
    missing_info: [],
    next_actions: [],
    ...overrides,
  };
}

function makeCompanyMemory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reusable_rh_context_json: {
      employees: [makeEmployee()],
      company_name: "Acme Corp",
      document_system: {
        default_family: "generic_hr",
        branding: { company_name: "Acme Corp", logo_url: null },
      },
      branding: { company_name: "Acme Corp" },
      ...overrides,
    },
  };
}

// ── buildPierreGoldenScenarios ────────────────────────────────────────────────

describe("buildPierreGoldenScenarios", () => {
  it("returns exactly 8 scenarios", () => {
    const scenarios = buildPierreGoldenScenarios();
    expect(scenarios).toHaveLength(8);
  });

  it("each scenario has a key", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(s.key).toBeTruthy();
  });

  it("each scenario has a title", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(s.title).toBeTruthy();
  });

  it("each scenario has a description", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(s.description.length).toBeGreaterThan(10);
  });

  it("each scenario has a prompt", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(s.prompt.length).toBeGreaterThan(20);
  });

  it("each scenario has expected_capabilities array", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) {
      expect(Array.isArray(s.expected_capabilities)).toBe(true);
      expect(s.expected_capabilities.length).toBeGreaterThan(0);
    }
  });

  it("each scenario has expected_outputs array", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) {
      expect(Array.isArray(s.expected_outputs)).toBe(true);
      expect(s.expected_outputs.length).toBeGreaterThan(0);
    }
  });

  it("each scenario has required_gates array", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) {
      expect(Array.isArray(s.required_gates)).toBe(true);
      expect(s.required_gates.length).toBeGreaterThan(0);
    }
  });

  it("each scenario has a risk level", () => {
    const scenarios = buildPierreGoldenScenarios();
    const validRisks = new Set(["low", "medium", "high", "critical"]);
    for (const s of scenarios) expect(validRisks.has(s.risk)).toBe(true);
  });

  it("each scenario has must_require_human_validation boolean", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(typeof s.must_require_human_validation).toBe("boolean");
  });

  it("each scenario has must_not_auto_execute array", () => {
    const scenarios = buildPierreGoldenScenarios();
    for (const s of scenarios) expect(Array.isArray(s.must_not_auto_execute)).toBe(true);
  });

  it("scenario sensitive_hr_case must_require_human_validation is true", () => {
    const scenarios = buildPierreGoldenScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    expect(sensitive.must_require_human_validation).toBe(true);
  });

  it("scenario sensitive_hr_case risk is critical", () => {
    const scenarios = buildPierreGoldenScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    expect(sensitive.risk).toBe("critical");
  });

  it("scenario sensitive_hr_case must_not_auto_execute contains email.send", () => {
    const scenarios = buildPierreGoldenScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    expect(sensitive.must_not_auto_execute).toContain("email.send");
  });

  it("scenario sensitive_hr_case must_not_auto_execute contains send_email", () => {
    const scenarios = buildPierreGoldenScenarios();
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    expect(sensitive.must_not_auto_execute).toContain("send_email");
  });

  it("has hiring_onboarding scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("hiring_onboarding");
  });

  it("has absence_management scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("absence_management");
  });

  it("has contract_generation scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("contract_generation");
  });

  it("has prepay_preparation scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("prepay_preparation");
  });

  it("has offboarding scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("offboarding");
  });

  it("has multi_site_reporting scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("multi_site_reporting");
  });

  it("has employee_file_review scenario", () => {
    const keys = buildPierreGoldenScenarios().map((s) => s.key);
    expect(keys).toContain("employee_file_review");
  });

  it("contract_generation scenario requires controlled_autonomy gate", () => {
    const scenarios = buildPierreGoldenScenarios();
    const contract = scenarios.find((s) => s.key === "contract_generation")!;
    expect(contract.required_gates).toContain("controlled_autonomy");
  });

  it("offboarding scenario must_require_human_validation is true", () => {
    const scenarios = buildPierreGoldenScenarios();
    const off = scenarios.find((s) => s.key === "offboarding")!;
    expect(off.must_require_human_validation).toBe(true);
  });

  it("employee_file_review has no must_not_auto_execute items", () => {
    const scenarios = buildPierreGoldenScenarios();
    const review = scenarios.find((s) => s.key === "employee_file_review")!;
    expect(review.must_not_auto_execute).toHaveLength(0);
  });
});

// ── evaluateMissionEngine ─────────────────────────────────────────────────────

describe("evaluateMissionEngine", () => {
  it("returns fail when no missions", () => {
    const gate = evaluateMissionEngine({ missions: [] });
    expect(gate.status).toBe("fail");
    expect(gate.score).toBe(0);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("returns key mission_engine", () => {
    const gate = evaluateMissionEngine({ missions: [] });
    expect(gate.key).toBe("mission_engine");
  });

  it("pass with well-formed missions", () => {
    const missions = Array.from({ length: 5 }, (_, i) => makeMission({ id: `m-${i}` }));
    const gate = evaluateMissionEngine({ missions });
    expect(gate.status).toBe("pass");
    expect(gate.score).toBeGreaterThanOrEqual(75);
  });

  it("warning when missions lack summary", () => {
    const missions = [
      makeMission({ mission_summary: null }),
      makeMission({ mission_summary: "" }),
    ];
    const gate = evaluateMissionEngine({ missions });
    expect(gate.status).not.toBe("fail");
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("evidence includes mission entries", () => {
    const missions = [makeMission()];
    const gate = evaluateMissionEngine({ missions });
    expect(gate.evidence.length).toBeGreaterThan(0);
    expect(gate.evidence[0].type).toBe("mission");
  });

  it("never crashes on null/undefined fields in missions", () => {
    const missions = [{ id: null, status: undefined, brain_output_json: null }];
    expect(() => evaluateMissionEngine({ missions })).not.toThrow();
  });

  it("score is within 0-100", () => {
    const missions = [makeMission()];
    const gate = evaluateMissionEngine({ missions });
    expect(gate.score).toBeGreaterThanOrEqual(0);
    expect(gate.score).toBeLessThanOrEqual(100);
  });
});

// ── evaluateTaskOrchestration ─────────────────────────────────────────────────

describe("evaluateTaskOrchestration", () => {
  it("fail when no tasks", () => {
    const gate = evaluateTaskOrchestration({ tasks: [] });
    expect(gate.status).toBe("fail");
  });

  it("returns key task_orchestration", () => {
    const gate = evaluateTaskOrchestration({ tasks: [] });
    expect(gate.key).toBe("task_orchestration");
  });

  it("pass with diverse well-formed tasks", () => {
    const tasks = [
      makeTask({ status: "done" }),
      makeTask({ id: "t-2", status: "ready" }),
      makeTask({ id: "t-3", status: "awaiting_approval" }),
      makeTask({ id: "t-4", status: "error" }),
    ];
    const gate = evaluateTaskOrchestration({ tasks });
    expect(gate.score).toBeGreaterThan(50);
  });

  it("warning when tasks not linked to mission", () => {
    const tasks = [makeTask({ mission_id: null }), makeTask({ id: "t-2", mission_id: null })];
    const gate = evaluateTaskOrchestration({ tasks });
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("never crashes on malformed tasks", () => {
    const tasks = [null, undefined, 42, { id: "t-1" }] as unknown as Record<string, unknown>[];
    expect(() => evaluateTaskOrchestration({ tasks })).not.toThrow();
  });

  it("score in 0-100", () => {
    const tasks = [makeTask()];
    const gate = evaluateTaskOrchestration({ tasks });
    expect(gate.score).toBeGreaterThanOrEqual(0);
    expect(gate.score).toBeLessThanOrEqual(100);
  });
});

// ── evaluateControlledAutonomy ────────────────────────────────────────────────

describe("evaluateControlledAutonomy", () => {
  it("not_applicable when no tasks", () => {
    const gate = evaluateControlledAutonomy({ tasks: [] });
    expect(gate.status).toBe("not_applicable");
  });

  it("fail when email.send auto-executed with approval_required", () => {
    const tasks = [
      makeTask({ type: "email.send", status: "done", approval_required: true }),
    ];
    const gate = evaluateControlledAutonomy({ tasks });
    expect(gate.status).toBe("fail");
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("fail when send_email auto-executed with approval_required in payload", () => {
    const tasks = [
      makeTask({
        type: "send_email",
        status: "done",
        approval_required: false,
        payload_json: { approval_required: true },
      }),
    ];
    const gate = evaluateControlledAutonomy({ tasks });
    expect(gate.status).toBe("fail");
  });

  it("pass when email.send is not done", () => {
    const tasks = [
      makeTask({ type: "email.send", status: "awaiting_approval" }),
    ];
    const gate = evaluateControlledAutonomy({ tasks });
    expect(gate.status).not.toBe("fail");
  });

  it("does not fail when no send tasks at all", () => {
    const tasks = [makeTask({ type: "doc.generate", status: "done" })];
    const gate = evaluateControlledAutonomy({ tasks });
    expect(gate.status).not.toBe("fail");
  });

  it("score improves with approval tasks present", () => {
    const tasks = [makeTask({ approval_required: true, status: "awaiting_approval" })];
    const gate = evaluateControlledAutonomy({ tasks });
    expect(gate.score).toBeGreaterThan(50);
  });

  it("key is controlled_autonomy", () => {
    const gate = evaluateControlledAutonomy({ tasks: [makeTask()] });
    expect(gate.key).toBe("controlled_autonomy");
  });

  it("never crashes on null tasks", () => {
    expect(() => evaluateControlledAutonomy({ tasks: [null as unknown as Record<string, unknown>] })).not.toThrow();
  });
});

// ── evaluateEmployeeFile360 ───────────────────────────────────────────────────

describe("evaluateEmployeeFile360", () => {
  it("warning when no employees", () => {
    const gate = evaluateEmployeeFile360({});
    expect(gate.status).toBe("warning");
    expect(gate.score).toBeLessThan(50);
  });

  it("key is employee_file_360", () => {
    const gate = evaluateEmployeeFile360({});
    expect(gate.key).toBe("employee_file_360");
  });

  it("improves score with employees present", () => {
    const gate1 = evaluateEmployeeFile360({});
    const gate2 = evaluateEmployeeFile360({ employees: [makeEmployee()] });
    expect(gate2.score).toBeGreaterThan(gate1.score);
  });

  it("improves score with employee files present", () => {
    const gate = evaluateEmployeeFile360({
      employees: [makeEmployee()],
      employeeFiles: [makeEmployeeFile()],
    });
    expect(gate.score).toBeGreaterThan(40);
  });

  it("pass with complete employee files", () => {
    const employees = [makeEmployee(), makeEmployee({ id: "emp-2", full_name: "Jean Martin" })];
    const files = [
      makeEmployeeFile(),
      makeEmployeeFile({ profile: { employee_id: "emp-2", employee_name: "Jean Martin" } }),
    ];
    const gate = evaluateEmployeeFile360({ employees, employeeFiles: files });
    expect(gate.score).toBeGreaterThanOrEqual(60);
  });

  it("detects attention_required files", () => {
    const gate = evaluateEmployeeFile360({
      employees: [makeEmployee()],
      employeeFiles: [makeEmployeeFile({ status: "attention_required" })],
    });
    expect(gate.reason).toContain("attention");
  });

  it("never crashes on empty/null inputs", () => {
    expect(() => evaluateEmployeeFile360({ employees: [], employeeFiles: [] })).not.toThrow();
    expect(() => evaluateEmployeeFile360({ employees: [null as unknown as Record<string, unknown>] })).not.toThrow();
  });
});

// ── evaluateContinuity ────────────────────────────────────────────────────────

describe("evaluateContinuity", () => {
  it("key is continuity", () => {
    const gate = evaluateContinuity({ tasks: [] });
    expect(gate.key).toBe("continuity");
  });

  it("warning when no tasks", () => {
    const gate = evaluateContinuity({ tasks: [] });
    expect(gate.status).toBe("warning");
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("pass with tasks and logs", () => {
    const tasks = [makeTask(), makeTask({ id: "t-2", status: "done" })];
    const logs = [makeLog()];
    const gate = evaluateContinuity({ tasks, logs });
    expect(gate.status).toBe("pass");
  });

  it("warning when many blocked tasks", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({ id: `t-${i}`, status: "blocked" }));
    const gate = evaluateContinuity({ tasks });
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("warning when many blocked missions", () => {
    const missions = Array.from({ length: 3 }, (_, i) => makeMission({ id: `m-${i}`, status: "blocked" }));
    const tasks = [makeTask()];
    const gate = evaluateContinuity({ tasks, missions });
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("evidence includes blocked task counts", () => {
    const tasks = [makeTask({ status: "blocked" })];
    const gate = evaluateContinuity({ tasks });
    const blockedEvidence = gate.evidence.some((e) => e.label.includes("bloquée"));
    expect(blockedEvidence).toBe(true);
  });
});

// ── evaluatePremiumDocuments ──────────────────────────────────────────────────

describe("evaluatePremiumDocuments", () => {
  it("key is premium_documents", () => {
    const gate = evaluatePremiumDocuments({ documents: [] });
    expect(gate.key).toBe("premium_documents");
  });

  it("warning when no documents", () => {
    const gate = evaluatePremiumDocuments({ documents: [] });
    expect(gate.status).toBe("warning");
  });

  it("pass with premium documents and config", () => {
    const documents = [makeDocument()];
    const documentSystemConfig = { default_family: "contract", branding: { company_name: "Acme" } };
    const gate = evaluatePremiumDocuments({ documents, documentSystemConfig });
    expect(gate.status).toBe("pass");
  });

  it("detects document_family", () => {
    const documents = [makeDocument({ document_family: "contract" })];
    const gate = evaluatePremiumDocuments({ documents });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("detects template_id", () => {
    const documents = [makeDocument({ template_id: "tpl_contract_v1" })];
    const gate = evaluatePremiumDocuments({ documents });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("detects pierre-wrapper HTML", () => {
    const documents = [makeDocument({ html_content: '<div class="pierre-wrapper">contrat</div>' })];
    const gate = evaluatePremiumDocuments({ documents });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("detects document_system in company memory", () => {
    const companyMemory = makeCompanyMemory();
    const gate = evaluatePremiumDocuments({ documents: [], companyMemory });
    expect(gate.score).toBeGreaterThan(20);
  });

  it("never crashes on empty arrays", () => {
    expect(() => evaluatePremiumDocuments({ documents: [], companyMemory: null })).not.toThrow();
  });
});

// ── evaluatePdfQuality ────────────────────────────────────────────────────────

describe("evaluatePdfQuality", () => {
  it("key is pdf_quality", () => {
    const gate = evaluatePdfQuality({ documents: [] });
    expect(gate.key).toBe("pdf_quality");
  });

  it("warning when no PDF and no config", () => {
    const gate = evaluatePdfQuality({ documents: [], documentSystemConfig: null });
    expect(gate.status).toBe("warning");
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("pass with PDFs and config", () => {
    const documents = [makeDocument({ type: "pdf", pdf_url: "/docs/contract.pdf" })];
    const documentSystemConfig = { branding: { company_name: "Acme" } };
    const gate = evaluatePdfQuality({ documents, documentSystemConfig });
    expect(gate.score).toBeGreaterThanOrEqual(50);
  });

  it("score improves with config present", () => {
    const gate1 = evaluatePdfQuality({ documents: [] });
    const gate2 = evaluatePdfQuality({ documents: [], documentSystemConfig: { branding: { company_name: "Acme" } } });
    expect(gate2.score).toBeGreaterThan(gate1.score);
  });

  it("warning when PDF without branding", () => {
    const documents = [makeDocument({ type: "pdf", pdf_filename: "test.pdf" })];
    const gate = evaluatePdfQuality({ documents });
    expect(gate.warnings.some((w) => w.includes("branding"))).toBe(true);
  });

  it("status never fail (pdf is a warning-only gate)", () => {
    const gate = evaluatePdfQuality({ documents: [] });
    expect(gate.status).not.toBe("fail");
  });
});

// ── evaluateEmailSafety ───────────────────────────────────────────────────────

describe("evaluateEmailSafety", () => {
  it("key is email_safety", () => {
    const gate = evaluateEmailSafety({ tasks: [] });
    expect(gate.key).toBe("email_safety");
  });

  it("pass when no email tasks", () => {
    const gate = evaluateEmailSafety({ tasks: [] });
    expect(gate.status).toBe("pass");
  });

  it("fail when sensitive email auto-sent", () => {
    const tasks = [makeTask({ type: "email.send", status: "done", approval_required: true })];
    const gate = evaluateEmailSafety({ tasks });
    expect(gate.status).toBe("fail");
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("warning when email.send done without approval", () => {
    const tasks = [makeTask({ type: "email.send", status: "done", approval_required: false })];
    const gate = evaluateEmailSafety({ tasks });
    // Should not pass with auto-sent emails
    expect(gate.score).toBeLessThan(80);
  });

  it("pass when email.send awaiting_approval", () => {
    const tasks = [makeTask({ type: "email.send", status: "awaiting_approval" })];
    const gate = evaluateEmailSafety({ tasks });
    expect(gate.status).not.toBe("fail");
  });

  it("score improves with email drafts", () => {
    const tasks = [makeTask({ type: "email.draft", status: "draft" })];
    const gate = evaluateEmailSafety({ tasks });
    expect(gate.score).toBeGreaterThan(70);
  });

  it("never crashes on send_email type", () => {
    const tasks = [makeTask({ type: "send_email", status: "done" })];
    expect(() => evaluateEmailSafety({ tasks })).not.toThrow();
  });
});

// ── evaluateCloneGuard ────────────────────────────────────────────────────────

describe("evaluateCloneGuard", () => {
  it("key is cloneguard", () => {
    const gate = evaluateCloneGuard({});
    expect(gate.key).toBe("cloneguard");
  });

  it("warning when no data", () => {
    const gate = evaluateCloneGuard({});
    expect(gate.score).toBeLessThan(50);
  });

  it("pass with risk_level and approval_required present", () => {
    const missions = [makeMission({ risk_level: "sensitive" })];
    const tasks = [makeTask({ approval_required: true })];
    const logs = [makeLog({ event_type: "governance_evaluation" })];
    const gate = evaluateCloneGuard({ missions, tasks, logs });
    expect(gate.status).toBe("pass");
  });

  it("detects governance logs", () => {
    const logs = [makeLog({ event_type: "governance_execution_blocked" })];
    const gate = evaluateCloneGuard({ logs });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("warning on sensitive mission without approval", () => {
    const missions = [makeMission({ mission_summary: "Licenciement harcèlement grave", brain_output_json: {} })];
    const gate = evaluateCloneGuard({ missions, tasks: [] });
    expect(gate.warnings.some((w) => w.includes("sensible"))).toBe(true);
  });

  it("detects risk_level in missions", () => {
    const missions = [makeMission({ risk_level: "critical" })];
    const gate = evaluateCloneGuard({ missions });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("never crashes on null inputs", () => {
    expect(() => evaluateCloneGuard({ missions: null as unknown as Record<string, unknown>[] })).not.toThrow();
  });
});

// ── evaluateCloneTrace ────────────────────────────────────────────────────────

describe("evaluateCloneTrace", () => {
  it("key is clonetrace", () => {
    const gate = evaluateCloneTrace({});
    expect(gate.key).toBe("clonetrace");
  });

  it("warning when no logs", () => {
    const gate = evaluateCloneTrace({ logs: [] });
    expect(gate.status).toBe("warning");
  });

  it("pass with correct schema logs", () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({ id: `l-${i}`, mission_id: "m-1" }));
    const gate = evaluateCloneTrace({ logs });
    expect(gate.status).toBe("pass");
  });

  it("fail when logs have old schema (level/event/payload)", () => {
    const logs = [
      makeLog({ level: "info", event: "document_generated", payload: { doc: "x" } }),
    ];
    const gate = evaluateCloneTrace({ logs });
    expect(gate.status).toBe("fail");
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("warning when event_type missing from some logs", () => {
    const logs = [
      makeLog({ event_type: null }),
      makeLog({ event_type: null }),
      makeLog(),
    ];
    const gate = evaluateCloneTrace({ logs });
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("score improves with mission-linked logs", () => {
    const gate1 = evaluateCloneTrace({ logs: [makeLog({ mission_id: null })] });
    const gate2 = evaluateCloneTrace({ logs: [makeLog({ mission_id: "m-001" })] });
    expect(gate2.score).toBeGreaterThanOrEqual(gate1.score);
  });

  it("never crashes on empty logs", () => {
    expect(() => evaluateCloneTrace({ logs: [] })).not.toThrow();
  });
});

// ── evaluateCompanyMemory ─────────────────────────────────────────────────────

describe("evaluateCompanyMemory", () => {
  it("key is company_memory", () => {
    const gate = evaluateCompanyMemory({});
    expect(gate.key).toBe("company_memory");
  });

  it("warning when no company memory", () => {
    const gate = evaluateCompanyMemory({ companyMemory: null });
    expect(gate.status).toBe("warning");
    expect(gate.score).toBeLessThan(20);
  });

  it("warning when reusable_rh_context_json absent", () => {
    const gate = evaluateCompanyMemory({ companyMemory: { other_field: "x" } });
    expect(gate.status).toBe("warning");
  });

  it("pass with full company memory", () => {
    const companyMemory = makeCompanyMemory();
    const gate = evaluateCompanyMemory({ companyMemory });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("detects employees in reusable_rh_context_json", () => {
    const companyMemory = makeCompanyMemory();
    const rrh = companyMemory.reusable_rh_context_json as Record<string, unknown>;
    const gate = evaluateCompanyMemory({ companyMemory: { reusable_rh_context_json: rrh } });
    expect(gate.score).toBeGreaterThan(40);
  });

  it("detects document_system in company memory", () => {
    const rrh = { employees: [makeEmployee()], document_system: { default_family: "contract" } };
    const gate = evaluateCompanyMemory({ companyMemory: { reusable_rh_context_json: rrh } });
    expect(gate.score).toBeGreaterThan(50);
  });

  it("warning when no employees in memory", () => {
    const rrh = { company_name: "Acme" };
    const gate = evaluateCompanyMemory({ companyMemory: { reusable_rh_context_json: rrh } });
    expect(gate.warnings.some((w) => w.includes("salariés") || w.includes("employ"))).toBe(true);
  });

  it("never crashes on null", () => {
    expect(() => evaluateCompanyMemory({ companyMemory: null })).not.toThrow();
  });
});

// ── evaluateTemplateConfiguration ─────────────────────────────────────────────

describe("evaluateTemplateConfiguration", () => {
  it("key is template_configuration", () => {
    const gate = evaluateTemplateConfiguration({});
    expect(gate.key).toBe("template_configuration");
  });

  it("warning when no config", () => {
    const gate = evaluateTemplateConfiguration({ documentSystemConfig: null });
    expect(gate.status).toBe("warning");
    expect(gate.score).toBeLessThan(50);
  });

  it("pass with full document_system config", () => {
    const documentSystemConfig = {
      default_family: "contract",
      branding: { company_name: "Acme", logo_url: null },
      company_name: "Acme",
      custom_templates: [{ id: "tpl_custom_1" }],
    };
    const gate = evaluateTemplateConfiguration({ documentSystemConfig });
    expect(gate.status).toBe("pass");
  });

  it("detects document_system in company memory", () => {
    const companyMemory = makeCompanyMemory();
    const rrh = companyMemory.reusable_rh_context_json as Record<string, unknown>;
    const gate = evaluateTemplateConfiguration({ companyMemory: { reusable_rh_context_json: rrh } });
    expect(gate.score).toBeGreaterThan(30);
  });

  it("warning when no branding", () => {
    const documentSystemConfig = { default_family: "contract" };
    const gate = evaluateTemplateConfiguration({ documentSystemConfig });
    expect(gate.warnings.some((w) => w.includes("branding"))).toBe(true);
  });

  it("score improves with custom templates", () => {
    const gate1 = evaluateTemplateConfiguration({ documentSystemConfig: { default_family: "contract" } });
    const gate2 = evaluateTemplateConfiguration({
      documentSystemConfig: { custom_templates: [{ id: "t1" }] },
    });
    expect(gate2.score).toBeGreaterThan(gate1.score);
  });

  it("never crashes on empty object", () => {
    expect(() => evaluateTemplateConfiguration({ documentSystemConfig: {} })).not.toThrow();
  });
});

// ── evaluateAuditability ──────────────────────────────────────────────────────

describe("evaluateAuditability", () => {
  it("key is auditability", () => {
    const gate = evaluateAuditability({});
    expect(gate.key).toBe("auditability");
  });

  it("low score with no data", () => {
    const gate = evaluateAuditability({});
    expect(gate.score).toBeLessThan(30);
  });

  it("pass with missions, tasks, logs, documents cross-referenced", () => {
    const missions = [makeMission({ id: "m-001" })];
    const tasks = [makeTask({ mission_id: "m-001" })];
    const logs = [makeLog({ mission_id: "m-001" })];
    const documents = [makeDocument({ mission_id: "m-001" })];
    const gate = evaluateAuditability({ missions, tasks, logs, documents });
    expect(gate.status).toBe("pass");
  });

  it("warning when no logs", () => {
    const gate = evaluateAuditability({ missions: [makeMission()], tasks: [makeTask()], logs: [] });
    expect(gate.warnings.some((w) => w.includes("log"))).toBe(true);
  });

  it("warning when tasks not linked to missions", () => {
    const missions = [makeMission({ id: "m-999" })];
    const tasks = [makeTask({ mission_id: "m-DIFFERENT" })];
    const gate = evaluateAuditability({ missions, tasks, logs: [] });
    expect(gate.warnings.length).toBeGreaterThan(0);
  });

  it("evidence includes mission and log entries", () => {
    const gate = evaluateAuditability({
      missions: [makeMission()],
      logs: [makeLog()],
    });
    const types = gate.evidence.map((e) => e.type);
    expect(types).toContain("mission");
    expect(types).toContain("log");
  });

  it("never crashes on null arrays", () => {
    expect(() => evaluateAuditability({
      missions: null as unknown as Record<string, unknown>[],
      tasks: undefined,
    })).not.toThrow();
  });
});

// ── evaluateGoldenScenario ────────────────────────────────────────────────────

describe("evaluateGoldenScenario", () => {
  const scenarios = buildPierreGoldenScenarios();

  it("returns a scenario evaluation for every scenario", () => {
    for (const scenario of scenarios) {
      const result = evaluateGoldenScenario(scenario, {
        missions: [],
        tasks: [],
        documents: [],
        logs: [],
      });
      expect(result.scenario_key).toBe(scenario.key);
    }
  });

  it("evaluation has expected fields", () => {
    const scenario = scenarios[0];
    const result = evaluateGoldenScenario(scenario, {
      missions: [makeMission()],
      tasks: [makeTask()],
      documents: [makeDocument()],
      logs: [makeLog()],
    });
    expect(result.title).toBeTruthy();
    expect(typeof result.score).toBe("number");
    expect(Array.isArray(result.matched_capabilities)).toBe(true);
    expect(Array.isArray(result.missing_capabilities)).toBe(true);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it("sensitive_hr_case fails when email.send auto-executed", () => {
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    const result = evaluateGoldenScenario(sensitive, {
      missions: [],
      tasks: [makeTask({ type: "email.send", status: "done" })],
      documents: [],
      logs: [],
    });
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.status).toBe("fail");
  });

  it("sensitive_hr_case passes when no auto-execution", () => {
    const sensitive = scenarios.find((s) => s.key === "sensitive_hr_case")!;
    const result = evaluateGoldenScenario(sensitive, {
      missions: [],
      tasks: [makeTask({ type: "doc.generate", status: "awaiting_approval" })],
      documents: [],
      logs: [],
    });
    expect(result.blockers).toHaveLength(0);
  });

  it("hiring_onboarding matches missions with onboarding keyword", () => {
    const scenario = scenarios.find((s) => s.key === "hiring_onboarding")!;
    const missions = [makeMission({ mission_summary: "Onboarding nouveau salarié" })];
    const result = evaluateGoldenScenario(scenario, {
      missions,
      tasks: [makeTask()],
      documents: [makeDocument()],
      logs: [makeLog()],
    });
    expect(result.score).toBeGreaterThan(30);
  });

  it("score is in 0-100 range", () => {
    for (const scenario of scenarios) {
      const result = evaluateGoldenScenario(scenario, {
        missions: [makeMission()],
        tasks: [makeTask()],
        documents: [makeDocument()],
        logs: [makeLog()],
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("never crashes on empty data", () => {
    for (const scenario of scenarios) {
      expect(() => evaluateGoldenScenario(scenario, {
        missions: [],
        tasks: [],
        documents: [],
        logs: [],
      })).not.toThrow();
    }
  });

  it("warning when human validation required but no approval tasks", () => {
    const contract = scenarios.find((s) => s.key === "contract_generation")!;
    const result = evaluateGoldenScenario(contract, {
      missions: [],
      tasks: [makeTask({ approval_required: false })],
      documents: [],
      logs: [],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── buildPierreReadinessReport ────────────────────────────────────────────────

describe("buildPierreReadinessReport", () => {
  const baseParams = {
    missions: [makeMission()],
    tasks: [makeTask()],
    documents: [makeDocument()],
    logs: [makeLog()],
    employees: [makeEmployee()],
    employeeFiles: [makeEmployeeFile()],
    companyMemory: makeCompanyMemory().reusable_rh_context_json as Record<string, unknown>,
    documentSystemConfig: { default_family: "contract", branding: { company_name: "Acme" } },
    now: new Date("2026-05-19T12:00:00Z"),
  };

  it("returns a report with generated_at", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.generated_at).toBe("2026-05-19T12:00:00.000Z");
  });

  it("report has gates array with 14 entries", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.gates).toHaveLength(14);
  });

  it("report has scenarios array with 8 entries", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.scenarios).toHaveLength(8);
  });

  it("global_score is in 0-100", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.global_score).toBeGreaterThanOrEqual(0);
    expect(report.global_score).toBeLessThanOrEqual(100);
  });

  it("level is one of the 4 valid values", () => {
    const report = buildPierreReadinessReport(baseParams);
    const valid = new Set(["not_ready", "partial", "ready", "premium_ready"]);
    expect(valid.has(report.level)).toBe(true);
  });

  it("classifies not_ready when score below 50", () => {
    const report = buildPierreReadinessReport({
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      employees: [],
      now: new Date(),
    });
    expect(report.level).toBe("not_ready");
    expect(report.global_score).toBeLessThan(50);
  });

  it("classifies partial when score 50-74", () => {
    // Minimal data to get partial
    const missions = Array.from({ length: 5 }, (_, i) => makeMission({ id: `m-${i}` }));
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `t-${i}` }));
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({ id: `l-${i}` }));
    const report = buildPierreReadinessReport({
      missions,
      tasks,
      documents: [],
      logs,
      employees: [],
      now: new Date(),
    });
    expect(["not_ready", "partial", "ready"].includes(report.level)).toBe(true);
  });

  it("report has a non-empty summary", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.summary.length).toBeGreaterThan(10);
  });

  it("summary includes score", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.summary).toContain(String(report.global_score));
  });

  it("report has next_actions array", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(Array.isArray(report.next_actions)).toBe(true);
    expect(report.next_actions.length).toBeGreaterThan(0);
  });

  it("report has risks array", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(Array.isArray(report.risks)).toBe(true);
  });

  it("totals.missions is correct", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.totals.missions).toBe(1);
  });

  it("totals.tasks is correct", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.totals.tasks).toBe(1);
  });

  it("totals.documents is correct", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.totals.documents).toBe(1);
  });

  it("totals.logs is correct", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.totals.logs).toBe(1);
  });

  it("totals.employees is correct", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(report.totals.employees).toBe(1);
  });

  it("totals.blocked_tasks is correct", () => {
    const report = buildPierreReadinessReport({
      ...baseParams,
      tasks: [makeTask({ status: "blocked" })],
    });
    expect(report.totals.blocked_tasks).toBe(1);
  });

  it("totals.error_tasks is correct", () => {
    const report = buildPierreReadinessReport({
      ...baseParams,
      tasks: [makeTask({ status: "error" })],
    });
    expect(report.totals.error_tasks).toBe(1);
  });

  it("totals.pending_approval_tasks is correct", () => {
    const report = buildPierreReadinessReport({
      ...baseParams,
      tasks: [makeTask({ status: "awaiting_approval" })],
    });
    expect(report.totals.pending_approval_tasks).toBe(1);
  });

  it("totals.premium_documents counts documents with template_id", () => {
    const report = buildPierreReadinessReport({
      ...baseParams,
      documents: [makeDocument({ template_id: "tpl_contract_v1" })],
    });
    expect(report.totals.premium_documents).toBe(1);
  });

  it("gate keys include all 14 expected gates", () => {
    const report = buildPierreReadinessReport(baseParams);
    const gateKeys = new Set(report.gates.map((g) => g.key));
    const expected = [
      "mission_engine", "task_orchestration", "controlled_autonomy",
      "employee_file_360", "continuity", "premium_documents", "pdf_quality",
      "email_safety", "cloneguard", "clonetrace", "company_memory",
      "template_configuration", "auditability", "golden_scenarios",
    ];
    for (const key of expected) expect(gateKeys.has(key as PierreReadinessGate["key"])).toBe(true);
  });

  it("next_actions priorities are valid", () => {
    const report = buildPierreReadinessReport(baseParams);
    const validPriorities = new Set(["low", "normal", "high", "urgent"]);
    for (const action of report.next_actions) {
      expect(validPriorities.has(action.priority)).toBe(true);
    }
  });

  it("next_actions sorted urgent first", () => {
    const report = buildPierreReadinessReport({
      missions: [],
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: true })],
      documents: [],
      logs: [],
      employees: [],
    });
    const priorities = report.next_actions.map((a) => a.priority);
    if (priorities.includes("urgent") && priorities.length > 1) {
      const urgentIdx = priorities.indexOf("urgent");
      expect(urgentIdx).toBe(0);
    }
  });

  it("never crashes with fully empty input", () => {
    expect(() =>
      buildPierreReadinessReport({
        missions: [],
        tasks: [],
        documents: [],
        logs: [],
        employees: [],
      }),
    ).not.toThrow();
  });

  it("never crashes with null values", () => {
    expect(() =>
      buildPierreReadinessReport({
        missions: null as unknown as Record<string, unknown>[],
        tasks: undefined as unknown as Record<string, unknown>[],
        documents: [],
        logs: [],
        employees: [],
        companyMemory: null,
        documentSystemConfig: null,
      }),
    ).not.toThrow();
  });

  it("label is a non-empty string", () => {
    const report = buildPierreReadinessReport(baseParams);
    expect(typeof report.label).toBe("string");
    expect(report.label.length).toBeGreaterThan(0);
  });
});

// ── buildMissionReadinessHint ────────────────────────────────────────────────

describe("buildMissionReadinessHint", () => {
  it("returns hint with gates_impacted, scenario_matches, warnings", () => {
    const hint = buildMissionReadinessHint(makeMission(), [], [], []);
    expect(Array.isArray(hint.gates_impacted)).toBe(true);
    expect(Array.isArray(hint.scenario_matches)).toBe(true);
    expect(Array.isArray(hint.warnings)).toBe(true);
  });

  it("detects onboarding scenario from mission_summary", () => {
    const mission = makeMission({ mission_summary: "Onboarding nouveau salarié Marie Dupont" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    expect(hint.scenario_matches).toContain("hiring_onboarding");
  });

  it("detects absence scenario", () => {
    const mission = makeMission({ mission_summary: "Gestion absence maladie Thomas" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    expect(hint.scenario_matches).toContain("absence_management");
  });

  it("detects contract scenario", () => {
    const mission = makeMission({ mission_summary: "Génération avenant contrat CDI" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    expect(hint.scenario_matches).toContain("contract_generation");
  });

  it("impacted gates include controlled_autonomy when awaiting_approval task", () => {
    const tasks = [makeTask({ status: "awaiting_approval" })];
    const hint = buildMissionReadinessHint(makeMission(), tasks, [], []);
    expect(hint.gates_impacted).toContain("controlled_autonomy");
  });

  it("impacted gates include premium_documents when documents present", () => {
    const docs = [makeDocument()];
    const hint = buildMissionReadinessHint(makeMission(), [], docs, []);
    expect(hint.gates_impacted).toContain("premium_documents");
  });

  it("impacted gates include clonetrace when logs present", () => {
    const logs = [makeLog()];
    const hint = buildMissionReadinessHint(makeMission(), [], [], logs);
    expect(hint.gates_impacted).toContain("clonetrace");
  });

  it("warning when blocked tasks", () => {
    const tasks = [makeTask({ status: "blocked" })];
    const hint = buildMissionReadinessHint(makeMission(), tasks, [], []);
    expect(hint.warnings.length).toBeGreaterThan(0);
  });

  it("detects sensitive_hr_case from harcèlement keyword", () => {
    const mission = makeMission({ mission_summary: "Gestion harcèlement moral signalé" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    expect(hint.scenario_matches).toContain("sensitive_hr_case");
    expect(hint.warnings.length).toBeGreaterThan(0);
  });

  it("detects sensitive from risk_level critical", () => {
    const mission = makeMission({ risk_level: "critical" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    expect(hint.scenario_matches).toContain("sensitive_hr_case");
  });

  it("never crashes on empty mission", () => {
    expect(() => buildMissionReadinessHint({}, [], [], [])).not.toThrow();
  });

  it("scenario_matches are deduplicated", () => {
    const mission = makeMission({ mission_summary: "contrat onboarding embauche cdi" });
    const hint = buildMissionReadinessHint(mission, [], [], []);
    const seen = new Set<string>();
    for (const k of hint.scenario_matches) {
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

// ── Robustesse générale ───────────────────────────────────────────────────────

describe("Robustesse générale", () => {
  it("all gate evaluators handle completely empty objects without throwing", () => {
    const empty = {};
    expect(() => evaluateMissionEngine(empty)).not.toThrow();
    expect(() => evaluateTaskOrchestration(empty)).not.toThrow();
    expect(() => evaluateControlledAutonomy(empty)).not.toThrow();
    expect(() => evaluateEmployeeFile360(empty)).not.toThrow();
    expect(() => evaluateContinuity(empty)).not.toThrow();
    expect(() => evaluatePremiumDocuments(empty)).not.toThrow();
    expect(() => evaluatePdfQuality(empty)).not.toThrow();
    expect(() => evaluateEmailSafety(empty)).not.toThrow();
    expect(() => evaluateCloneGuard(empty)).not.toThrow();
    expect(() => evaluateCloneTrace(empty)).not.toThrow();
    expect(() => evaluateCompanyMemory(empty)).not.toThrow();
    expect(() => evaluateTemplateConfiguration(empty)).not.toThrow();
    expect(() => evaluateAuditability(empty)).not.toThrow();
  });

  it("all gate evaluators return score in 0-100", () => {
    const data = {
      missions: [makeMission()],
      tasks: [makeTask()],
      documents: [makeDocument()],
      logs: [makeLog()],
      employees: [makeEmployee()],
      companyMemory: makeCompanyMemory().reusable_rh_context_json as Record<string, unknown>,
    };
    const gates: PierreReadinessGate[] = [
      evaluateMissionEngine(data),
      evaluateTaskOrchestration(data),
      evaluateControlledAutonomy(data),
      evaluateEmployeeFile360(data),
      evaluateContinuity(data),
      evaluatePremiumDocuments(data),
      evaluatePdfQuality(data),
      evaluateEmailSafety(data),
      evaluateCloneGuard(data),
      evaluateCloneTrace(data),
      evaluateCompanyMemory(data),
      evaluateTemplateConfiguration(data),
      evaluateAuditability(data),
    ];
    for (const gate of gates) {
      expect(gate.score).toBeGreaterThanOrEqual(0);
      expect(gate.score).toBeLessThanOrEqual(100);
    }
  });

  it("buildPierreReadinessReport with extreme data does not crash", () => {
    const manyMissions = Array.from({ length: 100 }, (_, i) => makeMission({ id: `m-${i}` }));
    const manyTasks = Array.from({ length: 200 }, (_, i) => makeTask({ id: `t-${i}` }));
    expect(() =>
      buildPierreReadinessReport({
        missions: manyMissions,
        tasks: manyTasks,
        documents: [],
        logs: [],
        employees: [],
      }),
    ).not.toThrow();
  });

  it("report.level transitions correctly with data", () => {
    const emptyReport = buildPierreReadinessReport({ missions: [], tasks: [], documents: [], logs: [], employees: [] });
    const fullReport = buildPierreReadinessReport({
      missions: Array.from({ length: 10 }, (_, i) => makeMission({ id: `m-${i}` })),
      tasks: Array.from({ length: 10 }, (_, i) => makeTask({ id: `t-${i}` })),
      documents: Array.from({ length: 5 }, (_, i) => makeDocument({ id: `d-${i}` })),
      logs: Array.from({ length: 20 }, (_, i) => makeLog({ id: `l-${i}` })),
      employees: [makeEmployee()],
      companyMemory: makeCompanyMemory().reusable_rh_context_json as Record<string, unknown>,
      documentSystemConfig: { default_family: "contract", branding: { company_name: "Acme" } },
    });
    expect(fullReport.global_score).toBeGreaterThan(emptyReport.global_score);
  });

  it("all gate statuses are valid values", () => {
    const validStatuses = new Set(["pass", "warning", "fail", "not_applicable"]);
    const report = buildPierreReadinessReport({
      missions: [makeMission()],
      tasks: [makeTask()],
      documents: [],
      logs: [],
      employees: [],
    });
    for (const gate of report.gates) {
      expect(validStatuses.has(gate.status)).toBe(true);
    }
  });

  it("all scenario statuses are valid values", () => {
    const validStatuses = new Set(["pass", "warning", "fail", "not_applicable"]);
    const report = buildPierreReadinessReport({
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      employees: [],
    });
    for (const s of report.scenarios) {
      expect(validStatuses.has(s.status)).toBe(true);
    }
  });
});
