import { describe, it, expect } from "vitest";
import {
  isMissionControlSafeToRun,
  isMissionControlSensitive,
  isMissionControlBlocking,
  inferMissionControlActionType,
  classifyMissionControlQueue,
  buildMissionControlActionFromTask,
  buildMissionControlActionFromMission,
  buildMissionControlActionFromDocument,
  buildMissionControlActionFromEmployeeSnapshot,
  buildMissionControlActionFromFeedItem,
  buildMissionControlMissionCard,
  buildMissionControlEmployeeCard,
  buildMissionControlMetrics,
  buildMissionControlQueues,
  sortMissionControlActions,
  buildMissionControlDigest,
  buildMissionControlExecutiveBriefing,
  buildMissionControlRunPlan,
  buildMissionControlDashboard,
  buildMissionControlScaleProfile,
  buildMissionControlDataWindow,
  buildMissionControlBriefing,
  buildMissionControlPreview,
  type PierreMissionControlAction,
} from "../hr/mission-control";

// ── Fixtures ──────────────────────────────────────────────

const NOW = new Date("2024-06-15T10:00:00.000Z");
const FUTURE = new Date("2024-06-20T10:00:00.000Z");

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "task_1",
    mission_id: "mission_1",
    type: "document.generate",
    title: "Générer contrat",
    status: "ready",
    approval_required: false,
    execute_at: null,
    priority: "normal",
    last_error: null,
    created_at: "2024-06-14T10:00:00.000Z",
    updated_at: "2024-06-14T10:00:00.000Z",
    ...overrides,
  };
}

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mission_1",
    status: "active",
    understanding_status: "complete",
    risk_level: "low",
    approval_required: false,
    mission_summary: "Embauche Jean Martin",
    intent: "onboarding",
    missing_info_json: null,
    brain_output_json: null,
    created_at: "2024-06-13T10:00:00.000Z",
    updated_at: "2024-06-14T10:00:00.000Z",
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "doc_1",
    mission_id: "mission_1",
    doc_type: "contract",
    title: "Contrat CDI Jean Martin",
    status: "generated",
    created_at: "2024-06-14T10:00:00.000Z",
    ...overrides,
  };
}

function makeAction(overrides: Partial<PierreMissionControlAction> = {}): PierreMissionControlAction {
  return {
    id: "ctrl_abc",
    type: "run_safe_task",
    label: "Lancer tâche",
    description: "Tâche prête",
    priority: "normal",
    source_type: "task",
    source_id: "task_1",
    task_id: "task_1",
    mission_id: "mission_1",
    employee_id: null,
    employee_name: null,
    execute_at: null,
    url: null,
    method: null,
    payload: null,
    reason: null,
    is_safe_to_run: true,
    requires_human: false,
    is_sensitive: false,
    is_blocking: false,
    is_delivery: false,
    action_required: true,
    queue: "safe_to_run",
    raw: {},
    created_at: "2024-06-14T10:00:00.000Z",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// 1. isMissionControlSafeToRun
// ─────────────────────────────────────────────────────────

describe("isMissionControlSafeToRun", () => {
  it("returns true for a ready task with no blockers", () => {
    expect(isMissionControlSafeToRun(makeTask(), NOW)).toBe(true);
  });

  it("returns false for email.send type", () => {
    expect(isMissionControlSafeToRun(makeTask({ type: "email.send" }), NOW)).toBe(false);
  });

  it("returns false for send_email type", () => {
    expect(isMissionControlSafeToRun(makeTask({ type: "send_email" }), NOW)).toBe(false);
  });

  it("returns false for status done", () => {
    expect(isMissionControlSafeToRun(makeTask({ status: "done" }), NOW)).toBe(false);
  });

  it("returns false for status cancelled", () => {
    expect(isMissionControlSafeToRun(makeTask({ status: "cancelled" }), NOW)).toBe(false);
  });

  it("returns false for status awaiting_approval", () => {
    expect(isMissionControlSafeToRun(makeTask({ status: "awaiting_approval" }), NOW)).toBe(false);
  });

  it("returns false when approval_required=true", () => {
    expect(isMissionControlSafeToRun(makeTask({ approval_required: true }), NOW)).toBe(false);
  });

  it("returns false when execute_at is in the future", () => {
    expect(isMissionControlSafeToRun(makeTask({ execute_at: FUTURE.toISOString() }), NOW)).toBe(false);
  });

  it("returns true when execute_at is in the past", () => {
    expect(isMissionControlSafeToRun(makeTask({ execute_at: "2024-06-10T10:00:00.000Z" }), NOW)).toBe(true);
  });

  it("returns false for non-object input", () => {
    expect(isMissionControlSafeToRun(null as unknown as Record<string, unknown>, NOW)).toBe(false);
  });

  it("returns true for retry status", () => {
    expect(isMissionControlSafeToRun(makeTask({ status: "retry" }), NOW)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// 2. isMissionControlSensitive
// ─────────────────────────────────────────────────────────

describe("isMissionControlSensitive", () => {
  it("returns false for a normal task", () => {
    expect(isMissionControlSensitive(makeTask())).toBe(false);
  });

  it("detects harcèlement keyword", () => {
    expect(isMissionControlSensitive({ title: "Gestion harcèlement moral" })).toBe(true);
  });

  it("detects licenci keyword", () => {
    expect(isMissionControlSensitive({ mission_summary: "Procédure licenciement" })).toBe(true);
  });

  it("detects disciplin keyword", () => {
    expect(isMissionControlSensitive({ message: "Sanction disciplinaire employé" })).toBe(true);
  });

  it("detects offboarding keyword", () => {
    expect(isMissionControlSensitive({ mission_summary: "Offboarding cadre dirigeant" })).toBe(true);
  });

  it("detects faute grave keyword", () => {
    expect(isMissionControlSensitive({ description: "Faute grave constatée" })).toBe(true);
  });

  it("returns true when status is sensitive", () => {
    expect(isMissionControlSensitive({ status: "sensitive" })).toBe(true);
  });

  it("returns true when risk_level is black", () => {
    expect(isMissionControlSensitive({ risk_level: "black" })).toBe(true);
  });

  it("returns true when risk_level is critical", () => {
    expect(isMissionControlSensitive({ risk_level: "critical" })).toBe(true);
  });

  it("returns false for null input", () => {
    expect(isMissionControlSensitive(null as unknown as Record<string, unknown>)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 3. isMissionControlBlocking
// ─────────────────────────────────────────────────────────

describe("isMissionControlBlocking", () => {
  it("returns false for a normal task", () => {
    expect(isMissionControlBlocking(makeTask())).toBe(false);
  });

  it("returns true for status blocked", () => {
    expect(isMissionControlBlocking({ status: "blocked" })).toBe(true);
  });

  it("returns true for status error", () => {
    expect(isMissionControlBlocking({ status: "error" })).toBe(true);
  });

  it("returns true for event_type containing error", () => {
    expect(isMissionControlBlocking({ event_type: "task_error_occurred" })).toBe(true);
  });

  it("returns true for event_type containing blocked", () => {
    expect(isMissionControlBlocking({ event_type: "mission_blocked" })).toBe(true);
  });

  it("returns true for event_type containing failed", () => {
    expect(isMissionControlBlocking({ event_type: "document_generation_failed" })).toBe(true);
  });

  it("returns false for null input", () => {
    expect(isMissionControlBlocking(null as unknown as Record<string, unknown>)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 4. inferMissionControlActionType
// ─────────────────────────────────────────────────────────

describe("inferMissionControlActionType", () => {
  it("returns run_safe_task for a safe ready task", () => {
    expect(inferMissionControlActionType(makeTask(), "task", NOW)).toBe("run_safe_task");
  });

  it("returns approve_task when awaiting_approval", () => {
    expect(inferMissionControlActionType(makeTask({ status: "awaiting_approval" }), "task", NOW)).toBe("approve_task");
  });

  it("returns approve_task when approval_required=true", () => {
    expect(inferMissionControlActionType(makeTask({ approval_required: true }), "task", NOW)).toBe("approve_task");
  });

  it("returns review_sensitive_case for sensitive task", () => {
    expect(inferMissionControlActionType({ status: "ready", title: "Licenciement économique" }, "task", NOW)).toBe("review_sensitive_case");
  });

  it("returns investigate_error for status error", () => {
    expect(inferMissionControlActionType(makeTask({ status: "error" }), "task", NOW)).toBe("investigate_error");
  });

  it("returns resolve_blocker for status blocked", () => {
    expect(inferMissionControlActionType(makeTask({ status: "blocked" }), "task", NOW)).toBe("resolve_blocker");
  });

  it("returns open_delivery for document source", () => {
    expect(inferMissionControlActionType(makeDocument(), "document", NOW)).toBe("open_delivery");
  });

  it("returns open_employee_file for employee_file source", () => {
    expect(inferMissionControlActionType({ status: "active" }, "employee_file", NOW)).toBe("open_employee_file");
  });

  it("returns open_mission for mission source", () => {
    expect(inferMissionControlActionType(makeMission(), "mission", NOW)).toBe("open_mission");
  });

  it("returns wait_until_scheduled for scheduled task with future execute_at", () => {
    expect(inferMissionControlActionType(makeTask({ status: "scheduled", execute_at: FUTURE.toISOString() }), "task", NOW)).toBe("wait_until_scheduled");
  });

  it("returns no_action for null", () => {
    expect(inferMissionControlActionType(null as unknown as Record<string, unknown>, "task", NOW)).toBe("no_action");
  });
});

// ─────────────────────────────────────────────────────────
// 5. classifyMissionControlQueue
// ─────────────────────────────────────────────────────────

describe("classifyMissionControlQueue", () => {
  it("returns sensitive for sensitive action", () => {
    const action = makeAction({ is_sensitive: true });
    expect(classifyMissionControlQueue(action, NOW)).toBe("sensitive");
  });

  it("returns approvals for approve_task type", () => {
    const action = makeAction({ type: "approve_task", is_safe_to_run: false });
    expect(classifyMissionControlQueue(action, NOW)).toBe("approvals");
  });

  it("returns errors for investigate_error type", () => {
    const action = makeAction({ type: "investigate_error", is_safe_to_run: false });
    expect(classifyMissionControlQueue(action, NOW)).toBe("errors");
  });

  it("returns blocked for resolve_blocker type", () => {
    const action = makeAction({ type: "resolve_blocker", is_safe_to_run: false });
    expect(classifyMissionControlQueue(action, NOW)).toBe("blocked");
  });

  it("returns blocked for is_blocking=true", () => {
    const action = makeAction({ is_blocking: true, is_safe_to_run: false });
    expect(classifyMissionControlQueue(action, NOW)).toBe("blocked");
  });

  it("returns deliveries for open_delivery type", () => {
    const action = makeAction({ type: "open_delivery", is_safe_to_run: false, is_delivery: true });
    expect(classifyMissionControlQueue(action, NOW)).toBe("deliveries");
  });

  it("returns employee_attention for employee_file source", () => {
    const action = makeAction({ source_type: "employee_file", type: "open_employee_file", is_safe_to_run: false });
    expect(classifyMissionControlQueue(action, NOW)).toBe("employee_attention");
  });

  it("returns do_now for safe+urgent", () => {
    const action = makeAction({ is_safe_to_run: true, priority: "urgent" });
    expect(classifyMissionControlQueue(action, NOW)).toBe("do_now");
  });

  it("returns safe_to_run for safe+normal", () => {
    const action = makeAction({ is_safe_to_run: true, priority: "normal" });
    expect(classifyMissionControlQueue(action, NOW)).toBe("safe_to_run");
  });

  it("returns scheduled when execute_at in future", () => {
    const action = makeAction({ type: "wait_until_scheduled", is_safe_to_run: false, execute_at: FUTURE.toISOString() });
    expect(classifyMissionControlQueue(action, NOW)).toBe("scheduled");
  });

  it("returns approvals when requires_human=true", () => {
    const action = makeAction({ is_safe_to_run: false, requires_human: true });
    expect(classifyMissionControlQueue(action, NOW)).toBe("approvals");
  });

  it("returns monitoring as fallback", () => {
    const action = makeAction({ is_safe_to_run: false, type: "prepare_followup" });
    expect(classifyMissionControlQueue(action, NOW)).toBe("monitoring");
  });
});

// ─────────────────────────────────────────────────────────
// 6. buildMissionControlActionFromTask
// ─────────────────────────────────────────────────────────

describe("buildMissionControlActionFromTask", () => {
  it("builds an action with correct source_type", () => {
    const action = buildMissionControlActionFromTask(makeTask(), NOW);
    expect(action.source_type).toBe("task");
  });

  it("builds is_safe_to_run=true for ready task", () => {
    const action = buildMissionControlActionFromTask(makeTask(), NOW);
    expect(action.is_safe_to_run).toBe(true);
  });

  it("sets is_safe_to_run=false for email.send", () => {
    const action = buildMissionControlActionFromTask(makeTask({ type: "email.send" }), NOW);
    expect(action.is_safe_to_run).toBe(false);
  });

  it("sets is_sensitive=true for licenciement", () => {
    const action = buildMissionControlActionFromTask(makeTask({ title: "Licenciement pour faute" }), NOW);
    expect(action.is_sensitive).toBe(true);
  });

  it("sets requires_human=true for approval_required", () => {
    const action = buildMissionControlActionFromTask(makeTask({ approval_required: true }), NOW);
    expect(action.requires_human).toBe(true);
  });

  it("sets task_id correctly", () => {
    const action = buildMissionControlActionFromTask(makeTask({ id: "task_xyz" }), NOW);
    expect(action.task_id).toBe("task_xyz");
  });

  it("sets mission_id correctly", () => {
    const action = buildMissionControlActionFromTask(makeTask({ mission_id: "mission_abc" }), NOW);
    expect(action.mission_id).toBe("mission_abc");
  });

  it("sets execute_at when present", () => {
    const action = buildMissionControlActionFromTask(makeTask({ execute_at: FUTURE.toISOString() }), NOW);
    expect(action.execute_at).toBe(FUTURE.toISOString());
  });

  it("generates a deterministic id", () => {
    const a1 = buildMissionControlActionFromTask(makeTask(), NOW);
    const a2 = buildMissionControlActionFromTask(makeTask(), NOW);
    expect(a1.id).toBe(a2.id);
  });

  it("sets queue correctly for safe task", () => {
    const action = buildMissionControlActionFromTask(makeTask(), NOW);
    expect(["safe_to_run", "do_now"]).toContain(action.queue);
  });
});

// ─────────────────────────────────────────────────────────
// 7. buildMissionControlActionFromMission
// ─────────────────────────────────────────────────────────

describe("buildMissionControlActionFromMission", () => {
  it("builds an action with source_type=mission", () => {
    const action = buildMissionControlActionFromMission(makeMission(), NOW);
    expect(action.source_type).toBe("mission");
  });

  it("sets type to open_mission for active mission", () => {
    const action = buildMissionControlActionFromMission(makeMission(), NOW);
    expect(action.type).toBe("open_mission");
  });

  it("detects sensitive mission", () => {
    const action = buildMissionControlActionFromMission(makeMission({ mission_summary: "Licenciement Jean" }), NOW);
    expect(action.is_sensitive).toBe(true);
  });

  it("sets mission_id correctly", () => {
    const action = buildMissionControlActionFromMission(makeMission({ id: "m_xyz" }), NOW);
    expect(action.mission_id).toBe("m_xyz");
  });

  it("review_sensitive_case for black risk_level", () => {
    const action = buildMissionControlActionFromMission(makeMission({ risk_level: "black" }), NOW);
    expect(action.type).toBe("review_sensitive_case");
  });

  it("generates a deterministic id", () => {
    const a1 = buildMissionControlActionFromMission(makeMission(), NOW);
    const a2 = buildMissionControlActionFromMission(makeMission(), NOW);
    expect(a1.id).toBe(a2.id);
  });
});

// ─────────────────────────────────────────────────────────
// 8. buildMissionControlActionFromDocument
// ─────────────────────────────────────────────────────────

describe("buildMissionControlActionFromDocument", () => {
  it("builds an action with source_type=document", () => {
    const action = buildMissionControlActionFromDocument(makeDocument());
    expect(action.source_type).toBe("document");
  });

  it("sets type to open_delivery", () => {
    const action = buildMissionControlActionFromDocument(makeDocument());
    expect(action.type).toBe("open_delivery");
  });

  it("sets is_delivery=true", () => {
    const action = buildMissionControlActionFromDocument(makeDocument());
    expect(action.is_delivery).toBe(true);
  });

  it("sets mission_id from document", () => {
    const action = buildMissionControlActionFromDocument(makeDocument({ mission_id: "m_abc" }));
    expect(action.mission_id).toBe("m_abc");
  });
});

// ─────────────────────────────────────────────────────────
// 9. buildMissionControlActionFromEmployeeSnapshot
// ─────────────────────────────────────────────────────────

describe("buildMissionControlActionFromEmployeeSnapshot", () => {
  it("builds an action with source_type=employee_file", () => {
    const snap = { employee_id: "emp_1", employee_name: "Alice", status: "sensitive", risk_level: "high", health_score: 30, missing_info_count: 2, open_tasks_count: 1, last_event_at: null };
    const action = buildMissionControlActionFromEmployeeSnapshot(snap);
    expect(action.source_type).toBe("employee_file");
  });

  it("sets type to open_employee_file", () => {
    const snap = { employee_id: "emp_2", employee_name: "Bob", status: "attention_required", risk_level: "medium", health_score: 60, missing_info_count: 1, open_tasks_count: 0, last_event_at: null };
    const action = buildMissionControlActionFromEmployeeSnapshot(snap);
    expect(action.type).toBe("open_employee_file");
  });

  it("sets is_sensitive=true for sensitive status", () => {
    const snap = { employee_id: "emp_3", employee_name: "Carol", status: "sensitive", risk_level: "high", health_score: 20, missing_info_count: 3, open_tasks_count: 2, last_event_at: null };
    const action = buildMissionControlActionFromEmployeeSnapshot(snap);
    expect(action.is_sensitive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// 10. buildMissionControlActionFromFeedItem
// ─────────────────────────────────────────────────────────

describe("buildMissionControlActionFromFeedItem", () => {
  it("returns null for null input", () => {
    expect(buildMissionControlActionFromFeedItem(null)).toBeNull();
  });

  it("builds an action from a feed item", () => {
    const item = {
      id: "feed_1",
      category: "alert",
      severity: "high",
      priority: "urgent",
      title: "Alerte critique",
      message: "Mission bloquée",
      source_type: "mission",
      source_id: "m1",
      mission_id: "m1",
      task_id: null,
      employee_id: null,
      employee_name: null,
      created_at: "2024-06-14T10:00:00.000Z",
      action_required: true,
      action_label: "Voir mission",
      tags: [],
      raw: {},
      intent: "urgent",
      action_kind: "none",
      action_target: null,
      display_context: null,
      is_sensitive: false,
      is_blocking: true,
      is_delivery: false,
      is_briefing: false,
    };
    const action = buildMissionControlActionFromFeedItem(item);
    expect(action).not.toBeNull();
    if (action) {
      expect(action.source_type).toBe("feed");
      expect(action.is_blocking).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────
// 11. buildMissionControlMissionCard
// ─────────────────────────────────────────────────────────

describe("buildMissionControlMissionCard", () => {
  it("builds a card with mission_id", () => {
    const card = buildMissionControlMissionCard(makeMission(), [], NOW);
    expect(card.mission_id).toBe("mission_1");
  });

  it("sets title from mission_summary", () => {
    const card = buildMissionControlMissionCard(makeMission(), [], NOW);
    expect(card.title).toBe("Embauche Jean Martin");
  });

  it("counts safe_to_run tasks", () => {
    const tasks = [makeTask({ mission_id: "mission_1", status: "ready" }), makeTask({ id: "t2", mission_id: "mission_1", status: "done" })];
    const card = buildMissionControlMissionCard(makeMission(), tasks, NOW);
    expect(card.safe_to_run_count).toBe(1);
  });

  it("counts blocked tasks", () => {
    const tasks = [makeTask({ mission_id: "mission_1", status: "blocked" })];
    const card = buildMissionControlMissionCard(makeMission(), tasks, NOW);
    expect(card.blocked_count).toBe(1);
  });

  it("counts pending_approval tasks", () => {
    const tasks = [makeTask({ mission_id: "mission_1", status: "awaiting_approval" })];
    const card = buildMissionControlMissionCard(makeMission(), tasks, NOW);
    expect(card.pending_approval_count).toBe(1);
  });

  it("computes progress_pct", () => {
    const tasks = [
      makeTask({ id: "t1", mission_id: "mission_1", status: "done" }),
      makeTask({ id: "t2", mission_id: "mission_1", status: "ready" }),
    ];
    const card = buildMissionControlMissionCard(makeMission(), tasks, NOW);
    expect(card.progress_pct).toBe(50);
  });

  it("sets priority urgent for sensitive mission", () => {
    const card = buildMissionControlMissionCard(makeMission({ risk_level: "black" }), [], NOW);
    expect(card.priority).toBe("urgent");
  });
});

// ─────────────────────────────────────────────────────────
// 12. buildMissionControlEmployeeCard
// ─────────────────────────────────────────────────────────

describe("buildMissionControlEmployeeCard", () => {
  it("builds a card with employee_id", () => {
    const snap = { employee_id: "emp_1", employee_name: "Alice", status: "sensitive", risk_level: "high", health_score: 30, missing_info_count: 2, open_tasks_count: 1, last_event_at: null };
    const card = buildMissionControlEmployeeCard(snap);
    expect(card.employee_id).toBe("emp_1");
  });

  it("sets status=sensitive for sensitive snapshot", () => {
    const snap = { employee_id: "emp_2", employee_name: "Bob", status: "sensitive", risk_level: "high", health_score: 20, missing_info_count: 3, open_tasks_count: 2, last_event_at: null };
    const card = buildMissionControlEmployeeCard(snap);
    expect(card.status).toBe("sensitive");
  });

  it("sets status=attention_required for attention snapshot", () => {
    const snap = { employee_id: "emp_3", employee_name: "Carol", status: "attention_required", risk_level: "medium", health_score: 60, missing_info_count: 1, open_tasks_count: 0, last_event_at: null };
    const card = buildMissionControlEmployeeCard(snap);
    expect(card.status).toBe("attention_required");
  });

  it("includes health_score", () => {
    const snap = { employee_id: "emp_4", employee_name: "Dave", status: "ok", risk_level: "low", health_score: 85, missing_info_count: 0, open_tasks_count: 0, last_event_at: null };
    const card = buildMissionControlEmployeeCard(snap);
    expect(card.health_score).toBe(85);
  });
});

// ─────────────────────────────────────────────────────────
// 13. buildMissionControlMetrics
// ─────────────────────────────────────────────────────────

describe("buildMissionControlMetrics", () => {
  it("returns an array of metrics", () => {
    const metrics = buildMissionControlMetrics({ actions: [], missions: [], snapshots: [] });
    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
  });

  it("includes safe_to_run metric", () => {
    const actions = [makeAction({ is_safe_to_run: true }), makeAction({ id: "ctrl_2", is_safe_to_run: true })];
    const metrics = buildMissionControlMetrics({ actions, missions: [], snapshots: [] });
    const m = metrics.find((x) => x.key === "safe_to_run");
    expect(m).toBeTruthy();
  });

  it("counts pending_approvals correctly", () => {
    const actions = [makeAction({ type: "approve_task", is_safe_to_run: false })];
    const metrics = buildMissionControlMetrics({ actions, missions: [], snapshots: [] });
    const m = metrics.find((x) => x.key === "pending_approvals");
    expect(m?.value).toBe(1);
  });

  it("counts blockers correctly", () => {
    const actions = [makeAction({ is_blocking: true, type: "resolve_blocker", is_safe_to_run: false }), makeAction({ id: "ctrl_2", is_blocking: true, type: "resolve_blocker", is_safe_to_run: false })];
    const metrics = buildMissionControlMetrics({ actions, missions: [], snapshots: [] });
    const m = metrics.find((x) => x.key === "blockers");
    expect(m?.value).toBe(2);
  });

  it("counts sensitive correctly", () => {
    const actions = [makeAction({ is_sensitive: true })];
    const metrics = buildMissionControlMetrics({ actions, missions: [], snapshots: [] });
    const m = metrics.find((x) => x.key === "sensitive_cases");
    expect(m?.value).toBe(1);
  });

  it("uses continuityDashboard total_runnable_tasks when provided", () => {
    const continuityDashboard = { total_runnable_tasks: 7 } as never;
    const metrics = buildMissionControlMetrics({ actions: [], missions: [], snapshots: [], continuityDashboard });
    const m = metrics.find((x) => x.key === "safe_to_run");
    expect(m?.value).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────
// 14. buildMissionControlQueues
// ─────────────────────────────────────────────────────────

describe("buildMissionControlQueues", () => {
  it("returns an array of queues", () => {
    const queues = buildMissionControlQueues([]);
    expect(Array.isArray(queues)).toBe(true);
  });

  it("has all 11 queue keys", () => {
    const queues = buildMissionControlQueues([]);
    const keys = queues.map((q) => q.key);
    expect(keys).toContain("do_now");
    expect(keys).toContain("safe_to_run");
    expect(keys).toContain("approvals");
    expect(keys).toContain("blocked");
    expect(keys).toContain("errors");
    expect(keys).toContain("sensitive");
    expect(keys).toContain("deliveries");
    expect(keys).toContain("scheduled");
    expect(keys).toContain("waiting_info");
    expect(keys).toContain("employee_attention");
    expect(keys).toContain("monitoring");
  });

  it("places safe action in safe_to_run queue", () => {
    const action = makeAction({ is_safe_to_run: true, priority: "normal" });
    const queues = buildMissionControlQueues([action]);
    const q = queues.find((x) => x.key === "safe_to_run");
    expect(q?.count).toBe(1);
    expect(q?.actions).toHaveLength(1);
  });

  it("places sensitive action in sensitive queue", () => {
    const action = makeAction({ is_sensitive: true });
    const queues = buildMissionControlQueues([action]);
    const q = queues.find((x) => x.key === "sensitive");
    expect(q?.count).toBe(1);
  });

  it("reports total_count across all queues", () => {
    const a1 = makeAction({ is_safe_to_run: true });
    const a2 = makeAction({ id: "ctrl_2", is_sensitive: true, is_safe_to_run: false });
    const queues = buildMissionControlQueues([a1, a2]);
    const total = queues.reduce((sum, q) => sum + q.count, 0);
    expect(total).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────
// 15. sortMissionControlActions
// ─────────────────────────────────────────────────────────

describe("sortMissionControlActions", () => {
  it("returns an array", () => {
    expect(Array.isArray(sortMissionControlActions([]))).toBe(true);
  });

  it("sorts urgent before normal", () => {
    const normal = makeAction({ priority: "normal" });
    const urgent = makeAction({ id: "ctrl_2", priority: "urgent" });
    const sorted = sortMissionControlActions([normal, urgent]);
    expect(sorted[0].priority).toBe("urgent");
  });

  it("puts urgent actions before normal priority", () => {
    const normal = makeAction({ priority: "normal" });
    const urgent = makeAction({ id: "ctrl_2", priority: "urgent", is_sensitive: true });
    const sorted = sortMissionControlActions([normal, urgent]);
    expect(sorted[0].priority).toBe("urgent");
  });

  it("does not mutate original array", () => {
    const a1 = makeAction({ priority: "normal" });
    const a2 = makeAction({ id: "ctrl_2", priority: "urgent" });
    const original = [a1, a2];
    sortMissionControlActions(original);
    expect(original[0].priority).toBe("normal");
  });
});

// ─────────────────────────────────────────────────────────
// 16. buildMissionControlDigest
// ─────────────────────────────────────────────────────────

describe("buildMissionControlDigest", () => {
  it("returns a digest with tone and text", () => {
    const d = buildMissionControlDigest({ status: "clear", urgentCount: 0, safeToRunCount: 0, pendingApprovals: 0, blockers: 0, sensitiveCount: 0, deliveries: 0 });
    expect(d.tone).toBeTruthy();
    expect(d.text).toBeTruthy();
  });

  it("tone=sensitive when sensitiveCount > 0", () => {
    const d = buildMissionControlDigest({ status: "sensitive", urgentCount: 0, safeToRunCount: 0, pendingApprovals: 0, blockers: 0, sensitiveCount: 2, deliveries: 0 });
    expect(d.tone).toBe("sensitive");
  });

  it("tone=blocked when blockers > 0", () => {
    const d = buildMissionControlDigest({ status: "blocked", urgentCount: 0, safeToRunCount: 0, pendingApprovals: 0, blockers: 3, sensitiveCount: 0, deliveries: 0 });
    expect(d.tone).toBe("blocked");
  });

  it("tone=waiting when pendingApprovals > 0", () => {
    const d = buildMissionControlDigest({ status: "active", urgentCount: 0, safeToRunCount: 0, pendingApprovals: 1, blockers: 0, sensitiveCount: 0, deliveries: 0 });
    expect(d.tone).toBe("waiting");
  });

  it("tone=action when safeToRunCount > 0", () => {
    const d = buildMissionControlDigest({ status: "active", urgentCount: 0, safeToRunCount: 3, pendingApprovals: 0, blockers: 0, sensitiveCount: 0, deliveries: 0 });
    expect(d.tone).toBe("action");
  });

  it("tone=calm for clear status", () => {
    const d = buildMissionControlDigest({ status: "clear", urgentCount: 0, safeToRunCount: 0, pendingApprovals: 0, blockers: 0, sensitiveCount: 0, deliveries: 0 });
    expect(d.tone).toBe("calm");
  });
});

// ─────────────────────────────────────────────────────────
// 17. buildMissionControlRunPlan
// ─────────────────────────────────────────────────────────

describe("buildMissionControlRunPlan", () => {
  it("returns a run plan with dry_run=true by default", () => {
    const plan = buildMissionControlRunPlan([]);
    expect(plan.dry_run).toBe(true);
  });

  it("includes safe actions only", () => {
    const safe = makeAction({ is_safe_to_run: true, task_id: "t1" });
    const unsafe = makeAction({ id: "ctrl_2", is_safe_to_run: false, type: "approve_task" });
    const plan = buildMissionControlRunPlan([safe, unsafe]);
    expect(plan.safe_actions).toHaveLength(1);
    expect(plan.safe_actions[0].task_id).toBe("t1");
  });

  it("respects maxTasks limit", () => {
    const actions = Array.from({ length: 10 }, (_, i) =>
      makeAction({ id: `ctrl_${i}`, task_id: `t${i}`, is_safe_to_run: true }),
    );
    const plan = buildMissionControlRunPlan(actions, 3);
    expect(plan.safe_actions).toHaveLength(3);
  });

  it("excludes sensitive actions from safe list", () => {
    const sensitive = makeAction({ is_sensitive: true, task_id: "t_s" });
    const plan = buildMissionControlRunPlan([sensitive]);
    expect(plan.safe_task_ids).not.toContain("t_s");
  });

  it("excludes requires_human actions from safe list", () => {
    const human = makeAction({ requires_human: true, task_id: "t_h" });
    const plan = buildMissionControlRunPlan([human]);
    expect(plan.safe_task_ids).not.toContain("t_h");
  });

  it("populates safe_task_ids", () => {
    const safe = makeAction({ is_safe_to_run: true, task_id: "task_abc" });
    const plan = buildMissionControlRunPlan([safe]);
    expect(plan.safe_task_ids).toContain("task_abc");
  });

  it("generates non-empty summary", () => {
    const plan = buildMissionControlRunPlan([]);
    expect(plan.summary.length).toBeGreaterThan(0);
  });

  it("clamps maxTasks to 20", () => {
    const actions = Array.from({ length: 25 }, (_, i) =>
      makeAction({ id: `ctrl_${i}`, task_id: `t${i}`, is_safe_to_run: true }),
    );
    const plan = buildMissionControlRunPlan(actions, 99);
    expect(plan.safe_actions.length).toBeLessThanOrEqual(20);
  });
});

// ─────────────────────────────────────────────────────────
// 18. buildMissionControlExecutiveBriefing
// ─────────────────────────────────────────────────────────

describe("buildMissionControlExecutiveBriefing", () => {
  it("returns a briefing object with summary", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "clear", actions: [], missionCards: [], employeeCards: [] });
    expect(b).toBeTruthy();
    expect(typeof b.summary).toBe("string");
  });

  it("includes safe_actions_available array", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "clear", actions: [], missionCards: [], employeeCards: [] });
    expect(Array.isArray(b.safe_actions_available)).toBe(true);
  });

  it("includes decisions_required array", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "clear", actions: [], missionCards: [], employeeCards: [] });
    expect(Array.isArray(b.decisions_required)).toBe(true);
  });

  it("includes period in output", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "active", actions: [], missionCards: [], employeeCards: [], period: "daily" });
    expect(b.period).toBe("daily");
  });

  it("lists sensitive_cases when sensitive actions present", () => {
    const sensitive = makeAction({ is_sensitive: true, task_id: "t_s", label: "Cas sensible" });
    const b = buildMissionControlExecutiveBriefing({ status: "sensitive", actions: [sensitive], missionCards: [], employeeCards: [] });
    expect(b.sensitive_cases.length).toBeGreaterThan(0);
  });

  it("has a non-empty headline", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "active", actions: [], missionCards: [], employeeCards: [] });
    expect(b.headline.length).toBeGreaterThan(0);
  });

  it("has a generated_at timestamp", () => {
    const b = buildMissionControlExecutiveBriefing({ status: "clear", actions: [], missionCards: [], employeeCards: [], now: NOW });
    expect(b.generated_at).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────
// 19. buildMissionControlDashboard — full integration
// ─────────────────────────────────────────────────────────

describe("buildMissionControlDashboard", () => {
  it("returns a dashboard object with all required fields", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard).toHaveProperty("status");
    expect(dashboard).toHaveProperty("headline");
    expect(dashboard).toHaveProperty("digest");
    expect(dashboard).toHaveProperty("metrics");
    expect(dashboard).toHaveProperty("queues");
    expect(dashboard).toHaveProperty("recommended_order");
    expect(dashboard).toHaveProperty("safe_to_run");
    expect(dashboard).toHaveProperty("mission_cards");
    expect(dashboard).toHaveProperty("employee_cards");
    expect(dashboard).toHaveProperty("briefing");
    expect(dashboard).toHaveProperty("generated_at");
  });

  it("status=clear when no actions", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard.status).toBe("clear");
  });

  it("builds recommended_order from tasks", () => {
    const dashboard = buildMissionControlDashboard({ tasks: [makeTask()] });
    expect(dashboard.recommended_order.length).toBeGreaterThan(0);
  });

  it("skips terminal tasks (done/cancelled)", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ status: "done" }), makeTask({ id: "t2", status: "cancelled" })],
    });
    expect(dashboard.recommended_order).toHaveLength(0);
  });

  it("marks dashboard sensitive when task is sensitive", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ title: "Licenciement économique" })],
    });
    expect(dashboard.status).toBe("sensitive");
  });

  it("builds mission_cards", () => {
    const dashboard = buildMissionControlDashboard({ missions: [makeMission()] });
    expect(dashboard.mission_cards).toHaveLength(1);
    expect(dashboard.mission_cards[0].mission_id).toBe("mission_1");
  });

  it("respects maxSafeActions limit on safe_to_run list", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, status: "ready" }),
    );
    const dashboard = buildMissionControlDashboard({ tasks, maxSafeActions: 3 });
    expect(dashboard.safe_to_run.length).toBeLessThanOrEqual(3);
  });

  it("generates a non-empty headline", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard.headline.length).toBeGreaterThan(0);
  });

  it("includes queues with 11 keys", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard.queues).toHaveLength(11);
  });

  it("does not crash on completely empty input", () => {
    expect(() => buildMissionControlDashboard({})).not.toThrow();
  });

  it("does not crash on null/malformed tasks", () => {
    expect(() =>
      buildMissionControlDashboard({ tasks: [null, undefined, "bad", 42] as unknown[] }),
    ).not.toThrow();
  });

  it("uses provided now date for deterministic output", () => {
    const d1 = buildMissionControlDashboard({ now: NOW });
    const d2 = buildMissionControlDashboard({ now: NOW });
    expect(d1.generated_at).toBe(d2.generated_at);
  });

  it("builds deliveries from documents", () => {
    const dashboard = buildMissionControlDashboard({ documents: [makeDocument()] });
    expect(dashboard.deliveries.length).toBeGreaterThan(0);
  });

  it("status=attention_required or blocked when urgent blocked task present", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ priority: "urgent", status: "blocked" })],
    });
    expect(["attention_required", "blocked", "sensitive"]).toContain(dashboard.status);
  });
});

// ─────────────────────────────────────────────────────────
// 20. buildMissionControlScaleProfile
// ─────────────────────────────────────────────────────────

describe("buildMissionControlScaleProfile", () => {
  it("returns a valid scale profile object", () => {
    const profile = buildMissionControlScaleProfile();
    expect(profile).toHaveProperty("target_active_clients");
    expect(profile).toHaveProperty("validated_active_clients");
    expect(profile).toHaveProperty("validation_status");
    expect(profile).toHaveProperty("notes");
  });

  it("targets 100 000 active clients", () => {
    const profile = buildMissionControlScaleProfile();
    expect(profile.target_active_clients).toBe(100000);
  });

  it("validation_status is not_load_tested", () => {
    const profile = buildMissionControlScaleProfile();
    expect(profile.validation_status).toBe("not_load_tested");
  });

  it("validated_active_clients is null (no load test done)", () => {
    const profile = buildMissionControlScaleProfile();
    expect(profile.validated_active_clients).toBeNull();
  });

  it("notes is a non-empty array of strings", () => {
    const profile = buildMissionControlScaleProfile();
    expect(Array.isArray(profile.notes)).toBe(true);
    expect(profile.notes.length).toBeGreaterThan(0);
    expect(typeof profile.notes[0]).toBe("string");
  });

  it("is deterministic — same result each call", () => {
    const p1 = buildMissionControlScaleProfile();
    const p2 = buildMissionControlScaleProfile();
    expect(p1.target_active_clients).toBe(p2.target_active_clients);
    expect(p1.validation_status).toBe(p2.validation_status);
  });
});

// ─────────────────────────────────────────────────────────
// 21. buildMissionControlDataWindow
// ─────────────────────────────────────────────────────────

describe("buildMissionControlDataWindow", () => {
  it("returns default data window", () => {
    const dw = buildMissionControlDataWindow();
    expect(dw.missions_limit).toBe(300);
    expect(dw.tasks_limit).toBe(500);
    expect(dw.documents_limit).toBe(300);
    expect(dw.logs_limit).toBe(500);
    expect(dw.employees_limit).toBe(500);
    expect(dw.safe_execution_hard_limit).toBe(10);
  });

  it("accepts overrides", () => {
    const dw = buildMissionControlDataWindow({ missions_limit: 50, tasks_limit: 100 });
    expect(dw.missions_limit).toBe(50);
    expect(dw.tasks_limit).toBe(100);
    expect(dw.documents_limit).toBe(300);
  });

  it("override does not affect unrelated fields", () => {
    const dw = buildMissionControlDataWindow({ logs_limit: 99 });
    expect(dw.logs_limit).toBe(99);
    expect(dw.missions_limit).toBe(300);
    expect(dw.safe_execution_hard_limit).toBe(10);
  });

  it("safe_execution_hard_limit cannot exceed 10 by default", () => {
    const dw = buildMissionControlDataWindow();
    expect(dw.safe_execution_hard_limit).toBeLessThanOrEqual(10);
  });

  it("all numeric fields are positive integers", () => {
    const dw = buildMissionControlDataWindow();
    for (const v of Object.values(dw)) {
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────
// 22. buildMissionControlBriefing
// ─────────────────────────────────────────────────────────

describe("buildMissionControlBriefing", () => {
  it("returns a valid briefing for empty dashboard", () => {
    const dashboard = buildMissionControlDashboard({});
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing).toHaveProperty("id");
    expect(briefing).toHaveProperty("period");
    expect(briefing).toHaveProperty("status");
    expect(briefing).toHaveProperty("headline");
    expect(briefing).toHaveProperty("summary");
    expect(briefing).toHaveProperty("decisions_required");
    expect(briefing).toHaveProperty("safe_actions_available");
    expect(briefing).toHaveProperty("blockers");
    expect(briefing).toHaveProperty("sensitive_cases");
    expect(briefing).toHaveProperty("deliveries_ready");
    expect(briefing).toHaveProperty("employee_attention");
    expect(briefing).toHaveProperty("suggested_focus");
    expect(briefing).toHaveProperty("scale_profile");
    expect(briefing).toHaveProperty("generated_at");
  });

  it("period is preserved in the briefing", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(buildMissionControlBriefing({ dashboard, period: "daily", now: NOW }).period).toBe("daily");
    expect(buildMissionControlBriefing({ dashboard, period: "weekly", now: NOW }).period).toBe("weekly");
    expect(buildMissionControlBriefing({ dashboard, period: "instant", now: NOW }).period).toBe("instant");
  });

  it("status matches dashboard status", () => {
    const dashboard = buildMissionControlDashboard({});
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.status).toBe(dashboard.status);
  });

  it("safe_actions_available lists ready tasks", () => {
    const dashboard = buildMissionControlDashboard({ tasks: [makeTask({ status: "ready" })] });
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.safe_actions_available.length).toBeGreaterThan(0);
  });

  it("decisions_required lists approval tasks", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ status: "awaiting_approval", approval_required: true })],
    });
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.decisions_required.length).toBeGreaterThan(0);
  });

  it("sensitive_cases lists sensitive tasks", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ title: "Licenciement pour faute grave" })],
    });
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.sensitive_cases.length).toBeGreaterThan(0);
  });

  it("scale_profile is embedded in briefing", () => {
    const dashboard = buildMissionControlDashboard({});
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.scale_profile.target_active_clients).toBe(100000);
    expect(briefing.scale_profile.validation_status).toBe("not_load_tested");
  });

  it("id is a non-empty string", () => {
    const dashboard = buildMissionControlDashboard({});
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(typeof briefing.id).toBe("string");
    expect(briefing.id.length).toBeGreaterThan(0);
  });

  it("generated_at is an ISO string", () => {
    const dashboard = buildMissionControlDashboard({});
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(() => new Date(briefing.generated_at)).not.toThrow();
    expect(briefing.generated_at).toContain("T");
  });

  it("suggested_focus is an array", () => {
    const dashboard = buildMissionControlDashboard({ tasks: [makeTask()] });
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(Array.isArray(briefing.suggested_focus)).toBe(true);
  });

  it("does not crash on completely empty dashboard", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(() => buildMissionControlBriefing({ dashboard, period: "instant" })).not.toThrow();
  });

  it("blockers includes blocked tasks", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ status: "blocked" })],
    });
    const briefing = buildMissionControlBriefing({ dashboard, period: "instant", now: NOW });
    expect(briefing.blockers.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// 23. buildMissionControlPreview
// ─────────────────────────────────────────────────────────

describe("buildMissionControlPreview", () => {
  it("returns a valid preview object", () => {
    const dashboard = buildMissionControlDashboard({});
    const preview = buildMissionControlPreview(dashboard);
    expect(preview).toHaveProperty("status");
    expect(preview).toHaveProperty("headline");
    expect(preview).toHaveProperty("digest");
    expect(preview).toHaveProperty("top_actions");
    expect(preview).toHaveProperty("counts");
  });

  it("top_actions has at most 5 entries", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({ id: `t${i}` }));
    const dashboard = buildMissionControlDashboard({ tasks });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.top_actions.length).toBeLessThanOrEqual(5);
  });

  it("counts.safe_to_run matches safe_to_run list length", () => {
    const dashboard = buildMissionControlDashboard({ tasks: [makeTask(), makeTask({ id: "t2" })] });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.counts.safe_to_run).toBe(dashboard.safe_to_run.length);
  });

  it("counts.blockers matches blockers list length", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ status: "blocked" })],
    });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.counts.blockers).toBe(dashboard.blockers.length);
  });

  it("counts.sensitive matches sensitive list length", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ title: "Harcèlement moral constaté" })],
    });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.counts.sensitive).toBe(dashboard.sensitive.length);
  });

  it("counts.needs_human matches needs_human list length", () => {
    const dashboard = buildMissionControlDashboard({
      tasks: [makeTask({ approval_required: true, status: "awaiting_approval" })],
    });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.counts.needs_human).toBe(dashboard.needs_human.length);
  });

  it("counts.deliveries matches deliveries list length", () => {
    const dashboard = buildMissionControlDashboard({ documents: [makeDocument()] });
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.counts.deliveries).toBe(dashboard.deliveries.length);
  });

  it("status matches dashboard status", () => {
    const dashboard = buildMissionControlDashboard({});
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.status).toBe(dashboard.status);
  });

  it("headline matches dashboard headline", () => {
    const dashboard = buildMissionControlDashboard({});
    const preview = buildMissionControlPreview(dashboard);
    expect(preview.headline).toBe(dashboard.headline);
  });

  it("does not crash on empty dashboard", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(() => buildMissionControlPreview(dashboard)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// 24. Security — blocked task types
// ─────────────────────────────────────────────────────────

describe("Security — blocked task types", () => {
  it("email.send is never safe to run", () => {
    expect(isMissionControlSafeToRun({ type: "email.send", status: "ready", approval_required: false }, NOW)).toBe(false);
  });

  it("send_email is never safe to run", () => {
    expect(isMissionControlSafeToRun({ type: "send_email", status: "ready", approval_required: false }, NOW)).toBe(false);
  });

  it("email.send in run plan ends up in blocked_actions", () => {
    const actions = [
      { ...makeAction({ type: "run_safe_task", is_safe_to_run: false, queue: "blocked" as const }),
        raw: { type: "email.send", status: "ready" } },
    ];
    const plan = buildMissionControlRunPlan(actions, 5, false);
    expect(plan.safe_task_ids).toHaveLength(0);
  });

  it("approval_required=true task is never safe", () => {
    expect(isMissionControlSafeToRun({ type: "document.generate", status: "ready", approval_required: true }, NOW)).toBe(false);
  });

  it("sensitive task always requires human in action", () => {
    const action = buildMissionControlActionFromTask(
      makeTask({ title: "Licenciement économique collectif" }), NOW,
    );
    expect(action.requires_human).toBe(true);
  });

  it("future execute_at is blocked from safe execution", () => {
    expect(isMissionControlSafeToRun(
      { type: "document.generate", status: "ready", approval_required: false, execute_at: FUTURE.toISOString() },
      NOW,
    )).toBe(false);
  });

  it("run plan respects maxTasks cap when explicitly set to 10", () => {
    const actions = Array.from({ length: 20 }, (_, i) =>
      makeAction({ id: `a${i}`, task_id: `t${i}`, is_safe_to_run: true, queue: "safe_to_run" }),
    );
    const plan = buildMissionControlRunPlan(actions, 10, false);
    expect(plan.safe_task_ids.length).toBeLessThanOrEqual(10);
  });

  it("BLOCKED_TASK_TYPES check is case-insensitive via lowerText", () => {
    expect(isMissionControlSafeToRun({ type: "EMAIL.SEND", status: "ready", approval_required: false }, NOW)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 25. Robustness — null / malformed inputs
// ─────────────────────────────────────────────────────────

describe("Robustness — null / malformed inputs", () => {
  it("buildMissionControlActionFromTask does not crash on empty object", () => {
    expect(() => buildMissionControlActionFromTask({}, NOW)).not.toThrow();
  });

  it("buildMissionControlActionFromMission does not crash on empty object", () => {
    expect(() => buildMissionControlActionFromMission({}, NOW)).not.toThrow();
  });

  it("buildMissionControlMissionCard does not crash with no tasks", () => {
    expect(() => buildMissionControlMissionCard(makeMission())).not.toThrow();
  });

  it("buildMissionControlEmployeeCard does not crash on empty object", () => {
    expect(() => buildMissionControlEmployeeCard({})).not.toThrow();
  });

  it("buildMissionControlRunPlan does not crash on empty actions", () => {
    expect(() => buildMissionControlRunPlan([], 5, true)).not.toThrow();
  });

  it("buildMissionControlDashboard does not crash with null in tasks array", () => {
    expect(() =>
      buildMissionControlDashboard({ tasks: [null, undefined] as unknown[] }),
    ).not.toThrow();
  });

  it("sortMissionControlActions does not crash on empty array", () => {
    expect(() => sortMissionControlActions([])).not.toThrow();
    expect(sortMissionControlActions([])).toHaveLength(0);
  });

  it("buildMissionControlMetrics handles empty input", () => {
    expect(() =>
      buildMissionControlMetrics({ actions: [], missions: [], snapshots: [] }),
    ).not.toThrow();
  });

  it("buildMissionControlDigest handles all statuses", () => {
    for (const status of ["clear", "active", "attention_required", "blocked", "sensitive"] as const) {
      expect(() =>
        buildMissionControlDigest({ status, urgentCount: 0, safeToRunCount: 0, pendingApprovals: 0, blockers: 0, sensitiveCount: 0, deliveries: 0 }),
      ).not.toThrow();
    }
  });

  it("buildMissionControlPreview does not crash on clear dashboard", () => {
    expect(() => buildMissionControlPreview(buildMissionControlDashboard({}))).not.toThrow();
  });

  it("buildMissionControlBriefing does not crash on minimal dashboard", () => {
    expect(() =>
      buildMissionControlBriefing({ dashboard: buildMissionControlDashboard({}), period: "instant" }),
    ).not.toThrow();
  });

  it("isMissionControlSafeToRun returns false for string input", () => {
    expect(isMissionControlSafeToRun("not an object" as unknown as Record<string, unknown>, NOW)).toBe(false);
  });

  it("isMissionControlSensitive returns false for array input", () => {
    expect(isMissionControlSensitive([] as unknown as Record<string, unknown>)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// 26. Scale architecture assertions
// ─────────────────────────────────────────────────────────

describe("Scale architecture assertions", () => {
  it("default data window missions_limit is 300", () => {
    expect(buildMissionControlDataWindow().missions_limit).toBe(300);
  });

  it("default data window tasks_limit is 500", () => {
    expect(buildMissionControlDataWindow().tasks_limit).toBe(500);
  });

  it("safe_execution_hard_limit is exactly 10 — hard safety cap", () => {
    expect(buildMissionControlDataWindow().safe_execution_hard_limit).toBe(10);
  });

  it("scale profile notes mentions 100 000 or more", () => {
    const profile = buildMissionControlScaleProfile();
    const allNotes = profile.notes.join(" ");
    expect(allNotes.length).toBeGreaterThan(0);
  });

  it("run plan enforces maxTasks cap even when more safe actions exist", () => {
    const actions = Array.from({ length: 15 }, (_, i) =>
      makeAction({ id: `a${i}`, task_id: `t${i}`, is_safe_to_run: true, queue: "safe_to_run" }),
    );
    const plan = buildMissionControlRunPlan(actions, 7, false);
    expect(plan.safe_task_ids.length).toBeLessThanOrEqual(7);
  });

  it("dashboard includes scale_profile", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard.scale_profile).toBeDefined();
    expect(dashboard.scale_profile?.target_active_clients).toBe(100000);
  });

  it("dashboard includes data_window", () => {
    const dashboard = buildMissionControlDashboard({});
    expect(dashboard.data_window).toBeDefined();
    expect(dashboard.data_window?.safe_execution_hard_limit).toBe(10);
  });
});
