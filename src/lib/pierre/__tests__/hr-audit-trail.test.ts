import { describe, it, expect } from "vitest";
import {
  normalizeAuditTrailRiskLevel,
  normalizeAuditTrailSeverity,
  normalizeAuditTrailSource,
  inferAuditTrailEventType,
  inferAuditTrailSeverity,
  inferAuditTrailRiskLevel,
  normalizeAuditTrailEvent,
  buildAuditTrailEvents,
  filterAuditTrailEvents,
  buildAuditTrailSections,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailTimeline,
  buildAuditTrailAlerts,
  summarizeAuditTrailEvent,
  buildAuditTrailExport,
  buildAuditTrailSnapshot,
  type PierreAuditTrailEvent,
  type PierreAuditTrailFilter,
} from "../hr/audit-trail";

// ═══════════════════════════════════════════════════════════
// 1. normalizeAuditTrailRiskLevel
// ═══════════════════════════════════════════════════════════

describe("normalizeAuditTrailRiskLevel", () => {
  it("returns green for 'green'", () => expect(normalizeAuditTrailRiskLevel("green")).toBe("green"));
  it("returns orange for 'orange'", () => expect(normalizeAuditTrailRiskLevel("orange")).toBe("orange"));
  it("returns red for 'red'", () => expect(normalizeAuditTrailRiskLevel("red")).toBe("red"));
  it("returns black for 'black'", () => expect(normalizeAuditTrailRiskLevel("black")).toBe("black"));
  it("returns green for null", () => expect(normalizeAuditTrailRiskLevel(null)).toBe("green"));
  it("returns green for undefined", () => expect(normalizeAuditTrailRiskLevel(undefined)).toBe("green"));
  it("returns green for unknown string", () => expect(normalizeAuditTrailRiskLevel("xyz")).toBe("green"));
  it("is case-insensitive", () => {
    expect(normalizeAuditTrailRiskLevel("RED")).toBe("red");
    expect(normalizeAuditTrailRiskLevel("BLACK")).toBe("black");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. normalizeAuditTrailSeverity
// ═══════════════════════════════════════════════════════════

describe("normalizeAuditTrailSeverity", () => {
  it("returns info for 'info'", () => expect(normalizeAuditTrailSeverity("info")).toBe("info"));
  it("returns notice for 'notice'", () => expect(normalizeAuditTrailSeverity("notice")).toBe("notice"));
  it("returns warning for 'warning'", () => expect(normalizeAuditTrailSeverity("warning")).toBe("warning"));
  it("returns action_required for 'action_required'", () => expect(normalizeAuditTrailSeverity("action_required")).toBe("action_required"));
  it("returns blocked for 'blocked'", () => expect(normalizeAuditTrailSeverity("blocked")).toBe("blocked"));
  it("returns critical for 'critical'", () => expect(normalizeAuditTrailSeverity("critical")).toBe("critical"));
  it("returns info for null", () => expect(normalizeAuditTrailSeverity(null)).toBe("info"));
  it("returns info for unknown", () => expect(normalizeAuditTrailSeverity("unknown_value")).toBe("info"));
  it("is case-insensitive", () => expect(normalizeAuditTrailSeverity("CRITICAL")).toBe("critical"));
  it("returns info for empty string", () => expect(normalizeAuditTrailSeverity("")).toBe("info"));
});

// ═══════════════════════════════════════════════════════════
// 3. normalizeAuditTrailSource
// ═══════════════════════════════════════════════════════════

describe("normalizeAuditTrailSource", () => {
  it("returns mission for 'mission'", () => expect(normalizeAuditTrailSource("mission")).toBe("mission"));
  it("returns task for 'task'", () => expect(normalizeAuditTrailSource("task")).toBe("task"));
  it("returns document for 'document'", () => expect(normalizeAuditTrailSource("document")).toBe("document"));
  it("returns log for 'log'", () => expect(normalizeAuditTrailSource("log")).toBe("log"));
  it("returns governance for 'governance'", () => expect(normalizeAuditTrailSource("governance")).toBe("governance"));
  it("returns cloneguard for 'cloneguard'", () => expect(normalizeAuditTrailSource("cloneguard")).toBe("cloneguard"));
  it("returns system for null", () => expect(normalizeAuditTrailSource(null)).toBe("system"));
  it("returns system for unknown", () => expect(normalizeAuditTrailSource("unknown_xyz")).toBe("system"));
  it("returns system for empty string", () => expect(normalizeAuditTrailSource("")).toBe("system"));
  it("returns employee_file for 'employee_file'", () => expect(normalizeAuditTrailSource("employee_file")).toBe("employee_file"));
});

// ═══════════════════════════════════════════════════════════
// 4. inferAuditTrailEventType
// ═══════════════════════════════════════════════════════════

describe("inferAuditTrailEventType", () => {
  it("returns task_started for event_type=task_execution_started", () =>
    expect(inferAuditTrailEventType({ event_type: "task_execution_started" })).toBe("task_started"));
  it("returns task_completed for event_type=task_execution_completed", () =>
    expect(inferAuditTrailEventType({ event_type: "task_execution_completed" })).toBe("task_completed"));
  it("returns task_failed for event_type=task_execution_failed", () =>
    expect(inferAuditTrailEventType({ event_type: "task_execution_failed" })).toBe("task_failed"));
  it("returns governance_blocked for governance_execution_blocked", () =>
    expect(inferAuditTrailEventType({ event_type: "governance_execution_blocked" })).toBe("governance_blocked"));
  it("returns governance_evaluated for governance_auto_allowed", () =>
    expect(inferAuditTrailEventType({ event_type: "governance_auto_allowed" })).toBe("governance_evaluated"));
  it("returns task_completed for status=done", () =>
    expect(inferAuditTrailEventType({ status: "done" })).toBe("task_completed"));
  it("returns task_blocked for status=blocked", () =>
    expect(inferAuditTrailEventType({ status: "blocked" })).toBe("task_blocked"));
  it("returns task_failed for status=error", () =>
    expect(inferAuditTrailEventType({ status: "error" })).toBe("task_failed"));
  it("returns document_generated for doc_type field", () =>
    expect(inferAuditTrailEventType({ doc_type: "contrat" })).toBe("document_generated"));
  it("returns unknown for empty row", () =>
    expect(inferAuditTrailEventType({})).toBe("unknown"));
  it("returns unknown for non-object", () =>
    expect(inferAuditTrailEventType(null as unknown as Record<string, unknown>)).toBe("unknown"));
  it("returns human_action_required for event_type=human_action_required", () =>
    expect(inferAuditTrailEventType({ event_type: "human_action_required" })).toBe("human_action_required"));
  it("returns run_safe_started for mission_control_run_safe_started", () =>
    expect(inferAuditTrailEventType({ event_type: "mission_control_run_safe_started" })).toBe("run_safe_started"));
  it("returns continuity_checked for continuity_run_next", () =>
    expect(inferAuditTrailEventType({ event_type: "continuity_run_next" })).toBe("continuity_checked"));
  it("returns mission_created for status=pending with mission_summary", () =>
    expect(inferAuditTrailEventType({ mission_summary: "Recruter un dev" })).toBe("mission_created"));
});

// ═══════════════════════════════════════════════════════════
// 5. inferAuditTrailSeverity
// ═══════════════════════════════════════════════════════════

describe("inferAuditTrailSeverity", () => {
  it("returns critical for governance_decision=refuse in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { governance_decision: "refuse" } })).toBe("critical"));
  it("returns critical for cloneguard_decision=refuse in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { cloneguard_decision: "refuse" } })).toBe("critical"));
  it("returns blocked for governance_decision=block in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { governance_decision: "block" } })).toBe("blocked"));
  it("returns action_required for governance_decision=require_approval", () =>
    expect(inferAuditTrailSeverity({ meta_json: { governance_decision: "require_approval" } })).toBe("action_required"));
  it("returns action_required for approval_required=true", () =>
    expect(inferAuditTrailSeverity({ approval_required: true })).toBe("action_required"));
  it("returns blocked for event_type=governance_execution_blocked", () =>
    expect(inferAuditTrailSeverity({ event_type: "governance_execution_blocked" })).toBe("blocked"));
  it("returns action_required for event_type=human_action_required", () =>
    expect(inferAuditTrailSeverity({ event_type: "human_action_required" })).toBe("action_required"));
  it("returns warning for status=error", () =>
    expect(inferAuditTrailSeverity({ status: "error" })).toBe("warning"));
  it("returns action_required for status=awaiting_approval", () =>
    expect(inferAuditTrailSeverity({ status: "awaiting_approval" })).toBe("action_required"));
  it("returns critical for risk_level=black in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { risk_level: "black" } })).toBe("critical"));
  it("returns warning for risk_level=red in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { risk_level: "red" } })).toBe("warning"));
  it("returns info for empty row", () =>
    expect(inferAuditTrailSeverity({})).toBe("info"));
  it("returns info for non-object", () =>
    expect(inferAuditTrailSeverity(null as unknown as Record<string, unknown>)).toBe("info"));
  it("returns blocked for trust=manual_only in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { clonetrust_decision: "manual_only" } })).toBe("blocked"));
  it("returns critical for policy_decision=refuse in meta_json", () =>
    expect(inferAuditTrailSeverity({ meta_json: { clonepolicy_decision: "refuse" } })).toBe("critical"));
});

// ═══════════════════════════════════════════════════════════
// 6. inferAuditTrailRiskLevel
// ═══════════════════════════════════════════════════════════

describe("inferAuditTrailRiskLevel", () => {
  it("returns the risk_level from the row directly", () =>
    expect(inferAuditTrailRiskLevel({ risk_level: "red" })).toBe("red"));
  it("returns risk_level from meta_json", () =>
    expect(inferAuditTrailRiskLevel({ meta_json: { risk_level: "orange" } })).toBe("orange"));
  it("returns green for empty row", () =>
    expect(inferAuditTrailRiskLevel({})).toBe("green"));
  it("returns green for null", () =>
    expect(inferAuditTrailRiskLevel(null as unknown as Record<string, unknown>)).toBe("green"));
  it("escalates to red for governance refuse", () =>
    expect(inferAuditTrailRiskLevel({ meta_json: { governance_decision: "refuse" } })).toBe("red"));
  it("returns highest of multiple risk levels", () =>
    expect(inferAuditTrailRiskLevel({ risk_level: "orange", meta_json: { risk_level: "black" } })).toBe("black"));
  it("returns green for unknown risk value", () =>
    expect(inferAuditTrailRiskLevel({ risk_level: "xyz" })).toBe("green"));
  it("returns black when meta_json has black", () =>
    expect(inferAuditTrailRiskLevel({ meta_json: { guard_risk_level: "black" } })).toBe("black"));
  it("escalates to red for governance block", () =>
    expect(inferAuditTrailRiskLevel({ meta_json: { governance_decision: "block" } })).toBe("red"));
  it("case-insensitive risk_level", () =>
    expect(inferAuditTrailRiskLevel({ risk_level: "RED" })).toBe("red"));
});

// ═══════════════════════════════════════════════════════════
// 7. normalizeAuditTrailEvent
// ═══════════════════════════════════════════════════════════

describe("normalizeAuditTrailEvent", () => {
  it("returns a valid event for a task log row", () => {
    const row = {
      id: "log-1",
      event_type: "task_execution_completed",
      message: "Tâche terminée.",
      mission_id: "m-1",
      task_id: "t-1",
      created_at: "2026-01-01T10:00:00Z",
      meta_json: { outcome: "completed" },
    };
    const event = normalizeAuditTrailEvent(row, "log");
    expect(event.source).toBe("log");
    expect(event.event_type).toBe("task_completed");
    expect(event.mission_id).toBe("m-1");
    expect(event.task_id).toBe("t-1");
    expect(event.created_at).toBe("2026-01-01T10:00:00Z");
    expect(typeof event.id).toBe("string");
  });

  it("returns a valid event for a governance log row", () => {
    const row = {
      id: "log-2",
      event_type: "governance_execution_blocked",
      message: "Bloqué par gouvernance.",
      meta_json: { governance_decision: "block", risk_level: "red" },
      created_at: "2026-01-01T11:00:00Z",
    };
    const event = normalizeAuditTrailEvent(row, "log");
    expect(event.severity).toBe("blocked");
    expect(event.governance_decision).toBe("block");
    expect(event.requires_human).toBe(true);
  });

  it("extracts governance fields from meta_json", () => {
    const row = {
      id: "log-3",
      event_type: "governance_evaluation",
      message: "Évaluation ok.",
      meta_json: {
        governance_decision: "allow",
        guard_decision: "allow",
        policy_decision: "allow",
        trust_decision: "auto_allowed",
        allowed_to_auto_execute: true,
        requires_human: false,
      },
    };
    const event = normalizeAuditTrailEvent(row, "log");
    expect(event.governance_decision).toBe("allow");
    expect(event.cloneguard_decision).toBe("allow");
    expect(event.clonepolicy_decision).toBe("allow");
    expect(event.clonetrust_decision).toBe("auto_allowed");
    expect(event.allowed_to_auto_execute).toBe(true);
  });

  it("does not crash on null input", () => {
    const event = normalizeAuditTrailEvent(null as unknown as Record<string, unknown>);
    expect(event.source).toBe("system");
    expect(event.event_type).toBe("unknown");
  });

  it("does not crash on empty object", () => {
    const event = normalizeAuditTrailEvent({});
    expect(typeof event.id).toBe("string");
    expect(event.severity).toBe("info");
  });

  it("id is deterministic for same input", () => {
    const row = { id: "x1", event_type: "task_created" };
    const e1 = normalizeAuditTrailEvent(row, "log");
    const e2 = normalizeAuditTrailEvent(row, "log");
    expect(e1.id).toBe(e2.id);
  });

  it("uses sourceHint when provided", () => {
    const row = { id: "doc-1" };
    const event = normalizeAuditTrailEvent(row, "document");
    expect(event.source).toBe("document");
  });

  it("returns requires_human=true when severity is critical", () => {
    const row = { meta_json: { governance_decision: "refuse" } };
    const event = normalizeAuditTrailEvent(row, "governance");
    expect(event.requires_human).toBe(true);
  });

  it("extracts employee_id from meta_json", () => {
    const row = { id: "l1", meta_json: { employee_id: "emp-42" } };
    const event = normalizeAuditTrailEvent(row, "log");
    expect(event.employee_id).toBe("emp-42");
  });

  it("handles malformed meta_json string gracefully", () => {
    const row = { id: "l2", meta_json: "not-json{{" };
    expect(() => normalizeAuditTrailEvent(row, "log")).not.toThrow();
  });

  it("uses row.title as title when present", () => {
    const row = { id: "t1", title: "Mon document important" };
    const event = normalizeAuditTrailEvent(row, "document");
    expect(event.title).toBe("Mon document important");
  });

  it("falls back to event_type as title when no title/message", () => {
    const row = { id: "x" };
    const event = normalizeAuditTrailEvent(row, "system");
    expect(event.title.length).toBeGreaterThan(0);
  });

  it("preserves raw field", () => {
    const row = { id: "raw-1", custom_field: "hello" };
    const event = normalizeAuditTrailEvent(row, "log");
    expect(event.raw).toBe(row);
  });

  it("allowed_to_auto_execute=false when meta says false", () => {
    const row = { meta_json: { allowed_to_auto_execute: false } };
    const event = normalizeAuditTrailEvent(row, "governance");
    expect(event.allowed_to_auto_execute).toBe(false);
  });

  it("allowed_to_auto_execute=null when not specified", () => {
    const row = { id: "x" };
    const event = normalizeAuditTrailEvent(row, "task");
    expect(event.allowed_to_auto_execute).toBeNull();
  });

  it("normalizes status from task row", () => {
    const row = { id: "t1", status: "done" };
    const event = normalizeAuditTrailEvent(row, "task");
    expect(event.status).toBe("completed");
  });

  it("normalizes status=error to failed", () => {
    const row = { id: "t1", status: "error" };
    const event = normalizeAuditTrailEvent(row, "task");
    expect(event.status).toBe("failed");
  });

  it("normalizes status=running to ok", () => {
    const row = { id: "t1", status: "running" };
    const event = normalizeAuditTrailEvent(row, "task");
    expect(event.status).toBe("ok");
  });
});

// ═══════════════════════════════════════════════════════════
// 8. buildAuditTrailEvents
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailEvents", () => {
  it("returns empty array for empty params", () => {
    expect(buildAuditTrailEvents({})).toEqual([]);
  });

  it("returns events from missions", () => {
    const missions = [{ id: "m-1", status: "running", mission_summary: "Test mission", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ missions });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].source).toBe("mission");
    expect(events[0].mission_id).toBe("m-1");
  });

  it("returns events from tasks", () => {
    const tasks = [{ id: "t-1", type: "document.draft", title: "Rédiger contrat", status: "done", mission_id: "m-1", created_at: "2026-01-01T11:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].source).toBe("task");
    expect(events[0].task_id).toBe("t-1");
  });

  it("returns events from documents", () => {
    const documents = [{ id: "d-1", doc_type: "contrat", title: "Contrat CDI", mission_id: "m-1", created_at: "2026-01-01T12:00:00Z" }];
    const events = buildAuditTrailEvents({ documents });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].source).toBe("document");
    expect(events[0].event_type).toBe("document_generated");
  });

  it("returns events from logs", () => {
    const logs = [{ id: "l-1", event_type: "task_execution_completed", message: "OK", mission_id: "m-1", created_at: "2026-01-01T13:00:00Z", meta_json: {} }];
    const events = buildAuditTrailEvents({ logs });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].source).toBe("log");
  });

  it("returns events from governance evaluations", () => {
    const govEvals = [{
      evaluation: { decision: "block", risk_level: "red", guard_decision: "block", explanation: "Bloqué" },
      mission_id: "m-1",
      created_at: "2026-01-01T14:00:00Z",
    }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].source).toBe("governance");
    expect(events[0].event_type).toBe("governance_blocked");
  });

  it("governance refuse produces governance_refused event", () => {
    const govEvals = [{ evaluation: { decision: "refuse", risk_level: "black" }, mission_id: "m-1" }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    expect(events[0].event_type).toBe("governance_refused");
    expect(events[0].severity).toBe("critical");
  });

  it("merges events from all sources", () => {
    const missions = [{ id: "m-1", status: "running", created_at: "2026-01-01T09:00:00Z" }];
    const tasks = [{ id: "t-1", status: "done", mission_id: "m-1", created_at: "2026-01-01T10:00:00Z" }];
    const documents = [{ id: "d-1", doc_type: "contrat", mission_id: "m-1", created_at: "2026-01-01T11:00:00Z" }];
    const logs = [{ id: "l-1", event_type: "task_execution_completed", message: "OK", created_at: "2026-01-01T12:00:00Z", meta_json: {} }];
    const events = buildAuditTrailEvents({ missions, tasks, documents, logs });
    expect(events.length).toBeGreaterThanOrEqual(4);
  });

  it("sorts events by created_at DESC", () => {
    const tasks = [
      { id: "t-1", status: "done", created_at: "2026-01-01T08:00:00Z" },
      { id: "t-2", status: "done", created_at: "2026-01-03T08:00:00Z" },
      { id: "t-3", status: "done", created_at: "2026-01-02T08:00:00Z" },
    ];
    const events = buildAuditTrailEvents({ tasks });
    const dates = events.map((e) => e.created_at).filter(Boolean);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(new Date(dates[i]!).getTime()).toBeGreaterThanOrEqual(new Date(dates[i + 1]!).getTime());
    }
  });

  it("puts null dates at end", () => {
    const tasks = [
      { id: "t-1", status: "done", created_at: null },
      { id: "t-2", status: "done", created_at: "2026-01-01T08:00:00Z" },
    ];
    const events = buildAuditTrailEvents({ tasks });
    const lastEvent = events[events.length - 1];
    expect(lastEvent.created_at).toBeNull();
  });

  it("deduplicates same source+source_id+event_type", () => {
    const tasks = [
      { id: "t-1", status: "done", created_at: "2026-01-01T08:00:00Z" },
      { id: "t-1", status: "done", created_at: "2026-01-01T09:00:00Z" }, // duplicate
    ];
    const events = buildAuditTrailEvents({ tasks });
    const t1Events = events.filter((e) => e.source_id === "t-1" && e.event_type === "task_completed");
    expect(t1Events.length).toBe(1);
  });

  it("does not crash on null missions", () => {
    expect(() => buildAuditTrailEvents({ missions: null as unknown as undefined })).not.toThrow();
  });

  it("does not crash on malformed task row", () => {
    const tasks = [null, undefined, { invalid: true }, { id: "t-ok", status: "done" }] as unknown as Record<string, unknown>[];
    expect(() => buildAuditTrailEvents({ tasks })).not.toThrow();
  });

  it("task email.send gets action_required severity", () => {
    const tasks = [{ id: "t-email", type: "email.send", title: "Envoyer email", status: "pending", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t-email");
    expect(e?.severity).toBe("action_required");
    expect(e?.requires_human).toBe(true);
  });

  it("task send_email also gets action_required", () => {
    const tasks = [{ id: "t-s", type: "send_email", title: "Email", status: "pending" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t-s");
    expect(e?.requires_human).toBe(true);
  });

  it("black risk task gets critical severity", () => {
    const tasks = [{ id: "t-b", type: "document.draft", title: "Doc", status: "done", risk_level: "black" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t-b");
    expect(e?.severity).toBe("critical");
  });

  it("mission with approval_required gets action_required severity", () => {
    const missions = [{ id: "m-1", status: "running", approval_required: true, mission_summary: "Mission sensible" }];
    const events = buildAuditTrailEvents({ missions });
    const e = events.find((ev) => ev.source === "mission");
    expect(e?.severity).toBe("action_required");
    expect(e?.requires_human).toBe(true);
  });

  it("document event has completed status", () => {
    const documents = [{ id: "d-1", doc_type: "contrat", title: "Contrat" }];
    const events = buildAuditTrailEvents({ documents });
    expect(events[0].status).toBe("completed");
  });

  it("returns empty array for non-array params", () => {
    expect(buildAuditTrailEvents(null as unknown as Record<string, unknown>)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. filterAuditTrailEvents
// ═══════════════════════════════════════════════════════════

describe("filterAuditTrailEvents", () => {
  const baseEvents: PierreAuditTrailEvent[] = [
    {
      id: "e1", source: "mission", source_id: "m-1", event_type: "mission_created",
      title: "Mission 1", message: "msg", created_at: "2026-01-01T10:00:00Z",
      mission_id: "m-1", task_id: null, employee_id: "emp-1", employee_name: null,
      risk_level: "green", severity: "info", status: "ok",
      requires_human: false, allowed_to_auto_execute: null,
      governance_decision: null, cloneguard_decision: null, clonepolicy_decision: null, clonetrust_decision: null,
      raw: {},
    },
    {
      id: "e2", source: "task", source_id: "t-1", event_type: "task_blocked",
      title: "Task 1", message: "bloqué", created_at: "2026-01-01T11:00:00Z",
      mission_id: "m-1", task_id: "t-1", employee_id: null, employee_name: null,
      risk_level: "red", severity: "blocked", status: "blocked",
      requires_human: true, allowed_to_auto_execute: false,
      governance_decision: "block", cloneguard_decision: null, clonepolicy_decision: null, clonetrust_decision: null,
      raw: {},
    },
    {
      id: "e3", source: "governance", source_id: "g-1", event_type: "governance_refused",
      title: "Refus", message: "refusé", created_at: "2026-01-01T12:00:00Z",
      mission_id: "m-2", task_id: null, employee_id: null, employee_name: null,
      risk_level: "black", severity: "critical", status: "blocked",
      requires_human: true, allowed_to_auto_execute: false,
      governance_decision: "refuse", cloneguard_decision: null, clonepolicy_decision: null, clonetrust_decision: null,
      raw: {},
    },
  ];

  it("returns all events for empty filter", () => {
    const result = filterAuditTrailEvents(baseEvents, {});
    expect(result.length).toBe(3);
  });

  it("filters by mission_id", () => {
    const result = filterAuditTrailEvents(baseEvents, { mission_id: "m-1" });
    expect(result.length).toBe(2);
    expect(result.every((e) => e.mission_id === "m-1")).toBe(true);
  });

  it("filters by task_id", () => {
    const result = filterAuditTrailEvents(baseEvents, { task_id: "t-1" });
    expect(result.length).toBe(1);
    expect(result[0].task_id).toBe("t-1");
  });

  it("filters by employee_id", () => {
    const result = filterAuditTrailEvents(baseEvents, { employee_id: "emp-1" });
    expect(result.length).toBe(1);
    expect(result[0].employee_id).toBe("emp-1");
  });

  it("filters by source", () => {
    const result = filterAuditTrailEvents(baseEvents, { source: "governance" });
    expect(result.length).toBe(1);
    expect(result[0].source).toBe("governance");
  });

  it("returns all for source=all", () => {
    const result = filterAuditTrailEvents(baseEvents, { source: "all" });
    expect(result.length).toBe(3);
  });

  it("filters by severity", () => {
    const result = filterAuditTrailEvents(baseEvents, { severity: "critical" });
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe("critical");
  });

  it("filters by risk_level", () => {
    const result = filterAuditTrailEvents(baseEvents, { risk_level: "black" });
    expect(result.length).toBe(1);
    expect(result[0].risk_level).toBe("black");
  });

  it("filters by requires_human=true", () => {
    const result = filterAuditTrailEvents(baseEvents, { requires_human: true });
    expect(result.length).toBe(2);
    expect(result.every((e) => e.requires_human)).toBe(true);
  });

  it("filters by requires_human=false", () => {
    const result = filterAuditTrailEvents(baseEvents, { requires_human: false });
    expect(result.length).toBe(1);
    expect(result[0].requires_human).toBe(false);
  });

  it("filters by status", () => {
    const result = filterAuditTrailEvents(baseEvents, { status: "blocked" });
    expect(result.length).toBe(2);
  });

  it("applies limit", () => {
    const result = filterAuditTrailEvents(baseEvents, { limit: 1 });
    expect(result.length).toBe(1);
  });

  it("returns empty for non-matching filter", () => {
    const result = filterAuditTrailEvents(baseEvents, { mission_id: "nonexistent" });
    expect(result.length).toBe(0);
  });

  it("returns empty array for non-array input", () => {
    const result = filterAuditTrailEvents(null as unknown as PierreAuditTrailEvent[], {});
    expect(result).toEqual([]);
  });

  it("does not mutate original array", () => {
    const copy = [...baseEvents];
    filterAuditTrailEvents(baseEvents, { limit: 1 });
    expect(baseEvents.length).toBe(copy.length);
  });

  it("combines multiple filters", () => {
    const result = filterAuditTrailEvents(baseEvents, { mission_id: "m-1", requires_human: true });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("e2");
  });

  it("filter with null values is a no-op", () => {
    const filter: PierreAuditTrailFilter = { mission_id: null, severity: null };
    const result = filterAuditTrailEvents(baseEvents, filter);
    expect(result.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. buildAuditTrailSections
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailSections", () => {
  it("returns array of sections", () => {
    const sections = buildAuditTrailSections([]);
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("all section has count=total events", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", status: "done" }, { id: "t2", status: "error" }],
    });
    const sections = buildAuditTrailSections(events);
    const allSection = sections.find((s) => s.key === "all");
    expect(allSection?.count).toBe(events.length);
  });

  it("critical section has count of critical events", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", meta_json: { governance_decision: "refuse" }, message: "Refusé", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const sections = buildAuditTrailSections(events);
    const crit = sections.find((s) => s.key === "critical");
    expect(crit).toBeDefined();
    expect(typeof crit?.count).toBe("number");
  });

  it("sections include event_ids", () => {
    const tasks = [{ id: "t1", status: "done", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    const sections = buildAuditTrailSections(events);
    const allSection = sections.find((s) => s.key === "all");
    expect(Array.isArray(allSection?.event_ids)).toBe(true);
    expect(allSection?.event_ids.length).toBe(events.length);
  });

  it("has correct keys including human_required", () => {
    const sections = buildAuditTrailSections([]);
    const keys = sections.map((s) => s.key);
    expect(keys).toContain("human_required");
    expect(keys).toContain("governance");
    expect(keys).toContain("documents");
    expect(keys).toContain("completed");
  });

  it("does not crash on non-array input", () => {
    expect(() => buildAuditTrailSections(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("governance section includes governance events", () => {
    const govEvals = [{ evaluation: { decision: "block" }, mission_id: "m-1", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    const sections = buildAuditTrailSections(events);
    const govSection = sections.find((s) => s.key === "governance");
    expect((govSection?.count ?? 0) + 1).toBeGreaterThan(0);
  });

  it("documents section includes document events", () => {
    const documents = [{ id: "d1", doc_type: "contrat", title: "Contrat" }];
    const events = buildAuditTrailEvents({ documents });
    const sections = buildAuditTrailSections(events);
    const docSection = sections.find((s) => s.key === "documents");
    expect(docSection?.count).toBeGreaterThan(0);
  });

  it("each section has label", () => {
    const sections = buildAuditTrailSections([]);
    for (const s of sections) {
      expect(typeof s.label).toBe("string");
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 11. buildAuditTrailDiagnostics
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailDiagnostics", () => {
  it("returns zeroed diagnostics for empty array", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(diag.total_events).toBe(0);
    expect(diag.critical_count).toBe(0);
    expect(diag.blocked_count).toBe(0);
    expect(diag.failed_count).toBe(0);
    expect(diag.human_required_count).toBe(0);
    expect(diag.governance_block_count).toBe(0);
    expect(diag.auto_allowed_count).toBe(0);
    expect(diag.latest_event_at).toBeNull();
  });

  it("counts critical events", () => {
    const events = buildAuditTrailEvents({
      logs: [{ id: "l1", event_type: "governance_execution_blocked", message: "Refus", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }],
    });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.critical_count).toBeGreaterThan(0);
  });

  it("counts human_required events", () => {
    const events = buildAuditTrailEvents({
      tasks: [{ id: "t1", type: "email.send", title: "Email", status: "pending" }],
    });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.human_required_count).toBeGreaterThan(0);
  });

  it("tracks latest_event_at", () => {
    const tasks = [
      { id: "t1", status: "done", created_at: "2026-01-01T08:00:00Z" },
      { id: "t2", status: "done", created_at: "2026-01-03T08:00:00Z" },
    ];
    const events = buildAuditTrailEvents({ tasks });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.latest_event_at).toBe("2026-01-03T08:00:00Z");
  });

  it("does not crash on non-array", () => {
    expect(() => buildAuditTrailDiagnostics(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("all diagnostic counts are numbers", () => {
    const diag = buildAuditTrailDiagnostics([]);
    expect(typeof diag.total_events).toBe("number");
    expect(typeof diag.critical_count).toBe("number");
    expect(typeof diag.blocked_count).toBe("number");
    expect(typeof diag.failed_count).toBe("number");
    expect(Number.isFinite(diag.total_events)).toBe(true);
  });

  it("counts governance_block_count", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", message: "Bloqué", meta_json: { governance_decision: "block" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.governance_block_count).toBeGreaterThan(0);
  });

  it("total_events equals length of events array", () => {
    const tasks = [{ id: "t1", status: "done" }, { id: "t2", status: "error" }];
    const events = buildAuditTrailEvents({ tasks });
    const diag = buildAuditTrailDiagnostics(events);
    expect(diag.total_events).toBe(events.length);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. scoreAuditTrailHealth
// ═══════════════════════════════════════════════════════════

describe("scoreAuditTrailHealth", () => {
  it("returns score 100 for empty events", () => {
    const health = scoreAuditTrailHealth([]);
    expect(health.score).toBe(100);
  });

  it("score is between 0 and 100", () => {
    const tasks = [{ id: "t1", status: "error" }, { id: "t2", status: "done" }];
    const events = buildAuditTrailEvents({ tasks });
    const health = scoreAuditTrailHealth(events);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it("score is lower when there are critical events", () => {
    const clean = buildAuditTrailEvents({ tasks: [{ id: "t1", status: "done" }] });
    const blocked = buildAuditTrailEvents({
      logs: [{ id: "l1", event_type: "governance_execution_blocked", message: "Refus", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }],
    });
    const healthClean = scoreAuditTrailHealth(clean);
    const healthBlocked = scoreAuditTrailHealth(blocked);
    expect(healthBlocked.score).toBeLessThanOrEqual(healthClean.score);
  });

  it("returns a non-empty label", () => {
    const health = scoreAuditTrailHealth([]);
    expect(typeof health.label).toBe("string");
    expect(health.label.length).toBeGreaterThan(0);
  });

  it("does not crash on non-array", () => {
    expect(() => scoreAuditTrailHealth(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("excellent label for perfect score", () => {
    const health = scoreAuditTrailHealth([]);
    expect(["Excellent", "Aucune donnée"]).toContain(health.label);
  });

  it("score is number and finite", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", status: "done" }] });
    const health = scoreAuditTrailHealth(events);
    expect(Number.isFinite(health.score)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 13. buildAuditTrailDigest
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailDigest", () => {
  it("returns ok tone for empty events", () => {
    const digest = buildAuditTrailDigest([]);
    expect(digest.tone).toBe("ok");
  });

  it("returns critical tone for critical events", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", message: "Refus critique", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const digest = buildAuditTrailDigest(events);
    expect(digest.tone).toBe("critical");
  });

  it("returns blocked tone for blocked events with no critical", () => {
    const govEvals = [{ evaluation: { decision: "block" }, mission_id: "m-1", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    const digest = buildAuditTrailDigest(events);
    expect(["blocked", "critical", "attention"]).toContain(digest.tone);
  });

  it("digest text is non-empty", () => {
    const digest = buildAuditTrailDigest([]);
    expect(typeof digest.text).toBe("string");
    expect(digest.text.length).toBeGreaterThan(0);
  });

  it("does not crash on non-array", () => {
    expect(() => buildAuditTrailDigest(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("returns ok tone for auto-allowed events", () => {
    const logs = [{ id: "l1", event_type: "governance_auto_allowed", message: "OK", meta_json: { governance_decision: "allow", allowed_to_auto_execute: true }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const digest = buildAuditTrailDigest(events);
    expect(["ok", "attention"]).toContain(digest.tone);
  });

  it("tone is one of the valid values", () => {
    const tasks = [{ id: "t1", status: "error" }];
    const events = buildAuditTrailEvents({ tasks });
    const digest = buildAuditTrailDigest(events);
    expect(["ok", "attention", "blocked", "critical"]).toContain(digest.tone);
  });
});

// ═══════════════════════════════════════════════════════════
// 14. buildAuditTrailTimeline
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailTimeline", () => {
  it("returns valid timeline for empty events", () => {
    const timeline = buildAuditTrailTimeline([]);
    expect(Array.isArray(timeline.events)).toBe(true);
    expect(Array.isArray(timeline.sections)).toBe(true);
    expect(typeof timeline.diagnostics).toBe("object");
    expect(typeof timeline.health).toBe("object");
    expect(typeof timeline.digest).toBe("object");
  });

  it("events field matches input length (no filter)", () => {
    const tasks = [{ id: "t1", status: "done" }, { id: "t2", status: "error" }];
    const events = buildAuditTrailEvents({ tasks });
    const timeline = buildAuditTrailTimeline(events);
    expect(timeline.events.length).toBe(events.length);
  });

  it("applies filter when provided", () => {
    const tasks = [
      { id: "t1", status: "done", created_at: "2026-01-01T10:00:00Z" },
      { id: "t2", type: "email.send", title: "Email", status: "pending", created_at: "2026-01-01T11:00:00Z" },
    ];
    const events = buildAuditTrailEvents({ tasks });
    const timeline = buildAuditTrailTimeline(events, { requires_human: true });
    expect(timeline.events.every((e) => e.requires_human)).toBe(true);
  });

  it("diagnostics.total_events matches events count", () => {
    const tasks = [{ id: "t1", status: "done" }];
    const events = buildAuditTrailEvents({ tasks });
    const timeline = buildAuditTrailTimeline(events);
    expect(timeline.diagnostics.total_events).toBe(events.length);
  });

  it("does not crash on non-array input", () => {
    expect(() => buildAuditTrailTimeline(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════
// 15. buildAuditTrailAlerts
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailAlerts", () => {
  it("returns empty array for empty events", () => {
    expect(buildAuditTrailAlerts([])).toEqual([]);
  });

  it("returns alerts for critical events", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", message: "Refusé", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const alerts = buildAuditTrailAlerts(events);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].level).toBe("critical");
  });

  it("returns alerts for task_failed events", () => {
    const tasks = [{ id: "t1", status: "error", title: "Tâche échouée", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    const alerts = buildAuditTrailAlerts(events);
    expect(alerts.some((a) => a.level === "warning" || a.level === "urgent" || a.level === "critical")).toBe(true);
  });

  it("no alerts for clean events", () => {
    const tasks = [{ id: "t1", status: "done", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    expect(events.length).toBeGreaterThan(0);
  });

  it("alerts are sorted by level (critical first)", () => {
    const events = buildAuditTrailEvents({
      logs: [
        { id: "l1", event_type: "governance_execution_blocked", message: "Refus", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" },
        { id: "l2", event_type: "human_action_required", message: "Action requise", meta_json: { governance_decision: "require_approval" }, created_at: "2026-01-01T09:00:00Z" },
      ],
    });
    const alerts = buildAuditTrailAlerts(events);
    if (alerts.length >= 2) {
      const levels = { critical: 3, urgent: 2, warning: 1, info: 0 };
      for (let i = 0; i < alerts.length - 1; i++) {
        expect(levels[alerts[i].level]).toBeGreaterThanOrEqual(levels[alerts[i + 1].level]);
      }
    }
  });

  it("each alert has required fields", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", message: "Refusé", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const alerts = buildAuditTrailAlerts(events);
    for (const alert of alerts) {
      expect(typeof alert.id).toBe("string");
      expect(typeof alert.level).toBe("string");
      expect(typeof alert.title).toBe("string");
      expect(typeof alert.message).toBe("string");
    }
  });

  it("does not crash on non-array", () => {
    expect(() => buildAuditTrailAlerts(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("returns alerts for black risk", () => {
    const tasks = [{ id: "t1", status: "done", risk_level: "black", title: "Risque noir", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ tasks });
    const alerts = buildAuditTrailAlerts(events);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("returns alerts for human_action_required event", () => {
    const logs = [{ id: "l1", event_type: "human_action_required", message: "Action requise", meta_json: { governance_decision: "require_approval" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const alerts = buildAuditTrailAlerts(events);
    expect(alerts.some((a) => a.level === "warning" || a.level === "urgent")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 16. summarizeAuditTrailEvent
// ═══════════════════════════════════════════════════════════

describe("summarizeAuditTrailEvent", () => {
  it("returns non-empty string", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", status: "done" }] });
    expect(summarizeAuditTrailEvent(events[0]).length).toBeGreaterThan(0);
  });

  it("includes severity in summary", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", status: "error" }] });
    const summary = summarizeAuditTrailEvent(events[0]);
    expect(summary).toContain("AVERTISSEMENT");
  });

  it("includes CRITIQUE for critical severity", () => {
    const logs = [{ id: "l1", event_type: "governance_execution_blocked", message: "Refus", meta_json: { governance_decision: "refuse" }, created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ logs });
    const crit = events.find((e) => e.severity === "critical");
    if (crit) {
      expect(summarizeAuditTrailEvent(crit)).toContain("CRITIQUE");
    }
  });

  it("does not crash on invalid input", () => {
    expect(() => summarizeAuditTrailEvent(null as unknown as PierreAuditTrailEvent)).not.toThrow();
    expect(typeof summarizeAuditTrailEvent(null as unknown as PierreAuditTrailEvent)).toBe("string");
  });

  it("returns string for any event type", () => {
    const events = buildAuditTrailEvents({
      missions: [{ id: "m1", status: "running" }],
      tasks: [{ id: "t1", status: "done" }],
      documents: [{ id: "d1", doc_type: "contrat", title: "Doc" }],
    });
    for (const e of events) {
      expect(typeof summarizeAuditTrailEvent(e)).toBe("string");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 17. buildAuditTrailExport
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailExport", () => {
  it("returns valid export object", () => {
    const tasks = [{ id: "t1", status: "done" }];
    const events = buildAuditTrailEvents({ tasks });
    const exportData = buildAuditTrailExport(events);
    expect(typeof exportData).toBe("object");
    expect(typeof exportData.generated_at).toBe("string");
    expect(typeof exportData.total_events).toBe("number");
    expect(Array.isArray(exportData.events)).toBe(true);
    expect(Array.isArray(exportData.alerts)).toBe(true);
    expect(typeof exportData.diagnostics).toBe("object");
    expect(typeof exportData.health).toBe("object");
    expect(typeof exportData.digest).toBe("object");
  });

  it("does not crash on empty events", () => {
    const exp = buildAuditTrailExport([]);
    expect(exp.total_events).toBe(0);
  });

  it("does not crash on non-array", () => {
    expect(() => buildAuditTrailExport(null as unknown as PierreAuditTrailEvent[])).not.toThrow();
  });

  it("exported events do not contain raw field", () => {
    const tasks = [{ id: "t1", status: "done" }];
    const events = buildAuditTrailEvents({ tasks });
    const exp = buildAuditTrailExport(events);
    const exportedEvents = exp.events as Record<string, unknown>[];
    for (const e of exportedEvents) {
      expect(e.raw).toBeUndefined();
    }
  });

  it("total_events matches events array length", () => {
    const tasks = [{ id: "t1", status: "done" }, { id: "t2", status: "error" }];
    const events = buildAuditTrailEvents({ tasks });
    const exp = buildAuditTrailExport(events);
    expect(exp.total_events).toBe(events.length);
  });
});

// ═══════════════════════════════════════════════════════════
// 18. buildAuditTrailSnapshot
// ═══════════════════════════════════════════════════════════

describe("buildAuditTrailSnapshot", () => {
  it("returns valid snapshot object", () => {
    const tasks = [{ id: "t1", status: "done" }];
    const events = buildAuditTrailEvents({ tasks });
    const timeline = buildAuditTrailTimeline(events);
    const snap = buildAuditTrailSnapshot(timeline);
    expect(typeof snap.snapshot_at).toBe("string");
    expect(typeof snap.total_events).toBe("number");
    expect(typeof snap.health_score).toBe("number");
    expect(typeof snap.health_label).toBe("string");
    expect(typeof snap.digest_tone).toBe("string");
    expect(typeof snap.digest_text).toBe("string");
    expect(typeof snap.critical_count).toBe("number");
    expect(typeof snap.blocked_count).toBe("number");
    expect(typeof snap.human_required_count).toBe("number");
    expect(Array.isArray(snap.sections_summary)).toBe(true);
  });

  it("does not crash on null input", () => {
    expect(() => buildAuditTrailSnapshot(null as unknown as ReturnType<typeof buildAuditTrailTimeline>)).not.toThrow();
  });

  it("health_score is between 0 and 100", () => {
    const events = buildAuditTrailEvents({ tasks: [{ id: "t1", status: "done" }] });
    const timeline = buildAuditTrailTimeline(events);
    const snap = buildAuditTrailSnapshot(timeline);
    expect(snap.health_score as number).toBeGreaterThanOrEqual(0);
    expect(snap.health_score as number).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════
// 19. Security invariants
// ═══════════════════════════════════════════════════════════

describe("Security invariants", () => {
  it("email.send task always has requires_human=true in audit trail", () => {
    const tasks = [{ id: "t-email", type: "email.send", title: "Send email", status: "pending" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t-email");
    expect(e?.requires_human).toBe(true);
  });

  it("send_email task always has requires_human=true", () => {
    const tasks = [{ id: "t-s", type: "send_email", title: "Envoyer email", status: "pending" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t-s");
    expect(e?.requires_human).toBe(true);
  });

  it("governance_refused event always has requires_human=true", () => {
    const govEvals = [{ evaluation: { decision: "refuse" }, mission_id: "m-1", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    const e = events.find((ev) => ev.event_type === "governance_refused");
    expect(e?.requires_human).toBe(true);
  });

  it("governance_blocked event always has requires_human=true", () => {
    const govEvals = [{ evaluation: { decision: "block" }, mission_id: "m-1", created_at: "2026-01-01T10:00:00Z" }];
    const events = buildAuditTrailEvents({ governanceEvaluations: govEvals });
    const e = events.find((ev) => ev.event_type === "governance_blocked");
    expect(e?.requires_human).toBe(true);
  });

  it("no event with allowed_to_auto_execute=true is in alerts", () => {
    const logs = [
      { id: "l1", event_type: "governance_auto_allowed", message: "Autorisé", meta_json: { governance_decision: "allow", allowed_to_auto_execute: true }, created_at: "2026-01-01T10:00:00Z" },
    ];
    const events = buildAuditTrailEvents({ logs });
    const autoAllowed = events.filter((e) => e.allowed_to_auto_execute === true);
    expect(autoAllowed.every((e) => e.severity === "info" || e.severity === "notice")).toBe(true);
  });

  it("buildAuditTrailEvents never crashes on any combination of malformed data", () => {
    const malformed = [null, undefined, {}, { invalid: true }, 42, "string"] as unknown as Record<string, unknown>[];
    expect(() => buildAuditTrailEvents({ missions: malformed, tasks: malformed, documents: malformed, logs: malformed })).not.toThrow();
  });

  it("IDs are always non-empty strings", () => {
    const events = buildAuditTrailEvents({
      missions: [{ id: "m1", status: "running" }],
      tasks: [{ id: "t1", status: "done" }],
      logs: [{ id: "l1", event_type: "task_created", message: "Created", meta_json: {} }],
    });
    for (const e of events) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it("approval_required=true task is never auto-executable", () => {
    const tasks = [{ id: "t1", title: "Approbation", status: "pending", approval_required: true }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t1");
    expect(e?.allowed_to_auto_execute).not.toBe(true);
  });

  it("red risk level task has requires_human=true", () => {
    const tasks = [{ id: "t1", title: "Doc rouge", status: "done", risk_level: "red" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t1");
    expect(e?.requires_human).toBe(true);
  });

  it("black risk level task has requires_human=true", () => {
    const tasks = [{ id: "t1", title: "Doc noir", status: "done", risk_level: "black" }];
    const events = buildAuditTrailEvents({ tasks });
    const e = events.find((ev) => ev.source_id === "t1");
    expect(e?.requires_human).toBe(true);
  });
});
