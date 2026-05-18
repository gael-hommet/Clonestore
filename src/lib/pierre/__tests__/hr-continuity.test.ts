import { describe, it, expect } from "vitest";
import {
  classifyTaskContinuityState,
  isTaskSafeToRun,
  buildTaskContinuitySlot,
  computeMissionProgress,
  detectStalledMission,
  classifyMissionContinuityState,
  buildContinuityRecommendedNextAction,
  scoreMissionContinuityHealth,
  buildMissionContinuityInsight,
  buildContinuePlan,
  selectNextRunnableTasks,
  buildContinuityDashboard,
  classifyTaskTimeState,
  isTaskCompletedRecently,
  buildMissionSections,
  summarizeMissionLogs,
  summarizeMissionDocuments,
  buildMissionContinuityDigest,
  buildDashboardSections,
  buildFollowupTaskDraftsForContinue,
  type PierreTaskContinuitySlot,
  type PierreMissionContinuityInsight,
  type PierreContinuitySection,
} from "../hr/continuity";

// ── Fixtures ─────────────────────────────────────────────────

const NOW = new Date("2026-05-14T10:00:00Z");
const PAST = "2026-05-10T10:00:00Z";
const FUTURE = "2026-05-20T10:00:00Z";

function task(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "task-001",
    mission_id: "mission-001",
    type: "doc.generate",
    title: "Générer contrat",
    status: "ready",
    approval_required: false,
    execute_at: null,
    priority: 50,
    last_error: null,
    created_at: PAST,
    updated_at: PAST,
    ...overrides,
  };
}

function mission(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "mission-001",
    status: "active",
    understanding_status: "understood",
    risk_level: "low",
    approval_required: false,
    mission_summary: "Test mission",
    missing_info_json: [],
    brain_output_json: {},
    created_at: PAST,
    updated_at: PAST,
    ...overrides,
  };
}

function slot(overrides?: Partial<PierreTaskContinuitySlot>): PierreTaskContinuitySlot {
  return {
    task_id: "task-001",
    type: "doc.generate",
    title: "Test",
    status: "ready",
    continuity_state: "runnable",
    approval_required: false,
    is_safe_to_run: true,
    blocked_reason: null,
    execute_at: null,
    priority: 50,
    ...overrides,
  };
}

function insight(overrides?: Partial<PierreMissionContinuityInsight>): PierreMissionContinuityInsight {
  return {
    mission_id: "mission-001",
    continuity_state: "active",
    progress_pct: 0,
    health_score: 100,
    total_count: 3,
    done_count: 0,
    runnable_count: 3,
    pending_approval_count: 0,
    blocked_count: 0,
    error_count: 0,
    scheduled_count: 0,
    has_missing_info: false,
    is_stalled: false,
    stalled_since: null,
    recommended_next_action: {
      type: "run_tasks",
      label: "Lancer 3 tâche(s) prête(s) à exécution automatique",
      task_ids: ["task-001", "task-002", "task-003"],
    },
    safe_task_ids: ["task-001", "task-002", "task-003"],
    tasks: [],
    ...overrides,
  };
}

// ── classifyTaskContinuityState ───────────────────────────────

describe("classifyTaskContinuityState", () => {
  it("done status → done", () => {
    expect(classifyTaskContinuityState(task({ status: "done" }), NOW)).toBe("done");
  });

  it("cancelled status → done", () => {
    expect(classifyTaskContinuityState(task({ status: "cancelled" }), NOW)).toBe("done");
  });

  it("error status → error", () => {
    expect(classifyTaskContinuityState(task({ status: "error" }), NOW)).toBe("error");
  });

  it("awaiting_approval status → awaiting_approval", () => {
    expect(
      classifyTaskContinuityState(task({ status: "awaiting_approval" }), NOW),
    ).toBe("awaiting_approval");
  });

  it("blocked status → blocked", () => {
    expect(classifyTaskContinuityState(task({ status: "blocked" }), NOW)).toBe("blocked");
  });

  it("running status → runnable", () => {
    expect(classifyTaskContinuityState(task({ status: "running" }), NOW)).toBe("runnable");
  });

  it("ready, no approval, no execute_at → runnable", () => {
    expect(classifyTaskContinuityState(task({ status: "ready" }), NOW)).toBe("runnable");
  });

  it("ready, approval_required=true → awaiting_approval", () => {
    expect(
      classifyTaskContinuityState(task({ status: "ready", approval_required: true }), NOW),
    ).toBe("awaiting_approval");
  });

  it("ready, execute_at in future → scheduled", () => {
    expect(
      classifyTaskContinuityState(task({ status: "ready", execute_at: FUTURE }), NOW),
    ).toBe("scheduled");
  });

  it("ready, execute_at in past → runnable", () => {
    expect(
      classifyTaskContinuityState(task({ status: "ready", execute_at: PAST }), NOW),
    ).toBe("runnable");
  });

  it("scheduled, execute_at in future → scheduled", () => {
    expect(
      classifyTaskContinuityState(task({ status: "scheduled", execute_at: FUTURE }), NOW),
    ).toBe("scheduled");
  });

  it("scheduled, execute_at in past → runnable", () => {
    expect(
      classifyTaskContinuityState(task({ status: "scheduled", execute_at: PAST }), NOW),
    ).toBe("runnable");
  });

  it("scheduled, no execute_at → runnable", () => {
    expect(
      classifyTaskContinuityState(task({ status: "scheduled", execute_at: null }), NOW),
    ).toBe("runnable");
  });

  it("retry status → runnable", () => {
    expect(classifyTaskContinuityState(task({ status: "retry" }), NOW)).toBe("runnable");
  });

  it("draft status → not_ready", () => {
    expect(classifyTaskContinuityState(task({ status: "draft" }), NOW)).toBe("not_ready");
  });
});

// ── isTaskSafeToRun ───────────────────────────────────────────

describe("isTaskSafeToRun", () => {
  it("ready, no approval, doc type → true", () => {
    expect(isTaskSafeToRun(task({ type: "doc.generate" }), NOW)).toBe(true);
  });

  it("retry, no approval, reminder type → true", () => {
    expect(
      isTaskSafeToRun(task({ status: "retry", type: "reminder.create" }), NOW),
    ).toBe(true);
  });

  it("email.send type → false (gate 3 — send requires manual trigger)", () => {
    expect(isTaskSafeToRun(task({ type: "email.send" }), NOW)).toBe(false);
  });

  it("send_email type → false", () => {
    expect(isTaskSafeToRun(task({ type: "send_email" }), NOW)).toBe(false);
  });

  it("approval_required=true → false", () => {
    expect(isTaskSafeToRun(task({ approval_required: true }), NOW)).toBe(false);
  });

  it("status=awaiting_approval → false", () => {
    expect(
      isTaskSafeToRun(task({ status: "awaiting_approval" }), NOW),
    ).toBe(false);
  });

  it("status=done → false", () => {
    expect(isTaskSafeToRun(task({ status: "done" }), NOW)).toBe(false);
  });

  it("execute_at in future → false", () => {
    expect(isTaskSafeToRun(task({ execute_at: FUTURE }), NOW)).toBe(false);
  });

  it("execute_at in past → true", () => {
    expect(isTaskSafeToRun(task({ execute_at: PAST }), NOW)).toBe(true);
  });

  it("email.draft type → true (not a send type)", () => {
    expect(isTaskSafeToRun(task({ type: "email.draft" }), NOW)).toBe(true);
  });

  it("followup.schedule type → true", () => {
    expect(isTaskSafeToRun(task({ type: "followup.schedule" }), NOW)).toBe(true);
  });
});

// ── buildTaskContinuitySlot ───────────────────────────────────

describe("buildTaskContinuitySlot", () => {
  it("builds slot from ready task", () => {
    const s = buildTaskContinuitySlot(task(), NOW);
    expect(s.task_id).toBe("task-001");
    expect(s.continuity_state).toBe("runnable");
    expect(s.is_safe_to_run).toBe(true);
    expect(s.blocked_reason).toBeNull();
    expect(s.priority).toBe(50);
  });

  it("sets blocked_reason for awaiting_approval state", () => {
    const s = buildTaskContinuitySlot(task({ approval_required: true }), NOW);
    expect(s.continuity_state).toBe("awaiting_approval");
    expect(s.is_safe_to_run).toBe(false);
    expect(s.blocked_reason).toContain("Validation humaine");
  });

  it("sets blocked_reason for blocked state", () => {
    const s = buildTaskContinuitySlot(task({ status: "blocked" }), NOW);
    expect(s.continuity_state).toBe("blocked");
    expect(s.blocked_reason).not.toBeNull();
  });

  it("uses last_error as blocked_reason when present", () => {
    const s = buildTaskContinuitySlot(
      task({ status: "blocked", last_error: "Informations manquantes" }),
      NOW,
    );
    expect(s.blocked_reason).toBe("Informations manquantes");
  });

  it("sets scheduled blocked_reason with execute_at date", () => {
    const s = buildTaskContinuitySlot(task({ execute_at: FUTURE }), NOW);
    expect(s.continuity_state).toBe("scheduled");
    expect(s.blocked_reason).toContain("Planifiée");
  });

  it("email.send runnable → blocked_reason mentions envoi", () => {
    const s = buildTaskContinuitySlot(task({ type: "email.send" }), NOW);
    expect(s.continuity_state).toBe("runnable");
    expect(s.is_safe_to_run).toBe(false);
    expect(s.blocked_reason).toContain("email");
  });

  it("done task → continuity_state done, not safe", () => {
    const s = buildTaskContinuitySlot(task({ status: "done" }), NOW);
    expect(s.continuity_state).toBe("done");
    expect(s.is_safe_to_run).toBe(false);
  });

  it("falls back to default title when missing", () => {
    const s = buildTaskContinuitySlot(task({ title: "" }), NOW);
    expect(s.title).toBe("Tâche sans titre");
  });
});

// ── computeMissionProgress ────────────────────────────────────

describe("computeMissionProgress", () => {
  it("returns 0 for empty slots", () => {
    expect(computeMissionProgress([])).toBe(0);
  });

  it("returns 0 when no tasks done", () => {
    const slots = [slot({ continuity_state: "runnable" }), slot({ continuity_state: "blocked" })];
    expect(computeMissionProgress(slots)).toBe(0);
  });

  it("returns 50 when half done", () => {
    const slots = [
      slot({ continuity_state: "done" }),
      slot({ continuity_state: "runnable" }),
    ];
    expect(computeMissionProgress(slots)).toBe(50);
  });

  it("returns 100 when all done", () => {
    const slots = [
      slot({ continuity_state: "done" }),
      slot({ continuity_state: "done" }),
    ];
    expect(computeMissionProgress(slots)).toBe(100);
  });

  it("rounds percentage correctly", () => {
    const slots = [
      slot({ continuity_state: "done" }),
      slot({ continuity_state: "runnable" }),
      slot({ continuity_state: "runnable" }),
    ];
    expect(computeMissionProgress(slots)).toBe(33);
  });
});

// ── detectStalledMission ──────────────────────────────────────

describe("detectStalledMission", () => {
  it("not stalled when all tasks done", () => {
    const slots = [slot({ continuity_state: "done" })];
    const r = detectStalledMission(mission(), slots, NOW);
    expect(r.stalled).toBe(false);
  });

  it("not stalled when has runnable tasks", () => {
    const slots = [slot({ continuity_state: "runnable" })];
    const r = detectStalledMission(mission(), slots, NOW);
    expect(r.stalled).toBe(false);
  });

  it("not stalled when cancelled mission", () => {
    const slots = [slot({ continuity_state: "blocked" })];
    const r = detectStalledMission(mission({ status: "cancelled" }), slots, NOW);
    expect(r.stalled).toBe(false);
  });

  it("stalled when no runnable tasks and updated > 3 days ago", () => {
    const stalledMission = mission({ updated_at: "2026-05-01T00:00:00Z" });
    const slots = [slot({ continuity_state: "blocked" })];
    const r = detectStalledMission(stalledMission, slots, NOW);
    expect(r.stalled).toBe(true);
    expect(r.stalled_since).toBe("2026-05-01T00:00:00Z");
  });

  it("not stalled when updated recently (< 3 days)", () => {
    const recentMission = mission({ updated_at: "2026-05-13T10:00:00Z" });
    const slots = [slot({ continuity_state: "blocked" })];
    const r = detectStalledMission(recentMission, slots, NOW);
    expect(r.stalled).toBe(false);
  });

  it("stalled when only awaiting_approval tasks and old", () => {
    const oldMission = mission({ updated_at: "2026-04-01T00:00:00Z" });
    const slots = [slot({ continuity_state: "awaiting_approval", is_safe_to_run: false })];
    const r = detectStalledMission(oldMission, slots, NOW);
    expect(r.stalled).toBe(true);
  });

  it("returns stalled_since from updated_at", () => {
    const stalledAt = "2026-05-01T00:00:00Z";
    const stalledMission = mission({ updated_at: stalledAt });
    const slots = [slot({ continuity_state: "error" })];
    const r = detectStalledMission(stalledMission, slots, NOW);
    expect(r.stalled_since).toBe(stalledAt);
  });
});

// ── classifyMissionContinuityState ───────────────────────────

describe("classifyMissionContinuityState", () => {
  it("cancelled mission → cancelled", () => {
    const r = classifyMissionContinuityState(mission({ status: "cancelled" }), [], NOW);
    expect(r).toBe("cancelled");
  });

  it("no tasks, done mission → completed", () => {
    const r = classifyMissionContinuityState(mission({ status: "done" }), [], NOW);
    expect(r).toBe("completed");
  });

  it("no tasks, active mission → active", () => {
    const r = classifyMissionContinuityState(mission(), [], NOW);
    expect(r).toBe("active");
  });

  it("all tasks done → completed", () => {
    const slots = [slot({ continuity_state: "done" }), slot({ continuity_state: "done" })];
    const r = classifyMissionContinuityState(mission(), slots, NOW);
    expect(r).toBe("completed");
  });

  it("all active tasks are error → error", () => {
    const slots = [slot({ continuity_state: "error" }), slot({ continuity_state: "error" })];
    const r = classifyMissionContinuityState(mission(), slots, NOW);
    expect(r).toBe("error");
  });

  it("all active tasks blocked, no runnable → blocked (mission recente)", () => {
    const recentMission = mission({ updated_at: "2026-05-13T10:00:00Z" });
    const slots = [slot({ continuity_state: "blocked" }), slot({ continuity_state: "blocked" })];
    const r = classifyMissionContinuityState(recentMission, slots, NOW);
    expect(r).toBe("blocked");
  });

  it("has awaiting_approval, no runnable → awaiting_approval", () => {
    const slots = [
      slot({ continuity_state: "awaiting_approval", is_safe_to_run: false }),
      slot({ continuity_state: "awaiting_approval", is_safe_to_run: false }),
    ];
    const r = classifyMissionContinuityState(mission(), slots, NOW);
    expect(r).toBe("awaiting_approval");
  });

  it("has missing_info → awaiting_info", () => {
    const m = mission({ missing_info_json: [{ code: "employee_name" }] });
    const slots = [slot({ continuity_state: "blocked" })];
    const r = classifyMissionContinuityState(m, slots, NOW);
    expect(r).toBe("awaiting_info");
  });

  it("mission status awaiting_info → awaiting_info", () => {
    const m = mission({ status: "awaiting_info" });
    const slots = [slot({ continuity_state: "blocked" })];
    const r = classifyMissionContinuityState(m, slots, NOW);
    expect(r).toBe("awaiting_info");
  });

  it("has runnable tasks → active", () => {
    const slots = [slot({ continuity_state: "runnable" }), slot({ continuity_state: "blocked" })];
    const r = classifyMissionContinuityState(mission(), slots, NOW);
    expect(r).toBe("active");
  });

  it("no runnable, old mission → stalled", () => {
    const oldMission = mission({ updated_at: "2026-04-01T00:00:00Z" });
    const slots = [slot({ continuity_state: "blocked" })];
    const r = classifyMissionContinuityState(oldMission, slots, NOW);
    expect(r).toBe("stalled");
  });
});

// ── buildContinuityRecommendedNextAction ──────────────────────

describe("buildContinuityRecommendedNextAction", () => {
  it("safe-to-run tasks → run_tasks", () => {
    const slots = [slot({ is_safe_to_run: true }), slot({ task_id: "task-002", is_safe_to_run: true })];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.type).toBe("run_tasks");
    expect(a.task_ids).toHaveLength(2);
  });

  it("approval pending, no runnable → approve_tasks", () => {
    const slots = [
      slot({ continuity_state: "awaiting_approval", is_safe_to_run: false }),
    ];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.type).toBe("approve_tasks");
  });

  it("error tasks only → investigate_errors", () => {
    const slots = [slot({ continuity_state: "error", is_safe_to_run: false })];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.type).toBe("investigate_errors");
  });

  it("blocked tasks only → provide_info", () => {
    const slots = [slot({ continuity_state: "blocked", is_safe_to_run: false })];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.type).toBe("provide_info");
  });

  it("all done → mission_complete", () => {
    const slots = [slot({ continuity_state: "done", is_safe_to_run: false })];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.type).toBe("mission_complete");
  });

  it("empty slots → no_action", () => {
    const a = buildContinuityRecommendedNextAction([]);
    expect(a.type).toBe("no_action");
    expect(a.task_ids).toHaveLength(0);
  });

  it("label includes task count for run_tasks", () => {
    const slots = [slot({ is_safe_to_run: true })];
    const a = buildContinuityRecommendedNextAction(slots);
    expect(a.label).toContain("1");
  });
});

// ── scoreMissionContinuityHealth ──────────────────────────────

describe("scoreMissionContinuityHealth", () => {
  it("progress_pct=100 → score 100", () => {
    const i = insight({ progress_pct: 100 });
    expect(scoreMissionContinuityHealth(i)).toBe(100);
  });

  it("no tasks → score 50", () => {
    const i = insight({ total_count: 0 });
    expect(scoreMissionContinuityHealth(i)).toBe(50);
  });

  it("error tasks reduce score by 15 each", () => {
    const i = insight({ error_count: 2, total_count: 3, runnable_count: 1 });
    const s = scoreMissionContinuityHealth(i);
    expect(s).toBeLessThan(80);
  });

  it("blocked tasks reduce score by 10 each", () => {
    const i = insight({ blocked_count: 3, total_count: 3, runnable_count: 0 });
    const s = scoreMissionContinuityHealth(i);
    expect(s).toBeLessThan(80);
  });

  it("stalled reduces score by 20", () => {
    const i = insight({ is_stalled: true, total_count: 2, runnable_count: 0 });
    const s = scoreMissionContinuityHealth(i);
    expect(s).toBeLessThanOrEqual(80);
  });

  it("score never below 0", () => {
    const i = insight({ error_count: 10, blocked_count: 10, is_stalled: true, total_count: 20 });
    expect(scoreMissionContinuityHealth(i)).toBeGreaterThanOrEqual(0);
  });

  it("score never above 100", () => {
    const i = insight({ progress_pct: 0, total_count: 2, runnable_count: 2 });
    expect(scoreMissionContinuityHealth(i)).toBeLessThanOrEqual(100);
  });
});

// ── buildMissionContinuityInsight ─────────────────────────────

describe("buildMissionContinuityInsight", () => {
  it("counts task states correctly", () => {
    const tasks = [
      task({ id: "t1", status: "ready" }),
      task({ id: "t2", status: "done" }),
      task({ id: "t3", status: "blocked" }),
      task({ id: "t4", status: "awaiting_approval", approval_required: true }),
      task({ id: "t5", status: "error" }),
    ];
    const i = buildMissionContinuityInsight(mission(), tasks, { now: NOW });
    expect(i.total_count).toBe(5);
    expect(i.done_count).toBe(1);
    expect(i.runnable_count).toBe(1);
    expect(i.blocked_count).toBe(1);
    expect(i.pending_approval_count).toBe(1);
    expect(i.error_count).toBe(1);
  });

  it("safe_task_ids contains only auto-runnable tasks", () => {
    const tasks = [
      task({ id: "t1", type: "doc.generate", status: "ready" }),
      task({ id: "t2", type: "email.send", status: "ready" }),
      task({ id: "t3", approval_required: true, status: "ready" }),
    ];
    const i = buildMissionContinuityInsight(mission(), tasks, { now: NOW });
    expect(i.safe_task_ids).toHaveLength(1);
    expect(i.safe_task_ids[0]).toBe("t1");
  });

  it("has_missing_info=true when missing_info_json has entries", () => {
    const m = mission({ missing_info_json: [{ code: "employee_name" }] });
    const i = buildMissionContinuityInsight(m, [], { now: NOW });
    expect(i.has_missing_info).toBe(true);
  });

  it("has_missing_info=false when missing_info_json is empty", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.has_missing_info).toBe(false);
  });

  it("progress_pct reflects done tasks", () => {
    const tasks = [
      task({ id: "t1", status: "done" }),
      task({ id: "t2", status: "done" }),
      task({ id: "t3", status: "ready" }),
      task({ id: "t4", status: "ready" }),
    ];
    const i = buildMissionContinuityInsight(mission(), tasks, { now: NOW });
    expect(i.progress_pct).toBe(50);
  });

  it("health_score is set (not 0 default)", () => {
    const tasks = [task({ id: "t1", status: "ready" })];
    const i = buildMissionContinuityInsight(mission(), tasks, { now: NOW });
    expect(i.health_score).toBeGreaterThan(0);
  });

  it("returns tasks array with all slots", () => {
    const tasks = [task({ id: "t1" }), task({ id: "t2" })];
    const i = buildMissionContinuityInsight(mission(), tasks, { now: NOW });
    expect(i.tasks).toHaveLength(2);
  });

  it("mission_id extracted from mission row", () => {
    const i = buildMissionContinuityInsight(mission({ id: "my-mission" }), [], { now: NOW });
    expect(i.mission_id).toBe("my-mission");
  });
});

// ── buildContinuePlan ─────────────────────────────────────────

describe("buildContinuePlan", () => {
  it("safe tasks → safe_to_run + run action", () => {
    const tasks = [task({ id: "t1", type: "doc.generate", status: "ready" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.safe_to_run).toContain("t1");
    expect(plan.actions[0].action).toBe("run");
  });

  it("approval tasks → requires_human + approve action", () => {
    const tasks = [task({ id: "t1", approval_required: true, status: "ready" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.requires_human).toContain("t1");
    expect(plan.actions[0].action).toBe("approve");
  });

  it("blocked tasks → blocked array + provide_info action", () => {
    const tasks = [task({ id: "t1", status: "blocked" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.blocked).toContain("t1");
    expect(plan.actions[0].action).toBe("provide_info");
  });

  it("error tasks → investigate action (not in blocked/requires_human)", () => {
    const tasks = [task({ id: "t1", status: "error" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.actions[0].action).toBe("investigate");
    expect(plan.safe_to_run).not.toContain("t1");
    expect(plan.blocked).not.toContain("t1");
  });

  it("done tasks are skipped", () => {
    const tasks = [task({ id: "t1", status: "done" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.actions).toHaveLength(0);
  });

  it("email.send runnable → approve action in requires_human", () => {
    const tasks = [task({ id: "t1", type: "email.send", status: "ready" })];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.requires_human).toContain("t1");
    expect(plan.actions[0].action).toBe("approve");
  });

  it("summary lists counts", () => {
    const tasks = [
      task({ id: "t1", type: "doc.generate", status: "ready" }),
      task({ id: "t2", status: "blocked" }),
    ];
    const plan = buildContinuePlan(mission(), tasks, { now: NOW });
    expect(plan.summary).toContain("1");
  });

  it("empty tasks → summary mentions no actions", () => {
    const plan = buildContinuePlan(mission(), [], { now: NOW });
    expect(plan.summary).toContain("Aucune action");
  });
});

// ── selectNextRunnableTasks ───────────────────────────────────

describe("selectNextRunnableTasks", () => {
  it("returns only safe tasks", () => {
    const tasks = [
      task({ id: "t1", type: "doc.generate" }),
      task({ id: "t2", type: "email.send" }),
      task({ id: "t3", approval_required: true }),
    ];
    const result = selectNextRunnableTasks(tasks, { now: NOW });
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).id).toBe("t1");
  });

  it("sorts by priority descending", () => {
    const tasks = [
      task({ id: "low", priority: 10 }),
      task({ id: "high", priority: 90 }),
      task({ id: "mid", priority: 50 }),
    ];
    const result = selectNextRunnableTasks(tasks, { now: NOW });
    expect((result[0] as Record<string, unknown>).id).toBe("high");
    expect((result[1] as Record<string, unknown>).id).toBe("mid");
    expect((result[2] as Record<string, unknown>).id).toBe("low");
  });

  it("respects max limit", () => {
    const tasks = Array.from({ length: 20 }, (_, i) =>
      task({ id: `t${i}`, priority: i }),
    );
    const result = selectNextRunnableTasks(tasks, { max: 3, now: NOW });
    expect(result).toHaveLength(3);
  });

  it("defaults to max=10", () => {
    const tasks = Array.from({ length: 15 }, (_, i) =>
      task({ id: `t${i}`, priority: 50 }),
    );
    const result = selectNextRunnableTasks(tasks, { now: NOW });
    expect(result).toHaveLength(10);
  });

  it("returns empty for no safe tasks", () => {
    const tasks = [task({ type: "email.send" }), task({ approval_required: true })];
    const result = selectNextRunnableTasks(tasks, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it("excludes tasks with future execute_at", () => {
    const tasks = [
      task({ id: "future", execute_at: FUTURE }),
      task({ id: "past", execute_at: PAST }),
    ];
    const result = selectNextRunnableTasks(tasks, { now: NOW });
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).id).toBe("past");
  });
});

// ── buildContinuityDashboard ──────────────────────────────────

describe("buildContinuityDashboard", () => {
  it("returns correct structure", () => {
    const missions = [mission({ id: "m1" })];
    const tasksByMissionId = { "m1": [task({ id: "t1" })] };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.user_id).toBe("user-1");
    expect(d.missions_total).toBe(1);
    expect(d.mission_entries).toHaveLength(1);
    expect(d.generated_at).toBeDefined();
  });

  it("counts active missions", () => {
    const missions = [mission({ id: "m1" }), mission({ id: "m2" })];
    const tasks = [task({ id: "t1" })];
    const tasksByMissionId = { "m1": tasks, "m2": tasks };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.missions_active).toBe(2);
  });

  it("counts completed missions", () => {
    const missions = [mission({ id: "m1", status: "done" })];
    const tasksByMissionId = { "m1": [task({ id: "t1", status: "done" })] };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.missions_completed).toBe(1);
    expect(d.missions_active).toBe(0);
  });

  it("aggregates total_safe_task_ids", () => {
    const missions = [mission({ id: "m1" }), mission({ id: "m2" })];
    const tasksByMissionId = {
      "m1": [task({ id: "t1", type: "doc.generate" })],
      "m2": [task({ id: "t2", type: "email.draft" })],
    };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.total_safe_task_ids).toContain("t1");
    expect(d.total_safe_task_ids).toContain("t2");
  });

  it("empty missions → all zero counts", () => {
    const d = buildContinuityDashboard("user-1", [], {}, { now: NOW });
    expect(d.missions_total).toBe(0);
    expect(d.total_runnable_tasks).toBe(0);
    expect(d.recommended_next_action).toBeNull();
  });

  it("recommended_next_action picks highest priority action (run_tasks over approve_tasks)", () => {
    const missions = [
      mission({ id: "m1" }),
      mission({ id: "m2" }),
    ];
    const tasksByMissionId = {
      "m1": [task({ id: "t1", approval_required: true, status: "ready" })],
      "m2": [task({ id: "t2", type: "doc.generate", status: "ready" })],
    };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.recommended_next_action).not.toBeNull();
    expect(d.recommended_next_action?.type).toBe("run_tasks");
  });

  it("dashboard has sections field (v10.5)", () => {
    const missions = [mission({ id: "m1" })];
    const tasksByMissionId = { "m1": [task({ id: "t1" })] };
    const d = buildContinuityDashboard("user-1", missions, tasksByMissionId, { now: NOW });
    expect(d.sections).toBeDefined();
    expect(Array.isArray(d.sections)).toBe(true);
  });
});

// ── classifyTaskTimeState (v10.5) ─────────────────────────

describe("classifyTaskTimeState", () => {
  it("no execute_at → no_schedule", () => {
    expect(classifyTaskTimeState(task({ execute_at: null }), NOW)).toBe("no_schedule");
  });

  it("empty string execute_at → no_schedule", () => {
    expect(classifyTaskTimeState(task({ execute_at: "" }), NOW)).toBe("no_schedule");
  });

  it("invalid date string → no_schedule", () => {
    expect(classifyTaskTimeState(task({ execute_at: "not-a-date" }), NOW)).toBe("no_schedule");
  });

  it("execute_at in past → overdue", () => {
    expect(classifyTaskTimeState(task({ execute_at: PAST }), NOW)).toBe("overdue");
  });

  it("execute_at 1 hour from now → due_now", () => {
    const soon = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    expect(classifyTaskTimeState(task({ execute_at: soon }), NOW)).toBe("due_now");
  });

  it("execute_at exactly 24h from now → due_now", () => {
    const edge = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
    expect(classifyTaskTimeState(task({ execute_at: edge }), NOW)).toBe("due_now");
  });

  it("execute_at beyond 24h → scheduled_future", () => {
    expect(classifyTaskTimeState(task({ execute_at: FUTURE }), NOW)).toBe("scheduled_future");
  });
});

// ── isTaskCompletedRecently (v10.5) ───────────────────────

describe("isTaskCompletedRecently", () => {
  it("done task updated 1h ago → true", () => {
    const recentlyUpdated = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: recentlyUpdated }), NOW)).toBe(true);
  });

  it("cancelled task updated 1h ago → true", () => {
    const recentlyUpdated = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "cancelled", updated_at: recentlyUpdated }), NOW)).toBe(true);
  });

  it("done task updated 48h ago → false", () => {
    const oldUpdate = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: oldUpdate }), NOW)).toBe(false);
  });

  it("ready task (not terminal) → false", () => {
    const recentlyUpdated = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "ready", updated_at: recentlyUpdated }), NOW)).toBe(false);
  });

  it("done task with no updated_at → false", () => {
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: null }), NOW)).toBe(false);
  });

  it("done task with invalid updated_at → false", () => {
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: "bad-date" }), NOW)).toBe(false);
  });

  it("custom 1h window: done 30min ago → true", () => {
    const thirtyMinAgo = new Date(NOW.getTime() - 30 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: thirtyMinAgo }), NOW, 60 * 60 * 1000)).toBe(true);
  });

  it("custom 1h window: done 2h ago → false", () => {
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(isTaskCompletedRecently(task({ status: "done", updated_at: twoHoursAgo }), NOW, 60 * 60 * 1000)).toBe(false);
  });
});

// ── buildMissionSections (v10.5) ──────────────────────────

describe("buildMissionSections", () => {
  function makeSlot(overrides?: Partial<PierreTaskContinuitySlot>): PierreTaskContinuitySlot {
    return {
      task_id: "task-001",
      type: "doc.generate",
      title: "Test",
      status: "ready",
      continuity_state: "runnable",
      approval_required: false,
      is_safe_to_run: true,
      blocked_reason: null,
      execute_at: null,
      priority: 50,
      ...overrides,
    };
  }

  it("empty slots → returns 8 sections all with count 0", () => {
    const sections = buildMissionSections([], NOW);
    expect(sections).toHaveLength(8);
    expect(sections.every((s) => s.count === 0)).toBe(true);
  });

  it("safe-to-run slot → appears in safe_to_run section", () => {
    const slots = [makeSlot({ task_id: "t1", is_safe_to_run: true })];
    const sections = buildMissionSections(slots, NOW);
    const safeSection = sections.find((s) => s.key === "safe_to_run");
    expect(safeSection?.task_ids).toContain("t1");
    expect(safeSection?.count).toBe(1);
  });

  it("awaiting_approval slot → appears in awaiting_approval section", () => {
    const slots = [makeSlot({ task_id: "t1", continuity_state: "awaiting_approval", is_safe_to_run: false })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "awaiting_approval");
    expect(s?.task_ids).toContain("t1");
  });

  it("blocked slot → appears in blocked section", () => {
    const slots = [makeSlot({ task_id: "t1", continuity_state: "blocked", is_safe_to_run: false })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "blocked");
    expect(s?.task_ids).toContain("t1");
  });

  it("error slot → appears in failed section", () => {
    const slots = [makeSlot({ task_id: "t1", continuity_state: "error", is_safe_to_run: false })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "failed");
    expect(s?.task_ids).toContain("t1");
  });

  it("scheduled slot → appears in scheduled section", () => {
    const slots = [makeSlot({ task_id: "t1", continuity_state: "scheduled", execute_at: FUTURE, is_safe_to_run: false })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "scheduled");
    expect(s?.task_ids).toContain("t1");
  });

  it("done slot with recent updated_at → appears in completed_recently", () => {
    const recentTs = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const slots = [makeSlot({ task_id: "t1", continuity_state: "done", is_safe_to_run: false, updated_at: recentTs })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "completed_recently");
    expect(s?.task_ids).toContain("t1");
  });

  it("done slot with old updated_at → NOT in completed_recently", () => {
    const oldTs = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const slots = [makeSlot({ task_id: "t1", continuity_state: "done", is_safe_to_run: false, updated_at: oldTs })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "completed_recently");
    expect(s?.task_ids).not.toContain("t1");
  });

  it("slot with execute_at in past (not done) → appears in overdue", () => {
    const slots = [makeSlot({ task_id: "t1", execute_at: PAST, continuity_state: "runnable" })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "overdue");
    expect(s?.task_ids).toContain("t1");
  });

  it("slot with execute_at within 24h (not done) → appears in due_now", () => {
    const soon = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const slots = [makeSlot({ task_id: "t1", execute_at: soon, continuity_state: "runnable" })];
    const sections = buildMissionSections(slots, NOW);
    const s = sections.find((s) => s.key === "due_now");
    expect(s?.task_ids).toContain("t1");
  });

  it("safe-to-run slot with execute_at in past → in BOTH safe_to_run AND overdue", () => {
    const slots = [makeSlot({ task_id: "t1", execute_at: PAST, continuity_state: "runnable", is_safe_to_run: true })];
    const sections = buildMissionSections(slots, NOW);
    const safe = sections.find((s) => s.key === "safe_to_run");
    const overdue = sections.find((s) => s.key === "overdue");
    expect(safe?.task_ids).toContain("t1");
    expect(overdue?.task_ids).toContain("t1");
  });

  it("always returns all 8 section keys", () => {
    const sections = buildMissionSections([], NOW);
    const keys = sections.map((s) => s.key);
    expect(keys).toContain("due_now");
    expect(keys).toContain("overdue");
    expect(keys).toContain("scheduled");
    expect(keys).toContain("awaiting_approval");
    expect(keys).toContain("blocked");
    expect(keys).toContain("failed");
    expect(keys).toContain("completed_recently");
    expect(keys).toContain("safe_to_run");
  });
});

// ── summarizeMissionLogs (v10.5) ──────────────────────────

describe("summarizeMissionLogs", () => {
  function log(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      id: "log-001",
      task_id: "task-001",
      mission_id: "mission-001",
      event_type: "task_completed",
      message: "Tâche terminée",
      created_at: PAST,
      ...overrides,
    };
  }

  it("empty array → all nulls and total=0", () => {
    const s = summarizeMissionLogs([]);
    expect(s.total).toBe(0);
    expect(s.last_event_type).toBeNull();
    expect(s.last_message).toBeNull();
    expect(s.last_at).toBeNull();
  });

  it("single log → total=1, fields populated", () => {
    const s = summarizeMissionLogs([log()]);
    expect(s.total).toBe(1);
    expect(s.last_event_type).toBe("task_completed");
    expect(s.last_message).toBe("Tâche terminée");
    expect(s.last_at).toBe(PAST);
  });

  it("multiple logs → total is count", () => {
    const logs = [log({ id: "l1" }), log({ id: "l2" }), log({ id: "l3" })];
    const s = summarizeMissionLogs(logs);
    expect(s.total).toBe(3);
  });

  it("most recent log is returned as last", () => {
    const older = log({ id: "l1", created_at: "2026-05-01T00:00:00Z", event_type: "old_event" });
    const newer = log({ id: "l2", created_at: "2026-05-13T00:00:00Z", event_type: "new_event" });
    const s = summarizeMissionLogs([older, newer]);
    expect(s.last_event_type).toBe("new_event");
    expect(s.last_at).toBe("2026-05-13T00:00:00Z");
  });

  it("log with null event_type → last_event_type is null", () => {
    const s = summarizeMissionLogs([log({ event_type: null })]);
    expect(s.last_event_type).toBeNull();
  });

  it("log schema uses event_type (new schema, not level/event)", () => {
    const s = summarizeMissionLogs([log({ event_type: "mission_continue_plan_generated" })]);
    expect(s.last_event_type).toBe("mission_continue_plan_generated");
  });
});

// ── summarizeMissionDocuments (v10.5) ─────────────────────

describe("summarizeMissionDocuments", () => {
  function doc(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      id: "doc-001",
      mission_id: "mission-001",
      title: "Contrat de travail",
      doc_type: "contract",
      created_at: PAST,
      ...overrides,
    };
  }

  it("empty array → all nulls and total=0", () => {
    const s = summarizeMissionDocuments([]);
    expect(s.total).toBe(0);
    expect(s.last_title).toBeNull();
    expect(s.last_type).toBeNull();
    expect(s.last_at).toBeNull();
  });

  it("single doc → total=1, fields populated", () => {
    const s = summarizeMissionDocuments([doc()]);
    expect(s.total).toBe(1);
    expect(s.last_title).toBe("Contrat de travail");
    expect(s.last_type).toBe("contract");
    expect(s.last_at).toBe(PAST);
  });

  it("multiple docs → total is count", () => {
    const docs = [doc({ id: "d1" }), doc({ id: "d2" }), doc({ id: "d3" })];
    const s = summarizeMissionDocuments(docs);
    expect(s.total).toBe(3);
  });

  it("most recent document is returned as last", () => {
    const older = doc({ id: "d1", created_at: "2026-05-01T00:00:00Z", title: "Old Doc" });
    const newer = doc({ id: "d2", created_at: "2026-05-13T00:00:00Z", title: "New Doc" });
    const s = summarizeMissionDocuments([older, newer]);
    expect(s.last_title).toBe("New Doc");
  });

  it("uses doc_type field for last_type", () => {
    const s = summarizeMissionDocuments([doc({ doc_type: "letter" })]);
    expect(s.last_type).toBe("letter");
  });

  it("falls back to type field when doc_type missing", () => {
    const s = summarizeMissionDocuments([doc({ doc_type: null, type: "pdf" })]);
    expect(s.last_type).toBe("pdf");
  });
});

// ── buildMissionContinuityDigest (v10.5) ──────────────────

describe("buildMissionContinuityDigest", () => {
  const emptyInsight: PierreMissionContinuityInsight = {
    mission_id: "m1",
    continuity_state: "active",
    progress_pct: 0,
    health_score: 80,
    total_count: 2,
    done_count: 0,
    runnable_count: 2,
    pending_approval_count: 0,
    blocked_count: 0,
    error_count: 0,
    scheduled_count: 0,
    has_missing_info: false,
    is_stalled: false,
    stalled_since: null,
    recommended_next_action: { type: "run_tasks", label: "...", task_ids: ["t1"] },
    safe_task_ids: ["t1"],
    tasks: [],
  };

  function makeSection(key: string, count: number): PierreContinuitySection {
    return { key: key as PierreContinuitySection["key"], label: key, task_ids: Array.from({ length: count }, (_, i) => `t${i}`), count };
  }

  it("progress_pct=100 → tone=complete", () => {
    const i = { ...emptyInsight, progress_pct: 100 };
    const d = buildMissionContinuityDigest(i, []);
    expect(d.tone).toBe("complete");
    expect(d.text).toContain("complète");
  });

  it("safe_to_run section present → tone=action", () => {
    const sections = [makeSection("safe_to_run", 2)];
    const d = buildMissionContinuityDigest(emptyInsight, sections);
    expect(d.tone).toBe("action");
  });

  it("only awaiting_approval → tone=waiting", () => {
    const sections = [makeSection("awaiting_approval", 1)];
    const d = buildMissionContinuityDigest({ ...emptyInsight, runnable_count: 0 }, sections);
    expect(d.tone).toBe("waiting");
  });

  it("only blocked tasks → tone=blocked", () => {
    const sections = [makeSection("blocked", 1)];
    const d = buildMissionContinuityDigest({ ...emptyInsight, runnable_count: 0 }, sections);
    expect(d.tone).toBe("blocked");
  });

  it("only failed tasks → tone=blocked", () => {
    const sections = [makeSection("failed", 1)];
    const d = buildMissionContinuityDigest({ ...emptyInsight, runnable_count: 0 }, sections);
    expect(d.tone).toBe("blocked");
  });

  it("no action sections → tone=neutral", () => {
    const d = buildMissionContinuityDigest({ ...emptyInsight, runnable_count: 0 }, []);
    expect(d.tone).toBe("neutral");
  });

  it("digest text includes progress percentage", () => {
    const i = { ...emptyInsight, progress_pct: 33 };
    const d = buildMissionContinuityDigest(i, []);
    expect(d.text).toContain("33%");
  });

  it("stalled insight → text mentions intervention", () => {
    const i = { ...emptyInsight, is_stalled: true };
    const d = buildMissionContinuityDigest(i, []);
    expect(d.text).toContain("3 jours");
  });

  it("due_now count in text", () => {
    const sections = [makeSection("due_now", 3)];
    const d = buildMissionContinuityDigest(emptyInsight, sections);
    expect(d.text).toContain("3");
  });

  it("overdue count in text", () => {
    const sections = [makeSection("overdue", 2)];
    const d = buildMissionContinuityDigest(emptyInsight, sections);
    expect(d.text).toContain("2");
  });
});

// ── buildDashboardSections (v10.5) ────────────────────────

describe("buildDashboardSections", () => {
  it("no missions → all 8 sections empty", () => {
    const sections = buildDashboardSections([], {}, NOW);
    expect(sections).toHaveLength(8);
    expect(sections.every((s) => s.count === 0)).toBe(true);
  });

  it("single mission with safe task → safe_to_run section has task", () => {
    const missions = [mission({ id: "m1" })];
    const tasksByMissionId = { "m1": [task({ id: "t1", type: "doc.generate", status: "ready" })] };
    const sections = buildDashboardSections(missions, tasksByMissionId, NOW);
    const safe = sections.find((s) => s.key === "safe_to_run");
    expect(safe?.task_ids).toContain("t1");
  });

  it("multiple missions → tasks aggregated across missions", () => {
    const missions = [mission({ id: "m1" }), mission({ id: "m2" })];
    const tasksByMissionId = {
      "m1": [task({ id: "t1", type: "doc.generate", status: "ready" })],
      "m2": [task({ id: "t2", type: "reminder.create", status: "ready" })],
    };
    const sections = buildDashboardSections(missions, tasksByMissionId, NOW);
    const safe = sections.find((s) => s.key === "safe_to_run");
    expect(safe?.task_ids).toContain("t1");
    expect(safe?.task_ids).toContain("t2");
    expect(safe?.count).toBe(2);
  });

  it("always returns all 8 sections", () => {
    const sections = buildDashboardSections([], {}, NOW);
    expect(sections).toHaveLength(8);
  });

  it("awaiting_approval task from one mission appears in global section", () => {
    const missions = [mission({ id: "m1" })];
    const tasksByMissionId = { "m1": [task({ id: "t1", status: "ready", approval_required: true })] };
    const sections = buildDashboardSections(missions, tasksByMissionId, NOW);
    const ap = sections.find((s) => s.key === "awaiting_approval");
    expect(ap?.task_ids).toContain("t1");
  });

  it("blocked task appears in blocked section", () => {
    const missions = [mission({ id: "m1" })];
    const tasksByMissionId = { "m1": [task({ id: "t1", status: "blocked" })] };
    const sections = buildDashboardSections(missions, tasksByMissionId, NOW);
    const b = sections.find((s) => s.key === "blocked");
    expect(b?.task_ids).toContain("t1");
  });
});

// ── buildFollowupTaskDraftsForContinue (v10.5) ────────────

describe("buildFollowupTaskDraftsForContinue", () => {
  const emptyPlan = {
    mission_id: "mission-001",
    actions: [],
    safe_to_run: [],
    requires_human: [],
    blocked: [],
    summary: "Aucune action.",
  };

  it("no blocked, no requires_human → empty array", () => {
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", emptyPlan);
    expect(drafts).toHaveLength(0);
  });

  it("blocked tasks → creates reminder.create task", () => {
    const plan = { ...emptyPlan, blocked: ["t1", "t2"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("reminder.create");
  });

  it("requires_human tasks → creates followup.schedule task", () => {
    const plan = { ...emptyPlan, requires_human: ["t1"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("followup.schedule");
  });

  it("both blocked and requires_human → creates 2 tasks", () => {
    const plan = { ...emptyPlan, blocked: ["t1"], requires_human: ["t2"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    expect(drafts).toHaveLength(2);
  });

  it("reminder draft has source=continuity_continue in payload", () => {
    const plan = { ...emptyPlan, blocked: ["t1"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload.source).toBe("continuity_continue");
  });

  it("followup draft has source=continuity_continue in payload", () => {
    const plan = { ...emptyPlan, requires_human: ["t1"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload.source).toBe("continuity_continue");
  });

  it("reminder draft has status=ready and approval_required=false", () => {
    const plan = { ...emptyPlan, blocked: ["t1"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-001", plan);
    expect(drafts[0].status).toBe("ready");
    expect(drafts[0].approval_required).toBe(false);
  });

  it("followup draft has mission_id set correctly", () => {
    const plan = { ...emptyPlan, requires_human: ["t1"] };
    const drafts = buildFollowupTaskDraftsForContinue("mission-abc", plan);
    expect(drafts[0].mission_id).toBe("mission-abc");
  });
});

// ── buildMissionContinuityInsight enrichment (v10.5) ──────

describe("buildMissionContinuityInsight v10.5 enrichment", () => {
  it("insight always includes sections field", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.sections).toBeDefined();
    expect(Array.isArray(i.sections)).toBe(true);
  });

  it("insight sections has 8 entries", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.sections).toHaveLength(8);
  });

  it("insight always includes digest field", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.digest).toBeDefined();
    expect(typeof i.digest?.text).toBe("string");
    expect(i.digest?.tone).toBeDefined();
  });

  it("insight with logs includes log_summary", () => {
    const logs = [
      { id: "l1", task_id: "t1", mission_id: "m1", event_type: "task_completed", message: "Done", created_at: PAST },
    ];
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW, logs });
    expect(i.log_summary).toBeDefined();
    expect(i.log_summary?.total).toBe(1);
    expect(i.log_summary?.last_event_type).toBe("task_completed");
  });

  it("insight with documents includes document_summary", () => {
    const documents = [
      { id: "d1", mission_id: "m1", title: "Contrat", doc_type: "contract", created_at: PAST },
    ];
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW, documents });
    expect(i.document_summary).toBeDefined();
    expect(i.document_summary?.total).toBe(1);
    expect(i.document_summary?.last_title).toBe("Contrat");
  });

  it("insight without logs has no log_summary", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.log_summary).toBeUndefined();
  });

  it("insight without documents has no document_summary", () => {
    const i = buildMissionContinuityInsight(mission(), [], { now: NOW });
    expect(i.document_summary).toBeUndefined();
  });
});
