import { describe, it, expect } from "vitest";
import { mapTimelineEvent, mapTimeline, groupTimeline } from "../timeline";

describe("mapTimelineEvent", () => {
  it("mappe event_type → kind humain + masque le bruit technique", () => {
    const e = mapTimelineEvent({
      id: "e1", event_type: "document_generated", title: "CDI généré", message: "Document prêt",
      created_at: "2026-07-01T00:00:00Z", mission_id: "m1", employee_id: "emp1", employee_name: "Marie",
      severity: "info", source: "document",
    });
    expect(e.kind).toBe("document");
    expect(e.title).toBe("CDI généré");
    expect(e.employee?.href).toContain("employee=emp1");
    expect(e.actor).toBe("pierre");
  });

  it("severité → tonalité ; incident pour task_failed", () => {
    const e = mapTimelineEvent({ event_type: "task_failed", severity: "critical", source: "task" });
    expect(e.kind).toBe("incident");
    expect(e.tone).toBe("danger");
  });

  it("titre dérivé du event_type si absent", () => {
    const e = mapTimelineEvent({ event_type: "human_action_required" });
    expect(e.kind).toBe("validation");
    expect(e.title).toBe("Human action required");
  });

  it("event_type inconnu → system, jamais d'erreur", () => {
    const e = mapTimelineEvent({ event_type: "totally_unknown_xyz" });
    expect(e.kind).toBe("system");
  });

  it("id de repli déterministe si absent", () => {
    expect(mapTimelineEvent({ event_type: "task_started" }, 4).id).toBe("evt-4");
  });
});

describe("groupTimeline", () => {
  it("regroupe les événements système consécutifs", () => {
    const events = mapTimeline([
      { id: "a", event_type: "mission_created", source: "mission" },
      { id: "b", event_type: "governance_evaluated", source: "governance" },
      { id: "c", event_type: "cloneguard_evaluated", source: "cloneguard" },
      { id: "d", event_type: "document_generated", source: "document" },
    ]);
    const groups = groupTimeline(events);
    // mission | (governance+cloneguard collapsés) | document
    expect(groups).toHaveLength(3);
    const sys = groups.find((g) => g.kind === "system");
    expect(sys?.collapsed).toBe(true);
    expect(sys?.events).toHaveLength(2);
  });

  it("liste vide → []", () => {
    expect(mapTimeline([])).toEqual([]);
    expect(groupTimeline([])).toEqual([]);
  });
});
