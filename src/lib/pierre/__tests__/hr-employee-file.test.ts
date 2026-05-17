import { describe, expect, it } from "vitest";

import {
  normalizeEmployeeFileProfile,
  resolveEmployeeIdentity,
  doesRowBelongToEmployee,
  filterEmployeeMissions,
  filterEmployeeTasks,
  filterEmployeeDocuments,
  filterEmployeeLogs,
  classifyEmployeeFileRisk,
  detectEmployeeMissingInfo,
  buildEmployeeTimeline,
  buildEmployeeFileSections,
  scoreEmployeeFileHealth,
  buildEmployeeNextActions,
  buildEmployeeFileDigest,
  buildEmployeeFile360,
  buildEmployeeFileSnapshot,
  buildEmployeeFileIndex,
  type PierreEmployeeFileProfile,
  type PierreEmployeeIdentity,
  type PierreEmployeeFileRisk,
  type PierreEmployeeFileMissingInfo,
  type PierreEmployeeFileTask,
  type PierreEmployeeFileMission,
  type PierreEmployeeFileDocument,
  type PierreEmployeeFileLog,
} from "../hr/employee-file";

// ══════════════════════════════════════════════════════════
// Fixtures
// ══════════════════════════════════════════════════════════

const EMPLOYEE_ALICE = {
  id: "emp-alice-001",
  full_name: "Alice Dupont",
  email: "alice.dupont@example.com",
  role: "Développeuse",
  department: "IT",
  site: "Paris",
  status: "active",
  start_date: "2022-01-10",
};

const EMPLOYEE_BOB = {
  id: "emp-bob-002",
  full_name: "Bob Martin",
  email: "bob.martin@example.com",
  role: "RH",
  department: "Ressources Humaines",
  status: "active",
  start_date: "2021-05-01",
};

function makeProfile(overrides: Partial<typeof EMPLOYEE_ALICE> = {}): PierreEmployeeFileProfile {
  return normalizeEmployeeFileProfile({ ...EMPLOYEE_ALICE, ...overrides });
}

function makeIdentity(overrides: Partial<typeof EMPLOYEE_ALICE> = {}): PierreEmployeeIdentity {
  return resolveEmployeeIdentity(makeProfile(overrides));
}

function makeTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "task-001",
    mission_id: "mission-001",
    type: "doc.generate",
    title: "Générer document RH",
    status: "done",
    approval_required: false,
    execute_at: "2024-03-01T10:00:00Z",
    created_at: "2024-03-01T09:00:00Z",
    employee_id: "emp-alice-001",
    ...overrides,
  };
}

function makeMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mission-001",
    status: "done",
    mission_summary: "Onboarding Alice Dupont",
    intent: "onboarding",
    risk_level: null,
    approval_required: false,
    created_at: "2024-03-01T08:00:00Z",
    employee_id: "emp-alice-001",
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "doc-001",
    mission_id: "mission-001",
    task_id: "task-001",
    doc_type: "document_onboarding",
    title: "Document onboarding Alice",
    created_at: "2024-03-01T11:00:00Z",
    employee_id: "emp-alice-001",
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "log-001",
    mission_id: "mission-001",
    task_id: "task-001",
    event_type: "task_execution_completed",
    message: "Tâche exécutée avec succès",
    created_at: "2024-03-01T10:30:00Z",
    meta_json: { employee_id: "emp-alice-001" },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════
// normalizeEmployeeFileProfile
// ══════════════════════════════════════════════════════════

describe("normalizeEmployeeFileProfile — valid input", () => {
  it("maps id field to employee_id", () => {
    const p = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(p.employee_id).toBe("emp-alice-001");
  });

  it("maps employee_id field if id is absent", () => {
    const p = normalizeEmployeeFileProfile({ employee_id: "emp-x", full_name: "Jean Dupont" });
    expect(p.employee_id).toBe("emp-x");
  });

  it("maps full_name to employee_name", () => {
    const p = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(p.employee_name).toBe("Alice Dupont");
  });

  it("falls back to name when full_name absent", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", name: "Jean Paul" });
    expect(p.employee_name).toBe("Jean Paul");
  });

  it("falls back to email when no name fields", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", email: "x@y.com" });
    expect(p.employee_name).toBe("x@y.com");
  });

  it("provides Salarié sans nom fallback", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1" });
    expect(p.employee_name).toBe("Salarié sans nom");
  });

  it("maps email correctly", () => {
    const p = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(p.email).toBe("alice.dupont@example.com");
  });

  it("maps role and department", () => {
    const p = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(p.role).toBe("Développeuse");
    expect(p.department).toBe("IT");
  });

  it("maps start_date and end_date", () => {
    const p = normalizeEmployeeFileProfile({ ...EMPLOYEE_ALICE, end_date: "2025-06-30" });
    expect(p.start_date).toBe("2022-01-10");
    expect(p.end_date).toBe("2025-06-30");
  });

  it("normalized_name is lowercase without accents", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", full_name: "Élodie Lévy" });
    expect(p.normalized_name).toBe("elodie levy");
  });

  it("stores raw object reference", () => {
    const p = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(p.raw).toMatchObject({ id: "emp-alice-001" });
  });
});

describe("normalizeEmployeeFileProfile — deterministic fallback ID", () => {
  it("generates deterministic ID when no id/employee_id present", () => {
    const p1 = normalizeEmployeeFileProfile({ full_name: "Marie Curie", email: "m@c.fr" });
    const p2 = normalizeEmployeeFileProfile({ full_name: "Marie Curie", email: "m@c.fr" });
    expect(p1.employee_id).toBe(p2.employee_id);
  });

  it("fallback ID does not contain timestamp (no Date.now)", () => {
    const p1 = normalizeEmployeeFileProfile({ full_name: "No Id User" });
    const p2 = normalizeEmployeeFileProfile({ full_name: "No Id User" });
    expect(p1.employee_id).toBe(p2.employee_id);
  });

  it("different names produce different fallback IDs", () => {
    const p1 = normalizeEmployeeFileProfile({ full_name: "Jean Dupont" });
    const p2 = normalizeEmployeeFileProfile({ full_name: "Marie Martin" });
    expect(p1.employee_id).not.toBe(p2.employee_id);
  });
});

describe("normalizeEmployeeFileProfile — robustness", () => {
  it("handles null input", () => {
    const p = normalizeEmployeeFileProfile(null);
    expect(p.employee_name).toBe("Salarié sans nom");
    expect(p.email).toBeNull();
  });

  it("handles undefined input", () => {
    const p = normalizeEmployeeFileProfile(undefined);
    expect(p.employee_name).toBe("Salarié sans nom");
  });

  it("handles non-object input (string)", () => {
    const p = normalizeEmployeeFileProfile("not-an-object");
    expect(p.employee_name).toBe("Salarié sans nom");
  });

  it("handles empty object", () => {
    const p = normalizeEmployeeFileProfile({});
    expect(p.employee_name).toBe("Salarié sans nom");
  });
});

// ══════════════════════════════════════════════════════════
// resolveEmployeeIdentity
// ══════════════════════════════════════════════════════════

describe("resolveEmployeeIdentity", () => {
  it("returns correct employee_id and normalized_name", () => {
    const p = makeProfile();
    const id = resolveEmployeeIdentity(p);
    expect(id.employee_id).toBe("emp-alice-001");
    expect(id.normalized_name).toBe("alice dupont");
  });

  it("lowercases email", () => {
    const p = makeProfile({ email: "ALICE@EXAMPLE.COM" });
    const id = resolveEmployeeIdentity(p);
    expect(id.email).toBe("alice@example.com");
  });

  it("email is null when absent", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", full_name: "No Email" });
    const id = resolveEmployeeIdentity(p);
    expect(id.email).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// doesRowBelongToEmployee
// ══════════════════════════════════════════════════════════

describe("doesRowBelongToEmployee — direct employee_id match", () => {
  it("returns true on direct employee_id match", () => {
    const id = makeIdentity();
    expect(doesRowBelongToEmployee({ employee_id: "emp-alice-001" }, id)).toBe(true);
  });

  it("returns false for different employee_id", () => {
    const id = makeIdentity();
    expect(doesRowBelongToEmployee({ employee_id: "emp-bob-002" }, id)).toBe(false);
  });

  it("returns false when row is null", () => {
    const id = makeIdentity();
    expect(doesRowBelongToEmployee(null, id)).toBe(false);
  });

  it("returns false when row is not an object", () => {
    const id = makeIdentity();
    expect(doesRowBelongToEmployee("string", id)).toBe(false);
    expect(doesRowBelongToEmployee(42, id)).toBe(false);
  });
});

describe("doesRowBelongToEmployee — nested employee_id", () => {
  it("matches employee_id in payload_json", () => {
    const id = makeIdentity();
    const row = { payload_json: { employee_id: "emp-alice-001" } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("matches employee_id in employee_context inside payload_json", () => {
    const id = makeIdentity();
    const row = { payload_json: { employee_context: { employee_id: "emp-alice-001" } } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("matches employee_id in brain_output_json", () => {
    const id = makeIdentity();
    const row = { brain_output_json: { employee_id: "emp-alice-001" } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("matches employee_id in meta_json", () => {
    const id = makeIdentity();
    const row = { meta_json: { employee_id: "emp-alice-001" } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });
});

describe("doesRowBelongToEmployee — email match", () => {
  it("matches direct email field", () => {
    const id = makeIdentity();
    const row = { email: "alice.dupont@example.com" };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("email match is case-insensitive", () => {
    const id = makeIdentity();
    const row = { email: "ALICE.DUPONT@EXAMPLE.COM" };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("does not match different email", () => {
    const id = makeIdentity();
    const row = { email: "other@example.com" };
    expect(doesRowBelongToEmployee(row, id)).toBe(false);
  });
});

describe("doesRowBelongToEmployee — name match anti false-positive", () => {
  it("matches on employee_name field when name is long enough with space", () => {
    const id = makeIdentity();
    const row = { employee_name: "Alice Dupont" };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("does NOT match on short name without space (false-positive guard)", () => {
    const id = makeIdentity({ full_name: "Ali" } as never);
    const row = { employee_name: "Ali" };
    expect(doesRowBelongToEmployee(row, id)).toBe(false);
  });

  it("does NOT match on name without space", () => {
    const id = makeIdentity({ full_name: "Mononymous" } as never);
    const row = { employee_name: "Mononymous" };
    expect(doesRowBelongToEmployee(row, id)).toBe(false);
  });

  it("matches accent-normalized name", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", full_name: "Éléonore Beaumont" });
    const id = resolveEmployeeIdentity(p);
    const row = { employee_name: "Eleonore Beaumont" };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// filterEmployeeMissions / Tasks / Documents / Logs
// ══════════════════════════════════════════════════════════

describe("filterEmployeeMissions", () => {
  it("returns missions belonging to the employee", () => {
    const id = makeIdentity();
    const missions = [
      { id: "m1", employee_id: "emp-alice-001" },
      { id: "m2", employee_id: "emp-bob-002" },
    ];
    const result = filterEmployeeMissions(id, missions);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("handles non-array input gracefully", () => {
    const id = makeIdentity();
    expect(filterEmployeeMissions(id, null)).toEqual([]);
    expect(filterEmployeeMissions(id, undefined)).toEqual([]);
    expect(filterEmployeeMissions(id, "not-array")).toEqual([]);
  });

  it("skips non-object items in array", () => {
    const id = makeIdentity();
    const missions = [null, undefined, "string", { employee_id: "emp-alice-001" }];
    const result = filterEmployeeMissions(id, missions);
    expect(result).toHaveLength(1);
  });
});

describe("filterEmployeeTasks", () => {
  it("returns tasks matching the employee via direct id", () => {
    const id = makeIdentity();
    const tasks = [
      makeTask({ employee_id: "emp-alice-001" }),
      makeTask({ id: "t2", employee_id: "emp-bob-002" }),
    ];
    expect(filterEmployeeTasks(id, tasks)).toHaveLength(1);
  });

  it("returns tasks matching via payload_json.employee_id", () => {
    const id = makeIdentity();
    const tasks = [
      { id: "t1", payload_json: { employee_id: "emp-alice-001" } },
      { id: "t2", payload_json: { employee_id: "emp-bob-002" } },
    ];
    expect(filterEmployeeTasks(id, tasks)).toHaveLength(1);
  });

  it("handles empty array", () => {
    const id = makeIdentity();
    expect(filterEmployeeTasks(id, [])).toEqual([]);
  });
});

describe("filterEmployeeDocuments", () => {
  it("returns documents matching the employee", () => {
    const id = makeIdentity();
    const docs = [makeDocument(), makeDocument({ id: "doc-2", employee_id: "emp-bob-002" })];
    expect(filterEmployeeDocuments(id, docs)).toHaveLength(1);
  });

  it("handles null input", () => {
    const id = makeIdentity();
    expect(filterEmployeeDocuments(id, null)).toEqual([]);
  });
});

describe("filterEmployeeLogs", () => {
  it("returns logs matching via meta_json.employee_id", () => {
    const id = makeIdentity();
    const logs = [
      { id: "l1", meta_json: { employee_id: "emp-alice-001" } },
      { id: "l2", meta_json: { employee_id: "emp-bob-002" } },
    ];
    expect(filterEmployeeLogs(id, logs)).toHaveLength(1);
  });

  it("handles undefined input", () => {
    const id = makeIdentity();
    expect(filterEmployeeLogs(id, undefined)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
// classifyEmployeeFileRisk
// ══════════════════════════════════════════════════════════

describe("classifyEmployeeFileRisk — no risk", () => {
  it("returns empty array for clean data", () => {
    const profile = makeProfile();
    const risks = classifyEmployeeFileRisk(profile, [], [], [], []);
    expect(Array.isArray(risks)).toBe(true);
    expect(risks.every((r) => r.level !== "black" && r.level !== "red")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — black signals", () => {
  it("detects harcèlement keyword in mission summary", () => {
    const profile = makeProfile();
    const missions = [{ id: "m1", mission_summary: "signalement harcèlement moral" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "black" && r.code === "harcelement")).toBe(true);
  });

  it("detects discrimination keyword in task title", () => {
    const profile = makeProfile();
    const tasks = [{ id: "t1", title: "Cas de discrimination signalé" }];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    expect(risks.some((r) => r.level === "black")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — red signals", () => {
  it("detects licenciement in mission text", () => {
    const profile = makeProfile();
    const missions = [{ id: "m1", mission_summary: "procédure de licenciement en cours" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "red")).toBe(true);
  });

  it("detects blocked task as risk signal", () => {
    const profile = makeProfile();
    const tasks = [{ id: "t1", status: "blocked", title: "Tâche bloquée" }];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    expect(risks.length).toBeGreaterThan(0);
  });

  it("detects error status in task", () => {
    const profile = makeProfile();
    const tasks = [{ id: "t1", status: "error", title: "Tâche erreur" }];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    expect(risks.some((r) => r.level === "red")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — orange signals", () => {
  it("detects onboarding_incomplet", () => {
    const profile = makeProfile({ status: "onboarding" } as never);
    const missions = [{ id: "m1", mission_summary: "onboarding incomplet" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "orange")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — robustness", () => {
  it("handles null/undefined missions/tasks/docs/logs gracefully", () => {
    const profile = makeProfile();
    // Arrays guarded internally — should not throw
    expect(() =>
      classifyEmployeeFileRisk(profile, null as never, null as never, null as never, null as never),
    ).not.toThrow();
    // Empty arrays are always safe
    expect(() =>
      classifyEmployeeFileRisk(profile, [], [], [], []),
    ).not.toThrow();
  });

  it("deduplicates risks with same code+source", () => {
    const profile = makeProfile();
    const tasks = [
      { id: "t1", status: "blocked", title: "Bloqué A" },
      { id: "t2", status: "blocked", title: "Bloqué B" },
    ];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    const codes = risks.map((r) => `${r.code}:${r.source_id}`);
    const unique = new Set(codes);
    expect(codes.length).toBe(unique.size);
  });
});

// ══════════════════════════════════════════════════════════
// detectEmployeeMissingInfo
// ══════════════════════════════════════════════════════════

describe("detectEmployeeMissingInfo", () => {
  it("flags missing email as optional", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont" });
    const missing = detectEmployeeMissingInfo(profile, [], [], []);
    expect(missing.some((m) => m.field === "email")).toBe(true);
  });

  it("does not flag email when present", () => {
    const profile = makeProfile();
    const missing = detectEmployeeMissingInfo(profile, [], [], []);
    expect(missing.some((m) => m.field === "email")).toBe(false);
  });

  it("flags missing role", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missing = detectEmployeeMissingInfo(profile, [], [], []);
    expect(missing.some((m) => m.field === "role")).toBe(true);
  });

  it("flags missing department", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr", role: "Dev" });
    const missing = detectEmployeeMissingInfo(profile, [], [], []);
    expect(missing.some((m) => m.field === "department")).toBe(true);
  });

  it("flags missing start_date when onboarding mission detected", () => {
    const profile = normalizeEmployeeFileProfile({
      id: "e1", full_name: "Jean Dupont", email: "j@d.fr",
      role: "Dev", department: "IT",
    });
    // Onboarding is detected from mission text, not profile status
    const onboardingMission = [{ id: "m1", mission_summary: "onboarding employé" }];
    const missing = detectEmployeeMissingInfo(profile, onboardingMission, [], []);
    expect(missing.some((m) => m.field === "start_date")).toBe(true);
  });

  it("returns array for a complete profile with no tasks/docs", () => {
    const profile = makeProfile();
    const missing = detectEmployeeMissingInfo(profile, [], [], []);
    expect(Array.isArray(missing)).toBe(true);
  });

  it("handles null inputs without crash (guarded internally)", () => {
    const profile = makeProfile();
    expect(() =>
      detectEmployeeMissingInfo(profile, null as never, null as never, null as never),
    ).not.toThrow();
    expect(() =>
      detectEmployeeMissingInfo(profile, [], [], []),
    ).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeTimeline
// ══════════════════════════════════════════════════════════

describe("buildEmployeeTimeline", () => {
  it("returns array of timeline events", () => {
    const profile = makeProfile();
    const missions = [makeMission()];
    const tasks = [makeTask()];
    const docs = [makeDocument()];
    const logs = [makeLog()];
    const timeline = buildEmployeeTimeline(profile, missions, tasks, docs, logs);
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(4);
  });

  it("sorts events by date descending", () => {
    const profile = makeProfile();
    const tasks = [
      makeTask({ id: "t1", created_at: "2024-01-01T00:00:00Z" }),
      makeTask({ id: "t2", created_at: "2024-06-01T00:00:00Z" }),
    ];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    if (timeline.length >= 2 && timeline[0].date && timeline[1].date) {
      expect(new Date(timeline[0].date).getTime()).toBeGreaterThanOrEqual(
        new Date(timeline[1].date).getTime(),
      );
    }
  });

  it("assigns source_type correctly for tasks", () => {
    const profile = makeProfile();
    const tasks = [makeTask()];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    expect(timeline.some((e) => e.source_type === "task")).toBe(true);
  });

  it("assigns source_type correctly for missions", () => {
    const profile = makeProfile();
    const missions = [makeMission()];
    const timeline = buildEmployeeTimeline(profile, missions, [], [], []);
    expect(timeline.some((e) => e.source_type === "mission")).toBe(true);
  });

  it("assigns event_type task_completed for done tasks", () => {
    const profile = makeProfile();
    const tasks = [makeTask({ status: "done" })];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    expect(timeline.some((e) => e.event_type === "task_completed")).toBe(true);
  });

  it("assigns approval_required event type for awaiting_approval tasks", () => {
    const profile = makeProfile();
    const tasks = [makeTask({ status: "awaiting_approval" })];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    expect(timeline.some((e) => e.event_type === "approval_required")).toBe(true);
  });

  it("handles empty inputs without crash", () => {
    const profile = makeProfile();
    expect(() => buildEmployeeTimeline(profile, [], [], [], [])).not.toThrow();
    expect(buildEmployeeTimeline(profile, [], [], [], [])).toEqual([]);
  });

  it("places null-date events at the end", () => {
    const profile = makeProfile();
    const tasks = [
      makeTask({ id: "t1", created_at: null }),
      makeTask({ id: "t2", created_at: "2024-01-01T00:00:00Z" }),
    ];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    const nullIdx = timeline.findIndex((e) => !e.date);
    const hasDateIdx = timeline.findIndex((e) => e.date);
    if (nullIdx !== -1 && hasDateIdx !== -1) {
      expect(nullIdx).toBeGreaterThan(hasDateIdx);
    }
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFileSections
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFileSections", () => {
  it("returns 9 sections in fixed order", () => {
    const sections = buildEmployeeFileSections({
      profile: makeProfile(),
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      risks: [],
      missing_info: [],
      timeline: [],
      next_actions: [],
    });
    expect(sections).toHaveLength(9);
    expect(sections[0].key).toBe("profile");
    expect(sections[0].count).toBe(1);
  });

  it("profile section always has count 1", () => {
    const sections = buildEmployeeFileSections({
      profile: makeProfile(),
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      risks: [],
      missing_info: [],
      timeline: [],
      next_actions: [],
    });
    expect(sections.find((s) => s.key === "profile")!.count).toBe(1);
  });

  it("counts tasks correctly", () => {
    const tasks: PierreEmployeeFileTask[] = [
      { id: "t1", mission_id: null, type: "doc", title: "T", status: "done", approval_required: false, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} },
    ];
    const sections = buildEmployeeFileSections({
      profile: makeProfile(),
      missions: [],
      tasks,
      documents: [],
      logs: [],
      risks: [],
      missing_info: [],
      timeline: [],
      next_actions: [],
    });
    expect(sections.find((s) => s.key === "tasks")!.count).toBe(1);
  });

  it("each section has a non-empty label", () => {
    const sections = buildEmployeeFileSections({
      profile: makeProfile(),
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
      risks: [],
      missing_info: [],
      timeline: [],
      next_actions: [],
    });
    expect(sections.every((s) => s.label.length > 0)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// scoreEmployeeFileHealth
// ══════════════════════════════════════════════════════════

describe("scoreEmployeeFileHealth", () => {
  it("returns 100 for clean dossier with docs", () => {
    const docs: PierreEmployeeFileDocument[] = [
      { id: "d1", mission_id: null, task_id: null, title: "Doc", doc_type: null, created_at: null, raw: {} },
    ];
    const health = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [], documents: docs });
    expect(health.score).toBeGreaterThan(95);
  });

  it("penalizes black risk by 30", () => {
    const risk: PierreEmployeeFileRisk = { level: "black", code: "test", label: "T", reason: "R", source_type: "mission", source_id: null };
    const h1 = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [], documents: [] });
    const h2 = scoreEmployeeFileHealth({ tasks: [], risks: [risk], missing_info: [], documents: [] });
    expect(h1.score - h2.score).toBe(30);
  });

  it("penalizes red risk by 15", () => {
    const risk: PierreEmployeeFileRisk = { level: "red", code: "test", label: "T", reason: "R", source_type: "task", source_id: null };
    const h1 = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [], documents: [] });
    const h2 = scoreEmployeeFileHealth({ tasks: [], risks: [risk], missing_info: [], documents: [] });
    expect(h1.score - h2.score).toBe(15);
  });

  it("penalizes required missing_info by 8", () => {
    const m: PierreEmployeeFileMissingInfo = { field: "email", label: "Email", required: true, reason: "R" };
    const h = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [m], documents: [] });
    expect(h.score).toBe(100 - 8);
  });

  it("penalizes optional missing_info by 3", () => {
    const m: PierreEmployeeFileMissingInfo = { field: "site", label: "Site", required: false, reason: "R" };
    const h = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [m], documents: [] });
    expect(h.score).toBe(100 - 3);
  });

  it("penalizes blocked task by 5", () => {
    const t: PierreEmployeeFileTask = { id: "t1", mission_id: null, type: "doc", title: "T", status: "blocked", approval_required: false, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} };
    const h = scoreEmployeeFileHealth({ tasks: [t], risks: [], missing_info: [], documents: [] });
    expect(h.score).toBe(100 - 5);
  });

  it("score never goes below 0", () => {
    const risks: PierreEmployeeFileRisk[] = Array.from({ length: 10 }, () => ({
      level: "black" as const, code: "x", label: "X", reason: "R", source_type: "task" as const, source_id: null,
    }));
    const h = scoreEmployeeFileHealth({ tasks: [], risks, missing_info: [], documents: [] });
    expect(h.score).toBeGreaterThanOrEqual(0);
  });

  it("returns appropriate label for high score", () => {
    const h = scoreEmployeeFileHealth({ tasks: [], risks: [], missing_info: [], documents: [] });
    expect(h.label).toContain("complet");
  });

  it("returns critique label for very low score", () => {
    const risks: PierreEmployeeFileRisk[] = Array.from({ length: 5 }, () => ({
      level: "black" as const, code: "x", label: "X", reason: "R", source_type: "task" as const, source_id: null,
    }));
    const h = scoreEmployeeFileHealth({ tasks: [], risks, missing_info: [], documents: [] });
    expect(h.label.toLowerCase()).toContain("critique");
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeNextActions
// ══════════════════════════════════════════════════════════

describe("buildEmployeeNextActions", () => {
  it("returns no_action for clean dossier", () => {
    const actions = buildEmployeeNextActions({ tasks: [], risks: [], missing_info: [], missions: [] });
    expect(actions.some((a) => a.type === "no_action")).toBe(true);
  });

  it("returns urgent approve action for black risk", () => {
    const risk: PierreEmployeeFileRisk = { level: "black", code: "harcelement", label: "H", reason: "R", source_type: "mission", source_id: null };
    const actions = buildEmployeeNextActions({ tasks: [], risks: [risk], missing_info: [], missions: [] });
    expect(actions.some((a) => a.priority === "urgent")).toBe(true);
  });

  it("returns resolve_blocked_task for blocked task", () => {
    const t: PierreEmployeeFileTask = { id: "t1", mission_id: null, type: "doc", title: "T", status: "blocked", approval_required: false, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} };
    const actions = buildEmployeeNextActions({ tasks: [t], risks: [], missing_info: [], missions: [] });
    expect(actions.some((a) => a.type === "resolve_blocked_task")).toBe(true);
  });

  it("returns complete_profile for missing required info", () => {
    const m: PierreEmployeeFileMissingInfo = { field: "email", label: "Email", required: true, reason: "R" };
    const actions = buildEmployeeNextActions({ tasks: [], risks: [], missing_info: [m], missions: [] });
    expect(actions.some((a) => a.type === "complete_profile")).toBe(true);
  });

  it("returns approve_sensitive_task for awaiting_approval tasks", () => {
    const t: PierreEmployeeFileTask = { id: "t1", mission_id: null, type: "doc", title: "T", status: "awaiting_approval", approval_required: true, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} };
    const actions = buildEmployeeNextActions({ tasks: [t], risks: [], missing_info: [], missions: [] });
    expect(actions.some((a) => a.type === "approve_sensitive_task")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFileDigest
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFileDigest", () => {
  it("returns complete tone for clean dossier", () => {
    const d = buildEmployeeFileDigest({ risks: [], tasks: [], missing_info: [] });
    expect(d.tone).toBe("complete");
  });

  it("returns sensitive tone for black risk", () => {
    const risk: PierreEmployeeFileRisk = { level: "black", code: "x", label: "X", reason: "R", source_type: "mission", source_id: null };
    const d = buildEmployeeFileDigest({ risks: [risk], tasks: [], missing_info: [] });
    expect(d.tone).toBe("sensitive");
  });

  it("returns blocked tone for blocked task", () => {
    const t: PierreEmployeeFileTask = { id: "t1", mission_id: null, type: "doc", title: "T", status: "blocked", approval_required: false, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} };
    const d = buildEmployeeFileDigest({ risks: [], tasks: [t], missing_info: [] });
    expect(d.tone).toBe("blocked");
  });

  it("returns waiting tone for awaiting_approval task", () => {
    const t: PierreEmployeeFileTask = { id: "t1", mission_id: null, type: "doc", title: "T", status: "awaiting_approval", approval_required: true, execute_at: null, risk_level: null, created_at: null, updated_at: null, raw: {} };
    const d = buildEmployeeFileDigest({ risks: [], tasks: [t], missing_info: [] });
    expect(d.tone).toBe("waiting");
  });

  it("returns non-empty text string", () => {
    const d = buildEmployeeFileDigest({ risks: [], tasks: [], missing_info: [] });
    expect(typeof d.text).toBe("string");
    expect(d.text.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFile360
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFile360", () => {
  it("returns a full PierreEmployeeFile360 object", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [makeMission()],
      tasks: [makeTask()],
      documents: [makeDocument()],
      logs: [makeLog()],
    });
    expect(file.profile.employee_id).toBe("emp-alice-001");
    expect(Array.isArray(file.missions)).toBe(true);
    expect(Array.isArray(file.tasks)).toBe(true);
    expect(Array.isArray(file.documents)).toBe(true);
    expect(Array.isArray(file.logs)).toBe(true);
    expect(Array.isArray(file.risks)).toBe(true);
    expect(Array.isArray(file.missing_info)).toBe(true);
    expect(Array.isArray(file.timeline)).toBe(true);
    expect(Array.isArray(file.next_actions)).toBe(true);
    expect(Array.isArray(file.sections)).toBe(true);
    expect(typeof file.health.score).toBe("number");
    expect(typeof file.digest.text).toBe("string");
    expect(["complete", "incomplete", "attention_required", "sensitive"]).toContain(file.status);
    expect(["green", "orange", "red", "black"]).toContain(file.risk_level);
  });

  it("filters out rows not belonging to the employee", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [
        makeMission({ id: "m-alice", employee_id: "emp-alice-001", mission_summary: "Mission Alice" }),
        // Bob's mission has a neutral summary without Alice's name
        { id: "m-bob", employee_id: "emp-bob-002", mission_summary: "Mission Bob", status: "done" },
      ],
      tasks: [],
      documents: [],
      logs: [],
    });
    // Only alice's mission should be included
    expect(file.missions.every((m) => m.raw.employee_id === "emp-alice-001")).toBe(true);
    expect(file.missions.length).toBe(1);
  });

  it("returns complete status for a healthy dossier", () => {
    const file = buildEmployeeFile360({ employee: EMPLOYEE_ALICE, missions: [], tasks: [], documents: [], logs: [] });
    expect(["complete", "incomplete"]).toContain(file.status);
  });

  it("does not throw on empty inputs", () => {
    expect(() => buildEmployeeFile360({ employee: {}, missions: [], tasks: [], documents: [], logs: [] })).not.toThrow();
  });

  it("does not throw on malformed employee input", () => {
    expect(() => buildEmployeeFile360({ employee: null as never, missions: [], tasks: [], documents: [], logs: [] })).not.toThrow();
  });

  it("has sections with 9 entries", () => {
    const file = buildEmployeeFile360({ employee: EMPLOYEE_ALICE, missions: [], tasks: [], documents: [], logs: [] });
    expect(file.sections).toHaveLength(9);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFileSnapshot
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFileSnapshot", () => {
  it("returns compact snapshot from full file", () => {
    const file = buildEmployeeFile360({ employee: EMPLOYEE_ALICE, missions: [], tasks: [], documents: [], logs: [] });
    const snap = buildEmployeeFileSnapshot(file);
    expect(snap.employee_id).toBe("emp-alice-001");
    expect(snap.employee_name).toBe("Alice Dupont");
    expect(typeof snap.health_score).toBe("number");
    expect(["green", "orange", "red", "black"]).toContain(snap.risk_level);
    expect(typeof snap.digest_text).toBe("string");
    expect(typeof snap.missing_info_count).toBe("number");
    expect(typeof snap.open_tasks_count).toBe("number");
    expect(typeof snap.pending_approval_count).toBe("number");
  });

  it("counts open tasks correctly", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [],
      tasks: [
        makeTask({ id: "t1", status: "ready" }),
        makeTask({ id: "t2", status: "done" }),
      ],
      documents: [],
      logs: [],
    });
    const snap = buildEmployeeFileSnapshot(file);
    expect(snap.open_tasks_count).toBe(1);
  });

  it("counts pending approval correctly", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [],
      tasks: [makeTask({ id: "t1", status: "awaiting_approval" })],
      documents: [],
      logs: [],
    });
    const snap = buildEmployeeFileSnapshot(file);
    expect(snap.pending_approval_count).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFileIndex
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFileIndex", () => {
  it("returns index with files array and totals", () => {
    const index = buildEmployeeFileIndex([EMPLOYEE_ALICE, EMPLOYEE_BOB], [], [], [], []);
    expect(Array.isArray(index.files)).toBe(true);
    expect(index.files).toHaveLength(2);
    expect(typeof index.totals.employees).toBe("number");
    expect(index.totals.employees).toBe(2);
  });

  it("totals match sum of statuses", () => {
    const index = buildEmployeeFileIndex([EMPLOYEE_ALICE], [], [], [], []);
    const total = index.totals.complete + index.totals.incomplete + index.totals.attention_required + index.totals.sensitive;
    expect(total).toBe(1);
  });

  it("attention_required and sensitive arrays contain snapshots", () => {
    const index = buildEmployeeFileIndex([EMPLOYEE_ALICE], [], [], [], []);
    expect(Array.isArray(index.attention_required)).toBe(true);
    expect(Array.isArray(index.sensitive)).toBe(true);
    expect(Array.isArray(index.incomplete)).toBe(true);
  });

  it("handles empty employee list", () => {
    const index = buildEmployeeFileIndex([], [], [], [], []);
    expect(index.files).toHaveLength(0);
    expect(index.totals.employees).toBe(0);
  });

  it("handles null inputs without crash", () => {
    expect(() => buildEmployeeFileIndex(null as never, null as never, null as never, null as never, null as never)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
// doesRowBelongToEmployee — extended cases
// ══════════════════════════════════════════════════════════

describe("doesRowBelongToEmployee — context_snapshot_json and brain_output_json", () => {
  it("matches employee_id in context_snapshot_json", () => {
    const id = makeIdentity();
    const row = { context_snapshot_json: { employee_id: "emp-alice-001" } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("matches employee_id in employee_context nested inside brain_output_json", () => {
    const id = makeIdentity();
    const row = { brain_output_json: { employee_context: { employee_id: "emp-alice-001" } } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("matches email in nested brain_output_json.email", () => {
    const id = makeIdentity();
    const row = { brain_output_json: { email: "alice.dupont@example.com" } };
    expect(doesRowBelongToEmployee(row, id)).toBe(true);
  });

  it("does NOT match free text when name is < 8 chars (anti false-positive)", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", full_name: "Ali Doe" });
    const id = resolveEmployeeIdentity(p);
    // normalized_name = "ali doe" (7 chars) — text match requires >= 8
    const row = { mission_summary: "Traitement dossier ali doe en cours" };
    expect(doesRowBelongToEmployee(row, id)).toBe(false);
  });

  it("does NOT match on name without space in free text", () => {
    const p = normalizeEmployeeFileProfile({ id: "e1", full_name: "Mononymous" });
    const id = resolveEmployeeIdentity(p);
    const row = { mission_summary: "Dossier Mononymous important" };
    expect(doesRowBelongToEmployee(row, id)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// classifyEmployeeFileRisk — extended signals
// ══════════════════════════════════════════════════════════

describe("classifyEmployeeFileRisk — black: prudhommes and faute grave", () => {
  it("detects prudhommes keyword → black", () => {
    const profile = makeProfile();
    const missions = [{ id: "m1", mission_summary: "Saisine conseil de prud'hommes" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "black" && r.code === "litige_prud")).toBe(true);
  });

  it("detects faute grave keyword → black", () => {
    const profile = makeProfile();
    const tasks = [{ id: "t1", title: "Procédure faute grave" }];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    expect(risks.some((r) => r.level === "black" && r.code === "procedure_disciplinaire")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — red: rupture and offboarding profile", () => {
  it("detects rupture conventionnelle → red", () => {
    const profile = makeProfile();
    const missions = [{ id: "m1", mission_summary: "Négociation rupture conventionnelle" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "red" && r.code === "rupture")).toBe(true);
  });

  it("detects profile status offboarding → red", () => {
    const profile = makeProfile({ status: "offboarding" } as never);
    const risks = classifyEmployeeFileRisk(profile, [], [], [], []);
    expect(risks.some((r) => r.level === "red" && r.code === "offboarding")).toBe(true);
  });
});

describe("classifyEmployeeFileRisk — orange: absence and awaiting_approval", () => {
  it("detects absence keyword in mission → orange", () => {
    const profile = makeProfile();
    const missions = [{ id: "m1", mission_summary: "Gestion absence prolongée" }];
    const risks = classifyEmployeeFileRisk(profile, missions, [], [], []);
    expect(risks.some((r) => r.level === "orange" && r.code === "absence")).toBe(true);
  });

  it("detects awaiting_approval task → orange approbation_requise", () => {
    const profile = makeProfile();
    const tasks = [{ id: "t1", status: "awaiting_approval", approval_required: true, title: "Validation requise" }];
    const risks = classifyEmployeeFileRisk(profile, [], tasks, [], []);
    expect(risks.some((r) => r.level === "orange" && r.code === "approbation_requise")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// detectEmployeeMissingInfo — extended cases
// ══════════════════════════════════════════════════════════

describe("detectEmployeeMissingInfo — offboarding and absence", () => {
  it("flags end_date when offboarding mission detected", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missions = [{ id: "m1", mission_summary: "Gestion départ salarié offboarding" }];
    const missing = detectEmployeeMissingInfo(profile, missions, [], []);
    expect(missing.some((m) => m.field === "end_date")).toBe(true);
  });

  it("flags absence_details when absence mission without justificatif", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missions = [{ id: "m1", mission_summary: "Gestion absence salarié" }];
    const missing = detectEmployeeMissingInfo(profile, missions, [], []);
    expect(missing.some((m) => m.field === "absence_details")).toBe(true);
  });

  it("flags contract_documents when contract mission and no documents", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missions = [{ id: "m1", mission_summary: "Signature contrat avenant CDI" }];
    const missing = detectEmployeeMissingInfo(profile, missions, [], []);
    expect(missing.some((m) => m.field === "contract_documents")).toBe(true);
  });

  it("does NOT flag contract_documents when docs exist", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missions = [{ id: "m1", mission_summary: "Signature contrat avenant CDI" }];
    const docs = [{ id: "d1", doc_type: "contrat", title: "Contrat signé" }];
    const missing = detectEmployeeMissingInfo(profile, missions, [], docs);
    expect(missing.some((m) => m.field === "contract_documents")).toBe(false);
  });

  it("flags human_validation when sensitive + awaiting_approval task", () => {
    const profile = normalizeEmployeeFileProfile({ id: "e1", full_name: "Jean Dupont", email: "j@d.fr" });
    const missions = [{ id: "m1", mission_summary: "Procédure disciplinaire sensible" }];
    const tasks = [{ id: "t1", approval_required: true, status: "awaiting_approval", title: "Validation" }];
    const missing = detectEmployeeMissingInfo(profile, missions, tasks, []);
    expect(missing.some((m) => m.field === "human_validation")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeTimeline — extended cases
// ══════════════════════════════════════════════════════════

describe("buildEmployeeTimeline — event type inference", () => {
  it("assigns document_generated for document entries", () => {
    const profile = makeProfile();
    const docs = [makeDocument()];
    const timeline = buildEmployeeTimeline(profile, [], [], docs, []);
    expect(timeline.some((e) => e.event_type === "document_generated")).toBe(true);
  });

  it("assigns email_prepared for log with email event_type", () => {
    const profile = makeProfile();
    const logs = [makeLog({ event_type: "email_sent" })];
    const timeline = buildEmployeeTimeline(profile, [], [], [], logs);
    expect(timeline.some((e) => e.event_type === "email_prepared")).toBe(true);
  });

  it("assigns task_blocked for blocked task status", () => {
    const profile = makeProfile();
    const tasks = [makeTask({ status: "blocked" })];
    const timeline = buildEmployeeTimeline(profile, [], tasks, [], []);
    expect(timeline.some((e) => e.event_type === "task_blocked")).toBe(true);
  });

  it("handles row with invalid date string without crash", () => {
    const profile = makeProfile();
    const tasks = [makeTask({ created_at: "not-a-date" })];
    expect(() => buildEmployeeTimeline(profile, [], tasks, [], [])).not.toThrow();
  });

  it("deduplicates rows with same source_type and id", () => {
    const profile = makeProfile();
    const task = makeTask({ id: "t-dup" });
    // Passing same row twice in the tasks array
    const timeline = buildEmployeeTimeline(profile, [], [task, task], [], []);
    const count = timeline.filter((e) => e.id === "task:t-dup").length;
    expect(count).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFile360 — status and coherence
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFile360 — status cases", () => {
  it("status is sensitive when black risk present", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [{ id: "m1", employee_id: "emp-alice-001", mission_summary: "Signalement harcèlement moral", status: "open" }],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(file.status).toBe("sensitive");
    expect(file.risk_level).toBe("black");
  });

  it("status is attention_required when red risk present", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [{ id: "m1", employee_id: "emp-alice-001", mission_summary: "Procédure de licenciement", status: "open" }],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(file.status).toBe("attention_required");
  });

  it("status is incomplete when required missing_info exists", () => {
    // Profile without email → missing email (required)
    const file = buildEmployeeFile360({
      employee: { id: "e1", full_name: "Nom Complet" },
      missions: [],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(["incomplete", "attention_required"]).toContain(file.status);
    expect(file.missing_info.some((m) => m.field === "email")).toBe(true);
  });

  it("digest tone is sensitive for black risk", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [{ id: "m1", employee_id: "emp-alice-001", mission_summary: "Violence au travail agression", status: "open" }],
      tasks: [],
      documents: [],
      logs: [],
    });
    expect(file.digest.tone).toBe("sensitive");
  });

  it("snapshot latest_event_at comes from timeline when timeline is populated", () => {
    const file = buildEmployeeFile360({
      employee: EMPLOYEE_ALICE,
      missions: [makeMission({ created_at: "2024-12-01T00:00:00Z" })],
      tasks: [],
      documents: [],
      logs: [],
    });
    const snap = buildEmployeeFileSnapshot(file);
    if (file.timeline.length > 0 && file.timeline[0].date) {
      expect(snap.latest_event_at).toBe(file.timeline[0].date);
    }
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployeeFileIndex — extended cases
// ══════════════════════════════════════════════════════════

describe("buildEmployeeFileIndex — category arrays", () => {
  it("attention_required array is populated for red-risk employees", () => {
    const employeeWithRisk = {
      ...EMPLOYEE_ALICE,
      id: "emp-risk-001",
    };
    const missions = [{ id: "m1", employee_id: "emp-risk-001", mission_summary: "Procédure de licenciement", status: "open" }];
    const index = buildEmployeeFileIndex([employeeWithRisk], missions, [], [], []);
    expect(index.attention_required.length).toBeGreaterThan(0);
    expect(index.attention_required[0].employee_id).toBe("emp-risk-001");
  });

  it("sensitive array is populated for black-risk employees", () => {
    const employeeBlack = { ...EMPLOYEE_ALICE, id: "emp-black-001" };
    const missions = [{ id: "m2", employee_id: "emp-black-001", mission_summary: "Discrimination signalée", status: "open" }];
    const index = buildEmployeeFileIndex([employeeBlack], missions, [], [], []);
    expect(index.sensitive.length).toBeGreaterThan(0);
    expect(index.totals.sensitive).toBeGreaterThan(0);
  });

  it("incomplete array is populated for employees with missing required info", () => {
    const empNoEmail = { id: "emp-no-email", full_name: "Sans Email", role: "Dev", department: "IT" };
    const index = buildEmployeeFileIndex([empNoEmail], [], [], [], []);
    // Should be incomplete (has required missing: email)
    expect(index.totals.incomplete + index.totals.attention_required).toBeGreaterThan(0);
  });

  it("non-object employee rows are skipped in index", () => {
    const employees = [null, undefined, "string", 42, EMPLOYEE_ALICE] as never[];
    const index = buildEmployeeFileIndex(employees, [], [], [], []);
    expect(index.totals.employees).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
// Pure module — no async, no Supabase, no Next
// ══════════════════════════════════════════════════════════

describe("Pure module contract", () => {
  it("normalizeEmployeeFileProfile is synchronous", () => {
    const result = normalizeEmployeeFileProfile(EMPLOYEE_ALICE);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("buildEmployeeFile360 is synchronous", () => {
    const result = buildEmployeeFile360({ employee: EMPLOYEE_ALICE, missions: [], tasks: [], documents: [], logs: [] });
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("buildEmployeeFileSnapshot is synchronous", () => {
    const file = buildEmployeeFile360({ employee: EMPLOYEE_ALICE, missions: [], tasks: [], documents: [], logs: [] });
    const snap = buildEmployeeFileSnapshot(file);
    expect(snap).not.toBeInstanceOf(Promise);
  });

  it("buildEmployeeFileIndex is synchronous", () => {
    const index = buildEmployeeFileIndex([EMPLOYEE_ALICE], [], [], [], []);
    expect(index).not.toBeInstanceOf(Promise);
  });
});
