// src/lib/pierre/v1/trace/__tests__/canonical-event-p19.test.ts
// P19 — CloneTrace canonical envelope: carries all fields, adapts legacy shapes, redacts secrets,
// reconstructs an ordered mission timeline.

import { describe, it, expect } from "vitest";
import {
  buildCanonicalTraceEvent, redactMetadata, fromRtEventRow, fromObservableEvent, reconstructMissionTimeline,
  CLONETRACE_ENVELOPE_VERSION,
} from "../canonical-event";

describe("P19 — canonical envelope carries all fields + never leaks secrets", () => {
  it("fills defaults and stamps version", () => {
    const e = buildCanonicalTraceEvent({ event_id: "e1", event_type: "mission_created", occurred_at: "2026-07-01T00:00:00Z", company_id: "A", provenance: "test" });
    expect(e.envelope_version).toBe(CLONETRACE_ENVELOPE_VERSION);
    expect(e.legal_country).toBeNull();
    expect(e.correlation_id).toBeNull();
  });
  it("redacts secret-looking keys and truncates long strings", () => {
    const r = redactMetadata({ api_key: "sk-123", service_role_key: "x", note: "ok", big: "y".repeat(600) });
    expect(r.api_key).toBe("[redacted]");
    expect(r.service_role_key).toBe("[redacted]");
    expect(r.note).toBe("ok");
    expect(String(r.big).endsWith("…")).toBe(true);
  });
});

describe("P19 — adapters fold legacy shapes into the canonical envelope", () => {
  it("pierre_rt_events row → envelope", () => {
    const e = fromRtEventRow({ id: "r1", type: "task_succeeded", created_at: "2026-07-01T00:00:01Z", company_id: "A", mission_id: "m1", task_id: "t1", correlation_id: "c1", prev_state: "in_progress", new_state: "done", metadata: { secret: "zzz", ok: 1 } });
    expect(e.event_type).toBe("task_succeeded");
    expect(e.mission_id).toBe("m1");
    expect(e.correlation_id).toBe("c1");
    expect(e.redacted_metadata.secret).toBe("[redacted]");
    expect(e.provenance).toBe("pierre_rt_events");
  });
  it("ObservableEvent → envelope (richest schema)", () => {
    const e = fromObservableEvent({ event_id: "o1", event_type: "mission_received", occurred_at: "2026-07-01T00:00:00Z", company_id: "A", mission_id: "m1", correlation_id: "c1", causation_id: "root", status: "ok", retry_count: 0, metadata_redacted: { a: 1 } });
    expect(e.causation_id).toBe("root");
    expect(e.result).toBe("ok");
    expect(e.provenance).toBe("observability");
  });
});

describe("P19 — a full mission can be reconstructed in order from mixed-provenance events", () => {
  it("orders by time and confirms a single correlation trail", () => {
    const events = [
      fromRtEventRow({ id: "r3", type: "task_succeeded", created_at: "2026-07-01T00:00:03Z", company_id: "A", mission_id: "m1", correlation_id: "c1" }),
      fromObservableEvent({ event_id: "o1", event_type: "mission_received", occurred_at: "2026-07-01T00:00:00Z", company_id: "A", mission_id: "m1", correlation_id: "c1" }),
      fromRtEventRow({ id: "r2", type: "task_created", created_at: "2026-07-01T00:00:02Z", company_id: "A", mission_id: "m1", correlation_id: "c1" }),
      // an unrelated mission event must be excluded
      fromRtEventRow({ id: "x", type: "task_created", created_at: "2026-07-01T00:00:01Z", company_id: "A", mission_id: "OTHER", correlation_id: "c9" }),
    ];
    const tl = reconstructMissionTimeline(events, "m1");
    expect(tl.ordered.map((e) => e.event_type)).toEqual(["mission_received", "task_created", "task_succeeded"]);
    expect(tl.correlation_ids).toEqual(["c1"]);
    expect(tl.reconstructable).toBe(true);
  });
  it("empty mission is not reconstructable (fail-closed)", () => {
    expect(reconstructMissionTimeline([], "m1").reconstructable).toBe(false);
  });
});
