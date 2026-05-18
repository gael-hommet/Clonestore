import { describe, it, expect } from "vitest";
import {
  buildPierreAuditLogRow,
  buildGovernanceAuditLogRow,
  buildExecutionAuditLogRow,
  buildHumanRequiredLogRow,
  type PierreLogRow,
} from "../logs";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
  buildAuditTrailTimeline,
  buildAuditTrailSections,
  filterAuditTrailEvents,
  type PierreAuditTrailEvent,
} from "../hr/audit-trail";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function hasNoForbiddenFields(row: PierreLogRow): boolean {
  const keys = Object.keys(row.meta_json);
  return !keys.includes("level") && !keys.includes("event") && !keys.includes("payload");
}

function hasRequiredLogFields(row: PierreLogRow): boolean {
  return (
    typeof row.event_type === "string" &&
    row.event_type.length > 0 &&
    typeof row.message === "string" &&
    row.message.length > 0 &&
    typeof row.meta_json === "object" &&
    row.meta_json !== null &&
    !Array.isArray(row.meta_json)
  );
}

// ═══════════════════════════════════════════════════════════
// 1. buildPierreAuditLogRow
// ═══════════════════════════════════════════════════════════

describe("buildPierreAuditLogRow — schema", () => {
  it("returns a row with agent_slug='pierre'", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(row.agent_slug).toBe("pierre");
  });

  it("returns user_id as provided", () => {
    const row = buildPierreAuditLogRow({ user_id: "user-abc", event_type: "task_created", message: "Test" });
    expect(row.user_id).toBe("user-abc");
  });

  it("returns event_type as provided", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "governance_evaluation", message: "Test" });
    expect(row.event_type).toBe("governance_evaluation");
  });

  it("returns message as provided", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Ma mission" });
    expect(row.message).toBe("Ma mission");
  });

  it("defaults mission_id to null", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(row.mission_id).toBeNull();
  });

  it("defaults task_id to null", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(row.task_id).toBeNull();
  });

  it("accepts mission_id", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test", mission_id: "m1" });
    expect(row.mission_id).toBe("m1");
  });

  it("accepts task_id", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test", task_id: "t1" });
    expect(row.task_id).toBe("t1");
  });

  it("defaults meta_json to empty object", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(row.meta_json).toEqual({});
  });

  it("propagates meta into meta_json", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test", meta: { foo: "bar" } });
    expect(row.meta_json).toEqual({ foo: "bar" });
  });

  it("has no forbidden fields (level/event/payload)", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test", meta: { info: "ok" } });
    expect(hasNoForbiddenFields(row)).toBe(true);
  });

  it("has all required fields", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(hasRequiredLogFields(row)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. buildGovernanceAuditLogRow
// ═══════════════════════════════════════════════════════════

describe("buildGovernanceAuditLogRow — blocked decision", () => {
  it("uses event_type='governance_execution_blocked' when decision=block", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "block" });
    expect(row.event_type).toBe("governance_execution_blocked");
  });

  it("uses event_type='governance_execution_blocked' when decision=refuse", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "refuse" });
    expect(row.event_type).toBe("governance_execution_blocked");
  });

  it("message contains 'bloquée' when decision=block", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "block" });
    expect(row.message.toLowerCase()).toContain("bloqu");
  });

  it("message contains decision value", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "refuse" });
    expect(row.message).toContain("refuse");
  });

  it("meta_json.governance_decision equals 'block'", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "block" });
    expect(row.meta_json.governance_decision).toBe("block");
  });

  it("meta_json.allowed_to_auto_execute defaults to false", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "block" });
    expect(row.meta_json.allowed_to_auto_execute).toBe(false);
  });
});

describe("buildGovernanceAuditLogRow — allowed decision", () => {
  it("uses event_type='governance_evaluation' when decision=allow", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow" });
    expect(row.event_type).toBe("governance_evaluation");
  });

  it("meta_json contains guard_decision", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow", guard_decision: "pass" });
    expect(row.meta_json.guard_decision).toBe("pass");
  });

  it("meta_json contains policy_decision", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow", policy_decision: "pass" });
    expect(row.meta_json.policy_decision).toBe("pass");
  });

  it("meta_json contains trust_decision", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow", trust_decision: "trusted" });
    expect(row.meta_json.trust_decision).toBe("trusted");
  });

  it("meta_json contains risk_level", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow", risk_level: "orange" });
    expect(row.meta_json.risk_level).toBe("orange");
  });

  it("meta_json.allowed_to_auto_execute=true when explicitly set", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow", allowed_to_auto_execute: true });
    expect(row.meta_json.allowed_to_auto_execute).toBe(true);
  });

  it("has no forbidden fields", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow" });
    expect(hasNoForbiddenFields(row)).toBe(true);
  });

  it("has all required fields", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow" });
    expect(hasRequiredLogFields(row)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. buildExecutionAuditLogRow
// ═══════════════════════════════════════════════════════════

describe("buildExecutionAuditLogRow — completed", () => {
  it("event_type='task_execution_completed' on outcome=completed", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed" });
    expect(row.event_type).toBe("task_execution_completed");
  });

  it("message mentions task_title when provided", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", task_title: "Rédiger contrat", outcome: "completed" });
    expect(row.message).toContain("Rédiger contrat");
  });

  it("message falls back to task_id when no task_title", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "task-42", outcome: "completed" });
    expect(row.message).toContain("task-42");
  });

  it("meta_json.outcome='completed'", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed" });
    expect(row.meta_json.outcome).toBe("completed");
  });

  it("meta_json.artifact_kind when provided", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed", artifact_kind: "pdf" });
    expect(row.meta_json.artifact_kind).toBe("pdf");
  });

  it("meta_json.quality_score when provided", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed", quality_score: 87 });
    expect(row.meta_json.quality_score).toBe(87);
  });

  it("no error fields on success", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed" });
    expect(row.meta_json.error_code).toBeUndefined();
    expect(row.meta_json.error_message).toBeUndefined();
  });

  it("has no forbidden fields", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed" });
    expect(hasNoForbiddenFields(row)).toBe(true);
  });
});

describe("buildExecutionAuditLogRow — failed", () => {
  it("event_type='task_execution_failed' on outcome=failed", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed" });
    expect(row.event_type).toBe("task_execution_failed");
  });

  it("message contains error_message when provided", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed", error_message: "Timeout" });
    expect(row.message).toContain("Timeout");
  });

  it("meta_json.error_code present on failure", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed", error_code: "ERR_TIMEOUT" });
    expect(row.meta_json.error_code).toBe("ERR_TIMEOUT");
  });

  it("meta_json.error_message present on failure", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed", error_message: "Timeout" });
    expect(row.meta_json.error_message).toBe("Timeout");
  });

  it("meta_json.outcome='failed'", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed" });
    expect(row.meta_json.outcome).toBe("failed");
  });

  it("has all required fields", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed" });
    expect(hasRequiredLogFields(row)).toBe(true);
  });

  it("task_id stored in row", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "task-99", outcome: "failed" });
    expect(row.task_id).toBe("task-99");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. buildHumanRequiredLogRow
// ═══════════════════════════════════════════════════════════

describe("buildHumanRequiredLogRow", () => {
  it("event_type='human_action_required'", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "approval needed" });
    expect(row.event_type).toBe("human_action_required");
  });

  it("message contains reason", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "Risque élevé" });
    expect(row.message).toContain("Risque élevé");
  });

  it("meta_json.requires_human=true always", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(row.meta_json.requires_human).toBe(true);
  });

  it("meta_json.reason matches reason param", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "approval" });
    expect(row.meta_json.reason).toBe("approval");
  });

  it("meta_json.governance_decision when provided", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test", governance_decision: "require_approval" });
    expect(row.meta_json.governance_decision).toBe("require_approval");
  });

  it("meta_json.risk_level when provided", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test", risk_level: "red" });
    expect(row.meta_json.risk_level).toBe("red");
  });

  it("agent_slug='pierre'", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(row.agent_slug).toBe("pierre");
  });

  it("accepts optional task_id", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test", task_id: "t42" });
    expect(row.task_id).toBe("t42");
  });

  it("accepts optional mission_id", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test", mission_id: "m1" });
    expect(row.mission_id).toBe("m1");
  });

  it("has no forbidden fields", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(hasNoForbiddenFields(row)).toBe(true);
  });

  it("has all required fields", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(hasRequiredLogFields(row)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Schema invariants — all builders
// ═══════════════════════════════════════════════════════════

describe("Schema invariants — no level/event/payload in any builder", () => {
  it("buildPierreAuditLogRow: no 'level' key", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(Object.keys(row.meta_json)).not.toContain("level");
  });

  it("buildPierreAuditLogRow: no 'event' key", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(Object.keys(row.meta_json)).not.toContain("event");
  });

  it("buildPierreAuditLogRow: no 'payload' key", () => {
    const row = buildPierreAuditLogRow({ user_id: "u1", event_type: "task_created", message: "Test" });
    expect(Object.keys(row.meta_json)).not.toContain("payload");
  });

  it("buildGovernanceAuditLogRow: no 'level' key", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow" });
    expect(Object.keys(row.meta_json)).not.toContain("level");
  });

  it("buildGovernanceAuditLogRow: no 'event' key", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "allow" });
    expect(Object.keys(row.meta_json)).not.toContain("event");
  });

  it("buildGovernanceAuditLogRow: no 'payload' key", () => {
    const row = buildGovernanceAuditLogRow({ user_id: "u1", governance_decision: "block" });
    expect(Object.keys(row.meta_json)).not.toContain("payload");
  });

  it("buildExecutionAuditLogRow: no 'level' key", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "completed" });
    expect(Object.keys(row.meta_json)).not.toContain("level");
  });

  it("buildExecutionAuditLogRow: no 'event' key", () => {
    const row = buildExecutionAuditLogRow({ user_id: "u1", task_id: "t1", outcome: "failed" });
    expect(Object.keys(row.meta_json)).not.toContain("event");
  });

  it("buildHumanRequiredLogRow: no 'level' key", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(Object.keys(row.meta_json)).not.toContain("level");
  });

  it("buildHumanRequiredLogRow: no 'payload' key", () => {
    const row = buildHumanRequiredLogRow({ user_id: "u1", reason: "test" });
    expect(Object.keys(row.meta_json)).not.toContain("payload");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Security invariants — audit trail events
// ═══════════════════════════════════════════════════════════

describe("Security invariants — email.send task requires_human", () => {
  it("task with type=email.send produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "email.send", title: "Envoyer email", status: "pending" }],
    });
    const emailTask = events.find((e) => e.task_id === "t1");
    expect(emailTask).toBeDefined();
    expect(emailTask?.requires_human).toBe(true);
  });

  it("task with type=send_email produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t2", type: "send_email", title: "Email employé", status: "pending" }],
    });
    const emailTask = events.find((e) => e.task_id === "t2");
    expect(emailTask?.requires_human).toBe(true);
  });

  it("task with approval_required=true produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t3", type: "contract_draft", title: "Contrat", status: "awaiting_approval", approval_required: true }],
    });
    const task = events.find((e) => e.task_id === "t3");
    expect(task?.requires_human).toBe(true);
  });

  it("task with approval_required=true is never auto-executable", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t4", type: "contract_draft", title: "Contrat", status: "awaiting_approval", approval_required: true }],
    });
    const task = events.find((e) => e.task_id === "t4");
    expect(task?.allowed_to_auto_execute).not.toBe(true);
  });

  it("task with risk_level=red produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t5", type: "contract_sign", title: "Signature", status: "pending", risk_level: "red" }],
    });
    const task = events.find((e) => e.task_id === "t5");
    expect(task?.requires_human).toBe(true);
  });

  it("task with risk_level=black produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t6", type: "layoff", title: "Licenciement", status: "pending", risk_level: "black" }],
    });
    const task = events.find((e) => e.task_id === "t6");
    expect(task?.requires_human).toBe(true);
  });

  it("mission with approval_required=true produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      missions: [{ id: "m1", status: "pending", approval_required: true, mission_summary: "Test" }],
    });
    const mission = events.find((e) => e.mission_id === "m1" && e.source === "mission");
    expect(mission?.requires_human).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. buildAuditTrailEvents — scope and resilience
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailEvents — mission scope", () => {
  it("returns events for each mission", () => {
    const events = buildAuditTrailEvents({
      missions: [
        { id: "m1", status: "active", mission_summary: "Mission A" },
        { id: "m2", status: "done", mission_summary: "Mission B" },
      ],
    });
    const missionEvents = events.filter((e) => e.source === "mission");
    expect(missionEvents.length).toBe(2);
  });

  it("mission event has source='mission'", () => {
    const events = buildAuditTrailEvents({
      missions: [{ id: "m1", status: "active", mission_summary: "Test" }],
    });
    expect(events[0].source).toBe("mission");
  });

  it("mission event has correct mission_id", () => {
    const events = buildAuditTrailEvents({
      missions: [{ id: "m-123", status: "active", mission_summary: "Test" }],
    });
    expect(events[0].mission_id).toBe("m-123");
  });
});

describe("buildAuditTrailEvents — task scope", () => {
  it("returns events for each task", () => {
    const events = buildAuditTrailEvents({
      tasks: [
        { id: "t1", type: "contract_draft", title: "Tâche 1", status: "pending" },
        { id: "t2", type: "meeting_prep", title: "Tâche 2", status: "done" },
      ],
    });
    const taskEvents = events.filter((e) => e.source === "task");
    expect(taskEvents.length).toBe(2);
  });

  it("completed task has status='completed'", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "contract_draft", title: "Tâche", status: "done" }],
    });
    const t = events.find((e) => e.task_id === "t1");
    expect(t?.status).toBe("completed");
  });

  it("failed task has event_type='task_failed'", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "contract_draft", title: "Tâche", status: "failed" }],
    });
    const t = events.find((e) => e.task_id === "t1");
    expect(t?.event_type).toBe("task_failed");
  });
});

describe("buildAuditTrailEvents — log scope", () => {
  it("includes events from logs", () => {
    const events = buildAuditTrailEvents({
      logs: [{ id: "l1", event_type: "task_execution_completed", message: "OK", meta_json: {}, created_at: "2026-01-01T00:00:00Z" }],
    });
    const logEvents = events.filter((e) => e.source === "log");
    expect(logEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("human_action_required log produces requires_human=true", () => {
    const events = buildAuditTrailEvents({
      logs: [{ id: "l1", event_type: "human_action_required", message: "Action requise", meta_json: { requires_human: true }, created_at: "2026-01-01T00:00:00Z" }],
    });
    const logEvt = events.find((e) => e.source === "log");
    expect(logEvt?.requires_human).toBe(true);
  });
});

describe("buildAuditTrailEvents — resilience to malformed data", () => {
  it("does not crash on empty params", () => {
    expect(() => buildAuditTrailEvents({})).not.toThrow();
  });

  it("does not crash on null params", () => {
    expect(() => buildAuditTrailEvents({ missions: null, tasks: null, documents: null, logs: null })).not.toThrow();
  });

  it("does not crash on malformed mission row", () => {
    expect(() => buildAuditTrailEvents({ missions: [null as unknown as Record<string, unknown>] })).not.toThrow();
  });

  it("does not crash on malformed task row", () => {
    expect(() => buildAuditTrailEvents({ tasks: [{ id: null, type: 42, status: {} } as unknown as Record<string, unknown>] })).not.toThrow();
  });

  it("does not crash on malformed log row with no meta_json", () => {
    expect(() => buildAuditTrailEvents({ logs: [{ id: "l1", event_type: "task_created", message: "Test" }] })).not.toThrow();
  });

  it("returns array on empty input", () => {
    const events = buildAuditTrailEvents({});
    expect(Array.isArray(events)).toBe(true);
  });

  it("skips rows with missing id gracefully", () => {
    const events = buildAuditTrailEvents({ tasks: [{ type: "contract_draft", title: "No ID", status: "pending" }] });
    expect(Array.isArray(events)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Audit summary shape — diagnostics / health / digest
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailDiagnostics — shape", () => {
  it("returns total_events count", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", type: "contract_draft", title: "T", status: "pending" }] });
    const diag = buildAuditTrailDiagnostics(events);
    expect(typeof diag.total_events).toBe("number");
    expect(diag.total_events).toBeGreaterThan(0);
  });

  it("critical_count is a number", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(typeof diag.critical_count).toBe("number");
  });

  it("human_required_count is a number", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(typeof diag.human_required_count).toBe("number");
  });

  it("governance_block_count is a number", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(typeof diag.governance_block_count).toBe("number");
  });

  it("auto_allowed_count is a number", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(typeof diag.auto_allowed_count).toBe("number");
  });

  it("latest_event_at is null for empty events", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(diag.latest_event_at).toBeNull();
  });

  it("human_required_count increments for requires_human events", () => {
    const events = buildAuditTrailEvents({
      tasks: [
        { id: "t1", type: "email.send", title: "Email", status: "pending" },
        { id: "t2", type: "meeting_prep", title: "Meeting", status: "pending" },
      ],
    });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.human_required_count).toBeGreaterThanOrEqual(1);
  });
});

describe("scoreAuditTrailHealth — shape", () => {
  it("returns a score between 0 and 100", () => {
    const events = buildAuditTrailEvents({});
    const health = scoreAuditTrailHealth(events);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it("returns a label string", () => {
    const health = scoreAuditTrailHealth([]);
    expect(typeof health.label).toBe("string");
    expect(health.label.length).toBeGreaterThan(0);
  });

  it("perfect score on empty events", () => {
    const health = scoreAuditTrailHealth([]);
    expect(health.score).toBe(100);
  });

  it("score decreases with critical events", () => {
    const criticalEvents: PierreAuditTrailEvent[] = [
      {
        id: "e1", source: "task", source_id: "t1", event_type: "task_failed",
        title: "T", message: "T", created_at: null,
        mission_id: null, task_id: "t1", employee_id: null, employee_name: null,
        risk_level: "black", severity: "critical", status: "failed",
        requires_human: true, allowed_to_auto_execute: null,
        governance_decision: "refuse", cloneguard_decision: null,
        clonepolicy_decision: null, clonetrust_decision: null, raw: {},
      },
    ];
    const health = scoreAuditTrailHealth(criticalEvents);
    expect(health.score).toBeLessThan(100);
  });
});

describe("buildAuditTrailDigest — shape", () => {
  it("tone='ok' for empty events", () => {
    const digest = buildAuditTrailDigest([]);
    expect(digest.tone).toBe("ok");
  });

  it("text is a non-empty string", () => {
    const digest = buildAuditTrailDigest([]);
    expect(typeof digest.text).toBe("string");
    expect(digest.text.length).toBeGreaterThan(0);
  });

  it("tone is one of ok/attention/blocked/critical", () => {
    const digest = buildAuditTrailDigest([]);
    expect(["ok", "attention", "blocked", "critical"]).toContain(digest.tone);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. buildAuditTrailAlerts
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailAlerts", () => {
  it("returns array for empty events", () => {
    const alerts = buildAuditTrailAlerts([]);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it("each alert has level field", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "email.send", title: "Email", status: "pending" }],
    });
    const alerts = buildAuditTrailAlerts(events);
    for (const a of alerts) {
      expect(["info", "warning", "urgent", "critical"]).toContain(a.level);
    }
  });

  it("each alert has title and message", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "email.send", title: "Email", status: "pending" }],
    });
    const alerts = buildAuditTrailAlerts(events);
    for (const a of alerts) {
      expect(typeof a.title).toBe("string");
      expect(typeof a.message).toBe("string");
    }
  });

  it("generates alerts for critical severity events", () => {
    const critEvents: PierreAuditTrailEvent[] = [
      {
        id: "e1", source: "task", source_id: "t1", event_type: "task_blocked",
        title: "Blocked task", message: "Blocked", created_at: null,
        mission_id: "m1", task_id: "t1", employee_id: null, employee_name: null,
        risk_level: "black", severity: "critical", status: "blocked",
        requires_human: true, allowed_to_auto_execute: null,
        governance_decision: "refuse", cloneguard_decision: "refuse",
        clonepolicy_decision: null, clonetrust_decision: null, raw: {},
      },
    ];
    const alerts = buildAuditTrailAlerts(critEvents);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("alert has id field", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "email.send", title: "Email", status: "pending" }],
    });
    const alerts = buildAuditTrailAlerts(events);
    for (const a of alerts) {
      expect(typeof a.id).toBe("string");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 10. buildAuditTrailTimeline — combined output shape
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailTimeline — combined shape", () => {
  it("returns events array", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", type: "meeting_prep", title: "Meeting", status: "pending" }] });
    const timeline = buildAuditTrailTimeline(events);
    expect(Array.isArray(timeline.events)).toBe(true);
  });

  it("returns sections array", () => {
    const events = buildAuditTrailEvents({});
    const timeline = buildAuditTrailTimeline(events);
    expect(Array.isArray(timeline.sections)).toBe(true);
  });

  it("diagnostics is present in timeline", () => {
    const events = buildAuditTrailEvents({});
    const timeline = buildAuditTrailTimeline(events);
    expect(timeline.diagnostics).toBeDefined();
    expect(typeof timeline.diagnostics.total_events).toBe("number");
  });

  it("health is present in timeline", () => {
    const events = buildAuditTrailEvents({});
    const timeline = buildAuditTrailTimeline(events);
    expect(timeline.health).toBeDefined();
    expect(typeof timeline.health.score).toBe("number");
  });

  it("digest is present in timeline", () => {
    const events = buildAuditTrailEvents({});
    const timeline = buildAuditTrailTimeline(events);
    expect(timeline.digest).toBeDefined();
    expect(["ok", "attention", "blocked", "critical"]).toContain(timeline.digest.tone);
  });
});

// ═══════════════════════════════════════════════════════════
// 11. filterAuditTrailEvents
// ═══════════════════════════════════════════════════════════

describe("filterAuditTrailEvents — scoped filtering", () => {
  const allEvents = buildAuditTrailEvents({
    missions: [{ id: "m1", status: "active", mission_summary: "Mission A" }],
    tasks: [
      { id: "t1", mission_id: "m1", type: "contract_draft", title: "T1", status: "pending" },
      { id: "t2", mission_id: "m2", type: "meeting_prep", title: "T2", status: "done" },
    ],
  });

  it("filters by mission_id", () => {
    const filtered = filterAuditTrailEvents(allEvents, { mission_id: "m1" });
    for (const e of filtered) {
      expect(e.mission_id).toBe("m1");
    }
  });

  it("filters by task_id", () => {
    const filtered = filterAuditTrailEvents(allEvents, { task_id: "t1" });
    for (const e of filtered) {
      expect(e.task_id).toBe("t1");
    }
  });

  it("filters by requires_human=true", () => {
    const events = buildAuditTrailEvents({
      tasks: [
        { id: "t1", type: "email.send", title: "Email", status: "pending" },
        { id: "t2", type: "meeting_prep", title: "Meeting", status: "done" },
      ],
    });
    const filtered = filterAuditTrailEvents(events, { requires_human: true });
    expect(filtered.every((e) => e.requires_human)).toBe(true);
  });

  it("returns all events when no filter applied", () => {
    const filtered = filterAuditTrailEvents(allEvents, {});
    expect(filtered.length).toBe(allEvents.length);
  });

  it("respects limit", () => {
    const events = buildAuditTrailEvents({
      tasks: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, type: "meeting_prep", title: `T${i}`, status: "pending" })),
    });
    const filtered = filterAuditTrailEvents(events, { limit: 3 });
    expect(filtered.length).toBeLessThanOrEqual(3);
  });
});
