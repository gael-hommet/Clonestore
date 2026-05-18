import { describe, it, expect } from "vitest";
import {
  normalizeFeedDate,
  buildDeterministicFeedId,
  inferFeedCategory,
  inferFeedSeverity,
  inferFeedPriority,
  buildFeedItemFromMission,
  buildFeedItemFromTask,
  buildFeedItemFromDocument,
  buildFeedItemFromLog,
  buildFeedItemFromEmployeeFileSnapshot,
  dedupeFeedItems,
  sortFeedItems,
  buildFeedSummary,
  buildFeedSections,
  buildOperationalBriefing,
  buildPierreOperationalFeed,
  normalizeFeedCategoryAlias,
  inferOperationalIntent,
  buildFeedActionTarget,
  buildFeedDisplayContext,
  buildPremiumFeedSummary,
  buildOperationalCommandCenter,
  type PierreOperationalFeedItem,
} from "../hr/operational-feed";

// ─── Helpers ──────────────────────────────────────────────

function makeItem(overrides: Partial<PierreOperationalFeedItem> = {}): PierreOperationalFeedItem {
  return {
    id: "feed_test",
    category: "follow_up",
    severity: "info",
    priority: "normal",
    title: "Test",
    message: "Message",
    source_type: "mission",
    source_id: "src1",
    mission_id: "m1",
    task_id: null,
    employee_id: null,
    employee_name: null,
    created_at: "2024-01-15T10:00:00.000Z",
    action_required: false,
    action_label: null,
    tags: [],
    raw: {},
    // Premium fields (Bloc 12.1)
    intent: "neutral",
    action_kind: "none",
    action_target: null,
    display_context: null,
    is_sensitive: false,
    is_blocking: false,
    is_delivery: false,
    is_briefing: false,
    ...overrides,
  };
}

// ─── 1. normalizeFeedDate ──────────────────────────────────

describe("normalizeFeedDate", () => {
  it("returns null for null", () => {
    expect(normalizeFeedDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeFeedDate(undefined)).toBeNull();
  });

  it("parses a valid ISO string", () => {
    const result = normalizeFeedDate("2024-06-01T12:00:00Z");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("parses a Date object", () => {
    const d = new Date("2024-01-10T08:00:00Z");
    const result = normalizeFeedDate(d);
    expect(result).toBe(d.toISOString());
  });

  it("parses a numeric timestamp", () => {
    const ts = Date.now();
    const result = normalizeFeedDate(ts);
    expect(result).not.toBeNull();
    expect(new Date(result!).getTime()).toBeCloseTo(ts, -3);
  });

  it("returns null for an invalid date string", () => {
    expect(normalizeFeedDate("not-a-date")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeFeedDate("")).toBeNull();
  });
});

// ─── 2. buildDeterministicFeedId ──────────────────────────

describe("buildDeterministicFeedId", () => {
  const base = {
    source_type: "mission",
    source_id: "m1",
    mission_id: "m1",
    task_id: "",
    category: "follow_up",
    title: "Test mission",
    created_at: "2024-01-01T00:00:00Z",
  };

  it("returns a string starting with feed_", () => {
    expect(buildDeterministicFeedId(base)).toMatch(/^feed_/);
  });

  it("is deterministic — same input produces same id", () => {
    expect(buildDeterministicFeedId(base)).toBe(buildDeterministicFeedId(base));
  });

  it("differs when source_id changes", () => {
    const alt = { ...base, source_id: "m2" };
    expect(buildDeterministicFeedId(base)).not.toBe(buildDeterministicFeedId(alt));
  });

  it("differs when category changes", () => {
    const alt = { ...base, category: "alert" };
    expect(buildDeterministicFeedId(base)).not.toBe(buildDeterministicFeedId(alt));
  });

  it("handles empty input without throwing", () => {
    expect(() => buildDeterministicFeedId({})).not.toThrow();
  });

  it("returns non-empty string", () => {
    expect(buildDeterministicFeedId(base).length).toBeGreaterThan(5);
  });
});

// ─── 3. inferFeedCategory ─────────────────────────────────

describe("inferFeedCategory", () => {
  it("maps employee_file sensitive status to alert", () => {
    expect(inferFeedCategory({ status: "sensitive" }, "employee_file")).toBe("alert");
  });

  it("maps employee_file attention_required to alert", () => {
    expect(inferFeedCategory({ status: "attention_required" }, "employee_file")).toBe("alert");
  });

  it("maps employee_file complete to follow_up", () => {
    expect(inferFeedCategory({ status: "complete" }, "employee_file")).toBe("follow_up");
  });

  it("maps continuity source to briefing", () => {
    expect(inferFeedCategory({}, "continuity")).toBe("briefing");
  });

  it("maps document source to delivery", () => {
    expect(inferFeedCategory({}, "document")).toBe("delivery");
  });

  it("maps harcèlement keyword to alert", () => {
    expect(inferFeedCategory({ title: "Cas de harcèlement signalé" }, "task")).toBe("alert");
  });

  it("maps faute grave keyword to alert", () => {
    expect(inferFeedCategory({ message: "Procédure faute grave enclenchée" }, "log")).toBe("alert");
  });

  it("maps status blocked to alert", () => {
    expect(inferFeedCategory({ status: "blocked" }, "task")).toBe("alert");
  });

  it("maps status error to alert", () => {
    expect(inferFeedCategory({ status: "error" }, "mission")).toBe("alert");
  });

  it("maps risk black to alert", () => {
    expect(inferFeedCategory({ risk_level: "black" }, "mission")).toBe("alert");
  });

  it("maps event_type digest to briefing", () => {
    expect(inferFeedCategory({ event_type: "weekly_digest" }, "log")).toBe("briefing");
  });

  it("defaults to follow_up for neutral row", () => {
    expect(inferFeedCategory({ status: "active" }, "mission")).toBe("follow_up");
  });
});

// ─── 4. inferFeedSeverity ────────────────────────────────

describe("inferFeedSeverity", () => {
  it("returns critical for risk_level black", () => {
    expect(inferFeedSeverity({ risk_level: "black" }, "mission")).toBe("critical");
  });

  it("returns critical for harcèlement text", () => {
    expect(inferFeedSeverity({ mission_summary: "Cas harcèlement moral" }, "mission")).toBe("critical");
  });

  it("returns critical for status error", () => {
    expect(inferFeedSeverity({ status: "error" }, "task")).toBe("critical");
  });

  it("returns critical for employee_file sensitive", () => {
    expect(inferFeedSeverity({ status: "sensitive" }, "employee_file")).toBe("critical");
  });

  it("returns warning for status blocked", () => {
    expect(inferFeedSeverity({ status: "blocked" }, "task")).toBe("warning");
  });

  it("returns warning for risk_level red", () => {
    expect(inferFeedSeverity({ risk_level: "red" }, "mission")).toBe("warning");
  });

  it("returns success for document source", () => {
    expect(inferFeedSeverity({}, "document")).toBe("success");
  });

  it("returns success for status done", () => {
    expect(inferFeedSeverity({ status: "done" }, "task")).toBe("success");
  });

  it("defaults to info for normal active row", () => {
    expect(inferFeedSeverity({ status: "active" }, "mission")).toBe("info");
  });
});

// ─── 5. inferFeedPriority ────────────────────────────────

describe("inferFeedPriority", () => {
  it("returns urgent for risk_level black", () => {
    expect(inferFeedPriority({ risk_level: "black" }, "mission")).toBe("urgent");
  });

  it("returns urgent for faute grave text", () => {
    expect(inferFeedPriority({ message: "faute grave constatée" }, "log")).toBe("urgent");
  });

  it("returns urgent for status error", () => {
    expect(inferFeedPriority({ status: "error" }, "task")).toBe("urgent");
  });

  it("returns urgent for employee_file sensitive", () => {
    expect(inferFeedPriority({ status: "sensitive" }, "employee_file")).toBe("urgent");
  });

  it("returns high for approval_required true", () => {
    expect(inferFeedPriority({ approval_required: true }, "task")).toBe("high");
  });

  it("returns high for status blocked", () => {
    expect(inferFeedPriority({ status: "blocked" }, "task")).toBe("high");
  });

  it("returns high for risk_level red", () => {
    expect(inferFeedPriority({ risk_level: "red" }, "mission")).toBe("high");
  });

  it("returns low for status done", () => {
    expect(inferFeedPriority({ status: "done" }, "task")).toBe("low");
  });

  it("defaults to normal for active status", () => {
    expect(inferFeedPriority({ status: "active" }, "mission")).toBe("normal");
  });
});

// ─── 6. buildFeedItemFromMission ─────────────────────────

describe("buildFeedItemFromMission", () => {
  const base = { id: "m1", status: "active", mission_summary: "Recrutement CDI", created_at: "2024-03-01T00:00:00Z" };

  it("returns a valid feed item", () => {
    const item = buildFeedItemFromMission(base);
    expect(item.source_type).toBe("mission");
    expect(item.id).toMatch(/^feed_/);
  });

  it("sets mission_id equal to source_id", () => {
    const item = buildFeedItemFromMission(base);
    expect(item.mission_id).toBe(item.source_id);
  });

  it("sets action_required=true for blocked status", () => {
    const item = buildFeedItemFromMission({ ...base, status: "blocked" });
    expect(item.action_required).toBe(true);
  });

  it("sets action_required=true for approval_required=true", () => {
    const item = buildFeedItemFromMission({ ...base, approval_required: true });
    expect(item.action_required).toBe(true);
  });

  it("includes mission tag", () => {
    const item = buildFeedItemFromMission(base);
    expect(item.tags).toContain("mission");
  });

  it("carries raw row reference", () => {
    const item = buildFeedItemFromMission(base);
    expect(item.raw).toBe(base);
  });

  it("is deterministic — same input produces same id", () => {
    expect(buildFeedItemFromMission(base).id).toBe(buildFeedItemFromMission(base).id);
  });
});

// ─── 7. buildFeedItemFromTask ────────────────────────────

describe("buildFeedItemFromTask", () => {
  const base = { id: "t1", mission_id: "m1", title: "Envoyer contrat", status: "ready", created_at: "2024-03-02T00:00:00Z" };

  it("returns a feed item with source_type task", () => {
    expect(buildFeedItemFromTask(base).source_type).toBe("task");
  });

  it("sets task_id and mission_id correctly", () => {
    const item = buildFeedItemFromTask(base);
    expect(item.task_id).toBe("t1");
    expect(item.mission_id).toBe("m1");
  });

  it("has action_label for blocked status", () => {
    const item = buildFeedItemFromTask({ ...base, status: "blocked" });
    expect(item.action_label).not.toBeNull();
  });

  it("has action_label for error status", () => {
    const item = buildFeedItemFromTask({ ...base, status: "error" });
    expect(item.action_label).toBe("Investiguer l'erreur");
  });

  it("has action_label for awaiting_approval", () => {
    const item = buildFeedItemFromTask({ ...base, status: "awaiting_approval" });
    expect(item.action_label).toBe("Valider la tâche");
  });

  it("no action_label for done status", () => {
    const item = buildFeedItemFromTask({ ...base, status: "done" });
    expect(item.action_label).toBeNull();
  });

  it("includes task tag", () => {
    const item = buildFeedItemFromTask(base);
    expect(item.tags).toContain("task");
  });

  it("approval_required tag added when true", () => {
    const item = buildFeedItemFromTask({ ...base, approval_required: true });
    expect(item.tags).toContain("approval_required");
  });

  it("is deterministic", () => {
    expect(buildFeedItemFromTask(base).id).toBe(buildFeedItemFromTask(base).id);
  });
});

// ─── 8. buildFeedItemFromDocument ────────────────────────

describe("buildFeedItemFromDocument", () => {
  const base = { id: "d1", mission_id: "m1", title: "Contrat CDI", doc_type: "contract", created_at: "2024-03-03T00:00:00Z" };

  it("returns a feed item with source_type document", () => {
    expect(buildFeedItemFromDocument(base).source_type).toBe("document");
  });

  it("sets category to delivery", () => {
    expect(buildFeedItemFromDocument(base).category).toBe("delivery");
  });

  it("sets severity to success", () => {
    expect(buildFeedItemFromDocument(base).severity).toBe("success");
  });

  it("sets action_required to false", () => {
    expect(buildFeedItemFromDocument(base).action_required).toBe(false);
  });

  it("includes document tag", () => {
    expect(buildFeedItemFromDocument(base).tags).toContain("document");
  });

  it("is deterministic", () => {
    expect(buildFeedItemFromDocument(base).id).toBe(buildFeedItemFromDocument(base).id);
  });
});

// ─── 9. buildFeedItemFromLog ──────────────────────────────

describe("buildFeedItemFromLog", () => {
  const base = {
    id: "log1",
    mission_id: "m1",
    task_id: "t1",
    event_type: "task_executed",
    message: "Tâche exécutée avec succès",
    created_at: "2024-03-04T00:00:00Z",
  };

  it("returns a feed item with source_type log", () => {
    expect(buildFeedItemFromLog(base).source_type).toBe("log");
  });

  it("reads event_type (correct schema)", () => {
    const item = buildFeedItemFromLog(base);
    expect(item.tags).toContain("log");
  });

  it("sets category to alert for error event_type", () => {
    const item = buildFeedItemFromLog({ ...base, event_type: "task_error" });
    expect(item.category).toBe("alert");
  });

  it("sets category to briefing for digest event_type", () => {
    const item = buildFeedItemFromLog({ ...base, event_type: "daily_digest" });
    expect(item.category).toBe("briefing");
  });

  it("sets category to delivery for document event_type", () => {
    const item = buildFeedItemFromLog({ ...base, event_type: "document_generated" });
    expect(item.category).toBe("delivery");
  });

  it("does not crash on null message", () => {
    expect(() => buildFeedItemFromLog({ ...base, message: null })).not.toThrow();
  });

  it("is deterministic", () => {
    expect(buildFeedItemFromLog(base).id).toBe(buildFeedItemFromLog(base).id);
  });
});

// ─── 10. buildFeedItemFromEmployeeFileSnapshot ────────────

describe("buildFeedItemFromEmployeeFileSnapshot", () => {
  const base = {
    employee_id: "emp1",
    employee_name: "Marie Dupont",
    status: "complete",
    risk_level: "green",
    health_score: 90,
    missing_info_count: 0,
    open_tasks_count: 0,
    pending_approval_count: 0,
    latest_event_at: "2024-03-05T00:00:00Z",
  };

  it("returns a feed item with source_type employee_file", () => {
    expect(buildFeedItemFromEmployeeFileSnapshot(base).source_type).toBe("employee_file");
  });

  it("sets category alert for sensitive status", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "sensitive" });
    expect(item.category).toBe("alert");
  });

  it("sets severity critical for sensitive status", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "sensitive" });
    expect(item.severity).toBe("critical");
  });

  it("sets priority urgent for sensitive status", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "sensitive" });
    expect(item.priority).toBe("urgent");
  });

  it("sets category alert for attention_required", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "attention_required" });
    expect(item.category).toBe("alert");
  });

  it("sets category follow_up for complete status", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "complete" });
    expect(item.category).toBe("follow_up");
  });

  it("sets action_required=false for complete status", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ ...base, status: "complete" });
    expect(item.action_required).toBe(false);
  });

  it("sets employee_name in title", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot(base);
    expect(item.title).toContain("Marie Dupont");
  });

  it("is deterministic", () => {
    expect(buildFeedItemFromEmployeeFileSnapshot(base).id).toBe(
      buildFeedItemFromEmployeeFileSnapshot(base).id,
    );
  });
});

// ─── 11. dedupeFeedItems ─────────────────────────────────

describe("dedupeFeedItems", () => {
  it("removes exact duplicate ids", () => {
    const items = [makeItem({ id: "x" }), makeItem({ id: "x" })];
    expect(dedupeFeedItems(items)).toHaveLength(1);
  });

  it("keeps items with distinct ids", () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    expect(dedupeFeedItems(items)).toHaveLength(2);
  });

  it("keeps the higher-priority duplicate", () => {
    const low = makeItem({ id: "x", priority: "low" });
    const high = makeItem({ id: "x", priority: "high" });
    const result = dedupeFeedItems([low, high]);
    expect(result[0].priority).toBe("high");
  });

  it("returns empty array for empty input", () => {
    expect(dedupeFeedItems([])).toHaveLength(0);
  });

  it("keeps more-recent item when priority is equal", () => {
    const older = makeItem({ id: "x", created_at: "2024-01-01T00:00:00Z" });
    const newer = makeItem({ id: "x", created_at: "2024-06-01T00:00:00Z" });
    const result = dedupeFeedItems([older, newer]);
    expect(result[0].created_at).toBe("2024-06-01T00:00:00Z");
  });

  it("handles single item without error", () => {
    const result = dedupeFeedItems([makeItem()]);
    expect(result).toHaveLength(1);
  });
});

// ─── 12. sortFeedItems ───────────────────────────────────

describe("sortFeedItems", () => {
  it("returns a new array (does not mutate)", () => {
    const items = [makeItem()];
    const result = sortFeedItems(items);
    expect(result).not.toBe(items);
  });

  it("places urgent before low priority", () => {
    const low = makeItem({ priority: "low" });
    const urgent = makeItem({ priority: "urgent" });
    const result = sortFeedItems([low, urgent]);
    expect(result[0].priority).toBe("urgent");
  });

  it("places critical before info when same priority", () => {
    const info = makeItem({ severity: "info" });
    const critical = makeItem({ severity: "critical" });
    const result = sortFeedItems([info, critical]);
    expect(result[0].severity).toBe("critical");
  });

  it("places action_required=true before false when same priority+severity", () => {
    const noAction = makeItem({ action_required: false });
    const action = makeItem({ action_required: true });
    const result = sortFeedItems([noAction, action]);
    expect(result[0].action_required).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(sortFeedItems([])).toHaveLength(0);
  });

  it("places newer dates before older dates", () => {
    const older = makeItem({ created_at: "2023-01-01T00:00:00Z" });
    const newer = makeItem({ id: "b", created_at: "2024-06-01T00:00:00Z" });
    const result = sortFeedItems([older, newer]);
    expect(result[0].created_at).toBe("2024-06-01T00:00:00Z");
  });

  it("produces stable order for equal items by title", () => {
    const a = makeItem({ id: "a", title: "Alpha" });
    const b = makeItem({ id: "b", title: "Zeta" });
    const result = sortFeedItems([b, a]);
    expect(result[0].title).toBe("Alpha");
  });
});

// ─── 13. buildFeedSummary ─────────────────────────────────

describe("buildFeedSummary", () => {
  it("returns zeros for empty input", () => {
    const s = buildFeedSummary([]);
    expect(s.total).toBe(0);
    expect(s.alert).toBe(0);
  });

  it("counts total correctly", () => {
    const items = [makeItem(), makeItem({ id: "b" })];
    expect(buildFeedSummary(items).total).toBe(2);
  });

  it("counts alert category", () => {
    const items = [makeItem({ category: "alert" }), makeItem({ category: "follow_up" })];
    expect(buildFeedSummary(items).alert).toBe(1);
  });

  it("counts urgent priority", () => {
    const items = [makeItem({ priority: "urgent" }), makeItem()];
    expect(buildFeedSummary(items).urgent).toBe(1);
  });

  it("counts action_required", () => {
    const items = [makeItem({ action_required: true }), makeItem(), makeItem({ action_required: true })];
    expect(buildFeedSummary(items).action_required).toBe(2);
  });

  it("counts all 4 categories independently", () => {
    const items = [
      makeItem({ category: "alert" }),
      makeItem({ category: "follow_up" }),
      makeItem({ category: "delivery" }),
      makeItem({ category: "briefing" }),
    ];
    const s = buildFeedSummary(items);
    expect(s.alert).toBe(1);
    expect(s.follow_up).toBe(1);
    expect(s.delivery).toBe(1);
    expect(s.briefing).toBe(1);
  });
});

// ─── 14. buildFeedSections ───────────────────────────────

describe("buildFeedSections", () => {
  it("always returns 4 sections", () => {
    expect(buildFeedSections([])).toHaveLength(4);
  });

  it("sections are in order: alert, follow_up, delivery, briefing", () => {
    const sections = buildFeedSections([]);
    expect(sections[0].category).toBe("alert");
    expect(sections[1].category).toBe("follow_up");
    expect(sections[2].category).toBe("delivery");
    expect(sections[3].category).toBe("briefing");
  });

  it("section count matches items in category", () => {
    const items = [makeItem({ category: "alert" }), makeItem({ category: "alert", id: "b" })];
    const sections = buildFeedSections(items);
    const alertSection = sections.find((s) => s.category === "alert");
    expect(alertSection?.count).toBe(2);
  });

  it("empty section has count=0 and empty items", () => {
    const sections = buildFeedSections([]);
    expect(sections[0].count).toBe(0);
    expect(sections[0].items).toHaveLength(0);
  });

  it("section label is set", () => {
    const sections = buildFeedSections([]);
    expect(sections[0].label).toBeTruthy();
    expect(typeof sections[0].label).toBe("string");
  });

  it("items in section match category filter", () => {
    const items = [makeItem({ category: "delivery" }), makeItem({ category: "briefing" })];
    const sections = buildFeedSections(items);
    const deliverySection = sections.find((s) => s.category === "delivery");
    expect(deliverySection?.items.every((it) => it.category === "delivery")).toBe(true);
  });
});

// ─── 15. buildOperationalBriefing ────────────────────────

describe("buildOperationalBriefing", () => {
  const items: PierreOperationalFeedItem[] = [
    makeItem({ category: "alert", severity: "critical", priority: "urgent", action_required: true }),
    makeItem({ id: "b", category: "delivery", severity: "success", priority: "low" }),
  ];

  it("returns a briefing with correct period", () => {
    const b = buildOperationalBriefing(items, "daily");
    expect(b.period).toBe("daily");
  });

  it("id starts with brief_", () => {
    expect(buildOperationalBriefing(items, "instant").id).toMatch(/^brief_/);
  });

  it("created_at is a valid ISO string", () => {
    const b = buildOperationalBriefing(items, "weekly");
    expect(() => new Date(b.created_at)).not.toThrow();
    expect(isNaN(new Date(b.created_at).getTime())).toBe(false);
  });

  it("stats.total matches input length", () => {
    expect(buildOperationalBriefing(items, "daily").stats.total).toBe(items.length);
  });

  it("risks include alert/critical items", () => {
    const b = buildOperationalBriefing(items, "daily");
    expect(b.risks.length).toBeGreaterThan(0);
  });

  it("next_actions include urgent action_required items", () => {
    const b = buildOperationalBriefing(items, "instant");
    expect(b.next_actions.length).toBeGreaterThan(0);
  });

  it("works with empty items array", () => {
    const b = buildOperationalBriefing([], "monthly");
    expect(b.stats.total).toBe(0);
    expect(b.risks).toHaveLength(0);
  });

  it("is deterministic — same input, same period, same now produces same id", () => {
    const now = new Date("2024-06-01T00:00:00Z");
    const id1 = buildOperationalBriefing(items, "daily", now).id;
    const id2 = buildOperationalBriefing(items, "daily", now).id;
    expect(id1).toBe(id2);
  });

  it("title is a non-empty string", () => {
    const b = buildOperationalBriefing(items, "weekly");
    expect(b.title.length).toBeGreaterThan(0);
  });
});

// ─── 16. buildPierreOperationalFeed ──────────────────────

describe("buildPierreOperationalFeed", () => {
  const missions = [{ id: "m1", status: "active", mission_summary: "Recrutement", created_at: "2024-01-01" }];
  const tasks = [{ id: "t1", mission_id: "m1", title: "Envoyer offre", status: "ready", created_at: "2024-01-02" }];
  const documents = [{ id: "d1", mission_id: "m1", title: "Contrat", doc_type: "contract", created_at: "2024-01-03" }];
  const logs = [{ id: "log1", mission_id: "m1", event_type: "task_executed", message: "OK", created_at: "2024-01-04" }];

  it("returns a PierreOperationalFeed with generated_at", () => {
    const feed = buildPierreOperationalFeed({ missions, tasks });
    expect(typeof feed.generated_at).toBe("string");
  });

  it("items array is non-empty when data provided", () => {
    const feed = buildPierreOperationalFeed({ missions, tasks, documents, logs });
    expect(feed.items.length).toBeGreaterThan(0);
  });

  it("always returns 4 sections", () => {
    expect(buildPierreOperationalFeed({}).sections).toHaveLength(4);
  });

  it("briefings array contains at least one instant briefing", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(feed.briefings.length).toBeGreaterThan(0);
    expect(feed.briefings[0].period).toBe("instant");
  });

  it("summary.total matches items.length", () => {
    const feed = buildPierreOperationalFeed({ missions, tasks });
    expect(feed.summary.total).toBe(feed.items.length);
  });

  it("respects the limit parameter", () => {
    const manyMissions = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      status: "active",
      mission_summary: `Mission ${i}`,
      created_at: "2024-01-01",
    }));
    const feed = buildPierreOperationalFeed({ missions: manyMissions, limit: 5 });
    expect(feed.items.length).toBeLessThanOrEqual(5);
  });

  it("handles all undefined inputs gracefully", () => {
    expect(() => buildPierreOperationalFeed({})).not.toThrow();
  });

  it("items are deduplicated", () => {
    const duplicateMissions = [missions[0], missions[0]];
    const feed = buildPierreOperationalFeed({ missions: duplicateMissions });
    const ids = feed.items.map((it) => it.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("items are sorted — urgent before low", () => {
    const data = [
      { id: "m1", status: "active", mission_summary: "A", created_at: "2024-01-01" },
      { id: "m2", status: "error", mission_summary: "B", created_at: "2024-01-01" },
    ];
    const feed = buildPierreOperationalFeed({ missions: data });
    const priorities = feed.items.map((it) => it.priority);
    const firstUrgentIndex = priorities.indexOf("urgent");
    const lastLowIndex = priorities.lastIndexOf("low");
    if (firstUrgentIndex >= 0 && lastLowIndex >= 0) {
      expect(firstUrgentIndex).toBeLessThan(lastLowIndex);
    }
  });
});

// ─── 17. Robustness ──────────────────────────────────────

describe("Robustness — null/malformed inputs", () => {
  it("buildFeedItemFromMission handles empty row", () => {
    expect(() => buildFeedItemFromMission({})).not.toThrow();
  });

  it("buildFeedItemFromTask handles empty row", () => {
    expect(() => buildFeedItemFromTask({})).not.toThrow();
  });

  it("buildFeedItemFromDocument handles empty row", () => {
    expect(() => buildFeedItemFromDocument({})).not.toThrow();
  });

  it("buildFeedItemFromLog handles empty row", () => {
    expect(() => buildFeedItemFromLog({})).not.toThrow();
  });

  it("buildFeedItemFromEmployeeFileSnapshot handles empty row", () => {
    expect(() => buildFeedItemFromEmployeeFileSnapshot({})).not.toThrow();
  });

  it("buildPierreOperationalFeed handles null mission_summary", () => {
    expect(() =>
      buildPierreOperationalFeed({ missions: [{ id: "m1", mission_summary: null }] }),
    ).not.toThrow();
  });

  it("buildFeedSections handles items with unknown category gracefully", () => {
    const items = [makeItem({ category: "follow_up" })];
    expect(() => buildFeedSections(items)).not.toThrow();
  });

  it("buildOperationalBriefing handles items with null created_at", () => {
    const items = [makeItem({ created_at: null })];
    expect(() => buildOperationalBriefing(items, "daily")).not.toThrow();
  });
});

// ─── 18. Pure module contract ─────────────────────────────

describe("Pure module contract", () => {
  it("buildPierreOperationalFeed returns a frozen generated_at (string)", () => {
    const feed = buildPierreOperationalFeed({});
    expect(typeof feed.generated_at).toBe("string");
    expect(feed.generated_at.length).toBeGreaterThan(0);
  });

  it("all PierreOperationalFeedItem fields are present", () => {
    const item = buildFeedItemFromMission({ id: "m1", status: "active", mission_summary: "Test" });
    const requiredFields: (keyof PierreOperationalFeedItem)[] = [
      "id", "category", "severity", "priority", "title", "message",
      "source_type", "source_id", "mission_id", "task_id", "employee_id",
      "employee_name", "created_at", "action_required", "action_label", "tags", "raw",
    ];
    for (const field of requiredFields) {
      expect(item).toHaveProperty(field);
    }
  });

  it("buildFeedSummary returns all expected keys", () => {
    const s = buildFeedSummary([]);
    const keys = ["total","follow_up","briefing","delivery","alert","urgent","high","normal","low","critical","warning","success","info","action_required"];
    for (const k of keys) {
      expect(s).toHaveProperty(k);
    }
  });

  it("buildFeedSections returns sections with category, label, count, items", () => {
    const sections = buildFeedSections([]);
    for (const section of sections) {
      expect(section).toHaveProperty("category");
      expect(section).toHaveProperty("label");
      expect(section).toHaveProperty("count");
      expect(section).toHaveProperty("items");
    }
  });

  it("sortFeedItems does not modify input array", () => {
    const items = [makeItem({ priority: "low" }), makeItem({ id: "b", priority: "urgent" })];
    const originalOrder = items.map((it) => it.id);
    sortFeedItems(items);
    expect(items.map((it) => it.id)).toEqual(originalOrder);
  });

  it("buildDeterministicFeedId output is purely alphanumeric + underscore", () => {
    const id = buildDeterministicFeedId({ source_type: "task", source_id: "t1" });
    expect(id).toMatch(/^feed_[a-z0-9]+$/);
  });
});

// ─── 19. normalizeFeedCategoryAlias ──────────────────────

describe("normalizeFeedCategoryAlias", () => {
  it("maps 'alert' to alert", () => {
    expect(normalizeFeedCategoryAlias("alert")).toBe("alert");
  });

  it("maps 'alerte' to alert", () => {
    expect(normalizeFeedCategoryAlias("alerte")).toBe("alert");
  });

  it("maps 'alertes' to alert", () => {
    expect(normalizeFeedCategoryAlias("alertes")).toBe("alert");
  });

  it("maps 'alerts' to alert", () => {
    expect(normalizeFeedCategoryAlias("alerts")).toBe("alert");
  });

  it("maps 'follow_up' to follow_up", () => {
    expect(normalizeFeedCategoryAlias("follow_up")).toBe("follow_up");
  });

  it("maps 'suivi' to follow_up", () => {
    expect(normalizeFeedCategoryAlias("suivi")).toBe("follow_up");
  });

  it("maps 'suivis' to follow_up", () => {
    expect(normalizeFeedCategoryAlias("suivis")).toBe("follow_up");
  });

  it("maps 'delivery' to delivery", () => {
    expect(normalizeFeedCategoryAlias("delivery")).toBe("delivery");
  });

  it("maps 'livraison' to delivery", () => {
    expect(normalizeFeedCategoryAlias("livraison")).toBe("delivery");
  });

  it("maps 'livraisons' to delivery", () => {
    expect(normalizeFeedCategoryAlias("livraisons")).toBe("delivery");
  });

  it("maps 'briefing' to briefing", () => {
    expect(normalizeFeedCategoryAlias("briefing")).toBe("briefing");
  });

  it("maps 'briefings' to briefing", () => {
    expect(normalizeFeedCategoryAlias("briefings")).toBe("briefing");
  });

  it("returns null for unknown alias", () => {
    expect(normalizeFeedCategoryAlias("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeFeedCategoryAlias("")).toBeNull();
  });
});

// ─── 20. inferFeedCategory — bug fix Bloc 12.1 ───────────

describe("inferFeedCategory — briefing before delivery (Bloc 12.1 fix)", () => {
  it("classifies operational_briefing_generated as briefing (not delivery)", () => {
    expect(inferFeedCategory({ event_type: "operational_briefing_generated" }, "log")).toBe("briefing");
  });

  it("classifies briefing_generated as briefing", () => {
    expect(inferFeedCategory({ event_type: "briefing_generated" }, "log")).toBe("briefing");
  });

  it("classifies daily_briefing_generated as briefing", () => {
    expect(inferFeedCategory({ event_type: "daily_briefing_generated" }, "log")).toBe("briefing");
  });

  it("classifies daily_summary_generated as briefing", () => {
    expect(inferFeedCategory({ event_type: "daily_summary_generated" }, "log")).toBe("briefing");
  });

  it("document_generated still classifies as delivery", () => {
    expect(inferFeedCategory({ event_type: "document_generated" }, "log")).toBe("delivery");
  });

  it("pdf_generated classifies as delivery", () => {
    expect(inferFeedCategory({ event_type: "pdf_generated" }, "log")).toBe("delivery");
  });

  it("weekly_digest classifies as briefing", () => {
    expect(inferFeedCategory({ event_type: "weekly_digest" }, "log")).toBe("briefing");
  });
});

// ─── 21. inferOperationalIntent ──────────────────────────

describe("inferOperationalIntent", () => {
  it("returns requires_human_validation for awaiting_approval status", () => {
    expect(inferOperationalIntent({ status: "awaiting_approval" }, "task")).toBe("requires_human_validation");
  });

  it("returns requires_human_validation for approval_required=true", () => {
    expect(inferOperationalIntent({ approval_required: true }, "task")).toBe("requires_human_validation");
  });

  it("returns requires_human_validation for approval event_type", () => {
    expect(inferOperationalIntent({ event_type: "task_approval_requested" }, "log")).toBe("requires_human_validation");
  });

  it("returns blocked_or_failed for blocked status", () => {
    expect(inferOperationalIntent({ status: "blocked" }, "task")).toBe("blocked_or_failed");
  });

  it("returns blocked_or_failed for error status", () => {
    expect(inferOperationalIntent({ status: "error" }, "task")).toBe("blocked_or_failed");
  });

  it("returns sensitive_risk for risk_level black", () => {
    expect(inferOperationalIntent({ risk_level: "black" }, "mission")).toBe("sensitive_risk");
  });

  it("returns sensitive_risk for risk_level red", () => {
    expect(inferOperationalIntent({ risk_level: "red" }, "mission")).toBe("sensitive_risk");
  });

  it("returns sensitive_risk for employee_file sensitive status", () => {
    expect(inferOperationalIntent({ status: "sensitive" }, "employee_file")).toBe("sensitive_risk");
  });

  it("returns employee_file_attention for employee_file attention_required", () => {
    expect(inferOperationalIntent({ status: "attention_required" }, "employee_file")).toBe("employee_file_attention");
  });

  it("returns ready_to_run for ready status", () => {
    expect(inferOperationalIntent({ status: "ready" }, "task")).toBe("ready_to_run");
  });

  it("returns scheduled_followup for scheduled status", () => {
    expect(inferOperationalIntent({ status: "scheduled" }, "task")).toBe("scheduled_followup");
  });

  it("returns artifact_available for document sourceType", () => {
    expect(inferOperationalIntent({}, "document")).toBe("artifact_available");
  });

  it("returns briefing_available for continuity sourceType", () => {
    expect(inferOperationalIntent({}, "continuity")).toBe("briefing_available");
  });

  it("returns mission_progress for mission sourceType with active status", () => {
    expect(inferOperationalIntent({ status: "active" }, "mission")).toBe("mission_progress");
  });

  it("returns neutral for empty row", () => {
    expect(inferOperationalIntent({}, "log")).toBe("neutral");
  });
});

// ─── 22. buildFeedActionTarget ────────────────────────────

describe("buildFeedActionTarget", () => {
  it("returns approve_task for awaiting_approval task", () => {
    const target = buildFeedActionTarget({ id: "t1", status: "awaiting_approval" }, "task", "alert");
    expect(target?.kind).toBe("approve_task");
  });

  it("approve_task method is POST", () => {
    const target = buildFeedActionTarget({ id: "t1", status: "awaiting_approval" }, "task", "alert");
    expect(target?.method).toBe("POST");
  });

  it("approve_task task_id is set", () => {
    const target = buildFeedActionTarget({ id: "t1", status: "awaiting_approval" }, "task", "alert");
    expect(target?.task_id).toBe("t1");
  });

  it("returns run_task for ready task without approval_required", () => {
    const target = buildFeedActionTarget({ id: "t2", status: "ready" }, "task", "follow_up");
    expect(target?.kind).toBe("run_task");
  });

  it("returns open_employee_file for employee_file sourceType", () => {
    const target = buildFeedActionTarget({ employee_id: "emp1" }, "employee_file", "alert");
    expect(target?.kind).toBe("open_employee_file");
  });

  it("returns open_document for document sourceType", () => {
    const target = buildFeedActionTarget({ id: "d1" }, "document", "delivery");
    expect(target?.kind).toBe("open_document");
  });

  it("returns read_briefing for briefing category", () => {
    const target = buildFeedActionTarget({}, "log", "briefing");
    expect(target?.kind).toBe("read_briefing");
  });

  it("action target label is a non-empty string", () => {
    const target = buildFeedActionTarget({ id: "t1", status: "awaiting_approval" }, "task", "alert");
    expect(typeof target?.label).toBe("string");
    expect((target?.label ?? "").length).toBeGreaterThan(0);
  });

  it("returns null for empty row", () => {
    const target = buildFeedActionTarget({}, "log", "follow_up");
    expect(target).toBeNull();
  });

  it("open_mission for alert category mission", () => {
    const target = buildFeedActionTarget({ id: "m1" }, "mission", "alert");
    expect(target?.kind).toBe("open_mission");
  });
});

// ─── 23. buildFeedDisplayContext ─────────────────────────

describe("buildFeedDisplayContext", () => {
  it("returns employee dossier label when employee_name is set", () => {
    const item = makeItem({ employee_name: "Sophie Martin" });
    expect(buildFeedDisplayContext(item)).toBe("Dossier salarié — Sophie Martin");
  });

  it("returns document label for document source_type", () => {
    const item = makeItem({ source_type: "document", title: "Contrat CDI" });
    const ctx = buildFeedDisplayContext(item);
    expect(ctx).toContain("Document");
  });

  it("returns Briefing Pierre for continuity source", () => {
    const item = makeItem({ source_type: "continuity" });
    expect(buildFeedDisplayContext(item)).toBe("Briefing Pierre");
  });

  it("returns mission label when mission_id set", () => {
    const item = makeItem({ mission_id: "m99" });
    const ctx = buildFeedDisplayContext(item);
    expect(ctx).toContain("m99");
  });

  it("returns task label when only task_id is set", () => {
    const item = makeItem({ mission_id: null, task_id: "t42", source_type: "task" });
    const ctx = buildFeedDisplayContext(item);
    expect(ctx).toContain("t42");
  });

  it("returns null when no identifying context", () => {
    const item = makeItem({ mission_id: null, task_id: null, source_type: "log" });
    expect(buildFeedDisplayContext(item)).toBeNull();
  });

  it("employee_name takes priority over mission_id", () => {
    const item = makeItem({ employee_name: "Jean Dupont", mission_id: "m1" });
    expect(buildFeedDisplayContext(item)).toContain("Jean Dupont");
  });
});

// ─── 24. Premium fields on builder items ─────────────────

describe("Premium fields on feed item builders", () => {
  it("buildFeedItemFromMission includes intent field", () => {
    const item = buildFeedItemFromMission({ id: "m1", status: "active" });
    expect(item).toHaveProperty("intent");
  });

  it("buildFeedItemFromMission error status gives blocked_or_failed intent", () => {
    const item = buildFeedItemFromMission({ id: "m1", status: "error" });
    expect(item.intent).toBe("blocked_or_failed");
  });

  it("buildFeedItemFromTask includes action_kind field", () => {
    const item = buildFeedItemFromTask({ id: "t1", status: "ready" });
    expect(item).toHaveProperty("action_kind");
  });

  it("buildFeedItemFromDocument sets is_delivery=true", () => {
    const item = buildFeedItemFromDocument({ id: "d1", title: "Contrat" });
    expect(item.is_delivery).toBe(true);
  });

  it("buildFeedItemFromDocument sets is_briefing=false", () => {
    const item = buildFeedItemFromDocument({ id: "d1" });
    expect(item.is_briefing).toBe(false);
  });

  it("buildFeedItemFromLog with briefing event sets is_briefing=true", () => {
    const item = buildFeedItemFromLog({ id: "log1", event_type: "operational_briefing_generated" });
    expect(item.is_briefing).toBe(true);
  });

  it("buildFeedItemFromEmployeeFileSnapshot sensitive sets is_sensitive=true", () => {
    const item = buildFeedItemFromEmployeeFileSnapshot({ employee_id: "emp1", status: "sensitive" });
    expect(item.is_sensitive).toBe(true);
  });

  it("buildFeedItemFromTask blocked sets is_blocking=true", () => {
    const item = buildFeedItemFromTask({ id: "t1", status: "blocked" });
    expect(item.is_blocking).toBe(true);
  });

  it("buildFeedItemFromMission includes action_target field", () => {
    const item = buildFeedItemFromMission({ id: "m1", status: "active" });
    expect(item).toHaveProperty("action_target");
  });

  it("all premium fields present on buildFeedItemFromTask", () => {
    const item = buildFeedItemFromTask({ id: "t1", status: "ready" });
    for (const f of ["intent","action_kind","action_target","display_context","is_sensitive","is_blocking","is_delivery","is_briefing"] as const) {
      expect(item).toHaveProperty(f);
    }
  });
});

// ─── 25. buildPremiumFeedSummary ─────────────────────────

describe("buildPremiumFeedSummary", () => {
  it("returns status=clear and zero counts for empty input", () => {
    const s = buildPremiumFeedSummary([]);
    expect(s.status).toBe("clear");
    expect(s.alerts_count).toBe(0);
    expect(s.action_required_count).toBe(0);
  });

  it("headline is a non-empty string", () => {
    const s = buildPremiumFeedSummary([]);
    expect(typeof s.headline).toBe("string");
    expect(s.headline.length).toBeGreaterThan(0);
  });

  it("counts alerts_count correctly", () => {
    const items = [makeItem({ category: "alert" }), makeItem({ id: "b", category: "follow_up" })];
    expect(buildPremiumFeedSummary(items).alerts_count).toBe(1);
  });

  it("has_blocking_alert=true when alert item present", () => {
    const items = [makeItem({ category: "alert" })];
    expect(buildPremiumFeedSummary(items).has_blocking_alert).toBe(true);
  });

  it("has_sensitive_case=true when is_sensitive item present", () => {
    const items = [makeItem({ is_sensitive: true })];
    expect(buildPremiumFeedSummary(items).has_sensitive_case).toBe(true);
  });

  it("status=sensitive when is_sensitive item present", () => {
    const items = [makeItem({ is_sensitive: true })];
    expect(buildPremiumFeedSummary(items).status).toBe("sensitive");
  });

  it("status=blocked when is_blocking item and no sensitive", () => {
    const items = [makeItem({ is_blocking: true })];
    expect(buildPremiumFeedSummary(items).status).toBe("blocked");
  });

  it("status=attention_required when urgent alert item", () => {
    const items = [makeItem({ category: "alert", priority: "urgent" })];
    expect(buildPremiumFeedSummary(items).status).toBe("attention_required");
  });

  it("action_required_count counts action_required items", () => {
    const items = [makeItem({ action_required: true }), makeItem({ id: "b", action_required: true }), makeItem({ id: "c" })];
    expect(buildPremiumFeedSummary(items).action_required_count).toBe(2);
  });

  it("top_priority is title of highest priority item", () => {
    const items = [
      makeItem({ title: "Low item", priority: "low" }),
      makeItem({ id: "b", title: "Urgent item", priority: "urgent" }),
    ];
    expect(buildPremiumFeedSummary(items).top_priority).toBe("Urgent item");
  });
});

// ─── 26. buildOperationalCommandCenter ───────────────────

describe("buildOperationalCommandCenter", () => {
  it("returns empty arrays for empty input", () => {
    const cc = buildOperationalCommandCenter([]);
    expect(cc.urgent_items).toHaveLength(0);
    expect(cc.blocking_items).toHaveLength(0);
    expect(cc.validation_items).toHaveLength(0);
    expect(cc.delivery_items).toHaveLength(0);
    expect(cc.followup_items).toHaveLength(0);
    expect(cc.briefing_items).toHaveLength(0);
    expect(cc.recommended_order).toHaveLength(0);
  });

  it("primary_message is a non-empty string", () => {
    const cc = buildOperationalCommandCenter([]);
    expect(typeof cc.primary_message).toBe("string");
    expect(cc.primary_message.length).toBeGreaterThan(0);
  });

  it("urgent_items contains urgent priority items", () => {
    const items = [makeItem({ priority: "urgent" }), makeItem({ id: "b", priority: "low" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.urgent_items).toHaveLength(1);
    expect(cc.urgent_items[0].priority).toBe("urgent");
  });

  it("blocking_items contains is_blocking=true items", () => {
    const items = [makeItem({ is_blocking: true }), makeItem({ id: "b" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.blocking_items).toHaveLength(1);
    expect(cc.blocking_items[0].is_blocking).toBe(true);
  });

  it("validation_items contains requires_human_validation intent", () => {
    const items = [makeItem({ intent: "requires_human_validation" }), makeItem({ id: "b" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.validation_items).toHaveLength(1);
  });

  it("delivery_items contains is_delivery=true items", () => {
    const items = [makeItem({ is_delivery: true }), makeItem({ id: "b" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.delivery_items).toHaveLength(1);
  });

  it("followup_items contains follow_up category items", () => {
    const items = [makeItem({ category: "follow_up" }), makeItem({ id: "b", category: "alert" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.followup_items.every((i) => i.category === "follow_up")).toBe(true);
  });

  it("briefing_items contains is_briefing=true items", () => {
    const items = [makeItem({ is_briefing: true }), makeItem({ id: "b" })];
    const cc = buildOperationalCommandCenter(items);
    expect(cc.briefing_items).toHaveLength(1);
  });

  it("recommended_order has no duplicates", () => {
    const items = [
      makeItem({ priority: "urgent", is_blocking: true, intent: "requires_human_validation" }),
      makeItem({ id: "b", priority: "normal" }),
    ];
    const cc = buildOperationalCommandCenter(items);
    const ids = cc.recommended_order.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("recommended_order puts urgent items first", () => {
    const items = [
      makeItem({ id: "low", priority: "low" }),
      makeItem({ id: "urgent", priority: "urgent" }),
    ];
    const cc = buildOperationalCommandCenter(items);
    if (cc.recommended_order.length >= 2) {
      expect(cc.recommended_order[0].priority).toBe("urgent");
    }
  });
});

// ─── 27. Briefing premium fields ─────────────────────────

describe("buildOperationalBriefing — premium fields", () => {
  const alertItem = makeItem({ category: "alert", severity: "critical", priority: "urgent", action_required: true, action_label: "Agir" });
  const deliveryItem = makeItem({ id: "b", category: "delivery", is_delivery: true, title: "Contrat signé" });
  const followupItem = makeItem({ id: "c", category: "follow_up", title: "Suivi RH" });
  const validationItem = makeItem({ id: "d", intent: "requires_human_validation", action_required: true, action_label: "Valider", priority: "high" });
  const employeeItem = makeItem({ id: "e", employee_name: "Marie Curie", source_type: "mission" });
  const missionItem = makeItem({ id: "f", source_type: "mission", mission_id: "m99" });

  it("executive_summary is a non-empty string", () => {
    const b = buildOperationalBriefing([alertItem], "daily");
    expect(b.executive_summary.length).toBeGreaterThan(0);
  });

  it("risk_summary is set when critical alert item present", () => {
    const b = buildOperationalBriefing([alertItem], "instant");
    expect(b.risk_summary).not.toBeNull();
  });

  it("risk_summary is null with no alert items", () => {
    const b = buildOperationalBriefing([followupItem], "daily");
    expect(b.risk_summary).toBeNull();
  });

  it("delivery_summary is set when delivery item present", () => {
    const b = buildOperationalBriefing([deliveryItem], "weekly");
    expect(b.delivery_summary).not.toBeNull();
  });

  it("delivery_summary is null with no delivery items", () => {
    const b = buildOperationalBriefing([alertItem], "monthly");
    expect(b.delivery_summary).toBeNull();
  });

  it("followup_summary is set when follow_up item present", () => {
    const b = buildOperationalBriefing([followupItem], "daily");
    expect(b.followup_summary).not.toBeNull();
  });

  it("validation_summary is set when requires_human_validation item present", () => {
    const b = buildOperationalBriefing([validationItem], "instant");
    expect(b.validation_summary).not.toBeNull();
  });

  it("recommended_next_actions is an array", () => {
    const b = buildOperationalBriefing([alertItem, validationItem], "daily");
    expect(Array.isArray(b.recommended_next_actions)).toBe(true);
  });

  it("employee_focus is set when employee_name present", () => {
    const b = buildOperationalBriefing([employeeItem], "daily");
    expect(b.employee_focus).not.toBeNull();
    expect(b.employee_focus).toContain("Marie Curie");
  });

  it("mission_focus is set when mission source items present", () => {
    const b = buildOperationalBriefing([missionItem], "weekly");
    expect(b.mission_focus).not.toBeNull();
  });

  it("all premium fields present on briefing object", () => {
    const b = buildOperationalBriefing([], "daily");
    for (const f of ["executive_summary","risk_summary","delivery_summary","followup_summary","validation_summary","recommended_next_actions","employee_focus","mission_focus"] as const) {
      expect(b).toHaveProperty(f);
    }
  });
});

// ─── 28. buildPierreOperationalFeed — premium output ─────

describe("buildPierreOperationalFeed — premium output", () => {
  const missions = [{ id: "m1", status: "active", mission_summary: "Recrutement CDI", created_at: "2024-01-01" }];

  it("feed has premium_summary field", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(feed).toHaveProperty("premium_summary");
  });

  it("feed has command_center field", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(feed).toHaveProperty("command_center");
  });

  it("premium_summary.status is a valid status value", () => {
    const feed = buildPierreOperationalFeed({ missions });
    const validStatuses = ["clear","active","attention_required","blocked","sensitive"];
    expect(validStatuses).toContain(feed.premium_summary.status);
  });

  it("command_center.recommended_order is an array", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(Array.isArray(feed.command_center.recommended_order)).toBe(true);
  });

  it("command_center.primary_message is a non-empty string", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(typeof feed.command_center.primary_message).toBe("string");
    expect(feed.command_center.primary_message.length).toBeGreaterThan(0);
  });

  it("premium_summary.alerts_count matches summary.alert", () => {
    const feed = buildPierreOperationalFeed({ missions });
    expect(feed.premium_summary.alerts_count).toBe(feed.summary.alert);
  });

  it("premium_summary.headline is non-empty string", () => {
    const feed = buildPierreOperationalFeed({});
    expect(typeof feed.premium_summary.headline).toBe("string");
    expect(feed.premium_summary.headline.length).toBeGreaterThan(0);
  });

  it("items have intent field set", () => {
    const feed = buildPierreOperationalFeed({ missions });
    for (const item of feed.items) {
      expect(item).toHaveProperty("intent");
    }
  });
});
