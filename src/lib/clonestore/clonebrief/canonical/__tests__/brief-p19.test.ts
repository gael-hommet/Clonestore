// src/lib/clonestore/clonebrief/canonical/__tests__/brief-p19.test.ts
// P19 — CloneBrief composes ONLY proven canonical facts. Prepared ≠ executed; failed ≠ completed; cancelled
// ≠ active; strictly tenant/entity scoped; provenance to canonical event ids.

import { describe, it, expect } from "vitest";
import { buildCloneBrief, type ScheduledItem } from "../brief";
import { buildCanonicalTraceEvent, type CanonicalTraceEvent } from "../../../../pierre/v1/trace/canonical-event";

const ev = (o: Partial<CanonicalTraceEvent> & { event_id: string; event_type: string; company_id: string }): CanonicalTraceEvent =>
  buildCanonicalTraceEvent({ occurred_at: "2026-07-01T08:00:00Z", provenance: "test", ...o });

describe("P19 — CloneBrief distinguishes executed / prepared / blocked / failed", () => {
  const events = [
    ev({ event_id: "e1", event_type: "task_succeeded", company_id: "A", mission_id: "m1", task_id: "t1", new_state: "succeeded" }),
    ev({ event_id: "e2", event_type: "task_awaiting_integration", company_id: "A", mission_id: "m1", task_id: "t2", result: "awaiting_integration" }),
    ev({ event_id: "e3", event_type: "task_blocked", company_id: "A", mission_id: "m1", task_id: "t3", new_state: "blocked" }),
    ev({ event_id: "e4", event_type: "task_failed", company_id: "A", mission_id: "m2", task_id: "t4", new_state: "failed" }),
    ev({ event_id: "e5", event_type: "validation_requested", company_id: "A", mission_id: "m3", task_id: "t5", new_state: "awaiting_validation" }),
  ];

  it("executed action is completed; awaiting_integration is prepared, NOT completed", () => {
    const b = buildCloneBrief({ kind: "morning", company_id: "A", legal_country: "FR", now: "2026-07-01T09:00:00Z", events });
    expect(b.completed_actions.map((l) => l.task_id)).toEqual(["t1"]);
    expect(b.prepared_actions.some((l) => l.task_id === "t2")).toBe(true);
    expect(b.completed_actions.some((l) => l.task_id === "t2")).toBe(false); // never presented as executed
  });

  it("blocked, failed→anomaly, and pending validation are separated", () => {
    const b = buildCloneBrief({ kind: "evening", company_id: "A", legal_country: "FR", now: "2026-07-01T20:00:00Z", events });
    expect(b.blocked.some((l) => l.task_id === "t3")).toBe(true);
    expect(b.anomalies.some((a) => a.includes("t4"))).toBe(true);       // failed = anomaly, never completed
    expect(b.completed_actions.some((l) => l.task_id === "t4")).toBe(false);
    expect(b.pending_validations.some((l) => l.task_id === "t5")).toBe(true);
    expect(b.decisions_required.some((l) => l.task_id === "t5")).toBe(true);
  });

  it("every completed line carries provenance to a canonical event id", () => {
    const b = buildCloneBrief({ kind: "morning", company_id: "A", legal_country: "FR", now: "2026-07-01T09:00:00Z", events });
    expect(b.completed_actions[0].evidence_event_ids).toEqual(["e1"]);
    expect(b.version).toBe("clonebrief-1");
    expect(b.legal_country).toBe("FR");
  });
});

describe("P19 — CloneBrief tenant/entity isolation + cancelled missions", () => {
  it("company B events never appear in company A's brief", () => {
    const events = [
      ev({ event_id: "a1", event_type: "task_succeeded", company_id: "A", mission_id: "ma", task_id: "ta", new_state: "succeeded" }),
      ev({ event_id: "b1", event_type: "task_succeeded", company_id: "B", mission_id: "mb", task_id: "tb", new_state: "succeeded" }),
    ];
    const a = buildCloneBrief({ kind: "morning", company_id: "A", legal_country: "FR", now: "2026-07-01T09:00:00Z", events });
    expect(a.completed_actions.map((l) => l.task_id)).toEqual(["ta"]);
    expect(a.completed_actions.some((l) => l.task_id === "tb")).toBe(false);
  });

  it("a cancelled mission is never active, and later activity on it is an anomaly", () => {
    const events = [
      ev({ event_id: "c1", event_type: "mission_cancelled", company_id: "A", mission_id: "mc", new_state: "cancelled" }),
      ev({ event_id: "c2", event_type: "task_succeeded", company_id: "A", mission_id: "mc", task_id: "tc", new_state: "succeeded" }),
    ];
    const b = buildCloneBrief({ kind: "evening", company_id: "A", legal_country: "FR", now: "2026-07-01T20:00:00Z", events });
    expect(b.completed_actions.some((l) => l.mission_id === "mc")).toBe(false); // cancelled → not active/completed
    expect(b.anomalies.some((a) => a.includes("mc"))).toBe(true);              // activity after cancellation = anomaly
  });

  it("deadlines come from scheduled items, entity-scoped, cancelled excluded", () => {
    const scheduled: ScheduledItem[] = [
      { company_id: "A", entity_id: "fr", mission_id: "m1", kind: "deadline", due_at: "2026-07-02T09:00:00Z", label: "Relance manager" },
      { company_id: "A", entity_id: "ch", mission_id: "m2", kind: "wake", due_at: "2026-07-03T09:00:00Z", label: "Autre entité" },
      { company_id: "A", entity_id: "fr", mission_id: "m3", kind: "relance", due_at: "2026-07-01T09:00:00Z", label: "Annulée", cancelled: true },
    ];
    const b = buildCloneBrief({ kind: "morning", company_id: "A", entity_id: "fr", legal_country: "FR", now: "2026-07-01T09:00:00Z", events: [], scheduled });
    expect(b.deadlines.map((d) => d.mission_id)).toEqual(["m1"]); // only fr entity, not cancelled
  });
});
