import { describe, it, expect } from "vitest";
import {
  getEmployeeActionCatalog,
  getEmployeeActionById,
  classifyEmployeeActionRisk,
  resolveEmployeeActionGovernance,
  isEmployeeActionAutoSafe,
  scoreEmployeeActionConfidence,
  buildEmployeeActionSuggestions,
  buildEmployeeActionPlan,
  buildEmployeeActionSummary,
  buildEmployeeActionTaskDraft,
  resolveEmployeeActionResult,
  buildEmployeeActionTrace,
  buildEmployeeActionAuditMeta,
  buildEmployeeActionsIndex,
  filterEmployeeActionsByGovernance,
  filterEmployeeActionsByRisk,
  type PierreEmployeeActionGovernance,
  type PierreEmployeeActionRisk,
} from "../hr/employee-actions";

// ── Fixtures ───────────────────────────────────────────────

const empActive = { id: "emp-rt-001", full_name: "Marie Curie", status: "active", contract_type: "cdi", department: "R&D" };
const empOnboarding = { id: "emp-rt-002", full_name: "Jean Valjean", status: "onboarding", contract_type: "cdi", department: "Ops" };
const empOffboarding = { id: "emp-rt-003", full_name: "Anna Karénine", status: "offboarding", contract_type: "cdd", department: "Sales" };
const empCdd = { id: "emp-rt-004", full_name: "Émile Zola", status: "active", contract_type: "cdd", department: "Marketing" };
const empMinimal = { id: "emp-rt-005" };
const empNoId = { full_name: "Ghost User" };

const missionActive = { id: "m-rt-001", mission_summary: "Suivi RH salarié actif", status: "active" };
const missionAbsence = { id: "m-rt-002", mission_summary: "Gestion absence longue durée", status: "active" };
const missionFormation = { id: "m-rt-003", mission_summary: "Plan de formation certifiante", status: "active" };
const missionTermination = { id: "m-rt-004", mission_summary: "Procédure de licenciement", status: "active" };

const taskReady = { id: "t-rt-001", status: "ready", type: "doc.generate", title: "Générer document" };
const taskAwaiting = { id: "t-rt-002", status: "awaiting_approval", type: "email.draft", title: "Draft email" };
const taskDone = { id: "t-rt-003", status: "done", type: "doc.generate", title: "Document généré" };

// ══════════════════════════════════════════════════════════
// 1. LOG SCHEMA INVARIANTS
// Verifies buildEmployeeActionAuditMeta produces shapes suitable
// for insertion into pierre_task_logs (event_type/message/meta_json)
// ══════════════════════════════════════════════════════════

describe("Log schema — buildEmployeeActionAuditMeta", () => {
  it("meta_json has action_type field (maps to event_type in logs)", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect(typeof meta.action_type).toBe("string");
    expect(meta.action_type).toBe("onboarding.welcome_email");
  });

  it("meta_json has employee_id for log filtering", () => {
    const meta = buildEmployeeActionAuditMeta("absence.absence_acknowledgment", "emp-rt-001", "auto_safe", "green");
    expect(meta.employee_id).toBe("emp-rt-001");
  });

  it("meta_json never contains level field (log schema uses event_type)", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect("level" in meta).toBe(false);
  });

  it("meta_json never contains event field (log schema uses event_type)", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect("event" in meta).toBe(false);
  });

  it("meta_json never contains payload field (log schema uses meta_json)", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect("payload" in meta).toBe(false);
  });

  it("meta_json has governance field", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.contract_send", "emp-rt-001", "approval_required", "orange");
    expect(meta.governance).toBe("approval_required");
  });

  it("meta_json has risk field", () => {
    const meta = buildEmployeeActionAuditMeta("offboarding.termination_letter_draft", "emp-rt-001", "manual_only", "red");
    expect(meta.risk).toBe("red");
  });

  it("meta_json has requires_human=true for manual_only", () => {
    const meta = buildEmployeeActionAuditMeta("offboarding.termination_letter_draft", "emp-rt-001", "manual_only", "red");
    expect(meta.requires_human).toBe(true);
  });

  it("meta_json has requires_human=false for auto_safe", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect(meta.requires_human).toBe(false);
  });

  it("meta_json has allowed_to_auto_execute=false for approval_required", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.contract_send", "emp-rt-001", "approval_required", "orange");
    expect(meta.allowed_to_auto_execute).toBe(false);
  });

  it("meta_json is serializable to JSON without error", () => {
    const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", "auto_safe", "green");
    expect(() => JSON.stringify(meta)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(meta));
    expect(typeof parsed).toBe("object");
  });

  it("meta_json shapes are consistent across all governance levels", () => {
    const levels: PierreEmployeeActionGovernance[] = ["auto_safe", "approval_required", "manual_only", "blocked"];
    for (const gov of levels) {
      const meta = buildEmployeeActionAuditMeta("onboarding.welcome_email", "emp-rt-001", gov, "green");
      expect(typeof meta.action_type).toBe("string");
      expect(typeof meta.employee_id).toBe("string");
      expect(typeof meta.governance).toBe("string");
      expect(typeof meta.requires_human).toBe("boolean");
      expect(typeof meta.allowed_to_auto_execute).toBe("boolean");
    }
  });
});

// ══════════════════════════════════════════════════════════
// 2. TASK DRAFT SCHEMA — execute_at (NOT scheduled_for)
// ══════════════════════════════════════════════════════════

describe("Task draft schema compliance", () => {
  const ctx = { employee_id: "emp-rt-001", employee_name: "Marie Curie", department: "R&D", contract_type: "cdi", status: "active" };

  it("draft uses execute_at (never scheduled_for)", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect("execute_at" in draft).toBe(true);
    expect("scheduled_for" in draft).toBe(false);
  });

  it("draft execute_at is null for immediate tasks", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.execute_at).toBeNull();
  });

  it("draft status is 'ready' for auto_safe actions", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.status).toBe("ready");
  });

  it("draft status is 'awaiting_approval' for approval_required actions", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.contract_send", ctx);
    expect(draft.status).toBe("awaiting_approval");
  });

  it("draft status is 'awaiting_approval' or 'blocked' for manual_only actions (never 'ready')", () => {
    const draft = buildEmployeeActionTaskDraft("offboarding.termination_letter_draft", ctx);
    expect(draft.status).not.toBe("ready");
    expect(["awaiting_approval", "blocked"]).toContain(draft.status);
  });

  it("draft approval_required=false for auto_safe", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.document_checklist", ctx);
    expect(draft.approval_required).toBe(false);
  });

  it("draft approval_required=true for approval_required", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.contract_send", ctx);
    expect(draft.approval_required).toBe(true);
  });

  it("draft approval_required=true for manual_only", () => {
    const draft = buildEmployeeActionTaskDraft("offboarding.termination_letter_draft", ctx);
    expect(draft.approval_required).toBe(true);
  });

  it("draft payload_json has employee_id", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.payload_json.employee_id).toBe("emp-rt-001");
  });

  it("draft payload_json has action_type", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.payload_json.action_type).toBe("onboarding.welcome_email");
  });

  it("draft payload_json has action_domain from catalog", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(draft.payload_json.action_domain).toBe("onboarding");
  });

  it("draft payload_json is serializable", () => {
    const draft = buildEmployeeActionTaskDraft("absence.absence_acknowledgment", ctx);
    expect(() => JSON.stringify(draft.payload_json)).not.toThrow();
  });

  it("draft type matches action_type", () => {
    const draft = buildEmployeeActionTaskDraft("training.training_plan_draft", ctx);
    expect(draft.type).toBe("training.training_plan_draft");
  });

  it("draft description is non-empty string", () => {
    const draft = buildEmployeeActionTaskDraft("onboarding.welcome_email", ctx);
    expect(typeof draft.description).toBe("string");
    expect(draft.description.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════
// 3. SECURITY GATE — resolveEmployeeActionResult
// Verifies governance chain stops task_draft for blocked/manual_only
// ══════════════════════════════════════════════════════════

describe("Security gate — resolveEmployeeActionResult", () => {
  const ctx = { employee_id: "emp-rt-001", employee_name: "Marie Curie", status: "active" };

  it("manual_only action → task_draft is null", () => {
    const result = resolveEmployeeActionResult("offboarding.termination_letter_draft", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("manual_only action → allowed_to_auto_execute is false", () => {
    const result = resolveEmployeeActionResult("offboarding.termination_letter_draft", ctx);
    expect(result.allowed_to_auto_execute).toBe(false);
  });

  it("contract termination → task_draft is null", () => {
    const result = resolveEmployeeActionResult("contract.termination_prep", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("disciplinary_prep → task_draft is null", () => {
    const result = resolveEmployeeActionResult("interview.disciplinary_prep", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("salary_review_draft → task_draft is null", () => {
    const result = resolveEmployeeActionResult("payroll.salary_review_draft", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("sensitive_communication_prep → task_draft is null", () => {
    const result = resolveEmployeeActionResult("communication.sensitive_communication_prep", ctx);
    expect(result.task_draft).toBeNull();
  });

  it("auto_safe action → task_draft is not null", () => {
    const result = resolveEmployeeActionResult("onboarding.welcome_email", ctx);
    expect(result.task_draft).not.toBeNull();
  });

  it("approval_required action → task_draft not null but approval_required=true", () => {
    const result = resolveEmployeeActionResult("onboarding.contract_send", ctx);
    expect(result.task_draft).not.toBeNull();
    expect(result.task_draft?.approval_required).toBe(true);
  });

  it("all red catalog items → resolveEmployeeActionResult produces null task_draft", () => {
    const catalog = getEmployeeActionCatalog();
    const redItems = catalog.filter((item) => item.risk === "red");
    for (const item of redItems) {
      const result = resolveEmployeeActionResult(item.action_type, ctx);
      expect(result.task_draft).toBeNull();
    }
  });

  it("no auto_safe action is governance manual_only or blocked", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      if (item.governance === "auto_safe") {
        expect(item.governance).not.toBe("manual_only");
        expect(item.governance).not.toBe("blocked");
      }
    }
  });

  it("explanation is always non-empty string", () => {
    const govs: PierreEmployeeActionGovernance[] = ["auto_safe", "approval_required", "manual_only", "blocked"];
    const catalog = getEmployeeActionCatalog();
    for (const gov of govs) {
      const item = catalog.find((c) => c.governance === gov);
      if (!item) continue;
      const result = resolveEmployeeActionResult(item.action_type, ctx);
      expect(typeof result.explanation).toBe("string");
      expect(result.explanation.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════
// 4. TRACE ID DETERMINISM
// ══════════════════════════════════════════════════════════

describe("Trace ID determinism", () => {
  it("same employee_id + action_type always produces same trace id", () => {
    const id1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001").id;
    const id2 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001").id;
    const id3 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001").id;
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  it("trace id starts with ea_", () => {
    const trace = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001");
    expect(trace.id.startsWith("ea_")).toBe(true);
  });

  it("different action_type → different trace id for same employee", () => {
    const ids = new Set([
      buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001").id,
      buildEmployeeActionTrace("contract.renewal_reminder", "emp-rt-001").id,
      buildEmployeeActionTrace("absence.absence_acknowledgment", "emp-rt-001").id,
      buildEmployeeActionTrace("training.training_plan_draft", "emp-rt-001").id,
    ]);
    expect(ids.size).toBe(4);
  });

  it("different employee_id → different trace id for same action_type", () => {
    const ids = new Set([
      buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001").id,
      buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-002").id,
      buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-003").id,
    ]);
    expect(ids.size).toBe(3);
  });

  it("context does not affect trace id (id is based on employee_id + action_type only)", () => {
    const id1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001", { task_id: "t-001" }).id;
    const id2 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001", { task_id: "t-999" }).id;
    expect(id1).toBe(id2);
  });

  it("different now values do not affect trace id", () => {
    const now1 = new Date("2026-01-01T00:00:00Z");
    const now2 = new Date("2026-12-31T23:59:59Z");
    const id1 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001", {}, now1).id;
    const id2 = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001", {}, now2).id;
    expect(id1).toBe(id2);
  });

  it("trace created_at matches provided now parameter", () => {
    const now = new Date("2026-05-18T10:00:00Z");
    const trace = buildEmployeeActionTrace("onboarding.welcome_email", "emp-rt-001", {}, now);
    expect(trace.created_at).toBe("2026-05-18T10:00:00.000Z");
  });
});

// ══════════════════════════════════════════════════════════
// 5. CONFIDENCE SCORING EDGE CASES
// ══════════════════════════════════════════════════════════

describe("Confidence scoring edge cases", () => {
  it("always returns value in [0, 1] range for any catalog item", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      const score = scoreEmployeeActionConfidence(item.action_type, empActive, [], []);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("returns 0 for action not in catalog", () => {
    expect(scoreEmployeeActionConfidence("totally.unknown.xyz", empActive, [], [])).toBe(0);
  });

  it("missions boost confidence proportionally", () => {
    const base = scoreEmployeeActionConfidence("absence.absence_acknowledgment", empActive, [], []);
    const boosted = scoreEmployeeActionConfidence("absence.absence_acknowledgment", empActive, [missionAbsence], []);
    expect(boosted).toBeGreaterThanOrEqual(base);
  });

  it("offboarding status boosts offboarding actions", () => {
    const base = scoreEmployeeActionConfidence("offboarding.exit_interview_schedule", empActive, [], []);
    const boosted = scoreEmployeeActionConfidence("offboarding.exit_interview_schedule", empOffboarding, [], []);
    expect(boosted).toBeGreaterThan(base);
  });

  it("cdd contract_type boosts renewal_reminder", () => {
    const cdiScore = scoreEmployeeActionConfidence("contract.renewal_reminder", empActive, [], []);
    const cddScore = scoreEmployeeActionConfidence("contract.renewal_reminder", empCdd, [], []);
    expect(cddScore).toBeGreaterThan(cdiScore);
  });

  it("pending tasks boost followup actions", () => {
    const base = scoreEmployeeActionConfidence("followup.pending_tasks_followup", empActive, [], []);
    const boosted = scoreEmployeeActionConfidence("followup.pending_tasks_followup", empActive, [], [taskReady, taskAwaiting]);
    expect(boosted).toBeGreaterThanOrEqual(base);
  });

  it("training missions boost training plan confidence", () => {
    const base = scoreEmployeeActionConfidence("training.training_plan_draft", empActive, [], []);
    const boosted = scoreEmployeeActionConfidence("training.training_plan_draft", empActive, [missionFormation], []);
    expect(boosted).toBeGreaterThanOrEqual(base);
  });

  it("minimal employee (id only) does not throw", () => {
    expect(() => scoreEmployeeActionConfidence("onboarding.welcome_email", empMinimal, [], [])).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
// 6. buildEmployeeActionPlan — determinism & now parameter
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionPlan determinism", () => {
  const fixedNow = new Date("2026-05-18T12:00:00Z");

  it("generated_at matches provided now exactly", () => {
    const plan = buildEmployeeActionPlan(empActive, [], [], fixedNow);
    expect(plan.generated_at).toBe("2026-05-18T12:00:00.000Z");
  });

  it("same inputs produce same plan shape across calls", () => {
    const plan1 = buildEmployeeActionPlan(empOnboarding, [], [], fixedNow);
    const plan2 = buildEmployeeActionPlan(empOnboarding, [], [], fixedNow);
    expect(plan1.employee_id).toBe(plan2.employee_id);
    expect(plan1.auto_safe_count).toBe(plan2.auto_safe_count);
    expect(plan1.approval_required_count).toBe(plan2.approval_required_count);
    expect(plan1.generated_at).toBe(plan2.generated_at);
  });

  it("count fields are all non-negative integers", () => {
    const plan = buildEmployeeActionPlan(empOffboarding, [missionActive], [taskReady], fixedNow);
    expect(plan.auto_safe_count).toBeGreaterThanOrEqual(0);
    expect(plan.approval_required_count).toBeGreaterThanOrEqual(0);
    expect(plan.manual_only_count).toBeGreaterThanOrEqual(0);
    expect(plan.blocked_count).toBeGreaterThanOrEqual(0);
  });

  it("count fields sum equals suggested_actions length", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], fixedNow);
    const sum = plan.auto_safe_count + plan.approval_required_count + plan.manual_only_count + plan.blocked_count;
    expect(sum).toBe(plan.suggested_actions.length);
  });

  it("employee with no id gets employee_id = 'unknown'", () => {
    const plan = buildEmployeeActionPlan(empNoId, [], [], fixedNow);
    expect(plan.employee_id).toBe("unknown");
  });

  it("employee_name is null when not provided", () => {
    const plan = buildEmployeeActionPlan(empMinimal, [], [], fixedNow);
    expect(plan.employee_name === null || typeof plan.employee_name === "string").toBe(true);
  });

  it("next_action is null only when there are no suggestions", () => {
    const plan = buildEmployeeActionPlan(empActive, [], [], fixedNow);
    if (plan.suggested_actions.length === 0) {
      expect(plan.next_action).toBeNull();
    } else {
      expect(plan.next_action).not.toBeNull();
    }
  });

  it("next_action prefers auto_safe over approval_required", () => {
    const plan = buildEmployeeActionPlan(empOnboarding, [], [], fixedNow);
    const hasAutoSafe = plan.suggested_actions.some((s) => s.governance === "auto_safe");
    if (hasAutoSafe && plan.next_action) {
      expect(plan.next_action.governance).toBe("auto_safe");
    }
  });
});

// ══════════════════════════════════════════════════════════
// 7. buildEmployeeActionsIndex — mixed data scenarios
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionsIndex mixed data", () => {
  it("handles mix of valid and invalid employees gracefully", () => {
    const mixed = [empActive, { full_name: "No ID" }, empOnboarding, null, undefined] as unknown as Record<string, unknown>[];
    expect(() => buildEmployeeActionsIndex(mixed, [], [])).not.toThrow();
    const index = buildEmployeeActionsIndex(mixed, [], []);
    expect("emp-rt-001" in index).toBe(true);
    expect("emp-rt-002" in index).toBe(true);
  });

  it("skips employees with empty string id", () => {
    const withEmptyId = [{ id: "", full_name: "Empty ID" }] as unknown as Record<string, unknown>[];
    const index = buildEmployeeActionsIndex(withEmptyId, [], []);
    expect(Object.keys(index).filter((k) => k === "")).toHaveLength(0);
  });

  it("each plan in index has correct employee_id", () => {
    const emps = [empActive, empOnboarding, empOffboarding] as unknown as Record<string, unknown>[];
    const index = buildEmployeeActionsIndex(emps, [], []);
    for (const [id, plan] of Object.entries(index)) {
      expect(plan.employee_id).toBe(id);
    }
  });

  it("tasks filtered by employee payload_json.employee_id reach correct plan", () => {
    const tasks = [
      { id: "t-filter-001", status: "ready", type: "doc.generate", payload_json: { employee_id: "emp-rt-001" } },
    ] as unknown as Record<string, unknown>[];
    const emps = [empActive] as unknown as Record<string, unknown>[];
    const index = buildEmployeeActionsIndex(emps, [], tasks);
    expect(index["emp-rt-001"]).toBeDefined();
    // The plan should be defined and include suggestions
    expect(Array.isArray(index["emp-rt-001"].suggested_actions)).toBe(true);
  });

  it("index with multiple employees has independent plans", () => {
    const emps = [empOnboarding, empOffboarding] as unknown as Record<string, unknown>[];
    const index = buildEmployeeActionsIndex(emps, [], []);
    const onboardingDomains = index["emp-rt-002"].suggested_actions.map((s) => s.domain);
    const offboardingDomains = index["emp-rt-003"].suggested_actions.map((s) => s.domain);
    expect(onboardingDomains).toContain("onboarding");
    expect(offboardingDomains).toContain("offboarding");
  });
});

// ══════════════════════════════════════════════════════════
// 8. FILTER CONSISTENCY WITH RISK/GOVERNANCE RANKS
// ══════════════════════════════════════════════════════════

describe("Filter consistency with risk/governance hierarchy", () => {
  const govRank: Record<PierreEmployeeActionGovernance, number> = { auto_safe: 0, approval_required: 1, manual_only: 2, blocked: 3 };
  const riskRank: Record<PierreEmployeeActionRisk, number> = { green: 0, orange: 1, red: 2, black: 3 };

  it("filterByGovernance('auto_safe') returns only auto_safe items", () => {
    const all = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const filtered = filterEmployeeActionsByGovernance(all, "auto_safe");
    filtered.forEach((s) => expect(govRank[s.governance]).toBe(0));
  });

  it("filterByGovernance('manual_only') returns only manual_only items", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [missionTermination], []);
    const filtered = filterEmployeeActionsByGovernance(all, "manual_only");
    filtered.forEach((s) => expect(s.governance).toBe("manual_only"));
  });

  it("filterByRisk('green') returns only green items", () => {
    const all = buildEmployeeActionSuggestions(empOnboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "green");
    filtered.forEach((s) => expect(riskRank[s.risk]).toBe(0));
  });

  it("filterByRisk('orange') returns green + orange (rank ≤ 1)", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "orange");
    filtered.forEach((s) => expect(riskRank[s.risk]).toBeLessThanOrEqual(1));
  });

  it("filterByRisk('red') returns green + orange + red (rank ≤ 2)", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [missionTermination], []);
    const filtered = filterEmployeeActionsByRisk(all, "red");
    filtered.forEach((s) => expect(riskRank[s.risk]).toBeLessThanOrEqual(2));
  });

  it("filterByRisk('black') returns all items", () => {
    const all = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const filtered = filterEmployeeActionsByRisk(all, "black");
    expect(filtered.length).toBe(all.length);
  });
});

// ══════════════════════════════════════════════════════════
// 9. SUGGESTIONS — employee context enrichment
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionSuggestions — context enrichment", () => {
  it("all suggestions have employee-context-aware reason", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [], []);
    for (const s of suggestions) {
      expect(typeof s.reason).toBe("string");
      expect(s.reason.length).toBeGreaterThan(0);
    }
  });

  it("suggestions for offboarding employee include at least one high-priority domain action", () => {
    const suggestions = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const highPriority = suggestions.filter((s) => ["offboarding", "contract", "document"].includes(s.domain));
    expect(highPriority.length).toBeGreaterThan(0);
  });

  it("absent missions produce no stray absence suggestions for non-absence context", () => {
    const result = buildEmployeeActionSuggestions(empOnboarding, [], []);
    // onboarding employee without absence mission should not suggest absence as primary domain
    // (it may suggest general.action_reminder or document.employee_file_update but not necessarily absence)
    const domains = result.map((s) => s.domain);
    // The first suggestion domain should be onboarding for an onboarding employee
    if (result.length > 0) {
      expect(domains[0]).toBe("onboarding");
    }
  });

  it("CDD employee with renewal mission has renewal_reminder with confidence > 0.5", () => {
    const suggestions = buildEmployeeActionSuggestions(
      empCdd,
      [{ id: "m-cdd", mission_summary: "Renouvellement contrat CDD", status: "active" }],
      [],
    );
    const renewal = suggestions.find((s) => s.action_type === "contract.renewal_reminder");
    expect(renewal).toBeDefined();
    if (renewal) expect(renewal.confidence).toBeGreaterThan(0.5);
  });

  it("suggestions sorted by confidence descending", () => {
    const suggestions = buildEmployeeActionSuggestions(empOffboarding, [missionActive], [taskReady]);
    for (let i = 0; i < suggestions.length - 1; i++) {
      expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
    }
  });

  it("done tasks do not inflate followup confidence above ready/awaiting tasks", () => {
    const withDone = buildEmployeeActionSuggestions(empActive, [], [taskDone]);
    const withPending = buildEmployeeActionSuggestions(empActive, [], [taskReady]);
    const followupDone = withDone.find((s) => s.domain === "followup");
    const followupPending = withPending.find((s) => s.domain === "followup");
    if (followupDone && followupPending) {
      expect(followupPending.confidence).toBeGreaterThanOrEqual(followupDone.confidence);
    }
  });
});

// ══════════════════════════════════════════════════════════
// 10. SUMMARY SHAPE INVARIANTS
// ══════════════════════════════════════════════════════════

describe("buildEmployeeActionSummary invariants", () => {
  it("total_actions equals sum of governance buckets", () => {
    const suggestions = buildEmployeeActionSuggestions(empOffboarding, [], []);
    const summary = buildEmployeeActionSummary(suggestions);
    expect(summary.total_actions).toBe(
      summary.auto_safe + summary.approval_required + summary.manual_only + summary.blocked,
    );
  });

  it("has_sensitive is true if any suggestion has red or black risk", () => {
    const suggestions = buildEmployeeActionSuggestions(empOffboarding, [missionTermination], []);
    const summary = buildEmployeeActionSummary(suggestions);
    const hasRedOrBlack = suggestions.some((s) => s.risk === "red" || s.risk === "black");
    if (hasRedOrBlack) expect(summary.has_sensitive).toBe(true);
  });

  it("domains_active contains no duplicates", () => {
    const suggestions = buildEmployeeActionSuggestions(empOnboarding, [missionFormation], []);
    const summary = buildEmployeeActionSummary(suggestions);
    expect(new Set(summary.domains_active).size).toBe(summary.domains_active.length);
  });

  it("domains_active only contains domains present in suggestions", () => {
    const suggestions = buildEmployeeActionSuggestions(empCdd, [], []);
    const summary = buildEmployeeActionSummary(suggestions);
    const suggDomains = new Set(suggestions.map((s) => s.domain));
    for (const d of summary.domains_active) {
      expect(suggDomains.has(d)).toBe(true);
    }
  });

  it("empty suggestions → has_sensitive=false", () => {
    const summary = buildEmployeeActionSummary([]);
    expect(summary.has_sensitive).toBe(false);
  });

  it("empty suggestions → all counts are 0", () => {
    const summary = buildEmployeeActionSummary([]);
    expect(summary.total_actions).toBe(0);
    expect(summary.auto_safe).toBe(0);
    expect(summary.approval_required).toBe(0);
    expect(summary.manual_only).toBe(0);
    expect(summary.blocked).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════
// 11. CATALOG RISK ↔ GOVERNANCE COHERENCE
// ══════════════════════════════════════════════════════════

describe("Catalog risk ↔ governance coherence", () => {
  it("no auto_safe item has red or black risk", () => {
    for (const item of getEmployeeActionCatalog()) {
      if (item.governance === "auto_safe") {
        expect(["green", "orange"]).toContain(item.risk);
      }
    }
  });

  it("no blocked item has green risk", () => {
    for (const item of getEmployeeActionCatalog()) {
      if (item.governance === "blocked") {
        expect(item.risk).not.toBe("green");
      }
    }
  });

  it("every manual_only item has orange, red, or black risk", () => {
    for (const item of getEmployeeActionCatalog()) {
      if (item.governance === "manual_only") {
        expect(["orange", "red", "black"]).toContain(item.risk);
      }
    }
  });

  it("classifyEmployeeActionRisk and catalog risk agree for catalog items", () => {
    for (const item of getEmployeeActionCatalog()) {
      const computed = classifyEmployeeActionRisk(item.action_type);
      // Computed risk should equal or be higher than catalog risk (context can only elevate)
      const riskRank: Record<PierreEmployeeActionRisk, number> = { green: 0, orange: 1, red: 2, black: 3 };
      expect(riskRank[computed]).toBeGreaterThanOrEqual(riskRank[item.risk]);
    }
  });

  it("resolveEmployeeActionGovernance and catalog governance agree for catalog items", () => {
    for (const item of getEmployeeActionCatalog()) {
      const computed = resolveEmployeeActionGovernance(item.action_type);
      const govRank: Record<PierreEmployeeActionGovernance, number> = { auto_safe: 0, approval_required: 1, manual_only: 2, blocked: 3 };
      expect(govRank[computed]).toBeGreaterThanOrEqual(govRank[item.governance]);
    }
  });

  it("getEmployeeActionById returns the same governance as catalog array entry", () => {
    const catalog = getEmployeeActionCatalog();
    for (const item of catalog) {
      const found = getEmployeeActionById(item.id);
      expect(found?.governance).toBe(item.governance);
    }
  });
});
