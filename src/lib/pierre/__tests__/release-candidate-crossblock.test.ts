// src/lib/pierre/__tests__/release-candidate-crossblock.test.ts
// Cross-block tests Bloc 30 — Pierre Release Candidate
// Verifies that RC engine, Brain Final, CloneADN, Documents, Golden Scenarios, and core modules
// coexist without conflict. No Supabase, no real AI provider.

import { describe, test, expect } from "vitest";

// RC engine
import {
  buildPierreReleaseCandidatePreflight,
  buildPierreReleaseCandidateStaticChecklist,
} from "../../pierre/release-candidate/preflight";
import {
  auditPierreGlobalInvariants,
  auditPierreTaskSafety,
  auditPierreLogSchema,
} from "../../pierre/release-candidate/invariant-auditor";
import {
  buildPierreReleaseCandidateReport,
  scoreRCChecks,
} from "../../pierre/release-candidate/checks";
import { renderPierreReleaseCandidateMarkdown } from "../../pierre/release-candidate/report";

// Brain Final (Bloc 26)
import { runPierreFinalBrain } from "../../pierre/brain/final-brain";

// CloneADN (Bloc 28)
import { getGoldenCloneADN } from "../../pierre/scenarios/fixtures";
import { evaluateCloneADNRules } from "../../pierre/adn/cloneadn";

// Documents Premium (Bloc 27)
import { renderPierrePremiumDocument } from "../../pierre/documents/premium-document-system";

// Golden Scenarios (Bloc 29)
import {
  normalizePierreGoldenScenarioId,
  getGoldenScenarioRegistry,
  getGoldenScenarioByOfficialIdOrAlias,
  PIERRE_OFFICIAL_SCENARIO_IDS,
} from "../../pierre/scenarios/golden-registry";
import { runGoldenScenario, runGoldenScenarioSuite } from "../../pierre/scenarios/runner";
import { getGoldenScenarioById } from "../../pierre/scenarios/golden-registry";
import { getGoldenEmployeeContext } from "../../pierre/scenarios/fixtures";

// AI Runtime (Bloc 25)
import { getCloneAIRuntimeStatus } from "../../cloneos/ai/runtime";

// Customer Success, Trial, Release Proof, Readiness (Blocs 21-24)
import { buildPierreReadinessReport } from "../../pierre/hr/operational-readiness";
import { buildPierreReleaseReport } from "../../pierre/hr/release-proof";
import { buildPierreTrialActivationReport } from "../../pierre/hr/trial-activation";
import { buildPierreCustomerSuccessReport } from "../../pierre/hr/customer-success";

// ══════════════════════════════════════════════════════════════
// 1. RC ENGINE + BRAIN FINAL CROSSBLOCK
// ══════════════════════════════════════════════════════════════

describe("RC Engine x Brain Final (Bloc 26)", () => {
  test("brain final runs in ai_mode=off (deterministic)", async () => {
    const output = await runPierreFinalBrain({
      input: "Préparer l'onboarding de Marie Dupont, CDI React.",
      aiMode: "off",
    });
    expect(output).toBeDefined();
    expect(output.source).toBe("deterministic");
    expect(output.quality_gate.valid).toBe(true);
  });

  test("brain final does not expose API keys", async () => {
    const output = await runPierreFinalBrain({
      input: "Mettre à jour les coordonnées de l'employé.",
      aiMode: "off",
    });
    const serialized = JSON.stringify(output);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
  });

  test("preflight static checklist includes brain checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const brainCheck = checks.find((c) => c.area === "brain");
    expect(brainCheck).toBeDefined();
  });

  test("brain output never has scheduled_for", async () => {
    const output = await runPierreFinalBrain({
      input: "Créer une tâche planifiée pour demain.",
      aiMode: "off",
    });
    const tasks = output.task_plan?.tasks ?? [];
    const hits = auditPierreTaskSafety(
      tasks.map((t) => t as unknown as Record<string, unknown>),
    );
    const scheduledCheck = hits.find((c) => c.id === "task_no_scheduled_for");
    expect(scheduledCheck!.status).toBe("pass");
  });
});

// ══════════════════════════════════════════════════════════════
// 2. RC ENGINE + CLONEADN (Bloc 28)
// ══════════════════════════════════════════════════════════════

describe("RC Engine x CloneADN (Bloc 28)", () => {
  test("CloneADN profile loaded from fixtures", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.status).toBe("configured");
  });

  test("CloneADN blocks email.send via never_auto_execute", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    const neverAuto = adn!.validation?.never_auto_execute ?? [];
    expect(neverAuto.some((s) => s.includes("email") || s.includes("send"))).toBe(true);
  });

  test("CloneADN rule evaluation does not throw", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(() =>
      evaluateCloneADNRules(adn, { text: "Licencier l'employé.", task_type: null, domain: null }),
    ).not.toThrow();
  });

  test("CloneADN validation profile nested correctly", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn!.validation).toBeDefined();
    expect(Array.isArray(adn!.validation.never_auto_execute)).toBe(true);
    expect(Array.isArray(adn!.validation.sensitive_topics)).toBe(true);
  });

  test("RC preflight includes CloneADN checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const adnChecks = checks.filter((c) => c.area === "cloneadn");
    expect(adnChecks.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. RC ENGINE + DOCUMENTS PREMIUM (Bloc 27)
// ══════════════════════════════════════════════════════════════

describe("RC Engine x Documents Premium (Bloc 27)", () => {
  test("premium document rendering does not throw", () => {
    expect(() =>
      renderPierrePremiumDocument({
        kind: "onboarding_plan",
        variables: { employee_name: "Marie Dupont", request_text: "Onboarding" },
      }),
    ).not.toThrow();
  });

  test("contract draft requires validation", () => {
    const result = renderPierrePremiumDocument({
      kind: "hr_contract_draft",
      variables: { employee_name: "Thomas Martin" },
    });
    expect(result.requires_human_validation).toBe(true);
  });

  test("sensitive_case_note requires human validation when rendered", () => {
    const result = renderPierrePremiumDocument({
      kind: "sensitive_case_note",
      variables: { employee_name: "Jean Dupont", request_text: "Cas sensible" },
    });
    expect(result.requires_human_validation).toBe(true);
  });

  test("prepay_summary requires human validation", () => {
    const result = renderPierrePremiumDocument({
      kind: "prepay_summary",
      variables: { employee_name: "Sophie Blanc" },
    });
    expect(result.requires_human_validation).toBe(true);
  });

  test("html content is pdf_ready_html string", () => {
    const result = renderPierrePremiumDocument({
      kind: "onboarding_plan",
      variables: { employee_name: "Marie" },
    });
    if (result.ok) {
      expect(typeof result.content_html).toBe("string");
      expect(result.content_html.length).toBeGreaterThan(0);
    }
  });

  test("RC preflight includes document checks", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const docChecks = checks.filter((c) => c.area === "documents");
    expect(docChecks.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. RC ENGINE + GOLDEN SCENARIOS (Bloc 29)
// ══════════════════════════════════════════════════════════════

describe("RC Engine x Golden Scenarios (Bloc 29)", () => {
  test("registry has 13 scenarios", () => {
    const registry = getGoldenScenarioRegistry();
    expect(registry.length).toBe(13);
  });

  test("contract_draft scenario has validation-related checks", () => {
    const scenario = getGoldenScenarioByOfficialIdOrAlias("contract_draft");
    expect(scenario).not.toBeNull();
    const hasSafetyCheck = scenario!.checks.some(
      (c) => c.id.includes("no_email") || c.id.includes("email") || c.id.includes("task"),
    );
    expect(hasSafetyCheck).toBe(true);
  });

  test("sensitive_case scenario requires human validation", async () => {
    const scenario = getGoldenScenarioByOfficialIdOrAlias("sensitive_case");
    expect(scenario).not.toBeNull();
    const result = await runGoldenScenario(scenario!, { ai_mode: "off", dry_run: true });
    const guardArtifact = result.artifacts.find((a) => a.type === "cloneguard");
    if (guardArtifact) {
      expect(guardArtifact.data["requires_human"]).toBe(true);
    } else {
      // If no cloneguard artifact, the scenario itself should still pass
      expect(result.status).toBe("pass");
    }
  }, 15000);

  test("email_without_validation alias exists and no email.send", async () => {
    const scenario = getGoldenScenarioByOfficialIdOrAlias("email_without_validation");
    expect(scenario).not.toBeNull();
    const result = await runGoldenScenario(scenario!, { ai_mode: "off", dry_run: true });
    const taskArtifact = result.artifacts.find((a) => a.type === "task_drafts");
    if (taskArtifact) {
      expect(taskArtifact.data["has_email_send"]).toBe(false);
    }
  }, 15000);

  test("incomplete_request returns validation_error artifact", async () => {
    const scenario = getGoldenScenarioByOfficialIdOrAlias("incomplete_request");
    expect(scenario).not.toBeNull();
    const result = await runGoldenScenario(scenario!, { ai_mode: "off", dry_run: true });
    const validationArtifact = result.artifacts.find((a) => a.type === "validation_error");
    expect(validationArtifact).toBeDefined();
    expect(validationArtifact!.data["handled"]).toBe(true);
  }, 15000);

  test("no task_drafts artifact has scheduled_for", async () => {
    const scenario = getGoldenScenarioById("gs_hiring_offer");
    expect(scenario).not.toBeNull();
    const result = await runGoldenScenario(scenario!, { ai_mode: "off", dry_run: true });
    const taskArtifact = result.artifacts.find((a) => a.type === "task_drafts");
    if (taskArtifact) {
      expect(taskArtifact.data["has_scheduled_for"]).toBe(false);
    }
  }, 15000);

  test("all 13 official IDs map to a valid scenario", () => {
    for (const oid of PIERRE_OFFICIAL_SCENARIO_IDS) {
      const scenario = getGoldenScenarioByOfficialIdOrAlias(oid);
      expect(scenario).not.toBeNull();
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 5. RC ENGINE + AI RUNTIME (Bloc 25)
// ══════════════════════════════════════════════════════════════

describe("RC Engine x AI Runtime (Bloc 25)", () => {
  test("AI runtime status is available", () => {
    const status = getCloneAIRuntimeStatus();
    expect(status).toBeDefined();
    expect(typeof status.prompt_contracts_count).toBe("number");
  });

  test("mock provider always configured", () => {
    const status = getCloneAIRuntimeStatus();
    const mock = status.providers.find((p) => p.provider === "mock");
    expect(mock).toBeDefined();
    expect(mock!.configured).toBe(true);
  });

  test("AI status does not expose secrets", () => {
    const status = getCloneAIRuntimeStatus();
    const serialized = JSON.stringify(status);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
  });

  test("RC audit of AI status passes for valid status", () => {
    const status = getCloneAIRuntimeStatus();
    const checks = auditPierreGlobalInvariants({ aiStatus: status });
    const secretCheck = checks.find((c) => c.id === "ai_runtime_no_secrets");
    expect(secretCheck!.status).toBe("pass");
  });
});

// ══════════════════════════════════════════════════════════════
// 6. MODULE COEXISTENCE (Blocs 21-24)
// ══════════════════════════════════════════════════════════════

describe("Module coexistence — Customer Success, Trial, Release Proof, Readiness", () => {
  test("customer success module importable and produces result", () => {
    const result = buildPierreCustomerSuccessReport({
      companyMemory: null,
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.generated_at).toBe("string");
  });

  test("trial activation module importable and produces result", () => {
    const result = buildPierreTrialActivationReport({
      companyMemory: null,
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.activation_score).toBe("number");
  });

  test("release proof module importable and produces result", () => {
    const result = buildPierreReleaseReport({
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      employees: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.global_score).toBe("number");
  });

  test("operational readiness module importable and produces result", () => {
    const result = buildPierreReadinessReport({
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      employees: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.global_score).toBe("number");
  });
});

// ══════════════════════════════════════════════════════════════
// 7. INVARIANTS GLOBAL — fixtures de test
// ══════════════════════════════════════════════════════════════

describe("Fixture safety — employee + log schema", () => {
  test("golden employee fixture uses execute_at not scheduled_for", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    const tasks = emp!.tasks;
    const hits = tasks.filter((t) => "scheduled_for" in t);
    expect(hits.length).toBe(0);
  });

  test("golden employee fixture logs use event_type/message/meta_json", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    const logs = emp!.logs;
    for (const log of logs) {
      expect("event_type" in log).toBe(true);
      expect("message" in log).toBe(true);
      expect("level" in log).toBe(false);
      expect("event" in log).toBe(false);
    }
  });

  test("auditPierreLogSchema passes for golden fixture logs", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    const logs = (emp?.logs ?? []) as Record<string, unknown>[];
    const checks = auditPierreLogSchema(logs);
    const fails = checks.filter((c) => c.status === "fail");
    expect(fails.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 8. PREFLIGHT GOLDEN SUITE INTEGRATION
// ══════════════════════════════════════════════════════════════

describe("Preflight x Golden Suite — full integration", () => {
  test("golden suite dry-run produces a valid suite result", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off", dry_run: true });
    expect(suite).toBeDefined();
    expect(typeof suite.scenarios_total).toBe("number");
    expect(suite.scenarios_total).toBe(13);
    expect(typeof suite.scenarios_passed).toBe("number");
  }, 60000);

  test("RC preflight with golden suite succeeds", async () => {
    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite: true,
      aiMode: "off",
    });
    expect(report).toBeDefined();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  }, 60000);

  test("RC report from golden suite is renderable to markdown", async () => {
    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite: false,
    });
    const md = renderPierreReleaseCandidateMarkdown(report);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(100);
    expect(md).toContain("Pierre Backend V1");
  });

  test("RC score computed from real checks is in [0, 100]", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const computed = scoreRCChecks(report.checks);
    expect(computed).toBeGreaterThanOrEqual(0);
    expect(computed).toBeLessThanOrEqual(100);
  });

  test("RC report has release_decision", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    expect(report.release_decision).toBeDefined();
    expect(typeof report.release_decision.can_release_backend).toBe("boolean");
    expect(typeof report.release_decision.can_start_cockpit).toBe("boolean");
    expect(typeof report.release_decision.requires_hotfix).toBe("boolean");
    expect(typeof report.release_decision.recommendation).toBe("string");
  });
});

// ══════════════════════════════════════════════════════════════
// 9. SECURITY — aucun secret dans les réponses RC
// ══════════════════════════════════════════════════════════════

describe("Security — no secrets in RC outputs", () => {
  test("static checklist output contains no API key patterns", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(serialized).not.toMatch(/Bearer [A-Za-z0-9]{20,}/);
  });

  test("RC report does not expose env vars", async () => {
    const report = await buildPierreReleaseCandidatePreflight({ includeGoldenSuite: false });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE/);
  });

  test("invariant audit does not expose memory secrets", () => {
    const memory = {
      reusable_rh_context_json: {
        employees: [],
        document_templates: [],
      },
    };
    const checks = auditPierreGlobalInvariants({ memory });
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
  });
});

// ══════════════════════════════════════════════════════════════
// 10. RC STATUS FINAL SUMMARY
// ══════════════════════════════════════════════════════════════

describe("RC final status — Pierre Backend V1", () => {
  test("static checklist alone produces overall score >= 70", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const report = buildPierreReleaseCandidateReport({ checks, version: "30.0.0" });
    expect(report.score).toBeGreaterThanOrEqual(70);
  });

  test("can_start_cockpit is true when score >= 75", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const report = buildPierreReleaseCandidateReport({ checks, version: "30.0.0" });
    if (report.score >= 75 && !report.blocking_issues.some((i) => i.severity === "critical")) {
      expect(report.release_decision.can_start_cockpit).toBe(true);
    }
  });

  test("report markdown mentions Bloc 31 when cockpit can start", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const report = buildPierreReleaseCandidateReport({ checks, version: "30.0.0" });
    const md = renderPierreReleaseCandidateMarkdown(report);
    if (report.release_decision.can_start_cockpit) {
      expect(md).toContain("31");
    }
  });

  test("RC report is always renderable to markdown", () => {
    const checks = buildPierreReleaseCandidateStaticChecklist();
    const report = buildPierreReleaseCandidateReport({ checks, version: "30.0.0" });
    const md = renderPierreReleaseCandidateMarkdown(report);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(50);
  });
});
