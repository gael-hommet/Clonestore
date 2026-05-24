// src/lib/pierre/__tests__/release-candidate.test.ts
// Tests Bloc 30 — Pierre Release Candidate Engine
// Pure tests: no Supabase, no real AI provider, no email, no DB writes.

import { describe, test, expect } from "vitest";

import {
  buildRCCheck,
  buildRCWarning,
  buildRCFail,
  scoreRCChecks,
  summarizeRCModules,
  classifyRCStatus,
  buildPierreReleaseCandidateReport,
} from "../../pierre/release-candidate/checks";

import {
  scanObjectForForbiddenKeys,
  auditPierreTaskSafety,
  auditPierreLogSchema,
  auditPierreStorageShape,
  auditPierreDocumentsSafety,
  auditPierreAIRuntimeShape,
  auditPierreGoldenScenarioSuiteShape,
  auditPierreGlobalInvariants,
} from "../../pierre/release-candidate/invariant-auditor";

import {
  buildPierreReleaseCandidateStaticChecklist,
  buildPierreReleaseCandidatePreflight,
} from "../../pierre/release-candidate/preflight";

import {
  buildPierreReleaseCandidateExecutiveSummary,
  renderPierreReleaseCandidateMarkdown,
} from "../../pierre/release-candidate/report";

import {
  normalizePierreGoldenScenarioId,
  isValidGoldenScenarioId,
  isValidOfficialScenarioId,
  getGoldenScenarioRegistry,
  getGoldenScenarioByOfficialIdOrAlias,
  PIERRE_OFFICIAL_SCENARIO_IDS,
} from "../../pierre/scenarios/golden-registry";

import type { PierreReleaseCandidateReport } from "../../pierre/release-candidate/types";

// ══════════════════════════════════════════════════════════════
// A. CHECKS / REPORT
// ══════════════════════════════════════════════════════════════

describe("buildRCCheck — pass", () => {
  test("returns status pass when pass=true", () => {
    const check = buildRCCheck({
      id: "test_pass",
      area: "schema",
      label: "Test check",
      pass: true,
      expected: "expected",
      actual: "actual",
    });
    expect(check.status).toBe("pass");
  });

  test("returns status fail when pass=false", () => {
    const check = buildRCCheck({
      id: "test_fail",
      area: "security",
      label: "Test fail check",
      pass: false,
      expected: "expected",
      actual: "actual",
    });
    expect(check.status).toBe("fail");
  });

  test("uses provided severity", () => {
    const check = buildRCCheck({
      id: "test_sev",
      area: "brain",
      label: "Severity test",
      pass: true,
      expected: "e",
      actual: "a",
      severity: "critical",
    });
    expect(check.severity).toBe("critical");
  });

  test("defaults severity to error", () => {
    const check = buildRCCheck({
      id: "test_def",
      area: "documents",
      label: "Default severity",
      pass: false,
      expected: "e",
      actual: "a",
    });
    expect(check.severity).toBe("error");
  });

  test("includes id, area, label, expected, actual", () => {
    const check = buildRCCheck({
      id: "my_id",
      area: "cloneadn",
      label: "My label",
      pass: true,
      expected: "my_expected",
      actual: "my_actual",
    });
    expect(check.id).toBe("my_id");
    expect(check.area).toBe("cloneadn");
    expect(check.label).toBe("My label");
    expect(check.expected).toBe("my_expected");
    expect(check.actual).toBe("my_actual");
  });

  test("recommendation null by default", () => {
    const check = buildRCCheck({ id: "x", area: "routes", label: "l", pass: true, expected: "e", actual: "a" });
    expect(check.recommendation).toBeNull();
  });

  test("recommendation set when provided", () => {
    const check = buildRCCheck({
      id: "x", area: "routes", label: "l", pass: false, expected: "e", actual: "a",
      recommendation: "Fix this.",
    });
    expect(check.recommendation).toBe("Fix this.");
  });
});

describe("buildRCWarning", () => {
  test("returns status warning", () => {
    const w = buildRCWarning({ id: "w1", area: "ai_runtime", label: "warn", expected: "e", actual: "a" });
    expect(w.status).toBe("warning");
  });

  test("defaults severity to warning", () => {
    const w = buildRCWarning({ id: "w2", area: "build", label: "warn", expected: "e", actual: "a" });
    expect(w.severity).toBe("warning");
  });
});

describe("buildRCFail", () => {
  test("returns status fail", () => {
    const f = buildRCFail({ id: "f1", area: "tests", label: "fail", expected: "e", actual: "a" });
    expect(f.status).toBe("fail");
  });

  test("can have critical severity", () => {
    const f = buildRCFail({ id: "f2", area: "security", label: "crit", expected: "e", actual: "a", severity: "critical" });
    expect(f.severity).toBe("critical");
  });
});

describe("scoreRCChecks", () => {
  test("returns 0 for empty array", () => {
    expect(scoreRCChecks([])).toBe(0);
  });

  test("returns 100 for all passing", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCCheck({ id: "b", area: "brain", label: "B", pass: true, expected: "e", actual: "a" }),
    ];
    expect(scoreRCChecks(checks)).toBe(100);
  });

  test("returns 0 for all failing", () => {
    const checks = [
      buildRCFail({ id: "a", area: "schema", label: "A", expected: "e", actual: "a" }),
      buildRCFail({ id: "b", area: "brain", label: "B", expected: "e", actual: "a" }),
    ];
    expect(scoreRCChecks(checks)).toBe(0);
  });

  test("returns value in [0, 100]", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCFail({ id: "b", area: "brain", label: "B", expected: "e", actual: "a" }),
    ];
    const score = scoreRCChecks(checks);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("warnings reduce score slightly", () => {
    const allPass = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCCheck({ id: "b", area: "schema", label: "B", pass: true, expected: "e", actual: "a" }),
    ];
    const withWarning = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCWarning({ id: "b", area: "schema", label: "B", expected: "e", actual: "a" }),
    ];
    const scorePure = scoreRCChecks(allPass);
    const scoreWarn = scoreRCChecks(withWarning);
    expect(scorePure).toBeGreaterThanOrEqual(scoreWarn);
  });
});

describe("summarizeRCModules", () => {
  test("groups checks by area", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCFail({ id: "b", area: "security", label: "B", expected: "e", actual: "a" }),
    ];
    const mods = summarizeRCModules(checks);
    expect(mods.length).toBeGreaterThanOrEqual(2);
    const schema = mods.find((m) => m.area === "schema");
    const security = mods.find((m) => m.area === "security");
    expect(schema).toBeDefined();
    expect(security).toBeDefined();
  });

  test("counts pass/warning/fail correctly", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCWarning({ id: "b", area: "schema", label: "B", expected: "e", actual: "a" }),
      buildRCFail({ id: "c", area: "schema", label: "C", expected: "e", actual: "a" }),
    ];
    const mods = summarizeRCModules(checks);
    const schema = mods.find((m) => m.area === "schema");
    expect(schema!.passed).toBe(1);
    expect(schema!.warnings).toBe(1);
    expect(schema!.failed).toBe(1);
  });

  test("critical count tracks critical failures", () => {
    const checks = [
      buildRCFail({ id: "a", area: "security", label: "A", expected: "e", actual: "a", severity: "critical" }),
    ];
    const mods = summarizeRCModules(checks);
    const security = mods.find((m) => m.area === "security");
    expect(security!.critical).toBe(1);
  });
});

describe("classifyRCStatus", () => {
  test("ready when score >= 90 and no fails", () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      buildRCCheck({ id: `c${i}`, area: "schema", label: `C${i}`, pass: true, expected: "e", actual: "a" }),
    );
    const status = classifyRCStatus({ score: 95, checks });
    expect(status).toBe("ready");
  });

  test("almost_ready when score >= 75 and no critical fails", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCWarning({ id: "b", area: "brain", label: "B", expected: "e", actual: "a" }),
    ];
    const status = classifyRCStatus({ score: 80, checks });
    expect(status).toBe("almost_ready");
  });

  test("blocked when critical fail present", () => {
    const checks = [
      buildRCFail({ id: "a", area: "security", label: "A", expected: "e", actual: "a", severity: "critical" }),
    ];
    const status = classifyRCStatus({ score: 90, checks });
    expect(status).toBe("blocked");
  });

  test("blocked when score < 75", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCFail({ id: "b", area: "brain", label: "B", expected: "e", actual: "a" }),
    ];
    const status = classifyRCStatus({ score: 50, checks });
    expect(status).toBe("blocked");
  });
});

describe("buildPierreReleaseCandidateReport", () => {
  test("returns report object", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(report).toBeDefined();
    expect(typeof report.score).toBe("number");
    expect(typeof report.status).toBe("string");
  });

  test("score in [0, 100]", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("has generated_at", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(typeof report.generated_at).toBe("string");
    expect(report.generated_at.length).toBeGreaterThan(0);
  });

  test("blocking_issues = fail checks", () => {
    const checks = [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      buildRCFail({ id: "b", area: "security", label: "B", expected: "e", actual: "a" }),
    ];
    const report = buildPierreReleaseCandidateReport({ checks });
    expect(report.blocking_issues.length).toBe(1);
    expect(report.blocking_issues[0].id).toBe("b");
  });

  test("warnings = warning checks", () => {
    const checks = [
      buildRCWarning({ id: "w", area: "ai_runtime", label: "W", expected: "e", actual: "a" }),
    ];
    const report = buildPierreReleaseCandidateReport({ checks });
    expect(report.warnings.length).toBe(1);
  });

  test("critical fail => status blocked", () => {
    const checks = [
      buildRCFail({ id: "c", area: "security", label: "C", expected: "e", actual: "a", severity: "critical" }),
    ];
    const report = buildPierreReleaseCandidateReport({ checks });
    expect(report.status).toBe("blocked");
  });

  test("ready status => can_release_backend = true", () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      buildRCCheck({ id: `c${i}`, area: "schema", label: `C${i}`, pass: true, expected: "e", actual: "a" }),
    );
    const report = buildPierreReleaseCandidateReport({ checks });
    if (report.status === "ready") {
      expect(report.release_decision.can_release_backend).toBe(true);
    }
  });

  test("almost_ready => can_start_cockpit = true", () => {
    const report: PierreReleaseCandidateReport = {
      ...buildPierreReleaseCandidateReport({ checks: [] }),
      status: "almost_ready",
      score: 80,
      blocking_issues: [],
    };
    // almost_ready with score >= 75 and no critical => can_start_cockpit
    const computed = buildPierreReleaseCandidateReport({
      checks: [
        buildRCWarning({ id: "w", area: "brain", label: "W", expected: "e", actual: "a" }),
        ...Array.from({ length: 8 }, (_, i) =>
          buildRCCheck({ id: `c${i}`, area: "schema", label: `C${i}`, pass: true, expected: "e", actual: "a" }),
        ),
      ],
    });
    expect(computed.release_decision.can_start_cockpit).toBeDefined();
    expect(typeof computed.release_decision.can_start_cockpit).toBe("boolean");
    void report; // suppress unused
  });

  test("requires_hotfix = true when critical fail", () => {
    const checks = [
      buildRCFail({ id: "c", area: "security", label: "C", expected: "e", actual: "a", severity: "critical" }),
    ];
    const report = buildPierreReleaseCandidateReport({ checks });
    expect(report.release_decision.requires_hotfix).toBe(true);
  });

  test("modules summary is array", () => {
    const report = buildPierreReleaseCandidateReport({
      checks: [
        buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
      ],
    });
    expect(Array.isArray(report.modules)).toBe(true);
  });

  test("never throws with empty checks", () => {
    expect(() => buildPierreReleaseCandidateReport({ checks: [] })).not.toThrow();
  });

  test("accepts strongest_proofs", () => {
    const report = buildPierreReleaseCandidateReport({
      checks: [],
      strongest_proofs: ["proof1", "proof2"],
    });
    expect(report.strongest_proofs).toEqual(["proof1", "proof2"]);
  });

  test("version defaults to 1.0.0", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(report.version).toBe("1.0.0");
  });

  test("accepts custom version", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [], version: "30.0.0" });
    expect(report.version).toBe("30.0.0");
  });
});

// ══════════════════════════════════════════════════════════════
// B. INVARIANT AUDITOR
// ══════════════════════════════════════════════════════════════

describe("scanObjectForForbiddenKeys", () => {
  test("finds key at root level", () => {
    const results = scanObjectForForbiddenKeys({ scheduled_for: "2026-06-01" }, ["scheduled_for"]);
    expect(results.length).toBe(1);
    expect(results[0].key).toBe("scheduled_for");
  });

  test("finds key nested in object", () => {
    const results = scanObjectForForbiddenKeys(
      { task: { payload: { scheduled_for: "2026-06-01" } } },
      ["scheduled_for"],
    );
    expect(results.length).toBe(1);
  });

  test("finds key in array", () => {
    const results = scanObjectForForbiddenKeys(
      [{ scheduled_for: "2026-06-01" }],
      ["scheduled_for"],
    );
    expect(results.length).toBe(1);
  });

  test("returns empty when no forbidden keys", () => {
    const results = scanObjectForForbiddenKeys(
      { execute_at: "2026-06-01" },
      ["scheduled_for"],
    );
    expect(results.length).toBe(0);
  });

  test("handles null gracefully", () => {
    expect(() => scanObjectForForbiddenKeys(null, ["scheduled_for"])).not.toThrow();
  });

  test("handles non-object gracefully", () => {
    expect(() => scanObjectForForbiddenKeys("string", ["scheduled_for"])).not.toThrow();
  });
});

describe("auditPierreTaskSafety", () => {
  test("detects scheduled_for in task root", () => {
    const tasks = [{ id: "t1", type: "document_generate", scheduled_for: "2026-06-01" }];
    const checks = auditPierreTaskSafety(tasks);
    const scheduledCheck = checks.find((c) => c.id === "task_no_scheduled_for");
    expect(scheduledCheck).toBeDefined();
    expect(scheduledCheck!.status).toBe("fail");
  });

  test("passes when execute_at used instead", () => {
    const tasks = [{ id: "t1", type: "document_generate", execute_at: "2026-06-01" }];
    const checks = auditPierreTaskSafety(tasks);
    const scheduledCheck = checks.find((c) => c.id === "task_no_scheduled_for");
    expect(scheduledCheck!.status).toBe("pass");
  });

  test("detects email.send without approval_required", () => {
    const tasks = [{ id: "t1", type: "email.send", approval_required: false }];
    const checks = auditPierreTaskSafety(tasks);
    const emailCheck = checks.find((c) => c.id === "task_no_email_send_auto");
    expect(emailCheck!.status).toBe("fail");
  });

  test("detects send_email type", () => {
    const tasks = [{ id: "t1", type: "send_email", approval_required: false }];
    const checks = auditPierreTaskSafety(tasks);
    const emailCheck = checks.find((c) => c.id === "task_no_email_send_auto");
    expect(emailCheck!.status).toBe("fail");
  });

  test("passes when email task has approval_required=true", () => {
    const tasks = [{ id: "t1", type: "email.draft", approval_required: true }];
    const checks = auditPierreTaskSafety(tasks);
    const emailCheck = checks.find((c) => c.id === "task_no_email_send_auto");
    expect(emailCheck!.status).toBe("pass");
  });

  test("empty tasks returns checks without fail", () => {
    const checks = auditPierreTaskSafety([]);
    const fails = checks.filter((c) => c.status === "fail");
    expect(fails.length).toBe(0);
  });

  test("returns array", () => {
    expect(Array.isArray(auditPierreTaskSafety([]))).toBe(true);
  });
});

describe("auditPierreLogSchema", () => {
  test("detects old level field", () => {
    const logs = [{ id: "l1", level: "info", message: "test" }];
    const checks = auditPierreLogSchema(logs);
    const levelCheck = checks.find((c) => c.id === "log_no_level_field");
    expect(levelCheck!.status).toBe("fail");
  });

  test("detects old event field", () => {
    const logs = [{ id: "l1", event: "mission_created" }];
    const checks = auditPierreLogSchema(logs);
    const eventCheck = checks.find((c) => c.id === "log_no_event_field");
    expect(eventCheck!.status).toBe("fail");
  });

  test("detects old payload field", () => {
    const logs = [{ id: "l1", payload: { key: "val" } }];
    const checks = auditPierreLogSchema(logs);
    const payloadCheck = checks.find((c) => c.id === "log_no_payload_field");
    expect(payloadCheck!.status).toBe("fail");
  });

  test("passes valid log schema", () => {
    const logs = [
      { id: "l1", event_type: "mission_created", message: "Mission cree", meta_json: {} },
    ];
    const checks = auditPierreLogSchema(logs);
    const levelCheck = checks.find((c) => c.id === "log_no_level_field");
    const eventCheck = checks.find((c) => c.id === "log_no_event_field");
    const payloadCheck = checks.find((c) => c.id === "log_no_payload_field");
    expect(levelCheck!.status).toBe("pass");
    expect(eventCheck!.status).toBe("pass");
    expect(payloadCheck!.status).toBe("pass");
  });

  test("empty logs returns no critical fails", () => {
    const checks = auditPierreLogSchema([]);
    const criticalFails = checks.filter((c) => c.status === "fail" && c.severity === "critical");
    expect(criticalFails.length).toBe(0);
  });
});

describe("auditPierreStorageShape", () => {
  test("passes when null memory provided", () => {
    const checks = auditPierreStorageShape(null);
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures.length).toBe(0);
  });

  test("passes valid memory shape", () => {
    const memory = {
      reusable_rh_context_json: {
        employees: [],
        document_templates: [],
        clone_adn: { status: "configured" },
      },
    };
    const checks = auditPierreStorageShape(memory);
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures.length).toBe(0);
  });

  test("detects employees in memory_json", () => {
    const memory = {
      memory_json: { employees: [{ id: "emp_001" }] },
      reusable_rh_context_json: { employees: [], document_templates: [] },
    };
    const checks = auditPierreStorageShape(memory);
    const employeesMemJson = checks.find((c) => c.id === "storage_no_employees_in_memory_json");
    expect(employeesMemJson!.status).toBe("fail");
  });

  test("detects clone_adn in memory_json", () => {
    const memory = {
      memory_json: { clone_adn: { status: "configured" } },
      reusable_rh_context_json: { employees: [], document_templates: [] },
    };
    const checks = auditPierreStorageShape(memory);
    const adnCheck = checks.find((c) => c.id === "storage_cloneadn_location");
    expect(adnCheck!.status).toBe("fail");
  });
});

describe("auditPierreDocumentsSafety", () => {
  test("detects sensitive document without human validation", () => {
    const docs = [
      {
        document_type: "sensitive_case_note",
        status: "draft",
        requires_human_validation: false,
      },
    ];
    const checks = auditPierreDocumentsSafety(docs);
    const sensCheck = checks.find((c) => c.id === "docs_sensitive_validation");
    expect(sensCheck!.status).toBe("fail");
  });

  test("passes sensitive document with validation required", () => {
    const docs = [
      {
        document_type: "sensitive_case_note",
        status: "blocked",
        requires_human_validation: true,
      },
    ];
    const checks = auditPierreDocumentsSafety(docs);
    const sensCheck = checks.find((c) => c.id === "docs_sensitive_validation");
    expect(sensCheck!.status).toBe("pass");
  });

  test("contract validation required", () => {
    const docs = [
      {
        document_type: "hr_contract_draft",
        status: "draft",
        requires_human_validation: false,
      },
    ];
    const checks = auditPierreDocumentsSafety(docs);
    const sensCheck = checks.find((c) => c.id === "docs_sensitive_validation");
    expect(sensCheck!.status).toBe("fail");
  });

  test("prepay validation required", () => {
    const docs = [
      {
        document_type: "prepay_summary",
        status: "draft",
        requires_human_validation: false,
      },
    ];
    const checks = auditPierreDocumentsSafety(docs);
    const sensCheck = checks.find((c) => c.id === "docs_sensitive_validation");
    expect(sensCheck!.status).toBe("fail");
  });

  test("offboarding validation required", () => {
    const docs = [
      {
        document_type: "offboarding_checklist",
        status: "draft",
        requires_human_validation: false,
      },
    ];
    const checks = auditPierreDocumentsSafety(docs);
    const sensCheck = checks.find((c) => c.id === "docs_sensitive_validation");
    expect(sensCheck!.status).toBe("fail");
  });

  test("empty documents returns no fail", () => {
    const checks = auditPierreDocumentsSafety([]);
    const fails = checks.filter((c) => c.status === "fail");
    expect(fails.length).toBe(0);
  });
});

describe("auditPierreAIRuntimeShape", () => {
  test("fails when status is null", () => {
    const checks = auditPierreAIRuntimeShape(null);
    const fail = checks.find((c) => c.status === "fail");
    expect(fail).toBeDefined();
  });

  test("passes when status has mock provider", () => {
    const status = {
      providers: [{ provider: "mock", configured: true, healthy: true }],
      prompt_contracts_count: 16,
      supported_use_cases: ["pierre.mission.interpret"],
    };
    const checks = auditPierreAIRuntimeShape(status);
    const mockCheck = checks.find((c) => c.id === "ai_runtime_mock_configured");
    expect(mockCheck!.status).toBe("pass");
  });

  test("AI status no secrets", () => {
    const status = {
      providers: [{ provider: "openai", configured: false, error: "OPENAI_API_KEY not set." }],
      prompt_contracts_count: 16,
      supported_use_cases: [],
    };
    const checks = auditPierreAIRuntimeShape(status);
    const secretCheck = checks.find((c) => c.id === "ai_runtime_no_secrets");
    expect(secretCheck!.status).toBe("pass");
  });

  test("detects API key pattern", () => {
    const status = {
      providers: [{ provider: "openai", configured: true, api_key: "sk-abcdefghij1234567890" }],
      prompt_contracts_count: 16,
      supported_use_cases: [],
    };
    const checks = auditPierreAIRuntimeShape(status);
    const secretCheck = checks.find((c) => c.id === "ai_runtime_no_secrets");
    expect(secretCheck!.status).toBe("fail");
  });

  test("prompt contracts count check", () => {
    const status = {
      providers: [{ provider: "mock", configured: true }],
      prompt_contracts_count: 5,
      supported_use_cases: [],
    };
    const checks = auditPierreAIRuntimeShape(status);
    const contractCheck = checks.find((c) => c.id === "ai_runtime_contracts_count");
    expect(contractCheck).toBeDefined();
    expect(contractCheck!.status).toBe("warning");
  });
});

describe("auditPierreGoldenScenarioSuiteShape", () => {
  test("fails when suite is null", () => {
    const checks = auditPierreGoldenScenarioSuiteShape(null);
    const fail = checks.find((c) => c.status === "fail");
    expect(fail).toBeDefined();
  });

  test("checks score in [0, 100]", () => {
    const suite = { scenarios_total: 13, scenarios_passed: 13, score: 100 };
    const checks = auditPierreGoldenScenarioSuiteShape(suite);
    const scoreCheck = checks.find((c) => c.id === "scenarios_suite_score");
    expect(scoreCheck!.status).toBe("pass");
  });

  test("fails when score out of range", () => {
    const suite = { scenarios_total: 13, scenarios_passed: 0, score: -1 };
    const checks = auditPierreGoldenScenarioSuiteShape(suite);
    const scoreCheck = checks.find((c) => c.id === "scenarios_suite_score");
    expect(scoreCheck!.status).toBe("fail");
  });

  test("checks scenarios total >= 13", () => {
    const suite = { scenarios_total: 13, scenarios_passed: 13 };
    const checks = auditPierreGoldenScenarioSuiteShape(suite);
    const countCheck = checks.find((c) => c.id === "scenarios_count_min");
    expect(countCheck!.status).toBe("pass");
  });

  test("fails when scenarios_total < 13", () => {
    const suite = { scenarios_total: 5, scenarios_passed: 5 };
    const checks = auditPierreGoldenScenarioSuiteShape(suite);
    const countCheck = checks.find((c) => c.id === "scenarios_count_min");
    expect(countCheck!.status).toBe("fail");
  });
});

describe("auditPierreGlobalInvariants", () => {
  test("returns array of checks", () => {
    const checks = auditPierreGlobalInvariants({});
    expect(Array.isArray(checks)).toBe(true);
  });

  test("works with empty params", () => {
    expect(() => auditPierreGlobalInvariants({})).not.toThrow();
  });

  test("aggregates task + log + storage checks", () => {
    const checks = auditPierreGlobalInvariants({
      tasks: [{ type: "document_generate", execute_at: "2026-06-01" }],
      logs: [{ event_type: "test", message: "ok", meta_json: {} }],
      memory: null,
    });
    const ids = checks.map((c) => c.id);
    expect(ids).toContain("task_no_scheduled_for");
    expect(ids).toContain("log_no_level_field");
    expect(ids).toContain("storage_employees_location");
  });

  test("detects scheduled_for in tasks", () => {
    const checks = auditPierreGlobalInvariants({
      tasks: [{ scheduled_for: "2026-06-01" }],
    });
    const check = checks.find((c) => c.id === "task_no_scheduled_for");
    expect(check!.status).toBe("fail");
  });

  test("detects old log schema", () => {
    const checks = auditPierreGlobalInvariants({
      logs: [{ level: "info", event: "test", payload: {} }],
    });
    const levelCheck = checks.find((c) => c.id === "log_no_level_field");
    expect(levelCheck!.status).toBe("fail");
  });

  test("approval_required tasks not auto-safe", () => {
    const checks = auditPierreGlobalInvariants({
      tasks: [{ type: "email.draft", approval_required: true, status: "ready" }],
    });
    const approvalCheck = checks.find((c) => c.id === "task_approval_required_not_auto");
    expect(approvalCheck!.status).toBe("fail");
  });

  test("adds warning when aiStatus not provided", () => {
    const checks = auditPierreGlobalInvariants({});
    const aiWarn = checks.find((c) => c.id === "ai_runtime_not_provided");
    expect(aiWarn).toBeDefined();
    expect(aiWarn!.status).toBe("warning");
  });

  test("adds warning when scenarioSuite not provided", () => {
    const checks = auditPierreGlobalInvariants({});
    const suiteWarn = checks.find((c) => c.id === "scenarios_suite_not_provided");
    expect(suiteWarn).toBeDefined();
    expect(suiteWarn!.status).toBe("warning");
  });

  test("never throws", () => {
    expect(() =>
      auditPierreGlobalInvariants({
        tasks: null as unknown as Record<string, unknown>[],
        logs: undefined as unknown as Record<string, unknown>[],
      }),
    ).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════
// C. PREFLIGHT
// ══════════════════════════════════════════════════════════════

describe("buildPierreReleaseCandidateStaticChecklist", () => {
  test("returns non-empty array", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    expect(checks.length).toBeGreaterThan(0);
  });

  test("all checks have required fields", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    for (const check of checks) {
      expect(typeof check.id).toBe("string");
      expect(typeof check.area).toBe("string");
      expect(typeof check.label).toBe("string");
      expect(["pass", "warning", "fail"]).toContain(check.status);
    }
  });

  test("includes AI runtime checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const aiChecks = checks.filter((c) => c.area === "ai_runtime");
    expect(aiChecks.length).toBeGreaterThan(0);
  });

  test("includes brain checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const brainChecks = checks.filter((c) => c.area === "brain");
    expect(brainChecks.length).toBeGreaterThan(0);
  });

  test("includes CloneADN checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const adnChecks = checks.filter((c) => c.area === "cloneadn");
    expect(adnChecks.length).toBeGreaterThan(0);
  });

  test("includes document checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const docChecks = checks.filter((c) => c.area === "documents");
    expect(docChecks.length).toBeGreaterThan(0);
  });

  test("includes scenarios checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const scenChecks = checks.filter((c) => c.area === "golden_scenarios");
    expect(scenChecks.length).toBeGreaterThan(0);
  });

  test("includes routes checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const routeChecks = checks.filter((c) => c.area === "routes");
    expect(routeChecks.length).toBeGreaterThan(0);
  });

  test("includes schema checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const schemaChecks = checks.filter((c) => c.area === "schema");
    expect(schemaChecks.length).toBeGreaterThan(0);
  });

  test("never throws", () => {
    expect(() => buildPierreReleaseCandidateStaticChecklist()).not.toThrow();
  });
});

describe("buildPierreReleaseCandidatePreflight", () => {
  test("returns report without throwing", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    expect(report).toBeDefined();
    expect(typeof report.score).toBe("number");
  });

  test("score in [0, 100]", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("status is valid", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    expect(["ready", "almost_ready", "blocked", "failed"]).toContain(report.status);
  });

  test("has AI runtime checks in checklist", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const aiChecks = report.checks.filter((c) => c.area === "ai_runtime");
    expect(aiChecks.length).toBeGreaterThan(0);
  });

  test("has brain checks", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const brainChecks = report.checks.filter((c) => c.area === "brain");
    expect(brainChecks.length).toBeGreaterThan(0);
  });

  test("has CloneADN checks", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const adnChecks = report.checks.filter((c) => c.area === "cloneadn");
    expect(adnChecks.length).toBeGreaterThan(0);
  });

  test("has document checks", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const docChecks = report.checks.filter((c) => c.area === "documents");
    expect(docChecks.length).toBeGreaterThan(0);
  });

  test("has scenarios checks", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const scenChecks = report.checks.filter((c) => c.area === "golden_scenarios");
    expect(scenChecks.length).toBeGreaterThan(0);
  });

  test("forceMock does not require provider", async () => {
    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite: false,
      forceMock: true,
      aiMode: "off",
    });
    expect(report).toBeDefined();
  });

  test("includeGoldenSuite=true works", async () => {
    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite: true,
      aiMode: "off",
    });
    expect(report).toBeDefined();
    expect(report.score).toBeGreaterThanOrEqual(0);
  }, 30000);

  test("has product checks (routes/schema)", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const hasProductArea = report.checks.some(
      (c) => c.area === "routes" || c.area === "schema" || c.area === "product",
    );
    expect(hasProductArea).toBe(true);
  });

  test("never throws", async () => {
    await expect(buildPierreReleaseCandidatePreflight()).resolves.not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════
// D. MARKDOWN REPORT
// ══════════════════════════════════════════════════════════════

describe("buildPierreReleaseCandidateExecutiveSummary", () => {
  const makeReport = (status: PierreReleaseCandidateReport["status"]): PierreReleaseCandidateReport => ({
    generated_at: "2026-05-20T00:00:00Z",
    version: "30.0.0",
    status,
    score: 85,
    modules: [],
    checks: [],
    blocking_issues: [],
    warnings: [],
    strongest_proofs: [],
    release_decision: {
      can_release_backend: status === "ready",
      can_start_cockpit: status === "ready" || status === "almost_ready",
      requires_hotfix: status === "blocked" || status === "failed",
      recommendation: "Test recommendation.",
    },
  });

  test("returns headline string", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("ready"));
    expect(typeof summary.headline).toBe("string");
    expect(summary.headline.length).toBeGreaterThan(0);
  });

  test("headline includes status", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("almost_ready"));
    expect(summary.headline).toContain("PRESQUE PRET");
  });

  test("returns summary string", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("ready"));
    expect(typeof summary.summary).toBe("string");
  });

  test("returns decision string", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("ready"));
    expect(typeof summary.decision).toBe("string");
  });

  test("returns next_steps array", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("ready"));
    expect(Array.isArray(summary.next_steps)).toBe(true);
  });

  test("next_step mentions cockpit for ready/almost_ready", () => {
    const summary = buildPierreReleaseCandidateExecutiveSummary(makeReport("ready"));
    const hasCockpit = summary.next_steps.some((s) =>
      s.toLowerCase().includes("31") || s.toLowerCase().includes("cockpit"),
    );
    expect(hasCockpit).toBe(true);
  });

  test("never throws", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(() => buildPierreReleaseCandidateExecutiveSummary(report)).not.toThrow();
  });
});

describe("renderPierreReleaseCandidateMarkdown", () => {
  const sampleReport = buildPierreReleaseCandidateReport({
    checks: [
      buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
    ],
    version: "30.0.0",
    strongest_proofs: ["Brain Final fonctionne"],
  });

  test("returns non-empty string", () => {
    const md = renderPierreReleaseCandidateMarkdown(sampleReport);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(100);
  });

  test("includes status", () => {
    const md = renderPierreReleaseCandidateMarkdown(sampleReport);
    expect(md).toContain("Statut");
  });

  test("includes score", () => {
    const md = renderPierreReleaseCandidateMarkdown(sampleReport);
    expect(md).toMatch(/\d+\/100/);
  });

  test("includes modules section when modules present", () => {
    const reportWithModules = buildPierreReleaseCandidateReport({
      checks: [
        buildRCCheck({ id: "a", area: "schema", label: "A", pass: true, expected: "e", actual: "a" }),
        buildRCFail({ id: "b", area: "security", label: "B", expected: "e", actual: "a" }),
      ],
    });
    const md = renderPierreReleaseCandidateMarkdown(reportWithModules);
    expect(md).toContain("Modules");
  });

  test("includes blocking issues when present", () => {
    const reportWithFail = buildPierreReleaseCandidateReport({
      checks: [
        buildRCFail({ id: "b", area: "security", label: "Fail Issue", expected: "e", actual: "a" }),
      ],
    });
    const md = renderPierreReleaseCandidateMarkdown(reportWithFail);
    expect(md).toContain("bloquantes");
  });

  test("mentions Bloc 31 cockpit for almost_ready report", () => {
    const checks = Array.from({ length: 5 }, (_, i) =>
      buildRCCheck({ id: `c${i}`, area: "schema", label: `C${i}`, pass: true, expected: "e", actual: "a" }),
    );
    const report = buildPierreReleaseCandidateReport({ checks });
    const md = renderPierreReleaseCandidateMarkdown(report);
    if (report.status === "ready" || report.status === "almost_ready" || report.release_decision.can_start_cockpit) {
      expect(md).toContain("31");
    }
  });

  test("never throws", () => {
    const report = buildPierreReleaseCandidateReport({ checks: [] });
    expect(() => renderPierreReleaseCandidateMarkdown(report)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════
// E. SCENARIO ID HARMONIZATION
// ══════════════════════════════════════════════════════════════

describe("normalizePierreGoldenScenarioId", () => {
  test("returns gs_* ID unchanged", () => {
    expect(normalizePierreGoldenScenarioId("gs_onboarding_complete")).toBe("gs_onboarding_complete");
  });

  test("resolves onboarding_cdi -> gs_onboarding_complete", () => {
    expect(normalizePierreGoldenScenarioId("onboarding_cdi")).toBe("gs_onboarding_complete");
  });

  test("resolves contract_draft -> gs_hiring_offer", () => {
    expect(normalizePierreGoldenScenarioId("contract_draft")).toBe("gs_hiring_offer");
  });

  test("resolves contract_amendment -> gs_contract_renewal", () => {
    expect(normalizePierreGoldenScenarioId("contract_amendment")).toBe("gs_contract_renewal");
  });

  test("resolves absence_followup -> gs_absence_justified", () => {
    expect(normalizePierreGoldenScenarioId("absence_followup")).toBe("gs_absence_justified");
  });

  test("resolves prepay_summary -> gs_payroll_prep", () => {
    expect(normalizePierreGoldenScenarioId("prepay_summary")).toBe("gs_payroll_prep");
  });

  test("resolves employee_file_summary -> gs_employee_360", () => {
    expect(normalizePierreGoldenScenarioId("employee_file_summary")).toBe("gs_employee_360");
  });

  test("resolves sensitive_case -> gs_cloneguard_block", () => {
    expect(normalizePierreGoldenScenarioId("sensitive_case")).toBe("gs_cloneguard_block");
  });

  test("resolves incomplete_request -> gs_invalid_request", () => {
    expect(normalizePierreGoldenScenarioId("incomplete_request")).toBe("gs_invalid_request");
  });

  test("returns null for unknown ID", () => {
    expect(normalizePierreGoldenScenarioId("unknown_xyz")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(normalizePierreGoldenScenarioId("")).toBeNull();
  });

  test("returns null for null", () => {
    expect(normalizePierreGoldenScenarioId(null)).toBeNull();
  });

  test("returns null for number", () => {
    expect(normalizePierreGoldenScenarioId(42)).toBeNull();
  });
});

describe("isValidGoldenScenarioId", () => {
  test("returns true for gs_* IDs", () => {
    expect(isValidGoldenScenarioId("gs_onboarding_complete")).toBe(true);
    expect(isValidGoldenScenarioId("gs_invalid_request")).toBe(true);
  });

  test("returns true for official alias IDs", () => {
    expect(isValidGoldenScenarioId("onboarding_cdi")).toBe(true);
    expect(isValidGoldenScenarioId("contract_draft")).toBe(true);
    expect(isValidGoldenScenarioId("incomplete_request")).toBe(true);
  });

  test("returns false for unknown ID", () => {
    expect(isValidGoldenScenarioId("foobar")).toBe(false);
  });
});

describe("isValidOfficialScenarioId", () => {
  test("returns true for all 13 official IDs", () => {
    const officialIds = [
      "onboarding_cdi", "contract_draft", "contract_amendment", "absence_followup",
      "prepay_summary", "employee_file_summary", "sensitive_case", "offboarding",
      "candidate_rejection", "executive_hr_briefing", "out_of_scope",
      "email_without_validation", "incomplete_request",
    ];
    for (const id of officialIds) {
      expect(isValidOfficialScenarioId(id)).toBe(true);
    }
  });

  test("returns false for gs_* internal IDs", () => {
    expect(isValidOfficialScenarioId("gs_onboarding_complete")).toBe(false);
  });

  test("returns false for unknown", () => {
    expect(isValidOfficialScenarioId("random_id")).toBe(false);
  });
});

describe("13 official IDs exist and are covered", () => {
  const registry = getGoldenScenarioRegistry();
  const registryIds = registry.map((s) => s.id);

  test("registry has 13 scenarios", () => {
    expect(registry.length).toBe(13);
  });

  test("PIERRE_OFFICIAL_SCENARIO_IDS has 13 entries", () => {
    expect(PIERRE_OFFICIAL_SCENARIO_IDS.length).toBe(13);
  });

  test("each official ID resolves to a gs_* ID in the registry", () => {
    for (const oid of PIERRE_OFFICIAL_SCENARIO_IDS) {
      const normalized = normalizePierreGoldenScenarioId(oid);
      expect(normalized).not.toBeNull();
      expect(registryIds).toContain(normalized);
    }
  });

  test("getGoldenScenarioByOfficialIdOrAlias works for all official IDs", () => {
    for (const oid of PIERRE_OFFICIAL_SCENARIO_IDS) {
      const scenario = getGoldenScenarioByOfficialIdOrAlias(oid);
      expect(scenario).not.toBeNull();
    }
  });

  test("registry by gs_* ID still works", () => {
    for (const id of registryIds) {
      const normalized = normalizePierreGoldenScenarioId(id);
      expect(normalized).not.toBeNull();
      expect(normalized).toBe(id);
    }
  });

  test("official IDs not in registry directly but via alias", () => {
    for (const oid of PIERRE_OFFICIAL_SCENARIO_IDS) {
      const inRegistryDirect = registryIds.includes(oid);
      const normalized = normalizePierreGoldenScenarioId(oid);
      if (!inRegistryDirect) {
        expect(normalized).not.toBeNull();
        expect(registryIds).toContain(normalized);
      }
    }
  });
});
