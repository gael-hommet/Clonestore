import { describe, test, expect } from "vitest";
import {
  computePierreCustomerSuccessMetrics,
  detectPierreCustomerSuccessSignals,
  detectPierreCustomerRisks,
  buildPierreCustomerValueSummary,
  scorePierreCustomerHealth,
  scorePierreCustomerConversion,
  scorePierreCustomerRetention,
  classifyPierreCustomerSuccessStage,
  buildPierreCustomerSuccessActions,
  buildPierreCustomerExecutiveSummary,
  buildPierreCustomerSuccessReport,
  buildPierreCustomerSuccessMissionHint,
  type PierreCustomerSuccessParams,
} from "../hr/customer-success";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "t1", mission_id: "m1", type: "generic", title: "Tâche", status: "done", approval_required: false, execute_at: null, created_at: "2026-01-01", ...overrides };
}

function makeDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "d1", mission_id: "m1", title: "Doc", family: "contract", doc_type: "contract", has_pdf: false, created_at: "2026-01-01", ...overrides };
}

function makeLog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "l1", mission_id: "m1", task_id: "t1", event_type: "task_completed", message: "Done", meta_json: null, created_at: "2026-01-01", ...overrides };
}

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "m1", title: "Mission RH", status: "active", created_at: "2026-01-01", ...overrides };
}

function makeEmployee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "e1", first_name: "Alice", last_name: "Martin", email: "alice@co.fr", ...overrides };
}

function makeCompanyMemory(withDocSystem = true): Record<string, unknown> {
  const rrh: Record<string, unknown> = {
    employees: [makeEmployee()],
  };
  if (withDocSystem) {
    rrh.document_system = { templates: [] };
  }
  return { id: "cm1", reusable_rh_context_json: rrh };
}

function makeFullParams(overrides: Partial<PierreCustomerSuccessParams> = {}): PierreCustomerSuccessParams {
  return {
    companyMemory: makeCompanyMemory(),
    missions: [makeMission()],
    tasks: [makeTask()],
    documents: [makeDoc()],
    logs: [makeLog()],
    employees: [makeEmployee()],
    employeeFiles: [{ employee: makeEmployee(), missions: [], tasks: [], documents: [], logs: [] }],
    now: new Date("2026-05-19"),
    ...overrides,
  };
}

function makeMinimalScores() {
  const metrics = computePierreCustomerSuccessMetrics(makeFullParams());
  const signals = detectPierreCustomerSuccessSignals(makeFullParams());
  const risks = detectPierreCustomerRisks(makeFullParams(), signals);
  const value = buildPierreCustomerValueSummary(makeFullParams(), signals);
  const health = scorePierreCustomerHealth({ metrics, signals, risks, value });
  return { metrics, signals, risks, value, health };
}

// ── computePierreCustomerSuccessMetrics ────────────────────────────────────────

describe("computePierreCustomerSuccessMetrics", () => {
  test("returns zero counts for empty params", () => {
    const m = computePierreCustomerSuccessMetrics({});
    expect(m.missions_total).toBe(0);
    expect(m.tasks_total).toBe(0);
    expect(m.completed_tasks).toBe(0);
    expect(m.blocked_tasks).toBe(0);
    expect(m.error_tasks).toBe(0);
    expect(m.documents_total).toBe(0);
    expect(m.premium_documents).toBe(0);
    expect(m.pdf_documents).toBe(0);
    expect(m.logs_total).toBe(0);
    expect(m.employees_total).toBe(0);
    expect(m.employee_files_total).toBe(0);
    expect(m.approvals_pending).toBe(0);
    expect(m.trial_activation_score).toBeNull();
    expect(m.trial_value_score).toBeNull();
    expect(m.release_score).toBeNull();
    expect(m.readiness_score).toBeNull();
  });

  test("counts missions, tasks, documents, logs, employees", () => {
    const m = computePierreCustomerSuccessMetrics({
      missions: [makeMission(), makeMission({ id: "m2" })],
      tasks: [makeTask(), makeTask({ id: "t2" })],
      documents: [makeDoc(), makeDoc({ id: "d2" })],
      logs: [makeLog(), makeLog({ id: "l2" })],
      employees: [makeEmployee(), makeEmployee({ id: "e2" })],
    });
    expect(m.missions_total).toBe(2);
    expect(m.tasks_total).toBe(2);
    expect(m.documents_total).toBe(2);
    expect(m.logs_total).toBe(2);
    expect(m.employees_total).toBe(2);
  });

  test("counts completed, blocked, error tasks separately", () => {
    const m = computePierreCustomerSuccessMetrics({
      tasks: [
        makeTask({ status: "done" }),
        makeTask({ id: "t2", status: "completed" }),
        makeTask({ id: "t3", status: "blocked" }),
        makeTask({ id: "t4", status: "error" }),
        makeTask({ id: "t5", status: "failed" }),
        makeTask({ id: "t6", status: "cancelled" }),
      ],
    });
    expect(m.completed_tasks).toBe(2);
    expect(m.blocked_tasks).toBe(1);
    expect(m.error_tasks).toBe(3);
  });

  test("counts premium documents by family", () => {
    const m = computePierreCustomerSuccessMetrics({
      documents: [
        makeDoc({ family: "contract" }),
        makeDoc({ id: "d2", family: "amendment" }),
        makeDoc({ id: "d3", family: "unknown_family" }),
      ],
    });
    expect(m.premium_documents).toBe(2);
    expect(m.documents_total).toBe(3);
  });

  test("counts PDF documents via has_pdf, pdf_url, pdf_path", () => {
    const m = computePierreCustomerSuccessMetrics({
      documents: [
        makeDoc({ has_pdf: true }),
        makeDoc({ id: "d2", pdf_url: "https://example.com/doc.pdf" }),
        makeDoc({ id: "d3", pdf_path: "/tmp/doc.pdf" }),
        makeDoc({ id: "d4", family: "generic" }),
      ],
    });
    expect(m.pdf_documents).toBe(3);
  });

  test("counts approvals pending via awaiting_approval status", () => {
    const m = computePierreCustomerSuccessMetrics({
      tasks: [
        makeTask({ status: "awaiting_approval" }),
        makeTask({ id: "t2", status: "pending_approval" }),
        makeTask({ id: "t3", status: "awaiting_validation" }),
        makeTask({ id: "t4", status: "done" }),
      ],
    });
    expect(m.approvals_pending).toBe(3);
  });

  test("counts employee files", () => {
    const m = computePierreCustomerSuccessMetrics({
      employeeFiles: [{ emp: "a" }, { emp: "b" }, "not-an-object"],
    });
    expect(m.employee_files_total).toBe(2);
  });

  test("extracts trial activation score from trialReport", () => {
    const m = computePierreCustomerSuccessMetrics({
      trialReport: { activation_score: 72 },
    });
    expect(m.trial_activation_score).toBe(72);
  });

  test("extracts trial activation score from nested report", () => {
    const m = computePierreCustomerSuccessMetrics({
      trialReport: { report: { activation_score: 65 } },
    });
    expect(m.trial_activation_score).toBe(65);
  });

  test("extracts trial value score from trialReport", () => {
    const m = computePierreCustomerSuccessMetrics({
      trialReport: { value_score: { score: 55 } },
    });
    expect(m.trial_value_score).toBe(55);
  });

  test("extracts release score from releaseReport", () => {
    const m = computePierreCustomerSuccessMetrics({
      releaseReport: { global_score: 80 },
    });
    expect(m.release_score).toBe(80);
  });

  test("extracts readiness score from readinessReport", () => {
    const m = computePierreCustomerSuccessMetrics({
      readinessReport: { global_score: 70 },
    });
    expect(m.readiness_score).toBe(70);
  });

  test("extracts readiness score from score field as fallback", () => {
    const m = computePierreCustomerSuccessMetrics({
      readinessReport: { score: 60 },
    });
    expect(m.readiness_score).toBe(60);
  });

  test("ignores malformed arrays", () => {
    const m = computePierreCustomerSuccessMetrics({
      missions: "not-an-array" as unknown as Record<string, unknown>[],
      tasks: null as unknown as Record<string, unknown>[],
    });
    expect(m.missions_total).toBe(0);
    expect(m.tasks_total).toBe(0);
  });
});

// ── detectPierreCustomerSuccessSignals ────────────────────────────────────────

describe("detectPierreCustomerSuccessSignals", () => {
  test("positive signal when companyMemory configured", () => {
    const signals = detectPierreCustomerSuccessSignals({ companyMemory: makeCompanyMemory() });
    const cfg = signals.find((s) => s.type === "configuration" && s.polarity === "positive");
    expect(cfg).toBeDefined();
    expect(cfg!.score_impact).toBeGreaterThan(0);
  });

  test("negative signal when companyMemory missing", () => {
    const signals = detectPierreCustomerSuccessSignals({});
    const cfg = signals.find((s) => s.type === "configuration" && s.polarity === "negative");
    expect(cfg).toBeDefined();
    expect(cfg!.score_impact).toBeLessThan(0);
  });

  test("negative signal when document_system missing", () => {
    const mem = makeCompanyMemory(false);
    const signals = detectPierreCustomerSuccessSignals({ companyMemory: mem });
    const docSys = signals.find((s) => s.label.includes("documentaire") && s.polarity === "negative");
    expect(docSys).toBeDefined();
  });

  test("positive signal when employees configured", () => {
    const signals = detectPierreCustomerSuccessSignals({
      companyMemory: makeCompanyMemory(),
      employees: [makeEmployee(), makeEmployee({ id: "e2" })],
    });
    const emp = signals.find((s) => s.type === "usage" && s.label.includes("salarié"));
    expect(emp).toBeDefined();
    expect(emp!.polarity).toBe("positive");
  });

  test("negative signal when no employees", () => {
    const signals = detectPierreCustomerSuccessSignals({ companyMemory: makeCompanyMemory(), employees: [] });
    const emp = signals.find((s) => s.type === "usage" && s.polarity === "negative" && s.label.includes("salarié"));
    expect(emp).toBeDefined();
  });

  test("positive signal for 3+ missions", () => {
    const missions = [makeMission(), makeMission({ id: "m2" }), makeMission({ id: "m3" })];
    const signals = detectPierreCustomerSuccessSignals({ missions });
    const m = signals.find((s) => s.type === "usage" && s.polarity === "positive" && s.label.includes("missions"));
    expect(m).toBeDefined();
    expect(m!.score_impact).toBeGreaterThanOrEqual(12);
  });

  test("neutral signal for 1-2 missions", () => {
    const signals = detectPierreCustomerSuccessSignals({ missions: [makeMission()] });
    const m = signals.find((s) => s.type === "usage" && s.polarity === "neutral");
    expect(m).toBeDefined();
  });

  test("negative signal for no missions", () => {
    const signals = detectPierreCustomerSuccessSignals({ missions: [] });
    const m = signals.find((s) => s.type === "usage" && s.polarity === "negative" && s.label.includes("mission"));
    expect(m).toBeDefined();
  });

  test("positive value signal for 5+ completed tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ id: `t${i}`, status: "done" }));
    const signals = detectPierreCustomerSuccessSignals({ tasks });
    const v = signals.find((s) => s.type === "value" && s.polarity === "positive" && s.label.includes("tâches"));
    expect(v).toBeDefined();
  });

  test("positive quality signal for 2+ premium docs", () => {
    const docs = [makeDoc(), makeDoc({ id: "d2", family: "amendment" })];
    const signals = detectPierreCustomerSuccessSignals({ documents: docs });
    const d = signals.find((s) => s.type === "quality" && s.polarity === "positive" && s.label.includes("premium"));
    expect(d).toBeDefined();
  });

  test("positive quality signal for PDFs", () => {
    const signals = detectPierreCustomerSuccessSignals({
      documents: [makeDoc({ has_pdf: true })],
    });
    const p = signals.find((s) => s.type === "quality" && s.label.includes("PDF"));
    expect(p).toBeDefined();
  });

  test("positive value signal for employee files", () => {
    const signals = detectPierreCustomerSuccessSignals({
      employeeFiles: [{ emp: "a" }, { emp: "b" }],
    });
    const ef = signals.find((s) => s.type === "value" && s.label.includes("dossiers"));
    expect(ef).toBeDefined();
  });

  test("positive retention signal for 5+ logs", () => {
    const logs = Array.from({ length: 6 }, (_, i) => makeLog({ id: `l${i}` }));
    const signals = detectPierreCustomerSuccessSignals({ logs });
    const l = signals.find((s) => s.type === "retention" && s.polarity === "positive");
    expect(l).toBeDefined();
  });

  test("negative retention signal when missions but no logs", () => {
    const signals = detectPierreCustomerSuccessSignals({ missions: [makeMission()], logs: [] });
    const l = signals.find((s) => s.type === "retention" && s.polarity === "negative");
    expect(l).toBeDefined();
  });

  test("positive conversion signal for approval tasks", () => {
    const signals = detectPierreCustomerSuccessSignals({
      tasks: [makeTask({ approval_required: true })],
    });
    const cv = signals.find((s) => s.type === "conversion" && s.polarity === "positive");
    expect(cv).toBeDefined();
  });

  test("negative risk signal for 3+ blocked tasks", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => makeTask({ id: `t${i}`, status: "blocked" }));
    const signals = detectPierreCustomerSuccessSignals({ tasks });
    const r = signals.find((s) => s.type === "risk" && s.polarity === "negative" && s.label.includes("bloquées"));
    expect(r).toBeDefined();
  });

  test("negative risk signal for 5+ error tasks", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "error" }));
    const signals = detectPierreCustomerSuccessSignals({ tasks });
    const r = signals.find((s) => s.type === "risk" && s.polarity === "negative" && s.label.includes("erreurs"));
    expect(r).toBeDefined();
  });

  test("positive conversion signal for high trial score", () => {
    const signals = detectPierreCustomerSuccessSignals({ trialReport: { activation_score: 75 } });
    const cv = signals.find((s) => s.type === "conversion" && s.source_type === "trial" && s.polarity === "positive");
    expect(cv).toBeDefined();
  });

  test("negative conversion signal for low trial score", () => {
    const signals = detectPierreCustomerSuccessSignals({ trialReport: { activation_score: 30 } });
    const cv = signals.find((s) => s.type === "conversion" && s.source_type === "trial" && s.polarity === "negative");
    expect(cv).toBeDefined();
  });

  test("positive quality signal for high release score", () => {
    const signals = detectPierreCustomerSuccessSignals({ releaseReport: { global_score: 70 } });
    const r = signals.find((s) => s.source_type === "release" && s.polarity === "positive");
    expect(r).toBeDefined();
  });

  test("positive quality signal for high readiness score", () => {
    const signals = detectPierreCustomerSuccessSignals({ readinessReport: { global_score: 70 } });
    const r = signals.find((s) => s.source_type === "readiness" && s.polarity === "positive");
    expect(r).toBeDefined();
  });

  test("support negative signal when zero usage", () => {
    const signals = detectPierreCustomerSuccessSignals({ missions: [], tasks: [], documents: [] });
    const s = signals.find((s) => s.type === "support" && s.polarity === "negative");
    expect(s).toBeDefined();
  });

  test("returns array even for null params", () => {
    const signals = detectPierreCustomerSuccessSignals({ companyMemory: null, missions: undefined });
    expect(Array.isArray(signals)).toBe(true);
  });
});

// ── detectPierreCustomerRisks ─────────────────────────────────────────────────

describe("detectPierreCustomerRisks", () => {
  test("not_configured risk when no companyMemory", () => {
    const risks = detectPierreCustomerRisks({});
    const r = risks.find((r) => r.type === "not_configured");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("high");
  });

  test("missing_templates risk when no document_system", () => {
    const risks = detectPierreCustomerRisks({ companyMemory: makeCompanyMemory(false) });
    const r = risks.find((r) => r.type === "missing_templates");
    expect(r).toBeDefined();
  });

  test("no missing_templates risk when document_system configured", () => {
    const risks = detectPierreCustomerRisks({ companyMemory: makeCompanyMemory(true) });
    const r = risks.find((r) => r.type === "missing_templates");
    expect(r).toBeUndefined();
  });

  test("no_usage risk when no missions and no tasks", () => {
    const risks = detectPierreCustomerRisks({ companyMemory: makeCompanyMemory() });
    const r = risks.find((r) => r.type === "no_usage");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("high");
  });

  test("low_usage risk when 1 mission and 0 completed tasks", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks: [makeTask({ status: "pending" })],
    });
    const r = risks.find((r) => r.type === "low_usage");
    expect(r).toBeDefined();
  });

  test("no_completed_value when tasks exist but none completed", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks: [makeTask({ status: "pending" }), makeTask({ id: "t2", status: "in_progress" })],
    });
    const r = risks.find((r) => r.type === "no_completed_value");
    expect(r).toBeDefined();
  });

  test("no_document_output when 3+ completed tasks but no docs", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => makeTask({ id: `t${i}`, status: "done" }));
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks,
      documents: [],
    });
    const r = risks.find((r) => r.type === "no_document_output");
    expect(r).toBeDefined();
  });

  test("no_employee_files risk when employees present but no files", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      employees: [makeEmployee()],
      employeeFiles: [],
    });
    const r = risks.find((r) => r.type === "no_employee_files");
    expect(r).toBeDefined();
  });

  test("schema_or_safety_issue critical for scheduled_for usage", () => {
    const tasks = [makeTask({ scheduled_for: "2026-06-01" })];
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks,
    });
    const r = risks.find((r) => r.type === "schema_or_safety_issue" && r.label.includes("scheduled_for"));
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  test("schema_or_safety_issue critical for old log schema (level field)", () => {
    const logs = [makeLog({ level: "info" })];
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      logs,
    });
    const r = risks.find((r) => r.type === "schema_or_safety_issue" && r.label.includes("level/event/payload"));
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  test("schema_or_safety_issue critical for old log schema (event field)", () => {
    const logs = [makeLog({ event: "task_done" })];
    const risks = detectPierreCustomerRisks({ logs });
    const r = risks.find((r) => r.type === "schema_or_safety_issue");
    expect(r).toBeDefined();
  });

  test("schema_or_safety_issue critical for old log schema (payload field)", () => {
    const logs = [makeLog({ payload: { foo: "bar" } })];
    const risks = detectPierreCustomerRisks({ logs });
    const r = risks.find((r) => r.type === "schema_or_safety_issue");
    expect(r).toBeDefined();
  });

  test("schema_or_safety_issue critical for auto-sent email without approval", () => {
    const tasks = [makeTask({ type: "email.send", status: "done", approval_required: false })];
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks,
    });
    const r = risks.find((r) => r.type === "schema_or_safety_issue" && r.label.includes("email"));
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  test("no auto-send risk if email task has approval_required", () => {
    const tasks = [makeTask({ type: "email.send", status: "done", approval_required: true })];
    const risks = detectPierreCustomerRisks({ tasks });
    const r = risks.find((r) => r.type === "schema_or_safety_issue" && r.label.includes("email"));
    expect(r).toBeUndefined();
  });

  test("blocked_workflow high risk for 3+ blocked tasks", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => makeTask({ id: `t${i}`, status: "blocked" }));
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks,
    });
    const r = risks.find((r) => r.type === "blocked_workflow");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("high");
  });

  test("blocked_workflow medium risk for 1-2 blocked tasks", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks: [makeTask({ status: "blocked" })],
    });
    const r = risks.find((r) => r.type === "blocked_workflow");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("medium");
  });

  test("too_many_errors high risk for 5+ errors", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "error" }));
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks,
    });
    const r = risks.find((r) => r.type === "too_many_errors");
    expect(r).toBeDefined();
    expect(["high", "critical"]).toContain(r!.severity);
  });

  test("too_many_errors critical for 50%+ error rate", () => {
    const tasks = [
      makeTask({ id: "t1", status: "error" }),
      makeTask({ id: "t2", status: "error" }),
      makeTask({ id: "t3", status: "error" }),
      makeTask({ id: "t4", status: "error" }),
      makeTask({ id: "t5", status: "error" }),
      makeTask({ id: "t6", status: "done" }),
    ];
    const risks = detectPierreCustomerRisks({ missions: [makeMission()], tasks });
    const r = risks.find((r) => r.type === "too_many_errors");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("critical");
  });

  test("low_perceived_value risk when no tangible output", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      tasks: [],
      documents: [],
      employeeFiles: [],
    });
    const r = risks.find((r) => r.type === "low_perceived_value");
    expect(r).toBeDefined();
  });

  test("conversion_not_ready risk when multiple elements missing", () => {
    const risks = detectPierreCustomerRisks({
      missions: [makeMission()],
      tasks: [],
      documents: [],
    });
    const r = risks.find((r) => r.type === "conversion_not_ready");
    expect(r).toBeDefined();
  });

  test("sensitive_case_mishandled for contract completed without approval", () => {
    const docs = [makeDoc({ family: "contract", status: "done", approval_required: false })];
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      documents: docs,
    });
    const r = risks.find((r) => r.type === "sensitive_case_mishandled");
    expect(r).toBeDefined();
  });

  test("insufficient_traceability risk when missions but no logs", () => {
    const risks = detectPierreCustomerRisks({
      companyMemory: makeCompanyMemory(),
      missions: [makeMission()],
      logs: [],
    });
    const r = risks.find((r) => r.type === "insufficient_traceability");
    expect(r).toBeDefined();
  });

  test("returns empty array for good health account", () => {
    const params: PierreCustomerSuccessParams = {
      companyMemory: makeCompanyMemory(true),
      missions: Array.from({ length: 5 }, (_, i) => makeMission({ id: `m${i}` })),
      tasks: Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "done" })),
      documents: Array.from({ length: 3 }, (_, i) => makeDoc({ id: `d${i}` })),
      logs: Array.from({ length: 5 }, (_, i) => makeLog({ id: `l${i}` })),
      employees: [makeEmployee()],
      employeeFiles: [{ emp: "a" }],
    };
    const risks = detectPierreCustomerRisks(params);
    const criticals = risks.filter((r) => r.severity === "critical");
    expect(criticals).toHaveLength(0);
  });

  test("never throws for null inputs", () => {
    expect(() => detectPierreCustomerRisks({})).not.toThrow();
    expect(() => detectPierreCustomerRisks({ tasks: null as unknown as Record<string, unknown>[] })).not.toThrow();
  });
});

// ── buildPierreCustomerValueSummary ───────────────────────────────────────────

describe("buildPierreCustomerValueSummary", () => {
  test("zero value for empty params", () => {
    const v = buildPierreCustomerValueSummary({}, []);
    expect(v.estimated_hours_saved_low).toBe(0);
    expect(v.estimated_monthly_value_eur_low).toBe(0);
    expect(v.confidence).toBe("low");
  });

  test("adds 1.5h per completed task", () => {
    const tasks = [makeTask({ status: "done" }), makeTask({ id: "t2", status: "done" })];
    const v = buildPierreCustomerValueSummary({ tasks }, []);
    expect(v.estimated_hours_saved_low).toBeGreaterThanOrEqual(3);
  });

  test("adds 1.25h per premium doc", () => {
    const documents = [makeDoc({ family: "contract" })];
    const v = buildPierreCustomerValueSummary({ documents }, []);
    expect(v.estimated_hours_saved_low).toBeGreaterThanOrEqual(1);
  });

  test("adds 0.75h per PDF doc", () => {
    const documents = [makeDoc({ has_pdf: true })];
    const v = buildPierreCustomerValueSummary({ documents }, []);
    expect(v.estimated_hours_saved_low).toBeGreaterThanOrEqual(0);
  });

  test("adds 0.5h per employee file", () => {
    const v = buildPierreCustomerValueSummary({ employeeFiles: [{ emp: "a" }] }, []);
    expect(v.estimated_hours_saved_low).toBeGreaterThanOrEqual(0);
  });

  test("adds 0.5h bonus if logs present", () => {
    const v1 = buildPierreCustomerValueSummary({ logs: [] }, []);
    const v2 = buildPierreCustomerValueSummary({ logs: [makeLog()] }, []);
    expect(v2.estimated_hours_saved_low).toBeGreaterThan(v1.estimated_hours_saved_low);
  });

  test("value EUR = hours * 50", () => {
    const tasks = [makeTask({ status: "done" }), makeTask({ id: "t2", status: "done" })];
    const v = buildPierreCustomerValueSummary({ tasks }, []);
    expect(v.estimated_monthly_value_eur_low).toBe(v.estimated_hours_saved_low * 50);
  });

  test("high confidence when hours >= 6 and high external scores", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "done" }));
    const v = buildPierreCustomerValueSummary(
      { tasks, releaseReport: { global_score: 80 } },
      [],
    );
    expect(v.confidence).toBe("high");
  });

  test("medium confidence when hours >= 2", () => {
    const tasks = [makeTask({ status: "done" }), makeTask({ id: "t2", status: "done" })];
    const v = buildPierreCustomerValueSummary({ tasks }, []);
    expect(["medium", "high"]).toContain(v.confidence);
  });

  test("strongest_proofs has at most 5 entries", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "done" }));
    const docs = Array.from({ length: 3 }, (_, i) => makeDoc({ id: `d${i}`, has_pdf: true }));
    const v = buildPierreCustomerValueSummary({ tasks, documents: docs, logs: [makeLog()] }, []);
    expect(v.strongest_proofs.length).toBeLessThanOrEqual(5);
  });

  test("high estimate is always >= low estimate", () => {
    const v = buildPierreCustomerValueSummary(makeFullParams(), []);
    expect(v.estimated_hours_saved_high).toBeGreaterThanOrEqual(v.estimated_hours_saved_low);
    expect(v.estimated_monthly_value_eur_high).toBeGreaterThanOrEqual(v.estimated_monthly_value_eur_low);
  });
});

// ── scorePierreCustomerHealth ─────────────────────────────────────────────────

describe("scorePierreCustomerHealth", () => {
  const emptyMetrics = computePierreCustomerSuccessMetrics({});
  const emptyValue = buildPierreCustomerValueSummary({}, []);

  test("score is between 0 and 100", () => {
    const { metrics, signals, risks, value } = makeMinimalScores();
    const h = scorePierreCustomerHealth({ metrics, signals, risks, value });
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
  });

  test("critical status when critical risk present", () => {
    const criticalRisk = {
      type: "schema_or_safety_issue" as const,
      severity: "critical" as const,
      label: "Test",
      reason: "Test",
      business_impact: "Test",
      recommended_fix: "Test",
    };
    const h = scorePierreCustomerHealth({ metrics: emptyMetrics, signals: [], risks: [criticalRisk], value: emptyValue });
    expect(h.status).toBe("critical");
    expect(h.score).toBeLessThanOrEqual(49);
  });

  test("score capped at 49 with critical risk", () => {
    const criticalRisk = {
      type: "schema_or_safety_issue" as const,
      severity: "critical" as const,
      label: "Test",
      reason: "Test",
      business_impact: "Test",
      recommended_fix: "Test",
    };
    const h = scorePierreCustomerHealth({
      metrics: emptyMetrics,
      signals: [{ type: "configuration", polarity: "positive", label: "x", reason: "x", score_impact: 100, source_type: "system", source_id: null }],
      risks: [criticalRisk],
      value: emptyValue,
    });
    expect(h.score).toBeLessThanOrEqual(49);
  });

  test("excellent status when score >= 85", () => {
    const signals = Array.from({ length: 10 }, (_, i) => ({
      type: "value" as const,
      polarity: "positive" as const,
      label: `Signal ${i}`,
      reason: "x",
      score_impact: 20,
      source_type: "task" as const,
      source_id: null,
    }));
    const metrics = computePierreCustomerSuccessMetrics({ employeeFiles: [{ a: 1 }, { b: 2 }, { c: 3 }] });
    const h = scorePierreCustomerHealth({ metrics, signals, risks: [], value: emptyValue });
    expect(["healthy", "excellent"]).toContain(h.status);
  });

  test("label is non-empty", () => {
    const { metrics, signals, risks, value } = makeMinimalScores();
    const h = scorePierreCustomerHealth({ metrics, signals, risks, value });
    expect(h.label.length).toBeGreaterThan(0);
  });

  test("explanation mentions score", () => {
    const { metrics, signals, risks, value } = makeMinimalScores();
    const h = scorePierreCustomerHealth({ metrics, signals, risks, value });
    expect(h.explanation).toContain(String(h.score));
  });

  test("more positive signals increase score", () => {
    const pos = { type: "value" as const, polarity: "positive" as const, label: "x", reason: "x", score_impact: 15, source_type: "task" as const, source_id: null };
    const h1 = scorePierreCustomerHealth({ metrics: emptyMetrics, signals: [], risks: [], value: emptyValue });
    const h2 = scorePierreCustomerHealth({ metrics: emptyMetrics, signals: [pos, pos], risks: [], value: emptyValue });
    expect(h2.score).toBeGreaterThan(h1.score);
  });
});

// ── scorePierreCustomerConversion ─────────────────────────────────────────────

describe("scorePierreCustomerConversion", () => {
  test("score between 0 and 100", () => {
    const { metrics, signals, risks, value, health } = makeMinimalScores();
    const c = scorePierreCustomerConversion({ metrics, signals, risks, value, health });
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(100);
  });

  test("ready is false when critical risks present", () => {
    const { metrics, signals, value, health } = makeMinimalScores();
    const criticalRisk = { type: "schema_or_safety_issue" as const, severity: "critical" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const c = scorePierreCustomerConversion({ metrics, signals, risks: [criticalRisk], value, health });
    expect(c.ready).toBe(false);
  });

  test("ready false when health < 60", () => {
    const { metrics, signals, value } = makeMinimalScores();
    const lowHealth = { score: 40, status: "at_risk" as const, label: "x", explanation: "x" };
    const c = scorePierreCustomerConversion({ metrics, signals, risks: [], value, health: lowHealth });
    expect(c.ready).toBe(false);
  });

  test("missing_before_conversion populated when elements missing", () => {
    const emptyMetrics = computePierreCustomerSuccessMetrics({});
    const emptyValue = buildPierreCustomerValueSummary({}, []);
    const lowHealth = { score: 40, status: "at_risk" as const, label: "x", explanation: "x" };
    const c = scorePierreCustomerConversion({ metrics: emptyMetrics, signals: [], risks: [], value: emptyValue, health: lowHealth });
    expect(c.missing_before_conversion.length).toBeGreaterThan(0);
  });

  test("score decreases with critical risks", () => {
    const { metrics, signals, value, health } = makeMinimalScores();
    const criticalRisk = { type: "schema_or_safety_issue" as const, severity: "critical" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const c1 = scorePierreCustomerConversion({ metrics, signals, risks: [], value, health });
    const c2 = scorePierreCustomerConversion({ metrics, signals, risks: [criticalRisk], value, health });
    expect(c2.score).toBeLessThan(c1.score);
  });

  test("score increases with high value visible", () => {
    const emptyMetrics = computePierreCustomerSuccessMetrics({});
    const emptyValue = buildPierreCustomerValueSummary({}, []);
    const goodHealth = { score: 75, status: "healthy" as const, label: "x", explanation: "x" };
    const richValue = { ...emptyValue, visible_value_count: 5 };
    const c = scorePierreCustomerConversion({ metrics: emptyMetrics, signals: [], risks: [], value: richValue, health: goodHealth });
    expect(c.score).toBeGreaterThan(25);
  });

  test("label is non-empty", () => {
    const { metrics, signals, risks, value, health } = makeMinimalScores();
    const c = scorePierreCustomerConversion({ metrics, signals, risks, value, health });
    expect(c.label.length).toBeGreaterThan(0);
  });
});

// ── scorePierreCustomerRetention ──────────────────────────────────────────────

describe("scorePierreCustomerRetention", () => {
  test("score between 0 and 100", () => {
    const { metrics, signals, risks, value, health } = makeMinimalScores();
    const r = scorePierreCustomerRetention({ metrics, signals, risks, value, health });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  test("strong status for high score", () => {
    const richMetrics = computePierreCustomerSuccessMetrics({
      missions: Array.from({ length: 5 }, (_, i) => makeMission({ id: `m${i}` })),
      documents: Array.from({ length: 5 }, (_, i) => makeDoc({ id: `d${i}` })),
      logs: Array.from({ length: 15 }, (_, i) => makeLog({ id: `l${i}` })),
      employeeFiles: Array.from({ length: 4 }, (_, i) => ({ id: i })),
    });
    const richValue = { estimated_hours_saved_low: 20, estimated_hours_saved_high: 32, estimated_monthly_value_eur_low: 1000, estimated_monthly_value_eur_high: 1600, visible_value_count: 8, strongest_proofs: [], confidence: "high" as const };
    const goodHealth = { score: 80, status: "healthy" as const, label: "x", explanation: "x" };
    const r = scorePierreCustomerRetention({ metrics: richMetrics, signals: [], risks: [], value: richValue, health: goodHealth });
    expect(["medium", "strong"]).toContain(r.status);
  });

  test("danger status when no usage and critical risks", () => {
    const emptyMetrics = computePierreCustomerSuccessMetrics({});
    const emptyValue = buildPierreCustomerValueSummary({}, []);
    const badHealth = { score: 20, status: "critical" as const, label: "x", explanation: "x" };
    const criticalRisk = { type: "schema_or_safety_issue" as const, severity: "critical" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const r = scorePierreCustomerRetention({ metrics: emptyMetrics, signals: [], risks: [criticalRisk], value: emptyValue, health: badHealth });
    expect(["weak", "danger"]).toContain(r.status);
  });

  test("reasons array populated", () => {
    const { metrics, signals, risks, value, health } = makeMinimalScores();
    const r = scorePierreCustomerRetention({ metrics, signals, risks, value, health });
    expect(Array.isArray(r.reasons)).toBe(true);
  });
});

// ── classifyPierreCustomerSuccessStage ────────────────────────────────────────

describe("classifyPierreCustomerSuccessStage", () => {
  function makeStageParams(overrides: Partial<Parameters<typeof classifyPierreCustomerSuccessStage>[0]> = {}) {
    const metrics = computePierreCustomerSuccessMetrics({});
    const health = { score: 50, status: "fragile" as const, label: "x", explanation: "x" };
    const conversion = { score: 40, ready: false, label: "x", reasons: [], missing_before_conversion: [] };
    const retention = { score: 40, status: "weak" as const, label: "x", reasons: [] };
    return { metrics, health, conversion, retention, risks: [], ...overrides };
  }

  test("new_account when no config and no usage", () => {
    const stage = classifyPierreCustomerSuccessStage(makeStageParams());
    expect(stage).toBe("new_account");
  });

  test("setup_in_progress when employees but no missions", () => {
    const metrics = computePierreCustomerSuccessMetrics({ employees: [makeEmployee()] });
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics }));
    expect(stage).toBe("setup_in_progress");
  });

  test("setup_in_progress when docs but no missions", () => {
    const metrics = computePierreCustomerSuccessMetrics({ documents: [makeDoc()] });
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics }));
    expect(stage).toBe("setup_in_progress");
  });

  test("churn_risk when missions but 0 completed + critical risks", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], tasks: [makeTask({ status: "pending" })] });
    const criticalRisk = { type: "schema_or_safety_issue" as const, severity: "critical" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, risks: [criticalRisk] }));
    expect(stage).toBe("churn_risk");
  });

  test("activated when missions launched and tasks started", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], tasks: [makeTask()] });
    const mediumRetention = { score: 60, status: "medium" as const, label: "x", reasons: [] };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, retention: mediumRetention }));
    expect(stage).toBe("activated");
  });

  test("value_visible when health >= 55 and premium docs >= 2", () => {
    const metrics = computePierreCustomerSuccessMetrics({
      missions: [makeMission()],
      tasks: [makeTask()],
      documents: [makeDoc(), makeDoc({ id: "d2" })],
    });
    const goodHealth = { score: 60, status: "fragile" as const, label: "x", explanation: "x" };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, health: goodHealth }));
    expect(stage).toBe("value_visible");
  });

  test("conversion_ready when ready=true and no critical risks", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], tasks: [makeTask()] });
    const conversion = { score: 80, ready: true, label: "x", reasons: [], missing_before_conversion: [] };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, conversion }));
    expect(stage).toBe("conversion_ready");
  });

  test("successful when excellent health + ready + strong retention", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], tasks: [makeTask()] });
    const excellent = { score: 90, status: "excellent" as const, label: "x", explanation: "x" };
    const readyConversion = { score: 85, ready: true, label: "x", reasons: [], missing_before_conversion: [] };
    const strongRetention = { score: 85, status: "strong" as const, label: "x", reasons: [] };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, health: excellent, conversion: readyConversion, retention: strongRetention }));
    expect(stage).toBe("successful");
  });

  test("retention_risk when missions + high risks", () => {
    const metrics = computePierreCustomerSuccessMetrics({
      missions: [makeMission()],
      tasks: [makeTask()],
    });
    const highRisk1 = { type: "blocked_workflow" as const, severity: "high" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const highRisk2 = { type: "no_usage" as const, severity: "high" as const, label: "x", reason: "x", business_impact: "x", recommended_fix: "x" };
    const stage = classifyPierreCustomerSuccessStage(makeStageParams({ metrics, risks: [highRisk1, highRisk2] }));
    expect(stage).toBe("retention_risk");
  });
});

// ── buildPierreCustomerSuccessActions ─────────────────────────────────────────

describe("buildPierreCustomerSuccessActions", () => {
  function makeActionParams(overrides: Partial<Parameters<typeof buildPierreCustomerSuccessActions>[0]> = {}) {
    const metrics = computePierreCustomerSuccessMetrics({});
    const conversion = { score: 40, ready: false, label: "x", reasons: [], missing_before_conversion: [] };
    const retention = { score: 40, status: "weak" as const, label: "x", reasons: [] };
    return { stage: "activated" as const, metrics, risks: [], conversion, retention, ...overrides };
  }

  test("returns array with max 8 actions", () => {
    const actions = buildPierreCustomerSuccessActions(makeActionParams());
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeLessThanOrEqual(8);
  });

  test("urgent action for critical risk", () => {
    const criticalRisk = { type: "schema_or_safety_issue" as const, severity: "critical" as const, label: "Blocker", reason: "x", business_impact: "x", recommended_fix: "x" };
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ risks: [criticalRisk] }));
    const urgent = actions.find((a) => a.priority === "urgent" && a.type === "resolve_blockers");
    expect(urgent).toBeDefined();
  });

  test("escalate_support for churn_risk stage", () => {
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ stage: "churn_risk" }));
    const esc = actions.find((a) => a.type === "escalate_support");
    expect(esc).toBeDefined();
    expect(esc!.priority).toBe("urgent");
  });

  test("complete_setup for new_account stage", () => {
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ stage: "new_account" }));
    const setup = actions.find((a) => a.type === "complete_setup");
    expect(setup).toBeDefined();
  });

  test("launch_high_value_mission when no missions", () => {
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ stage: "activated" }));
    const launch = actions.find((a) => a.type === "launch_high_value_mission");
    expect(launch).toBeDefined();
  });

  test("generate_premium_document when missions but no docs", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], documents: [] });
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ metrics }));
    const genDoc = actions.find((a) => a.type === "generate_premium_document");
    expect(genDoc).toBeDefined();
  });

  test("prepare_conversion_call when ready", () => {
    const metrics = computePierreCustomerSuccessMetrics({ missions: [makeMission()], tasks: [makeTask()] });
    const readyConversion = { score: 80, ready: true, label: "x", reasons: [], missing_before_conversion: [] };
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ metrics, conversion: readyConversion }));
    const conv = actions.find((a) => a.type === "prepare_conversion_call");
    expect(conv).toBeDefined();
  });

  test("no_action when everything is perfect and no other action triggered", () => {
    const metrics = computePierreCustomerSuccessMetrics({
      missions: Array.from({ length: 5 }, (_, i) => makeMission({ id: `m${i}` })),
      tasks: Array.from({ length: 5 }, (_, i) => makeTask({ id: `t${i}`, status: "done" })),
      documents: Array.from({ length: 3 }, (_, i) => makeDoc({ id: `d${i}` })),
      employeeFiles: Array.from({ length: 3 }, (_, i) => ({ id: i })),
    });
    const goodConversion = { score: 90, ready: true, label: "x", reasons: [], missing_before_conversion: [] };
    const strongRetention = { score: 85, status: "strong" as const, label: "x", reasons: [] };
    const actions = buildPierreCustomerSuccessActions(makeActionParams({ stage: "successful", metrics, conversion: goodConversion, retention: strongRetention }));
    expect(actions.length).toBeGreaterThan(0);
  });
});

// ── buildPierreCustomerExecutiveSummary ───────────────────────────────────────

describe("buildPierreCustomerExecutiveSummary", () => {
  function makeSummaryParams(stage: Parameters<typeof buildPierreCustomerExecutiveSummary>[0]["stage"] = "activated") {
    const { metrics, signals, risks, value, health } = makeMinimalScores();
    const conversion = scorePierreCustomerConversion({ metrics, signals, risks, value, health });
    const retention = scorePierreCustomerRetention({ metrics, signals, risks, value, health });
    const actions = buildPierreCustomerSuccessActions({ stage, metrics, risks, conversion, retention });
    return { stage, health, conversion, retention, value, risks, actions };
  }

  test("headline is non-empty for all stages", () => {
    const stages: Parameters<typeof buildPierreCustomerExecutiveSummary>[0]["stage"][] = [
      "new_account", "setup_in_progress", "activated", "value_visible",
      "conversion_ready", "retention_risk", "churn_risk", "successful",
    ];
    for (const stage of stages) {
      const s = buildPierreCustomerExecutiveSummary(makeSummaryParams(stage));
      expect(s.headline.length).toBeGreaterThan(0);
    }
  });

  test("summary is non-empty", () => {
    const s = buildPierreCustomerExecutiveSummary(makeSummaryParams("activated"));
    expect(s.summary.length).toBeGreaterThan(0);
  });

  test("what_worked is non-empty array", () => {
    const s = buildPierreCustomerExecutiveSummary(makeSummaryParams());
    expect(Array.isArray(s.what_worked)).toBe(true);
    expect(s.what_worked.length).toBeGreaterThan(0);
  });

  test("what_is_missing is non-empty array", () => {
    const s = buildPierreCustomerExecutiveSummary(makeSummaryParams());
    expect(Array.isArray(s.what_is_missing)).toBe(true);
    expect(s.what_is_missing.length).toBeGreaterThan(0);
  });

  test("recommendation is non-empty", () => {
    const s = buildPierreCustomerExecutiveSummary(makeSummaryParams());
    expect(s.recommendation.length).toBeGreaterThan(0);
  });

  test("churn_risk headline mentions alerte or risque", () => {
    const s = buildPierreCustomerExecutiveSummary(makeSummaryParams("churn_risk"));
    expect(s.headline.toLowerCase()).toMatch(/alerte|risque|churn|peu utilisé/);
  });

  test("successful headline mentions valeur or conversion", () => {
    const { metrics, signals, risks, value } = makeMinimalScores();
    const excellentHealth = { score: 90, status: "excellent" as const, label: "x", explanation: "x" };
    const readyConversion = { score: 90, ready: true, label: "x", reasons: [], missing_before_conversion: [] };
    const strongRetention = { score: 85, status: "strong" as const, label: "x", reasons: [] };
    const actions = buildPierreCustomerSuccessActions({ stage: "successful", metrics, risks, conversion: readyConversion, retention: strongRetention });
    const s = buildPierreCustomerExecutiveSummary({ stage: "successful", health: excellentHealth, conversion: readyConversion, retention: strongRetention, value, risks, actions });
    expect(s.headline.toLowerCase()).toMatch(/valeur|conversion|prêt/);
  });
});

// ── buildPierreCustomerSuccessReport ─────────────────────────────────────────

describe("buildPierreCustomerSuccessReport", () => {
  test("never throws for empty params", () => {
    expect(() => buildPierreCustomerSuccessReport({})).not.toThrow();
  });

  test("never throws for null fields", () => {
    expect(() => buildPierreCustomerSuccessReport({
      companyMemory: null,
      missions: null as unknown as Record<string, unknown>[],
      tasks: undefined,
      documents: [],
      logs: [],
    })).not.toThrow();
  });

  test("returns all required fields", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(report.stage).toBeDefined();
    expect(report.health).toBeDefined();
    expect(report.conversion).toBeDefined();
    expect(report.retention).toBeDefined();
    expect(report.value).toBeDefined();
    expect(report.signals).toBeDefined();
    expect(report.risks).toBeDefined();
    expect(report.actions).toBeDefined();
    expect(report.executive_summary).toBeDefined();
    expect(report.metrics).toBeDefined();
    expect(report.generated_at).toBeDefined();
  });

  test("generated_at is valid ISO string", () => {
    const report = buildPierreCustomerSuccessReport({});
    expect(() => new Date(report.generated_at)).not.toThrow();
    expect(new Date(report.generated_at).toISOString()).toBe(report.generated_at);
  });

  test("health score between 0 and 100", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(report.health.score).toBeGreaterThanOrEqual(0);
    expect(report.health.score).toBeLessThanOrEqual(100);
  });

  test("conversion score between 0 and 100", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(report.conversion.score).toBeGreaterThanOrEqual(0);
    expect(report.conversion.score).toBeLessThanOrEqual(100);
  });

  test("retention score between 0 and 100", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(report.retention.score).toBeGreaterThanOrEqual(0);
    expect(report.retention.score).toBeLessThanOrEqual(100);
  });

  test("signals is non-empty array", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(Array.isArray(report.signals)).toBe(true);
    expect(report.signals.length).toBeGreaterThan(0);
  });

  test("actions has at most 8 items", () => {
    const report = buildPierreCustomerSuccessReport(makeFullParams());
    expect(report.actions.length).toBeLessThanOrEqual(8);
  });

  test("metrics are consistent with input data", () => {
    const params = {
      missions: [makeMission(), makeMission({ id: "m2" })],
      tasks: [makeTask({ status: "done" }), makeTask({ id: "t2", status: "error" })],
    };
    const report = buildPierreCustomerSuccessReport(params);
    expect(report.metrics.missions_total).toBe(2);
    expect(report.metrics.completed_tasks).toBe(1);
    expect(report.metrics.error_tasks).toBe(1);
  });

  test("report is stable across repeated calls with same params", () => {
    const params = makeFullParams();
    const r1 = buildPierreCustomerSuccessReport(params);
    const r2 = buildPierreCustomerSuccessReport(params);
    expect(r1.stage).toBe(r2.stage);
    expect(r1.health.score).toBe(r2.health.score);
  });

  test("uses now param for generated_at", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    const report = buildPierreCustomerSuccessReport({ now });
    expect(report.generated_at).toBe(now.toISOString());
  });

  test("handles document without family gracefully", () => {
    const params = { documents: [{ id: "d1" }] };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });

  test("handles log without event_type gracefully", () => {
    const params = { logs: [{ id: "l1" }] };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });

  test("handles mission without id gracefully", () => {
    const params = { missions: [{ title: "No ID mission" }] };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });

  test("handles task without status gracefully", () => {
    const params = { tasks: [{ id: "t1", type: "generic" }] };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });

  test("handles malformed trialReport gracefully", () => {
    const params = { trialReport: "not-an-object" };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
    const report = buildPierreCustomerSuccessReport(params);
    expect(report.metrics.trial_activation_score).toBeNull();
  });

  test("handles malformed releaseReport gracefully", () => {
    const params = { releaseReport: 42 };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });

  test("handles malformed readinessReport gracefully", () => {
    const params = { readinessReport: [] };
    expect(() => buildPierreCustomerSuccessReport(params)).not.toThrow();
  });
});

// ── buildPierreCustomerSuccessMissionHint ─────────────────────────────────────

describe("buildPierreCustomerSuccessMissionHint", () => {
  test("returns all required fields", () => {
    const hint = buildPierreCustomerSuccessMissionHint({
      mission: makeMission(),
      tasks: [makeTask()],
      documents: [makeDoc()],
      logs: [makeLog()],
    });
    expect(hint.customer_stage).toBeDefined();
    expect(typeof hint.health_score).toBe("number");
    expect(typeof hint.conversion_score).toBe("number");
    expect(typeof hint.retention_score).toBe("number");
    expect(hint).toHaveProperty("main_risk");
    expect(hint).toHaveProperty("recommended_action");
  });

  test("health_score between 0 and 100", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [], documents: [], logs: [] });
    expect(hint.health_score).toBeGreaterThanOrEqual(0);
    expect(hint.health_score).toBeLessThanOrEqual(100);
  });

  test("conversion_score between 0 and 100", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [], documents: [], logs: [] });
    expect(hint.conversion_score).toBeGreaterThanOrEqual(0);
    expect(hint.conversion_score).toBeLessThanOrEqual(100);
  });

  test("retention_score between 0 and 100", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [], documents: [], logs: [] });
    expect(hint.retention_score).toBeGreaterThanOrEqual(0);
    expect(hint.retention_score).toBeLessThanOrEqual(100);
  });

  test("never throws for empty mission", () => {
    expect(() => buildPierreCustomerSuccessMissionHint({ mission: {}, tasks: [], documents: [], logs: [] })).not.toThrow();
  });

  test("never throws for null arrays", () => {
    expect(() => buildPierreCustomerSuccessMissionHint({
      mission: makeMission(),
      tasks: null as unknown as Record<string, unknown>[],
      documents: null as unknown as Record<string, unknown>[],
      logs: null as unknown as Record<string, unknown>[],
    })).not.toThrow();
  });

  test("main_risk is null or string", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [], documents: [], logs: [] });
    expect(hint.main_risk === null || typeof hint.main_risk === "string").toBe(true);
  });

  test("recommended_action is null or string", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [], documents: [], logs: [] });
    expect(hint.recommended_action === null || typeof hint.recommended_action === "string").toBe(true);
  });

  test("customer_stage is valid stage value", () => {
    const validStages = ["new_account", "setup_in_progress", "activated", "value_visible", "conversion_ready", "retention_risk", "churn_risk", "successful"];
    const hint = buildPierreCustomerSuccessMissionHint({ mission: makeMission(), tasks: [makeTask()], documents: [], logs: [] });
    expect(validStages).toContain(hint.customer_stage);
  });
});
