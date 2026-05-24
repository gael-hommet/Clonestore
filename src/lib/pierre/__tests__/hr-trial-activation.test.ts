// src/lib/pierre/__tests__/hr-trial-activation.test.ts
// Bloc 23 — Pierre Trial Activation & First-Value Engine

import { describe, test, expect } from "vitest";
import {
  buildPierreTrialMissionTemplates,
  computePierreTrialMetrics,
  detectPierreTrialProofs,
  detectPierreTrialBlockers,
  buildPierreTrialDayPlan,
  scorePierreTrialValue,
  scorePierreTrialConversion,
  classifyPierreTrialActivationStage,
  classifyPierreTrialActivationStatus,
  buildPierreTrialRecommendedMissions,
  buildPierreTrialFirstValuePrompt,
  buildPierreTrialNextActions,
  buildPierreTrialDigest,
  buildPierreTrialActivationReport,
  buildMissionTrialActivationHint,
  type PierreTrialActivationParams,
  type PierreTrialActivationMetrics,
  type PierreTrialActivationProof,
  type PierreTrialActivationBlocker,
  type PierreTrialValueScore,
  type PierreTrialConversionScore,
} from "../hr/trial-activation";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "m-001",
    title: "Audit RH initial",
    status: "active",
    created_at: "2026-05-01T10:00:00Z",
    user_id: "user-001",
    agent_slug: "pierre",
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "t-001",
    type: "document.generate",
    status: "done",
    execute_at: "2026-05-01T10:00:00Z",
    user_id: "user-001",
    agent_slug: "pierre",
    approval_required: false,
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "d-001",
    family: "contract",
    status: "done",
    has_pdf: true,
    approval_required: true,
    user_id: "user-001",
    agent_slug: "pierre",
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "l-001",
    event_type: "task.completed",
    message: "Task completed successfully",
    meta_json: null,
    user_id: "user-001",
    agent_slug: "pierre",
    ...overrides,
  };
}

function makeEmployee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "emp-001",
    first_name: "Alice",
    last_name: "Dupont",
    role: "Développeuse",
    status: "active",
    ...overrides,
  };
}

function makeCompanyMemory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cm-001",
    user_id: "user-001",
    agent_slug: "pierre",
    reusable_rh_context_json: {
      employees: [makeEmployee()],
      document_system: { default_template: "cdi" },
      company_name: "TestCo",
    },
    ...overrides,
  };
}

function makeFullParams(overrides: Partial<PierreTrialActivationParams> = {}): PierreTrialActivationParams {
  return {
    companyMemory: makeCompanyMemory(),
    missions: [makeMission()],
    tasks: [makeTask(), makeTask({ id: "t-002", status: "pending" })],
    documents: [makeDocument()],
    logs: [makeLog()],
    employees: [makeEmployee()],
    employeeFiles: [{ id: "ef-001", employee_id: "emp-001" }],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<PierreTrialActivationMetrics> = {}): PierreTrialActivationMetrics {
  return {
    missions_total: 3,
    completed_tasks: 5,
    documents_generated: 3,
    premium_documents: 2,
    pdf_documents: 2,
    employees_configured: 4,
    employee_files_ready: 3,
    logs_total: 10,
    approval_pending: 1,
    blocked_tasks: 0,
    error_tasks: 0,
    release_score: 75,
    readiness_score: 70,
    ...overrides,
  };
}

function makeProofs(overrides: Partial<PierreTrialActivationProof>[] = []): PierreTrialActivationProof[] {
  const defaults: PierreTrialActivationProof[] = [
    { type: "mission_created", label: "3 missions créées", source_type: "mission", source_id: null, value_score: 24 },
    { type: "task_completed", label: "5 tâches complétées", source_type: "task", source_id: null, value_score: 30 },
    { type: "document_generated", label: "3 documents générés", source_type: "document", source_id: null, value_score: 21 },
  ];
  return defaults.map((p, i) => ({ ...p, ...(overrides[i] ?? {}) }));
}

function makeBlockers(overrides: Partial<PierreTrialActivationBlocker>[] = []): PierreTrialActivationBlocker[] {
  return overrides.map((o) => ({
    type: "no_missions" as const,
    label: "Aucune mission",
    reason: "Test",
    severity: "medium" as const,
    recommended_fix: "Fix",
    ...o,
  }));
}

function makeValueScore(overrides: Partial<PierreTrialValueScore> = {}): PierreTrialValueScore {
  return {
    score: 65,
    label: "Valeur bonne — preuves convaincantes",
    estimated_hours_saved_low: 8,
    estimated_hours_saved_high: 14,
    estimated_value_eur_low: 400,
    estimated_value_eur_high: 700,
    confidence: "medium",
    explanation: "Test",
    ...overrides,
  };
}

function makeConversionScore(overrides: Partial<PierreTrialConversionScore> = {}): PierreTrialConversionScore {
  return {
    score: 70,
    label: "Forte probabilité — finir les dernières étapes",
    probability_band: "high",
    reasons: ["Valeur démontrée"],
    ...overrides,
  };
}

// ── buildPierreTrialMissionTemplates ─────────────────────────────────────────

describe("buildPierreTrialMissionTemplates", () => {
  test("returns exactly 10 templates", () => {
    const templates = buildPierreTrialMissionTemplates();
    expect(templates).toHaveLength(10);
  });

  test("each template has required fields", () => {
    const templates = buildPierreTrialMissionTemplates();
    for (const t of templates) {
      expect(typeof t.key).toBe("string");
      expect(typeof t.title).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(typeof t.business_value).toBe("string");
      expect(typeof t.suggested_prompt).toBe("string");
      expect(Array.isArray(t.expected_outputs)).toBe(true);
      expect(Array.isArray(t.required_inputs)).toBe(true);
      expect(["low", "medium", "high", "critical"]).toContain(t.risk_level);
      expect(typeof t.requires_human_validation).toBe("boolean");
    }
  });

  test("sensitive_case_review is critical and requires human validation", () => {
    const templates = buildPierreTrialMissionTemplates();
    const sensitive = templates.find((t) => t.key === "sensitive_case_review");
    expect(sensitive).toBeDefined();
    expect(sensitive!.risk_level).toBe("critical");
    expect(sensitive!.requires_human_validation).toBe(true);
  });

  test("audit_rh_initial is low risk and does not require human validation", () => {
    const templates = buildPierreTrialMissionTemplates();
    const audit = templates.find((t) => t.key === "audit_rh_initial");
    expect(audit).toBeDefined();
    expect(audit!.risk_level).toBe("low");
    expect(audit!.requires_human_validation).toBe(false);
  });

  test("generate_contract_or_document requires human validation", () => {
    const templates = buildPierreTrialMissionTemplates();
    const contract = templates.find((t) => t.key === "generate_contract_or_document");
    expect(contract!.requires_human_validation).toBe(true);
  });

  test("sensitive_case_review prompt contains safety warning", () => {
    const templates = buildPierreTrialMissionTemplates();
    const sensitive = templates.find((t) => t.key === "sensitive_case_review");
    expect(sensitive!.suggested_prompt).toContain("Ne rien envoyer");
    expect(sensitive!.suggested_prompt).toContain("validation humaine");
  });

  test("all 10 template keys are unique", () => {
    const templates = buildPierreTrialMissionTemplates();
    const keys = templates.map((t) => t.key);
    expect(new Set(keys).size).toBe(10);
  });

  test("all templates have at least one expected output", () => {
    const templates = buildPierreTrialMissionTemplates();
    for (const t of templates) {
      expect(t.expected_outputs.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("all templates have a recommended_day", () => {
    const templates = buildPierreTrialMissionTemplates();
    const validDays = [
      "day_0_setup", "day_1_first_mission", "day_2_employee_files", "day_3_documents",
      "day_4_continuity", "day_5_sensitive_control", "day_6_value_review", "day_7_conversion",
    ];
    for (const t of templates) {
      expect(validDays).toContain(t.recommended_day);
    }
  });
});

// ── computePierreTrialMetrics ─────────────────────────────────────────────────

describe("computePierreTrialMetrics", () => {
  test("counts missions correctly", () => {
    const params = makeFullParams({ missions: [makeMission(), makeMission({ id: "m-002" })] });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.missions_total).toBe(2);
  });

  test("counts completed tasks only", () => {
    const params = makeFullParams({
      tasks: [
        makeTask({ status: "done" }),
        makeTask({ id: "t-002", status: "pending" }),
        makeTask({ id: "t-003", status: "completed" }),
        makeTask({ id: "t-004", status: "error" }),
      ],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.completed_tasks).toBe(2);
  });

  test("counts premium documents from known families", () => {
    const params = makeFullParams({
      documents: [
        makeDocument({ family: "contract" }),
        makeDocument({ id: "d-002", family: "onboarding" }),
        makeDocument({ id: "d-003", family: "random_family" }),
      ],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.premium_documents).toBe(2);
  });

  test("counts pdf documents via has_pdf", () => {
    const params = makeFullParams({
      documents: [
        makeDocument({ has_pdf: true }),
        makeDocument({ id: "d-002", has_pdf: false, pdf_url: "http://example.com/doc.pdf" }),
        makeDocument({ id: "d-003", has_pdf: false }),
      ],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.pdf_documents).toBe(2);
  });

  test("counts pdf documents via pdf_url", () => {
    const params = makeFullParams({
      documents: [makeDocument({ has_pdf: false, pdf_url: "http://s3.example.com/file.pdf" })],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.pdf_documents).toBe(1);
  });

  test("counts approval_pending tasks", () => {
    const params = makeFullParams({
      tasks: [
        makeTask({ status: "pending_approval" }),
        makeTask({ id: "t-002", status: "awaiting_validation" }),
        makeTask({ id: "t-003", status: "done" }),
      ],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.approval_pending).toBe(2);
  });

  test("extracts release_score from releaseReport", () => {
    const params = makeFullParams({ releaseReport: { global_score: 80 } });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.release_score).toBe(80);
  });

  test("extracts release_score from nested report object", () => {
    const params = makeFullParams({ releaseReport: { report: { global_score: 72 } } });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.release_score).toBe(72);
  });

  test("extracts readiness_score from readinessReport", () => {
    const params = makeFullParams({ readinessReport: { global_score: 68 } });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.readiness_score).toBe(68);
  });

  test("returns null release_score when not available", () => {
    const params = makeFullParams({ releaseReport: undefined });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.release_score).toBeNull();
  });

  test("handles empty params gracefully", () => {
    const metrics = computePierreTrialMetrics({});
    expect(metrics.missions_total).toBe(0);
    expect(metrics.completed_tasks).toBe(0);
    expect(metrics.documents_generated).toBe(0);
  });

  test("counts employee_files_ready from employeeFiles", () => {
    const params = makeFullParams({
      employeeFiles: [{ id: "ef-1" }, { id: "ef-2" }, { id: "ef-3" }],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.employee_files_ready).toBe(3);
  });

  test("counts error_tasks correctly", () => {
    const params = makeFullParams({
      tasks: [
        makeTask({ status: "error" }),
        makeTask({ id: "t-002", status: "failed" }),
        makeTask({ id: "t-003", status: "done" }),
      ],
    });
    const metrics = computePierreTrialMetrics(params);
    expect(metrics.error_tasks).toBe(2);
  });
});

// ── detectPierreTrialProofs ───────────────────────────────────────────────────

describe("detectPierreTrialProofs", () => {
  test("detects mission_created proof when missions exist", () => {
    const params = makeFullParams({ missions: [makeMission(), makeMission({ id: "m-2" })] });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "mission_created");
    expect(proof).toBeDefined();
    expect(proof!.value_score).toBeGreaterThan(0);
  });

  test("detects task_completed proof when done tasks exist", () => {
    const params = makeFullParams({ tasks: [makeTask({ status: "done" })] });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "task_completed");
    expect(proof).toBeDefined();
  });

  test("detects document_generated proof when documents exist", () => {
    const params = makeFullParams({ documents: [makeDocument()] });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "document_generated");
    expect(proof).toBeDefined();
  });

  test("detects pdf_generated proof when documents have pdf", () => {
    const params = makeFullParams({ documents: [makeDocument({ has_pdf: true })] });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "pdf_generated");
    expect(proof).toBeDefined();
    expect(proof!.value_score).toBeGreaterThan(0);
  });

  test("detects employee_file_created from employeeFiles", () => {
    const params = makeFullParams({ employeeFiles: [{ id: "ef-1" }, { id: "ef-2" }] });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "employee_file_created");
    expect(proof).toBeDefined();
  });

  test("detects risk_controlled proof from approval_required tasks", () => {
    const params = makeFullParams({
      tasks: [makeTask({ approval_required: true })],
    });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "risk_controlled");
    expect(proof).toBeDefined();
  });

  test("detects approval_required proof", () => {
    const params = makeFullParams({
      tasks: [makeTask({ approval_required: true })],
    });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "approval_required");
    expect(proof).toBeDefined();
  });

  test("detects continuity_recovered from continuity logs", () => {
    const params = makeFullParams({
      logs: [makeLog({ event_type: "continuity.resume" })],
    });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "continuity_recovered");
    expect(proof).toBeDefined();
  });

  test("detects readiness_passed when readiness score >= 50", () => {
    const params = makeFullParams({ readinessReport: { global_score: 70 } });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "readiness_passed");
    expect(proof).toBeDefined();
  });

  test("does not detect readiness_passed when readiness score < 50", () => {
    const params = makeFullParams({ readinessReport: { global_score: 40 } });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "readiness_passed");
    expect(proof).toBeUndefined();
  });

  test("detects release_gate_passed when release score >= 50", () => {
    const params = makeFullParams({ releaseReport: { global_score: 65 } });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "release_gate_passed");
    expect(proof).toBeDefined();
  });

  test("detects time_saved_estimated when tasks/docs present", () => {
    const params = makeFullParams({
      tasks: [makeTask({ status: "done" })],
      documents: [makeDocument({ family: "contract" })],
    });
    const proofs = detectPierreTrialProofs(params);
    const proof = proofs.find((p) => p.type === "time_saved_estimated");
    expect(proof).toBeDefined();
  });

  test("returns empty proofs for empty params", () => {
    const proofs = detectPierreTrialProofs({});
    expect(Array.isArray(proofs)).toBe(true);
    expect(proofs).toHaveLength(0);
  });

  test("all proof value_scores are between 0 and 100", () => {
    const params = makeFullParams();
    const proofs = detectPierreTrialProofs(params);
    for (const p of proofs) {
      expect(p.value_score).toBeGreaterThanOrEqual(0);
      expect(p.value_score).toBeLessThanOrEqual(100);
    }
  });
});

// ── detectPierreTrialBlockers ─────────────────────────────────────────────────

describe("detectPierreTrialBlockers", () => {
  test("detects missing_company_memory when no companyMemory", () => {
    const params = makeFullParams({ companyMemory: null });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "missing_company_memory");
    expect(b).toBeDefined();
  });

  test("detects missing_employees when no employees in memory", () => {
    const cm = {
      ...makeCompanyMemory(),
      reusable_rh_context_json: { employees: [], document_system: { default_template: "cdi" } },
    };
    const params = makeFullParams({ companyMemory: cm, employees: [] });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "missing_employees");
    expect(b).toBeDefined();
  });

  test("detects no_missions when missions array is empty", () => {
    const params = makeFullParams({ missions: [] });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "no_missions");
    expect(b).toBeDefined();
  });

  test("detects no_completed_tasks when tasks exist but none done", () => {
    const params = makeFullParams({
      tasks: [makeTask({ status: "pending" }), makeTask({ id: "t-2", status: "running" })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "no_completed_tasks");
    expect(b).toBeDefined();
  });

  test("detects no_traceability when logs missing and missions exist", () => {
    const params = makeFullParams({ logs: [] });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "no_traceability");
    expect(b).toBeDefined();
  });

  test("detects schema_risk when tasks have scheduled_for", () => {
    const params = makeFullParams({
      tasks: [makeTask({ scheduled_for: "2026-05-01T10:00:00Z" })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "schema_risk");
    expect(b).toBeDefined();
    expect(b!.severity).toBe("critical");
  });

  test("detects schema_risk when logs use level/event/payload", () => {
    const params = makeFullParams({
      logs: [makeLog({ level: "info", event: "task.done", payload: {} })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "schema_risk");
    expect(b).toBeDefined();
    expect(b!.severity).toBe("critical");
  });

  test("detects safety_risk when email task executed without approval", () => {
    const params = makeFullParams({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: false })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "safety_risk");
    expect(b).toBeDefined();
    expect(b!.severity).toBe("critical");
  });

  test("does not detect safety_risk when email task has approval_required=true", () => {
    const params = makeFullParams({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: true })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "safety_risk");
    expect(b).toBeUndefined();
  });

  test("does not detect safety_risk for send_email when pending", () => {
    const params = makeFullParams({
      tasks: [makeTask({ type: "send_email", status: "pending", approval_required: false })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "safety_risk");
    expect(b).toBeUndefined();
  });

  test("detects sensitive_case_uncontrolled for contract completed without approval", () => {
    const params = makeFullParams({
      documents: [makeDocument({ family: "contract", status: "done", approval_required: false })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "sensitive_case_uncontrolled");
    expect(b).toBeDefined();
  });

  test("does not detect sensitive_case_uncontrolled for non-sensitive doc", () => {
    const params = makeFullParams({
      documents: [makeDocument({ family: "internal_note", status: "done", approval_required: false })],
    });
    const blockers = detectPierreTrialBlockers(params);
    const b = blockers.find((b) => b.type === "sensitive_case_uncontrolled");
    expect(b).toBeUndefined();
  });

  test("all blockers have required fields", () => {
    const params = makeFullParams({ companyMemory: null, missions: [], tasks: [] });
    const blockers = detectPierreTrialBlockers(params);
    for (const b of blockers) {
      expect(typeof b.type).toBe("string");
      expect(typeof b.label).toBe("string");
      expect(typeof b.reason).toBe("string");
      expect(["low", "medium", "high", "critical"]).toContain(b.severity);
      expect(typeof b.recommended_fix).toBe("string");
    }
  });

  test("handles empty params without error", () => {
    const blockers = detectPierreTrialBlockers({});
    expect(Array.isArray(blockers)).toBe(true);
  });
});

// ── buildPierreTrialDayPlan ───────────────────────────────────────────────────

describe("buildPierreTrialDayPlan", () => {
  test("returns exactly 8 days", () => {
    const dayPlan = buildPierreTrialDayPlan(makeFullParams());
    expect(dayPlan).toHaveLength(8);
  });

  test("days are in correct order", () => {
    const dayPlan = buildPierreTrialDayPlan(makeFullParams());
    const expectedDays = [
      "day_0_setup", "day_1_first_mission", "day_2_employee_files", "day_3_documents",
      "day_4_continuity", "day_5_sensitive_control", "day_6_value_review", "day_7_conversion",
    ];
    expect(dayPlan.map((d) => d.day)).toEqual(expectedDays);
  });

  test("each day has required fields", () => {
    const dayPlan = buildPierreTrialDayPlan(makeFullParams());
    for (const day of dayPlan) {
      expect(typeof day.day).toBe("string");
      expect(typeof day.label).toBe("string");
      expect(typeof day.objective).toBe("string");
      expect(Array.isArray(day.recommended_missions)).toBe(true);
      expect(Array.isArray(day.expected_proofs)).toBe(true);
      expect(Array.isArray(day.success_criteria)).toBe(true);
      expect(["not_started", "available", "in_progress", "done", "blocked"]).toContain(day.status);
      expect(Array.isArray(day.blockers)).toBe(true);
    }
  });

  test("day_0_setup is done when company memory and employees present", () => {
    const params = makeFullParams({
      companyMemory: makeCompanyMemory(),
      employees: [makeEmployee()],
    });
    const dayPlan = buildPierreTrialDayPlan(params);
    const day0 = dayPlan.find((d) => d.day === "day_0_setup");
    expect(day0!.status).toBe("done");
  });

  test("day_0_setup has blockers when company memory missing", () => {
    const params = makeFullParams({ companyMemory: null });
    const dayPlan = buildPierreTrialDayPlan(params);
    const day0 = dayPlan.find((d) => d.day === "day_0_setup");
    expect(day0!.blockers.length).toBeGreaterThan(0);
  });

  test("day_7_conversion has critical blockers when schema_risk present", () => {
    const params = makeFullParams({
      tasks: [makeTask({ scheduled_for: "2026-05-01" })],
    });
    const dayPlan = buildPierreTrialDayPlan(params);
    const day7 = dayPlan.find((d) => d.day === "day_7_conversion");
    expect(day7!.blockers.some((b) => b.severity === "critical")).toBe(true);
  });

  test("day_3_documents is done when premium docs exist", () => {
    const params = makeFullParams({
      missions: [makeMission()],
      tasks: [makeTask({ status: "done" })],
      documents: [makeDocument({ family: "contract" })],
    });
    const dayPlan = buildPierreTrialDayPlan(params);
    const day3 = dayPlan.find((d) => d.day === "day_3_documents");
    expect(day3!.status).toBe("done");
  });
});

// ── scorePierreTrialValue ─────────────────────────────────────────────────────

describe("scorePierreTrialValue", () => {
  test("returns score between 0 and 100", () => {
    const metrics = makeMetrics();
    const proofs = makeProofs();
    const result = scorePierreTrialValue(metrics, proofs);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("returns higher score with more completed tasks and docs", () => {
    const metricsLow = makeMetrics({ completed_tasks: 0, premium_documents: 0 });
    const metricsHigh = makeMetrics({ completed_tasks: 8, premium_documents: 5 });
    const proofs = makeProofs();
    const scoreLow = scorePierreTrialValue(metricsLow, proofs);
    const scoreHigh = scorePierreTrialValue(metricsHigh, proofs);
    expect(scoreHigh.score).toBeGreaterThan(scoreLow.score);
  });

  test("hours_saved_low <= hours_saved_high", () => {
    const result = scorePierreTrialValue(makeMetrics(), makeProofs());
    expect(result.estimated_hours_saved_low).toBeLessThanOrEqual(result.estimated_hours_saved_high);
  });

  test("eur_low <= eur_high", () => {
    const result = scorePierreTrialValue(makeMetrics(), makeProofs());
    expect(result.estimated_value_eur_low).toBeLessThanOrEqual(result.estimated_value_eur_high);
  });

  test("confidence is one of low/medium/high", () => {
    const result = scorePierreTrialValue(makeMetrics(), makeProofs());
    expect(["low", "medium", "high"]).toContain(result.confidence);
  });

  test("returns high confidence when score >= 70 and release/readiness scores high", () => {
    const metrics = makeMetrics({ release_score: 80, readiness_score: 80 });
    const proofs = makeProofs();
    const result = scorePierreTrialValue(metrics, proofs);
    expect(result.confidence).toBe("high");
  });

  test("returns non-empty explanation", () => {
    const result = scorePierreTrialValue(makeMetrics(), makeProofs());
    expect(result.explanation.length).toBeGreaterThan(10);
  });

  test("returns non-empty label", () => {
    const result = scorePierreTrialValue(makeMetrics(), makeProofs());
    expect(result.label.length).toBeGreaterThan(5);
  });

  test("handles zero metrics gracefully", () => {
    const metrics = makeMetrics({
      completed_tasks: 0, premium_documents: 0, employee_files_ready: 0,
      pdf_documents: 0, release_score: null, readiness_score: null,
    });
    const result = scorePierreTrialValue(metrics, []);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── scorePierreTrialConversion ────────────────────────────────────────────────

describe("scorePierreTrialConversion", () => {
  test("returns score between 0 and 100", () => {
    const result = scorePierreTrialConversion({
      metrics: makeMetrics(),
      proofs: makeProofs(),
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("probability_band is valid", () => {
    const result = scorePierreTrialConversion({
      metrics: makeMetrics(),
      proofs: makeProofs(),
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(["low", "medium", "high", "very_high"]).toContain(result.probability_band);
  });

  test("score >= 85 gives very_high band", () => {
    const highMetrics = makeMetrics({
      completed_tasks: 10, premium_documents: 5, employee_files_ready: 5,
      release_score: 90, readiness_score: 90, missions_total: 10,
    });
    const highValue = makeValueScore({ score: 90 });
    const result = scorePierreTrialConversion({
      metrics: highMetrics, proofs: makeProofs(), blockers: [], valueScore: highValue,
    });
    expect(result.probability_band).toBe("very_high");
  });

  test("critical blockers reduce score significantly", () => {
    const criticalBlockers = makeBlockers([
      { severity: "critical", type: "schema_risk" },
      { severity: "critical", type: "safety_risk" },
    ]);
    const withoutBlockers = scorePierreTrialConversion({
      metrics: makeMetrics(), proofs: makeProofs(), blockers: [], valueScore: makeValueScore(),
    });
    const withBlockers = scorePierreTrialConversion({
      metrics: makeMetrics(), proofs: makeProofs(), blockers: criticalBlockers, valueScore: makeValueScore(),
    });
    expect(withBlockers.score).toBeLessThan(withoutBlockers.score);
  });

  test("no missions reduces score", () => {
    const metricsWithMissions = makeMetrics({ missions_total: 5 });
    const metricsNoMissions = makeMetrics({ missions_total: 0 });
    const withMissions = scorePierreTrialConversion({
      metrics: metricsWithMissions, proofs: [], blockers: [], valueScore: makeValueScore(),
    });
    const withoutMissions = scorePierreTrialConversion({
      metrics: metricsNoMissions, proofs: [], blockers: [], valueScore: makeValueScore(),
    });
    expect(withMissions.score).toBeGreaterThan(withoutMissions.score);
  });

  test("returns non-empty reasons array", () => {
    const result = scorePierreTrialConversion({
      metrics: makeMetrics(), proofs: makeProofs(), blockers: [], valueScore: makeValueScore({ score: 70 }),
    });
    expect(Array.isArray(result.reasons)).toBe(true);
  });

  test("low band when score < 45", () => {
    const result = scorePierreTrialConversion({
      metrics: makeMetrics({ missions_total: 0, completed_tasks: 0, logs_total: 0 }),
      proofs: [],
      blockers: makeBlockers([
        { severity: "critical" }, { severity: "critical" }, { severity: "critical" },
      ]),
      valueScore: makeValueScore({ score: 5 }),
    });
    expect(result.probability_band).toBe("low");
  });
});

// ── classifyPierreTrialActivationStage ───────────────────────────────────────

describe("classifyPierreTrialActivationStage", () => {
  test("returns blocked when critical blockers present", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics(),
      proofs: [],
      blockers: makeBlockers([{ severity: "critical", type: "schema_risk" }]),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
    });
    expect(stage).toBe("blocked");
  });

  test("returns not_started when no data at all", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics({ missions_total: 0, completed_tasks: 0, logs_total: 0 }),
      proofs: [],
      blockers: [],
      valueScore: makeValueScore({ score: 0 }),
      conversionScore: makeConversionScore({ score: 0 }),
    });
    expect(stage).toBe("not_started");
  });

  test("returns conversion_ready when very_high probability", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics(),
      proofs: makeProofs(),
      blockers: [],
      valueScore: makeValueScore({ score: 75 }),
      conversionScore: makeConversionScore({ probability_band: "very_high", score: 90 }),
    });
    expect(stage).toBe("conversion_ready");
  });

  test("returns value_proven when value strong and tasks/docs sufficient", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics({ completed_tasks: 5, documents_generated: 3 }),
      proofs: makeProofs(),
      blockers: [],
      valueScore: makeValueScore({ score: 65 }),
      conversionScore: makeConversionScore({ score: 50, probability_band: "medium" }),
    });
    expect(stage).toBe("value_proven");
  });

  test("returns first_value_started when missions exist", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics({ missions_total: 1, completed_tasks: 1, documents_generated: 0 }),
      proofs: [],
      blockers: [],
      valueScore: makeValueScore({ score: 30 }),
      conversionScore: makeConversionScore({ score: 40, probability_band: "low" }),
    });
    expect(stage).toBe("first_value_started");
  });

  test("returns ready_to_launch when no missions but no setup blockers", () => {
    const stage = classifyPierreTrialActivationStage({
      metrics: makeMetrics({ missions_total: 0, completed_tasks: 0, logs_total: 5 }),
      proofs: [],
      blockers: [],
      valueScore: makeValueScore({ score: 20 }),
      conversionScore: makeConversionScore({ score: 20, probability_band: "low" }),
    });
    expect(stage).toBe("ready_to_launch");
  });
});

// ── classifyPierreTrialActivationStatus ──────────────────────────────────────

describe("classifyPierreTrialActivationStatus", () => {
  test("returns black when critical blockers present", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "first_value_started",
      blockers: makeBlockers([{ severity: "critical" }]),
      valueScore: makeValueScore(),
    });
    expect(status).toBe("black");
  });

  test("returns black when stage is blocked", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "blocked",
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(status).toBe("black");
  });

  test("returns red when 2+ high blockers", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "first_value_started",
      blockers: makeBlockers([{ severity: "high" }, { severity: "high" }]),
      valueScore: makeValueScore(),
    });
    expect(status).toBe("red");
  });

  test("returns green for conversion_ready with no blockers", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "conversion_ready",
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(status).toBe("green");
  });

  test("returns green for value_proven", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "value_proven",
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(status).toBe("green");
  });

  test("returns yellow for ready_to_launch", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "ready_to_launch",
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(status).toBe("yellow");
  });

  test("returns red for not_started", () => {
    const status = classifyPierreTrialActivationStatus({
      stage: "not_started",
      blockers: [],
      valueScore: makeValueScore(),
    });
    expect(status).toBe("red");
  });
});

// ── buildPierreTrialRecommendedMissions ───────────────────────────────────────

describe("buildPierreTrialRecommendedMissions", () => {
  test("returns at most 5 recommendations", () => {
    const params = makeFullParams({ missions: [], employees: [], documents: [] });
    const recs = buildPierreTrialRecommendedMissions(params, []);
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  test("recommends audit_rh_initial when no missions", () => {
    const params = makeFullParams({ missions: [] });
    const recs = buildPierreTrialRecommendedMissions(params, []);
    expect(recs.some((r) => r.key === "audit_rh_initial")).toBe(true);
  });

  test("recommends create_employee_file when no employees", () => {
    const params = makeFullParams({ employees: [], employeeFiles: [] });
    const recs = buildPierreTrialRecommendedMissions(params, []);
    expect(recs.some((r) => r.key === "create_employee_file")).toBe(true);
  });

  test("recommends sensitive_case_review when safety_risk blocker present", () => {
    const params = makeFullParams();
    const blockers = makeBlockers([{ type: "safety_risk" as const, severity: "critical" }]);
    const recs = buildPierreTrialRecommendedMissions(params, blockers);
    expect(recs.some((r) => r.key === "sensitive_case_review")).toBe(true);
  });

  test("all recommended templates have valid keys", () => {
    const params = makeFullParams({ missions: [], employees: [], documents: [] });
    const recs = buildPierreTrialRecommendedMissions(params, []);
    for (const r of recs) {
      expect(typeof r.key).toBe("string");
      expect(r.key.length).toBeGreaterThan(0);
    }
  });

  test("returns at least 1 recommendation even with full params", () => {
    const recs = buildPierreTrialRecommendedMissions(makeFullParams(), []);
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });
});

// ── buildPierreTrialFirstValuePrompt ─────────────────────────────────────────

describe("buildPierreTrialFirstValuePrompt", () => {
  test("returns prompt for valid template key", () => {
    const result = buildPierreTrialFirstValuePrompt({ template_key: "audit_rh_initial" });
    expect(result.template_key).toBe("audit_rh_initial");
    expect(result.prompt.length).toBeGreaterThan(20);
    expect(result.title.length).toBeGreaterThan(5);
  });

  test("injects company_name into context when provided", () => {
    const result = buildPierreTrialFirstValuePrompt({
      template_key: "audit_rh_initial",
      company_name: "Acme Corp",
    });
    expect(result.prompt).toContain("Acme Corp");
  });

  test("injects employee_name into prompt when provided", () => {
    const result = buildPierreTrialFirstValuePrompt({
      template_key: "create_employee_file",
      employee_name: "Jean Dupont",
    });
    expect(result.prompt).toContain("Jean Dupont");
  });

  test("appends safety warning for sensitive_case_review", () => {
    const result = buildPierreTrialFirstValuePrompt({ template_key: "sensitive_case_review" });
    expect(result.prompt).toContain("IMPORTANT");
    expect(result.prompt).toContain("validation humaine explicite");
  });

  test("appends safety warning for generate_contract_or_document", () => {
    const result = buildPierreTrialFirstValuePrompt({ template_key: "generate_contract_or_document" });
    expect(result.prompt).toContain("IMPORTANT");
    expect(result.requires_human_validation).toBe(true);
  });

  test("does not append safety warning for audit_rh_initial", () => {
    const result = buildPierreTrialFirstValuePrompt({ template_key: "audit_rh_initial" });
    expect(result.requires_human_validation).toBe(false);
  });

  test("returns expected_outputs and required_inputs arrays", () => {
    const result = buildPierreTrialFirstValuePrompt({ template_key: "onboarding_plan" });
    expect(Array.isArray(result.expected_outputs)).toBe(true);
    expect(result.expected_outputs.length).toBeGreaterThan(0);
    expect(Array.isArray(result.required_inputs)).toBe(true);
  });

  test("handles unknown template_key gracefully", () => {
    const result = buildPierreTrialFirstValuePrompt({
      template_key: "unknown_key" as "audit_rh_initial",
    });
    expect(result.template_key).toBe("unknown_key");
    expect(result.requires_human_validation).toBe(true);
  });
});

// ── buildPierreTrialNextActions ───────────────────────────────────────────────

describe("buildPierreTrialNextActions", () => {
  test("returns at most 8 actions", () => {
    const actions = buildPierreTrialNextActions({
      stage: "blocked",
      blockers: makeBlockers([
        { severity: "critical", type: "schema_risk" },
        { severity: "critical", type: "safety_risk" },
        { severity: "high", type: "missing_employees" },
      ]),
      recommendedMissions: buildPierreTrialMissionTemplates().slice(0, 3),
      conversionScore: makeConversionScore(),
    });
    expect(actions.length).toBeLessThanOrEqual(8);
  });

  test("returns no_action when no issues", () => {
    const actions = buildPierreTrialNextActions({
      stage: "value_proven",
      blockers: [],
      recommendedMissions: [],
      conversionScore: makeConversionScore({ probability_band: "medium", score: 55 }),
    });
    const noAction = actions.find((a) => a.type === "no_action");
    expect(noAction).toBeUndefined();
  });

  test("returns resolve_blocker for critical blockers first", () => {
    const actions = buildPierreTrialNextActions({
      stage: "blocked",
      blockers: makeBlockers([{ severity: "critical", type: "schema_risk" }]),
      recommendedMissions: [],
      conversionScore: makeConversionScore(),
    });
    expect(actions[0].type).toBe("resolve_blocker");
    expect(actions[0].priority).toBe("urgent");
  });

  test("returns prepare_conversion for conversion_ready stage", () => {
    const actions = buildPierreTrialNextActions({
      stage: "conversion_ready",
      blockers: [],
      recommendedMissions: [],
      conversionScore: makeConversionScore({ probability_band: "very_high" }),
    });
    const conv = actions.find((a) => a.type === "prepare_conversion");
    expect(conv).toBeDefined();
  });

  test("returns complete_setup for setup_needed stage with config blockers", () => {
    const actions = buildPierreTrialNextActions({
      stage: "setup_needed",
      blockers: makeBlockers([{ type: "missing_company_memory", severity: "high" }]),
      recommendedMissions: [],
      conversionScore: makeConversionScore(),
    });
    const setup = actions.find((a) => a.type === "complete_setup");
    expect(setup).toBeDefined();
  });

  test("all actions have valid priority", () => {
    const actions = buildPierreTrialNextActions({
      stage: "first_value_started",
      blockers: [],
      recommendedMissions: buildPierreTrialMissionTemplates().slice(0, 2),
      conversionScore: makeConversionScore(),
    });
    for (const a of actions) {
      expect(["low", "normal", "high", "urgent"]).toContain(a.priority);
    }
  });
});

// ── buildPierreTrialDigest ───────────────────────────────────────────────────

describe("buildPierreTrialDigest", () => {
  test("returns blocked tone for blocked stage", () => {
    const digest = buildPierreTrialDigest({
      stage: "blocked",
      status: "black",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
      blockers: makeBlockers([{ severity: "critical", type: "schema_risk" }]),
    });
    expect(digest.tone).toBe("blocked");
    expect(digest.text.length).toBeGreaterThan(10);
  });

  test("returns setup tone for not_started stage", () => {
    const digest = buildPierreTrialDigest({
      stage: "not_started",
      status: "red",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
      blockers: [],
    });
    expect(digest.tone).toBe("setup");
  });

  test("returns conversion tone for conversion_ready stage", () => {
    const digest = buildPierreTrialDigest({
      stage: "conversion_ready",
      status: "green",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore({ score: 90 }),
      blockers: [],
    });
    expect(digest.tone).toBe("conversion");
    expect(digest.text).toContain("abonnement");
  });

  test("returns value tone for value_proven stage", () => {
    const digest = buildPierreTrialDigest({
      stage: "value_proven",
      status: "green",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
      blockers: [],
    });
    expect(digest.tone).toBe("value");
  });

  test("returns action tone for first_value_started", () => {
    const digest = buildPierreTrialDigest({
      stage: "first_value_started",
      status: "yellow",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
      blockers: [],
    });
    expect(digest.tone).toBe("action");
  });

  test("blocked tone when critical blockers even if stage not blocked", () => {
    const digest = buildPierreTrialDigest({
      stage: "first_value_started",
      status: "black",
      metrics: makeMetrics(),
      valueScore: makeValueScore(),
      conversionScore: makeConversionScore(),
      blockers: makeBlockers([{ severity: "critical", type: "safety_risk" }]),
    });
    expect(digest.tone).toBe("blocked");
  });
});

// ── buildPierreTrialActivationReport ─────────────────────────────────────────

describe("buildPierreTrialActivationReport", () => {
  test("returns a complete report", () => {
    const report = buildPierreTrialActivationReport(makeFullParams());
    expect(report.stage).toBeDefined();
    expect(report.status).toBeDefined();
    expect(typeof report.activation_score).toBe("number");
    expect(report.metrics).toBeDefined();
    expect(report.value_score).toBeDefined();
    expect(report.conversion_score).toBeDefined();
    expect(Array.isArray(report.proofs)).toBe(true);
    expect(Array.isArray(report.blockers)).toBe(true);
    expect(Array.isArray(report.day_plan)).toBe(true);
    expect(Array.isArray(report.recommended_missions)).toBe(true);
    expect(Array.isArray(report.next_actions)).toBe(true);
    expect(report.digest).toBeDefined();
    expect(typeof report.generated_at).toBe("string");
  });

  test("activation_score is between 0 and 100", () => {
    const report = buildPierreTrialActivationReport(makeFullParams());
    expect(report.activation_score).toBeGreaterThanOrEqual(0);
    expect(report.activation_score).toBeLessThanOrEqual(100);
  });

  test("activation_score capped at 49 when critical blockers present", () => {
    const params = makeFullParams({
      tasks: [makeTask({ scheduled_for: "2026-05-01" })],
    });
    const report = buildPierreTrialActivationReport(params);
    expect(report.activation_score).toBeLessThanOrEqual(49);
  });

  test("stage is blocked when critical blockers present", () => {
    const params = makeFullParams({
      tasks: [makeTask({ type: "email.send", status: "done", approval_required: false })],
    });
    const report = buildPierreTrialActivationReport(params);
    expect(report.stage).toBe("blocked");
  });

  test("day_plan has exactly 8 days", () => {
    const report = buildPierreTrialActivationReport(makeFullParams());
    expect(report.day_plan).toHaveLength(8);
  });

  test("handles empty params without error", () => {
    const report = buildPierreTrialActivationReport({});
    expect(report).toBeDefined();
    expect(typeof report.activation_score).toBe("number");
  });

  test("generated_at is a valid ISO string", () => {
    const report = buildPierreTrialActivationReport(makeFullParams());
    expect(() => new Date(report.generated_at)).not.toThrow();
    expect(new Date(report.generated_at).toISOString()).toBe(report.generated_at);
  });

  test("uses provided now param for generated_at", () => {
    const now = new Date("2026-05-19T12:00:00Z");
    const report = buildPierreTrialActivationReport({ ...makeFullParams(), now });
    expect(report.generated_at).toBe("2026-05-19T12:00:00.000Z");
  });

  test("status is green for high-value params with no blockers", () => {
    const goodParams: PierreTrialActivationParams = {
      companyMemory: makeCompanyMemory(),
      missions: [makeMission(), makeMission({ id: "m-2" }), makeMission({ id: "m-3" })],
      tasks: [
        makeTask({ status: "done" }),
        makeTask({ id: "t-2", status: "done" }),
        makeTask({ id: "t-3", status: "done" }),
        makeTask({ id: "t-4", status: "done" }),
      ],
      documents: [
        makeDocument({ family: "contract", has_pdf: true, approval_required: true }),
        makeDocument({ id: "d-2", family: "onboarding", has_pdf: true, approval_required: true }),
        makeDocument({ id: "d-3", family: "pre_payroll" }),
      ],
      logs: [makeLog(), makeLog({ id: "l-2" })],
      employees: [makeEmployee()],
      employeeFiles: [{ id: "ef-1" }, { id: "ef-2" }],
      releaseReport: { global_score: 80 },
      readinessReport: { global_score: 75 },
    };
    const report = buildPierreTrialActivationReport(goodParams);
    expect(["green", "yellow"]).toContain(report.status);
  });
});

// ── buildMissionTrialActivationHint ──────────────────────────────────────────

describe("buildMissionTrialActivationHint", () => {
  test("returns a hint with required fields", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    expect(typeof hint.stage).toBe("string");
    expect(typeof hint.status).toBe("string");
    expect(typeof hint.value_score).toBe("number");
    expect(typeof hint.conversion_score).toBe("number");
    expect(typeof hint.next_action_label).toBe("string");
  });

  test("value_score is between 0 and 100", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    expect(hint.value_score).toBeGreaterThanOrEqual(0);
    expect(hint.value_score).toBeLessThanOrEqual(100);
  });

  test("conversion_score is between 0 and 100", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    expect(hint.conversion_score).toBeGreaterThanOrEqual(0);
    expect(hint.conversion_score).toBeLessThanOrEqual(100);
  });

  test("handles empty arrays gracefully", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [], [], []);
    expect(hint).toBeDefined();
    expect(hint.stage).toBeDefined();
  });

  test("detects blocked stage when schema_risk task present", () => {
    const hint = buildMissionTrialActivationHint(
      makeMission(),
      [makeTask({ scheduled_for: "2026-05-01" })],
      [],
      [],
    );
    expect(hint.stage).toBe("blocked");
    expect(hint.status).toBe("black");
  });

  test("next_action_label is non-empty", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    expect(hint.next_action_label.length).toBeGreaterThan(5);
  });

  test("valid stage value", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    const validStages = [
      "not_started", "setup_needed", "ready_to_launch",
      "first_value_started", "value_proven", "conversion_ready", "blocked",
    ];
    expect(validStages).toContain(hint.stage);
  });

  test("valid status value", () => {
    const hint = buildMissionTrialActivationHint(makeMission(), [makeTask()], [makeDocument()], [makeLog()]);
    expect(["green", "yellow", "orange", "red", "black"]).toContain(hint.status);
  });
});
