// src/lib/pierre/scenarios/runner.ts
// Pierre Golden Scenarios — Async Runner
// Bloc 29: executes golden scenarios dry-run, no DB writes, no email.
// ai_mode defaults to "off" (mock provider always used in tests).

import { runPierreFinalBrain } from "../brain/final-brain";
import { convertPierreBrainTaskPlanToTaskDrafts } from "../brain/task-bridge";
import { buildPierreHrWorkflowPlan } from "../hr/workflows";
import { evaluatePierreCloneGuard } from "../hr/cloneguard";
import { buildEmployeeFile360 } from "../hr/employee-file";
import { renderPierrePremiumDocument } from "../documents/premium-document-system";
import type { PierrePremiumDocumentKind } from "../documents/premium-document-system";
import {
  buildPierreCompanyContextFromCloneADN,
  buildCloneADNApplicationContext,
  analyzeCloneADNProfile,
  evaluateCloneADNRules,
} from "../adn/cloneadn";
import type { CloneADNProfile } from "../../clonestore/adn/types";

import type {
  PierreGoldenScenarioInput,
  PierreGoldenScenarioResult,
  PierreGoldenScenarioSuiteResult,
  PierreGoldenScenarioArtifact,
  PierreGoldenScenarioRunOptions,
  PierreGoldenScenarioArtifactType,
  PierreGoldenScenarioExpectedStatus,
} from "./types";
import {
  getGoldenCompanyContext,
  getGoldenEmployeeContext,
  getGoldenCloneADN,
} from "./fixtures";
import {
  runAllChecks,
  computeCheckSummary,
  determineScenarioStatus,
  buildTaskDraftSafetyData,
  validateRequestText,
  buildValidationErrorArtifact,
} from "./validator";
import { getGoldenScenarioRegistry } from "./golden-registry";

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

function nowISO(): string {
  return new Date().toISOString();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeRecord(v: unknown): Record<string, unknown> {
  return isObject(v) ? v : {};
}

const KIND_TO_FAMILY: Record<PierrePremiumDocumentKind, string> = {
  hr_contract_draft: "contract",
  hr_amendment_draft: "amendment",
  candidate_rejection: "refusal",
  interview_invitation: "convocation",
  onboarding_plan: "onboarding",
  absence_followup: "absence",
  prepay_summary: "pre_payroll",
  employee_file_summary: "employee_summary",
  sensitive_case_note: "internal_note",
  offboarding_checklist: "offboarding",
  hr_weekly_briefing: "generic_hr",
  manager_notification: "generic_hr",
};

const SCENARIO_TO_DOCUMENT_KIND: Partial<Record<string, PierrePremiumDocumentKind>> = {
  gs_onboarding_complete: "onboarding_plan",
  gs_hiring_offer: "hr_contract_draft",
  gs_absence_justified: "absence_followup",
  gs_contract_renewal: "hr_amendment_draft",
  gs_document_premium: "interview_invitation",
};

// ══════════════════════════════════════════════════════════════
// MODULE RUNNERS
// ══════════════════════════════════════════════════════════════

function runWorkflowModule(
  requestText: string,
  employeeContext: Record<string, unknown> | null,
): PierreGoldenScenarioArtifact {
  try {
    const plan = buildPierreHrWorkflowPlan(requestText, {
      employee_context: employeeContext ?? undefined,
    });
    return {
      type: "workflow_plan",
      label: "Workflow HR Plan",
      data: {
        domain: plan.domain,
        priority: plan.priority,
        risk_level: plan.risk_level,
        approval_required: plan.approval_required,
        tasks: plan.tasks,
        missing_info: plan.missing_info,
        summary: plan.summary,
        can_execute_low_risk_tasks: plan.can_execute_low_risk_tasks,
        blocked_actions: plan.blocked_actions,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "workflow_plan",
      label: "Workflow HR Plan",
      data: {},
      valid: false,
      error: err instanceof Error ? err.message : "workflow error",
    };
  }
}

async function runBrainModule(
  requestText: string,
  companyContext: Record<string, unknown> | null,
  employeeContext: Record<string, unknown> | null,
): Promise<PierreGoldenScenarioArtifact> {
  try {
    const output = await runPierreFinalBrain({
      input: requestText,
      aiMode: "off",
      companyContext: companyContext ?? undefined,
      employeeContext: employeeContext ?? undefined,
    });
    return {
      type: "brain_output",
      label: "Pierre Brain Final Output",
      data: {
        source: output.source,
        ai_enabled: output.ai_enabled,
        interpretation: output.interpretation,
        risk_review: output.risk_review,
        task_plan: output.task_plan,
        quality_gate: output.quality_gate,
        warnings: output.warnings,
        errors: output.errors,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "brain_output",
      label: "Pierre Brain Final Output",
      data: { quality_gate: { valid: false } },
      valid: false,
      error: err instanceof Error ? err.message : "brain error",
    };
  }
}

async function runTaskDraftsModule(
  requestText: string,
  companyContext: Record<string, unknown> | null,
  employeeContext: Record<string, unknown> | null,
  cloneADNProfile: CloneADNProfile | null,
): Promise<PierreGoldenScenarioArtifact> {
  try {
    const output = await runPierreFinalBrain({
      input: requestText,
      aiMode: "off",
      companyContext: companyContext ?? undefined,
      employeeContext: employeeContext ?? undefined,
    });
    const cloneADNContext = cloneADNProfile
      ? {
          never_auto_execute: cloneADNProfile.validation?.never_auto_execute ?? [],
          always_require_human_for: cloneADNProfile.validation?.always_require_human_for ?? [],
          sensitive_topics: cloneADNProfile.validation?.sensitive_topics ?? [],
        }
      : undefined;
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(output.task_plan, {
      cloneADNContext,
    });
    const safetyData = buildTaskDraftSafetyData(
      drafts.map((d) => safeRecord(d as unknown)),
    );
    return {
      type: "task_drafts",
      label: "Task Drafts",
      data: safetyData,
      valid: true,
    };
  } catch (err) {
    return {
      type: "task_drafts",
      label: "Task Drafts",
      data: { tasks: [], has_email_send: false, has_scheduled_for: false, task_count: 0 },
      valid: false,
      error: err instanceof Error ? err.message : "task_drafts error",
    };
  }
}

function runEmployee360Module(
  employeeContext: {
    employee_row: Record<string, unknown>;
    missions: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    documents: Record<string, unknown>[];
    logs: Record<string, unknown>[];
  } | null,
): PierreGoldenScenarioArtifact {
  try {
    const empl = employeeContext ?? {
      employee_row: {},
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
    };
    const file360 = buildEmployeeFile360({
      employee: empl.employee_row,
      missions: empl.missions,
      tasks: empl.tasks,
      documents: empl.documents,
      logs: empl.logs,
    });
    return {
      type: "employee_360",
      label: "Employee File 360°",
      data: {
        health_score: file360.health.score,
        status: file360.status,
        risk_level: file360.risk_level,
        employee: file360.profile,
        risks: file360.risks,
        next_actions: file360.next_actions,
        timeline: file360.timeline,
        missing_info: file360.missing_info,
        digest: file360.digest,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "employee_360",
      label: "Employee File 360°",
      data: {},
      valid: false,
      error: err instanceof Error ? err.message : "employee_360 error",
    };
  }
}

function runDocumentModule(
  scenarioId: string,
  requestText: string,
  employeeContext: Record<string, unknown> | null,
  companyContext: Record<string, unknown> | null,
  cloneADNProfile: CloneADNProfile | null,
): PierreGoldenScenarioArtifact {
  try {
    const kind: PierrePremiumDocumentKind =
      SCENARIO_TO_DOCUMENT_KIND[scenarioId] ?? "manager_notification";
    const family = KIND_TO_FAMILY[kind] ?? "generic_hr";

    const cloneADNVariables: Record<string, unknown> = {};
    if (cloneADNProfile) {
      const appCtx = buildCloneADNApplicationContext(cloneADNProfile);
      cloneADNVariables["company_name"] = appCtx.company_name ?? "";
      cloneADNVariables["tone"] = appCtx.tone ?? "neutral";
    }

    const result = renderPierrePremiumDocument({
      kind,
      variables: {
        request_text: requestText,
        employee_name:
          isObject(employeeContext) ? (employeeContext["employee_name"] ?? "") : "",
        date: nowISO().slice(0, 10),
      },
      company_profile: companyContext,
      employee_profile: employeeContext,
      cloneADNVariables: Object.keys(cloneADNVariables).length > 0 ? cloneADNVariables : null,
    });

    return {
      type: "document",
      label: `Document premium — ${kind}`,
      data: {
        status: result.ok ? "rendered" : "blocked",
        html_content: result.content_html,
        template_id: result.template_id,
        family,
        document_type: result.document_type,
        risk_level: result.risk_level,
        requires_human_validation: result.requires_human_validation,
        quality_score: result.quality_score,
        warnings: result.warnings,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "document",
      label: "Document premium",
      data: { status: "blocked" },
      valid: false,
      error: err instanceof Error ? err.message : "document error",
    };
  }
}

function runCloneGuardModule(
  requestText: string,
  domain: string | null,
  taskType: string | null,
  riskHint: string | null,
): PierreGoldenScenarioArtifact {
  try {
    const evaluation = evaluatePierreCloneGuard({
      task_title: taskType ?? requestText.slice(0, 80),
      task_description: requestText,
      text_corpus: requestText,
      domain: domain ?? undefined,
      task_type: taskType ?? undefined,
      risk_level_hint: riskHint ?? undefined,
    });
    return {
      type: "cloneguard",
      label: "CloneGuard Evaluation",
      data: {
        decision: evaluation.decision,
        risk_level: evaluation.risk_level,
        reasoning: evaluation.explanation,
        requires_human: evaluation.requires_human,
        allowed_to_auto_execute: evaluation.allowed_to_auto_execute,
        signals: evaluation.signals,
        matched_rules: evaluation.matched_rules,
        human_note: evaluation.human_note,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "cloneguard",
      label: "CloneGuard Evaluation",
      data: {},
      valid: false,
      error: err instanceof Error ? err.message : "cloneguard error",
    };
  }
}

function runCloneADNModule(
  cloneADNProfile: CloneADNProfile | null,
  requestText: string,
): PierreGoldenScenarioArtifact {
  try {
    if (!cloneADNProfile) {
      return {
        type: "cloneadn",
        label: "CloneADN Profile",
        data: {
          profile_status: "not_configured",
          is_configured: false,
          company_context: null,
          rules_evaluated: false,
        },
        valid: true,
      };
    }
    const companyContext = buildPierreCompanyContextFromCloneADN(cloneADNProfile);
    const analysis = analyzeCloneADNProfile(cloneADNProfile);
    const ruleResults = evaluateCloneADNRules(
      cloneADNProfile,
      { text: requestText, task_type: null, domain: null },
    );
    const isConfigured = ["configured", "strong", "locked"].includes(cloneADNProfile.status);

    return {
      type: "cloneadn",
      label: "CloneADN Profile",
      data: {
        profile_status: cloneADNProfile.status,
        is_configured: isConfigured,
        company_context: companyContext,
        rules_evaluated: true,
        rule_results: ruleResults,
        completeness_score: analysis.completeness_score,
        active_rules: ruleResults.triggered_rules.length,
      },
      valid: true,
    };
  } catch (err) {
    return {
      type: "cloneadn",
      label: "CloneADN Profile",
      data: {},
      valid: false,
      error: err instanceof Error ? err.message : "cloneadn error",
    };
  }
}

// ══════════════════════════════════════════════════════════════
// SCENARIO-SPECIFIC CONFIGURATIONS
// ══════════════════════════════════════════════════════════════

function getCloneGuardConfig(scenarioId: string): {
  domain: string | null;
  taskType: string | null;
  riskHint: string | null;
} {
  switch (scenarioId) {
    case "gs_cloneguard_block":
      return {
        domain: "offboarding",
        taskType: "dismissal_action",
        riskHint: "critical",
      };
    case "gs_contract_renewal":
      return {
        domain: "contract",
        taskType: "contract_action",
        riskHint: "high",
      };
    case "gs_hiring_offer":
      return {
        domain: "hiring",
        taskType: "email_draft",
        riskHint: "medium",
      };
    default:
      return { domain: null, taskType: null, riskHint: null };
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ══════════════════════════════════════════════════════════════

export async function runGoldenScenario(
  scenario: PierreGoldenScenarioInput,
  options: PierreGoldenScenarioRunOptions = {},
): Promise<PierreGoldenScenarioResult> {
  const startMs = Date.now();

  // Handle validation_error scenario (gs_invalid_request)
  if (scenario.modules.length === 1 && scenario.modules[0] === "validation_error") {
    const textValidation = validateRequestText(scenario.request_text);
    const artifacts: PierreGoldenScenarioArtifact[] = [
      buildValidationErrorArtifact(
        textValidation.valid
          ? ["Request text is valid but scenario expects validation_error"]
          : [textValidation.error ?? "Invalid input"],
      ),
    ];
    const checkResults = runAllChecks(scenario.checks, artifacts);
    const { checks_total, checks_passed, checks_failed } = computeCheckSummary(checkResults);
    const status = determineScenarioStatus(checkResults, scenario.expected_status);
    return {
      scenario_id: scenario.id,
      label: scenario.label,
      category: scenario.category,
      severity: scenario.severity,
      status,
      expected_status: scenario.expected_status,
      checks_total,
      checks_passed,
      checks_failed,
      check_results: checkResults,
      artifacts,
      demonstrates: scenario.demonstrates,
      duration_ms: Date.now() - startMs,
    };
  }

  // Load fixtures
  const companyCtx = scenario.company_context_key
    ? getGoldenCompanyContext(scenario.company_context_key)
    : null;
  const employeeCtx = scenario.employee_context_key
    ? getGoldenEmployeeContext(scenario.employee_context_key)
    : null;
  const cloneADNProfile = scenario.clone_adn_key
    ? getGoldenCloneADN(scenario.clone_adn_key)
    : null;

  const companyContext = companyCtx
    ? buildPierreCompanyContextFromCloneADN(cloneADNProfile)
    : null;
  const employeeRow = employeeCtx ? employeeCtx.employee_row : null;

  // Collect artifacts in parallel where possible
  const modulesToRun = new Set(scenario.modules as PierreGoldenScenarioArtifactType[]);
  const artifacts: PierreGoldenScenarioArtifact[] = [];

  // Sync modules first
  if (modulesToRun.has("workflow_plan")) {
    artifacts.push(
      runWorkflowModule(scenario.request_text, employeeRow),
    );
  }

  if (modulesToRun.has("employee_360")) {
    artifacts.push(
      runEmployee360Module(
        employeeCtx
          ? {
              employee_row: employeeCtx.employee_row,
              missions: employeeCtx.missions,
              tasks: employeeCtx.tasks,
              documents: employeeCtx.documents,
              logs: employeeCtx.logs,
            }
          : null,
      ),
    );
  }

  if (modulesToRun.has("document")) {
    artifacts.push(
      runDocumentModule(
        scenario.id,
        scenario.request_text,
        employeeRow,
        companyContext,
        cloneADNProfile,
      ),
    );
  }

  if (modulesToRun.has("cloneguard")) {
    const guardCfg = getCloneGuardConfig(scenario.id);
    artifacts.push(
      runCloneGuardModule(
        scenario.request_text,
        guardCfg.domain,
        guardCfg.taskType,
        guardCfg.riskHint,
      ),
    );
  }

  if (modulesToRun.has("cloneadn")) {
    artifacts.push(
      runCloneADNModule(cloneADNProfile, scenario.request_text),
    );
  }

  // Async modules
  const asyncPromises: Promise<PierreGoldenScenarioArtifact>[] = [];

  if (modulesToRun.has("brain_output")) {
    asyncPromises.push(
      runBrainModule(scenario.request_text, companyContext, employeeRow),
    );
  }

  if (modulesToRun.has("task_drafts")) {
    asyncPromises.push(
      runTaskDraftsModule(
        scenario.request_text,
        companyContext,
        employeeRow,
        cloneADNProfile,
      ),
    );
  }

  const asyncArtifacts = await Promise.all(asyncPromises);
  artifacts.push(...asyncArtifacts);

  // Validate checks
  const checkResults = runAllChecks(scenario.checks, artifacts);
  const { checks_total, checks_passed, checks_failed } = computeCheckSummary(checkResults);
  const status = determineScenarioStatus(checkResults, scenario.expected_status);

  return {
    scenario_id: scenario.id,
    label: scenario.label,
    category: scenario.category,
    severity: scenario.severity,
    status,
    expected_status: scenario.expected_status,
    checks_total,
    checks_passed,
    checks_failed,
    check_results: checkResults,
    artifacts,
    demonstrates: scenario.demonstrates,
    duration_ms: Date.now() - startMs,
  };
}

// ══════════════════════════════════════════════════════════════
// SUITE RUNNER
// ══════════════════════════════════════════════════════════════

export async function runGoldenScenarioSuite(
  options: PierreGoldenScenarioRunOptions = {},
): Promise<PierreGoldenScenarioSuiteResult> {
  const startMs = Date.now();
  const registry = getGoldenScenarioRegistry();

  const scenariosToRun = options.scenario_ids
    ? registry.filter((s) => options.scenario_ids!.includes(s.id))
    : registry;

  const results = await Promise.all(
    scenariosToRun.map((scenario) => runGoldenScenario(scenario, options)),
  );

  const scenarios_passed = results.filter((r) => r.status === "pass").length;
  const scenarios_failed = results.filter((r) => r.status === "fail").length;
  const scenarios_warned = results.filter((r) => r.status === "warn").length;
  const scenarios_skipped = results.filter((r) => r.status === "skip").length;

  const checks_total = results.reduce((acc, r) => acc + r.checks_total, 0);
  const checks_passed = results.reduce((acc, r) => acc + r.checks_passed, 0);
  const checks_failed = results.reduce((acc, r) => acc + r.checks_failed, 0);

  const critical_failures = results
    .filter((r) => r.status === "fail" && r.severity === "critical")
    .map((r) => r.label);

  const modules_validated = Array.from(
    new Set(results.flatMap((r) => r.artifacts.map((a) => a.type))),
  );

  let suite_status: PierreGoldenScenarioSuiteResult["suite_status"] = "all_pass";
  if (scenarios_failed === results.length) suite_status = "all_fail";
  else if (scenarios_failed > 0) suite_status = "some_fail";
  else if (scenarios_warned > 0) suite_status = "partial";

  const executive_summary = buildExecutiveSummary({
    scenarios_total: results.length,
    scenarios_passed,
    scenarios_failed,
    critical_failures,
  });

  return {
    generated_at: nowISO(),
    scenarios_total: results.length,
    scenarios_passed,
    scenarios_failed,
    scenarios_warned,
    scenarios_skipped,
    checks_total,
    checks_passed,
    checks_failed,
    results,
    duration_ms: Date.now() - startMs,
    suite_status,
    executive_summary,
    critical_failures,
    modules_validated,
  };
}

function buildExecutiveSummary(params: {
  scenarios_total: number;
  scenarios_passed: number;
  scenarios_failed: number;
  critical_failures: string[];
}): string {
  const { scenarios_total, scenarios_passed, scenarios_failed, critical_failures } = params;
  const rate = scenarios_total > 0
    ? Math.round((scenarios_passed / scenarios_total) * 100)
    : 0;

  if (scenarios_failed === 0) {
    return `Pierre HR Engine opérationnel — ${scenarios_total} scénarios validés (${rate}% réussite). Prêt pour démo client.`;
  }
  if (critical_failures.length > 0) {
    return `${scenarios_failed} scénarios échoués dont ${critical_failures.length} critique(s). Blocage avant démo. Vérifier: ${critical_failures.slice(0, 2).join(", ")}.`;
  }
  return `${scenarios_passed}/${scenarios_total} scénarios validés (${rate}%). Quelques ajustements requis.`;
}

// ══════════════════════════════════════════════════════════════
// SCENARIO SUMMARY (for API responses)
// ══════════════════════════════════════════════════════════════

export type PierreGoldenScenarioSummary = {
  id: string;
  label: string;
  category: string;
  severity: string;
  expected_status: PierreGoldenScenarioExpectedStatus;
  modules: string[];
  checks_count: number;
  demonstrates_count: number;
};

export function buildScenarioSummaryList(): PierreGoldenScenarioSummary[] {
  return getGoldenScenarioRegistry().map((s) => ({
    id: s.id,
    label: s.label,
    category: s.category,
    severity: s.severity,
    expected_status: s.expected_status,
    modules: s.modules,
    checks_count: s.checks.length,
    demonstrates_count: s.demonstrates.length,
  }));
}
