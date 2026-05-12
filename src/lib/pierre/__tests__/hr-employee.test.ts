import { describe, expect, it } from "vitest";

import {
  sanitizePierreEmployeeProfile,
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  findPierreEmployeeByName,
  buildPierreEmployeeContext,
  resolveEmployeeContext,
  enrichPayloadWithEmployeeContext,
  upsertPierreEmployeeProfile,
  updatePierreEmployeeProfile,
  deletePierreEmployeeProfile,
  detectEmployeeReferenceFromText,
  buildEmployee360Summary,
  type PierreEmployeeProfile,
} from "../hr/employee";

// ══════════════════════════════════════════════════════════
// sanitizePierreEmployeeProfile
// ══════════════════════════════════════════════════════════

describe("sanitizePierreEmployeeProfile — valid input", () => {
  it("returns a full profile from a complete object", () => {
    const result = sanitizePierreEmployeeProfile({
      id: "emp-001",
      full_name: "Alice Dupont",
      email: "alice@example.com",
      job_title: "Responsable RH",
      department: "RH",
      contract_type: "cdi",
      date_entree: "2022-03-01",
      date_sortie: null,
      status: "active",
      tags: ["senior", "manager"],
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("emp-001");
    expect(result!.full_name).toBe("Alice Dupont");
    expect(result!.email).toBe("alice@example.com");
    expect(result!.job_title).toBe("Responsable RH");
    expect(result!.department).toBe("RH");
    expect(result!.contract_type).toBe("cdi");
    expect(result!.date_entree).toBe("2022-03-01");
    expect(result!.date_sortie).toBeNull();
    expect(result!.status).toBe("active");
    expect(result!.tags).toEqual(["senior", "manager"]);
  });

  it("returns a minimal profile with only id + full_name", () => {
    const result = sanitizePierreEmployeeProfile({
      id: "emp-002",
      full_name: "Bob Martin",
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("emp-002");
    expect(result!.full_name).toBe("Bob Martin");
    expect(result!.status).toBe("unknown");
    expect(result!.tags).toEqual([]);
  });

  it("accepts all valid contract types", () => {
    const types = ["cdi", "cdd", "alternance", "stage", "independant", "interim", "autre"] as const;
    for (const ct of types) {
      const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X", contract_type: ct });
      expect(result!.contract_type).toBe(ct);
    }
  });

  it("accepts all valid statuses", () => {
    const statuses = ["active", "inactive", "onboarding", "offboarding", "unknown"] as const;
    for (const s of statuses) {
      const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X", status: s });
      expect(result!.status).toBe(s);
    }
  });

  it("trims whitespace from id and full_name", () => {
    const result = sanitizePierreEmployeeProfile({ id: "  emp-003  ", full_name: "  Carol Petit  " });
    expect(result!.id).toBe("emp-003");
    expect(result!.full_name).toBe("Carol Petit");
  });

  it("limits tags to 20 items", () => {
    const manyTags = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X", tags: manyTags });
    expect(result!.tags!.length).toBeLessThanOrEqual(20);
  });

  it("ignores non-string tag items silently", () => {
    const result = sanitizePierreEmployeeProfile({
      id: "x",
      full_name: "X",
      tags: ["valid", 42, null, "also-valid"],
    });
    expect(result!.tags).toEqual(["valid", "also-valid"]);
  });
});

describe("sanitizePierreEmployeeProfile — invalid input", () => {
  it("returns null for null", () => {
    expect(sanitizePierreEmployeeProfile(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(sanitizePierreEmployeeProfile(undefined)).toBeNull();
  });

  it("returns null for a non-object", () => {
    expect(sanitizePierreEmployeeProfile("string")).toBeNull();
    expect(sanitizePierreEmployeeProfile(42)).toBeNull();
    expect(sanitizePierreEmployeeProfile([])).toBeNull();
  });

  it("returns null when id is missing", () => {
    expect(sanitizePierreEmployeeProfile({ full_name: "Alice" })).toBeNull();
  });

  it("returns null when full_name is missing", () => {
    expect(sanitizePierreEmployeeProfile({ id: "emp-001" })).toBeNull();
  });

  it("returns null when id is an empty string", () => {
    expect(sanitizePierreEmployeeProfile({ id: "   ", full_name: "Alice" })).toBeNull();
  });

  it("returns null when full_name is an empty string", () => {
    expect(sanitizePierreEmployeeProfile({ id: "emp-001", full_name: "  " })).toBeNull();
  });

  it("falls back to unknown status for an invalid status string", () => {
    const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X", status: "zombie" });
    expect(result!.status).toBe("unknown");
  });

  it("sets contract_type to null for an invalid contract type", () => {
    const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X", contract_type: "supercontrat" });
    expect(result!.contract_type).toBeNull();
  });

  it("sets optional fields to null when absent", () => {
    const result = sanitizePierreEmployeeProfile({ id: "x", full_name: "X" });
    expect(result!.email).toBeNull();
    expect(result!.job_title).toBeNull();
    expect(result!.department).toBeNull();
    expect(result!.contract_type).toBeNull();
    expect(result!.date_entree).toBeNull();
    expect(result!.date_sortie).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// sanitizePierreEmployeeList
// ══════════════════════════════════════════════════════════

describe("sanitizePierreEmployeeList", () => {
  it("returns an empty array for a non-array input", () => {
    expect(sanitizePierreEmployeeList(null)).toEqual([]);
    expect(sanitizePierreEmployeeList(undefined)).toEqual([]);
    expect(sanitizePierreEmployeeList("string")).toEqual([]);
    expect(sanitizePierreEmployeeList({})).toEqual([]);
  });

  it("returns an empty array for an empty array", () => {
    expect(sanitizePierreEmployeeList([])).toEqual([]);
  });

  it("filters out invalid profiles silently", () => {
    const result = sanitizePierreEmployeeList([
      { id: "emp-001", full_name: "Alice" },
      { full_name: "No ID" },
      null,
      42,
      { id: "emp-002", full_name: "Bob" },
    ]);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("emp-001");
    expect(result[1].id).toBe("emp-002");
  });

  it("limits to 200 profiles maximum", () => {
    const raw = Array.from({ length: 250 }, (_, i) => ({ id: `emp-${i}`, full_name: `Person ${i}` }));
    const result = sanitizePierreEmployeeList(raw);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});

// ══════════════════════════════════════════════════════════
// findPierreEmployeeById
// ══════════════════════════════════════════════════════════

const sampleEmployees: PierreEmployeeProfile[] = [
  { id: "emp-001", full_name: "Alice Dupont", status: "active", tags: [] },
  { id: "emp-002", full_name: "Bob Martin", status: "inactive", tags: [] },
  { id: "EMP-003", full_name: "Carol Petit", status: "onboarding", tags: [] },
];

describe("findPierreEmployeeById", () => {
  it("finds an employee by exact id", () => {
    const result = findPierreEmployeeById(sampleEmployees, "emp-001");
    expect(result!.full_name).toBe("Alice Dupont");
  });

  it("is case-insensitive on both sides", () => {
    expect(findPierreEmployeeById(sampleEmployees, "EMP-001")).not.toBeNull();
    expect(findPierreEmployeeById(sampleEmployees, "emp-003")).not.toBeNull();
    expect(findPierreEmployeeById(sampleEmployees, "EMP-003")).not.toBeNull();
  });

  it("trims whitespace from the search id", () => {
    expect(findPierreEmployeeById(sampleEmployees, "  emp-002  ")).not.toBeNull();
  });

  it("returns null when no match is found", () => {
    expect(findPierreEmployeeById(sampleEmployees, "emp-999")).toBeNull();
  });

  it("returns null for an empty id string", () => {
    expect(findPierreEmployeeById(sampleEmployees, "")).toBeNull();
    expect(findPierreEmployeeById(sampleEmployees, "   ")).toBeNull();
  });

  it("returns null on an empty employee list", () => {
    expect(findPierreEmployeeById([], "emp-001")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// findPierreEmployeeByName
// ══════════════════════════════════════════════════════════

describe("findPierreEmployeeByName", () => {
  it("finds by exact full_name (case-insensitive)", () => {
    const result = findPierreEmployeeByName(sampleEmployees, "alice dupont");
    expect(result!.id).toBe("emp-001");
  });

  it("prefers exact match over partial match", () => {
    const employees: PierreEmployeeProfile[] = [
      { id: "x", full_name: "Ali", status: "active", tags: [] },
      { id: "y", full_name: "Alice", status: "active", tags: [] },
    ];
    const result = findPierreEmployeeByName(employees, "Alice");
    expect(result!.id).toBe("y");
  });

  it("falls back to partial match when no exact match", () => {
    const result = findPierreEmployeeByName(sampleEmployees, "alice");
    expect(result!.full_name).toBe("Alice Dupont");
  });

  it("also matches when the stored name includes the needle", () => {
    const result = findPierreEmployeeByName(sampleEmployees, "carol");
    expect(result!.id).toBe("EMP-003");
  });

  it("also matches when the needle includes the stored name", () => {
    const employees: PierreEmployeeProfile[] = [
      { id: "x", full_name: "Bob", status: "active", tags: [] },
    ];
    const result = findPierreEmployeeByName(employees, "Bob Martin");
    expect(result!.id).toBe("x");
  });

  it("returns null when no match is found", () => {
    expect(findPierreEmployeeByName(sampleEmployees, "Zoe Unknown")).toBeNull();
  });

  it("returns null for an empty name", () => {
    expect(findPierreEmployeeByName(sampleEmployees, "")).toBeNull();
    expect(findPierreEmployeeByName(sampleEmployees, "  ")).toBeNull();
  });

  it("returns null on an empty employee list", () => {
    expect(findPierreEmployeeByName([], "Alice")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// buildPierreEmployeeContext
// ══════════════════════════════════════════════════════════

describe("buildPierreEmployeeContext", () => {
  it("maps all lightweight fields from a full profile", () => {
    const profile: PierreEmployeeProfile = {
      id: "emp-001",
      full_name: "Alice Dupont",
      email: "alice@example.com",
      job_title: "DRH",
      department: "RH",
      contract_type: "cdi",
      date_entree: "2022-03-01",
      date_sortie: null,
      status: "active",
      tags: ["senior"],
    };

    const ctx = buildPierreEmployeeContext(profile);

    expect(ctx.employee_id).toBe("emp-001");
    expect(ctx.employee_name).toBe("Alice Dupont");
    expect(ctx.employee_email).toBe("alice@example.com");
    expect(ctx.contract_type).toBe("cdi");
    expect(ctx.department).toBe("RH");
    expect(ctx.date_entree).toBe("2022-03-01");
    expect(ctx.status).toBe("active");
  });

  it("does not include job_title (sensitive field excluded from context)", () => {
    const profile: PierreEmployeeProfile = {
      id: "x",
      full_name: "X",
      job_title: "Some Title",
      status: "active",
      tags: [],
    };
    const ctx = buildPierreEmployeeContext(profile);
    expect("job_title" in ctx).toBe(false);
  });

  it("sets optional fields to null when absent from profile", () => {
    const profile: PierreEmployeeProfile = {
      id: "emp-002",
      full_name: "Bob Martin",
      status: "unknown",
      tags: [],
    };
    const ctx = buildPierreEmployeeContext(profile);
    expect(ctx.employee_email).toBeNull();
    expect(ctx.contract_type).toBeNull();
    expect(ctx.department).toBeNull();
    expect(ctx.date_entree).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// resolveEmployeeContext
// ══════════════════════════════════════════════════════════

describe("resolveEmployeeContext", () => {
  it("resolves by employee_id first when both id and name provided", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, {
      employee_id: "emp-001",
      employee_name: "Bob Martin",
    });
    expect(ctx!.employee_id).toBe("emp-001");
    expect(ctx!.employee_name).toBe("Alice Dupont");
  });

  it("falls back to name lookup when employee_id is absent", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, {
      employee_name: "Bob Martin",
    });
    expect(ctx!.employee_id).toBe("emp-002");
  });

  it("falls back to name lookup when employee_id is not found", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, {
      employee_id: "emp-999",
      employee_name: "Bob Martin",
    });
    expect(ctx!.employee_id).toBe("emp-002");
  });

  it("returns null when neither id nor name resolves", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, {
      employee_id: "emp-999",
      employee_name: "Nobody Here",
    });
    expect(ctx).toBeNull();
  });

  it("returns null when both inputs are null", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, {
      employee_id: null,
      employee_name: null,
    });
    expect(ctx).toBeNull();
  });

  it("returns null on an empty employee list regardless of input", () => {
    const ctx = resolveEmployeeContext([], { employee_id: "emp-001" });
    expect(ctx).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// enrichPayloadWithEmployeeContext
// ══════════════════════════════════════════════════════════

describe("enrichPayloadWithEmployeeContext", () => {
  it("injects employee_context into the payload when context is provided", () => {
    const payload = { action: "send_email", subject: "Contrat" };
    const ctx = resolveEmployeeContext(sampleEmployees, { employee_id: "emp-001" })!;

    const enriched = enrichPayloadWithEmployeeContext(payload, ctx);

    expect(enriched.action).toBe("send_email");
    expect(enriched.subject).toBe("Contrat");
    expect(enriched.employee_context).toBeDefined();
    const ec = enriched.employee_context as { employee_id: string; employee_name: string };
    expect(ec.employee_id).toBe("emp-001");
    expect(ec.employee_name).toBe("Alice Dupont");
  });

  it("also injects flat employee_id and employee_name fields when context is provided", () => {
    const payload = { action: "doc.generate" };
    const ctx = resolveEmployeeContext(sampleEmployees, { employee_id: "emp-002" })!;
    const enriched = enrichPayloadWithEmployeeContext(payload, ctx);
    expect(enriched.employee_id).toBe("emp-002");
    expect(enriched.employee_name).toBe("Bob Martin");
  });

  it("does not inject flat fields when context is null", () => {
    const payload = { action: "doc.generate" };
    const enriched = enrichPayloadWithEmployeeContext(payload, null);
    expect("employee_id" in enriched).toBe(false);
    expect("employee_name" in enriched).toBe(false);
  });

  it("flat fields match the employee_context block", () => {
    const ctx = resolveEmployeeContext(sampleEmployees, { employee_id: "EMP-003" })!;
    const enriched = enrichPayloadWithEmployeeContext({}, ctx);
    const ec = enriched.employee_context as { employee_id: string; employee_name: string };
    expect(enriched.employee_id).toBe(ec.employee_id);
    expect(enriched.employee_name).toBe(ec.employee_name);
  });

  it("returns an unchanged payload reference when context is null", () => {
    const payload = { action: "doc.generate" };
    const enriched = enrichPayloadWithEmployeeContext(payload, null);
    expect(enriched).toEqual({ action: "doc.generate" });
    expect("employee_context" in enriched).toBe(false);
  });

  it("does not mutate the original payload object", () => {
    const payload = { action: "send_email" };
    const ctx = resolveEmployeeContext(sampleEmployees, { employee_id: "emp-001" })!;

    enrichPayloadWithEmployeeContext(payload, ctx);

    expect("employee_context" in payload).toBe(false);
  });

  it("overwrites an existing employee_context key with the new context", () => {
    const payload = { action: "test", employee_context: { employee_id: "old-id" } };
    const ctx = resolveEmployeeContext(sampleEmployees, { employee_id: "emp-002" })!;

    const enriched = enrichPayloadWithEmployeeContext(payload, ctx);
    const ec = enriched.employee_context as { employee_id: string };
    expect(ec.employee_id).toBe("emp-002");
  });
});

// ══════════════════════════════════════════════════════════
// upsertPierreEmployeeProfile
// ══════════════════════════════════════════════════════════

const baseList: PierreEmployeeProfile[] = [
  { id: "emp-001", full_name: "Alice Dupont", status: "active", tags: [] },
  { id: "emp-002", full_name: "Bob Martin", status: "inactive", tags: [] },
];

describe("upsertPierreEmployeeProfile — create", () => {
  it("appends a new employee and returns mode 'created'", () => {
    const newProfile: PierreEmployeeProfile = {
      id: "emp-003",
      full_name: "Carol Petit",
      status: "onboarding",
      tags: [],
    };
    const { employees, mode } = upsertPierreEmployeeProfile(baseList, newProfile);
    expect(mode).toBe("created");
    expect(employees.length).toBe(3);
    expect(employees[2].id).toBe("emp-003");
  });

  it("does not mutate the original array", () => {
    const original = [...baseList];
    const newProfile: PierreEmployeeProfile = {
      id: "emp-004",
      full_name: "Dan Roux",
      status: "active",
      tags: [],
    };
    upsertPierreEmployeeProfile(baseList, newProfile);
    expect(baseList.length).toBe(original.length);
  });

  it("limits the resulting list to 200 employees", () => {
    const large = Array.from({ length: 199 }, (_, i) => ({
      id: `emp-${i}`,
      full_name: `Person ${i}`,
      status: "active" as const,
      tags: [],
    }));
    const newProfile: PierreEmployeeProfile = {
      id: "emp-new",
      full_name: "New Person",
      status: "active",
      tags: [],
    };
    const extraProfile: PierreEmployeeProfile = {
      id: "emp-extra",
      full_name: "Extra Person",
      status: "active",
      tags: [],
    };
    const { employees: at200 } = upsertPierreEmployeeProfile(large, newProfile);
    expect(at200.length).toBe(200);
    const { employees: capped } = upsertPierreEmployeeProfile(at200, extraProfile);
    expect(capped.length).toBe(200);
  });
});

describe("upsertPierreEmployeeProfile — update", () => {
  it("replaces an existing employee by id and returns mode 'updated'", () => {
    const updated: PierreEmployeeProfile = {
      id: "emp-001",
      full_name: "Alice Dupont-Updated",
      status: "inactive",
      tags: ["updated"],
    };
    const { employees, mode } = upsertPierreEmployeeProfile(baseList, updated);
    expect(mode).toBe("updated");
    expect(employees.length).toBe(2);
    expect(employees[0].full_name).toBe("Alice Dupont-Updated");
    expect(employees[0].status).toBe("inactive");
  });

  it("is case-insensitive on id comparison", () => {
    const updated: PierreEmployeeProfile = {
      id: "EMP-002",
      full_name: "Bob Martin-Updated",
      status: "active",
      tags: [],
    };
    const { mode, employees } = upsertPierreEmployeeProfile(baseList, updated);
    expect(mode).toBe("updated");
    expect(employees[1].full_name).toBe("Bob Martin-Updated");
  });

  it("preserves other employees unchanged", () => {
    const updated: PierreEmployeeProfile = {
      id: "emp-001",
      full_name: "Only Alice Changes",
      status: "active",
      tags: [],
    };
    const { employees } = upsertPierreEmployeeProfile(baseList, updated);
    expect(employees[1].full_name).toBe("Bob Martin");
  });
});

// ══════════════════════════════════════════════════════════
// updatePierreEmployeeProfile
// ══════════════════════════════════════════════════════════

describe("updatePierreEmployeeProfile", () => {
  it("merges patch fields onto existing employee", () => {
    const { employees, employee } = updatePierreEmployeeProfile(
      baseList,
      "emp-001",
      { status: "offboarding", department: "Finance" },
    );
    expect(employee).not.toBeNull();
    expect(employee!.full_name).toBe("Alice Dupont");
    expect(employee!.status).toBe("offboarding");
    expect(employee!.department).toBe("Finance");
    expect(employees[0].status).toBe("offboarding");
  });

  it("preserves existing fields not in the patch", () => {
    const { employee } = updatePierreEmployeeProfile(
      baseList,
      "emp-001",
      { department: "IT" },
    );
    expect(employee!.full_name).toBe("Alice Dupont");
    expect(employee!.status).toBe("active");
  });

  it("returns employee: null when id is not found", () => {
    const { employees, employee } = updatePierreEmployeeProfile(
      baseList,
      "emp-999",
      { status: "inactive" },
    );
    expect(employee).toBeNull();
    expect(employees.length).toBe(2);
  });

  it("returns employee: null when patch makes the profile invalid", () => {
    const { employee } = updatePierreEmployeeProfile(
      baseList,
      "emp-001",
      { full_name: "   " },
    );
    expect(employee).toBeNull();
  });

  it("does not mutate the original array", () => {
    const original = [...baseList];
    updatePierreEmployeeProfile(baseList, "emp-001", { status: "offboarding" });
    expect(baseList[0].status).toBe(original[0].status);
  });

  it("is case-insensitive on id", () => {
    const { employee } = updatePierreEmployeeProfile(
      baseList,
      "EMP-002",
      { job_title: "Manager" },
    );
    expect(employee).not.toBeNull();
    expect(employee!.job_title).toBe("Manager");
  });
});

// ══════════════════════════════════════════════════════════
// deletePierreEmployeeProfile
// ══════════════════════════════════════════════════════════

describe("deletePierreEmployeeProfile", () => {
  it("removes the employee and returns deleted: true", () => {
    const { employees, deleted } = deletePierreEmployeeProfile(baseList, "emp-001");
    expect(deleted).toBe(true);
    expect(employees.length).toBe(1);
    expect(employees[0].id).toBe("emp-002");
  });

  it("returns deleted: false when id is not found", () => {
    const { employees, deleted } = deletePierreEmployeeProfile(baseList, "emp-999");
    expect(deleted).toBe(false);
    expect(employees.length).toBe(2);
  });

  it("is case-insensitive on id", () => {
    const { deleted } = deletePierreEmployeeProfile(baseList, "EMP-001");
    expect(deleted).toBe(true);
  });

  it("does not mutate the original array", () => {
    deletePierreEmployeeProfile(baseList, "emp-001");
    expect(baseList.length).toBe(2);
  });

  it("returns an empty array when the last employee is deleted", () => {
    const single: PierreEmployeeProfile[] = [
      { id: "solo", full_name: "Solo Person", status: "active", tags: [] },
    ];
    const { employees } = deletePierreEmployeeProfile(single, "solo");
    expect(employees).toEqual([]);
  });

  it("returns empty list unchanged on empty input", () => {
    const { employees, deleted } = deletePierreEmployeeProfile([], "emp-001");
    expect(deleted).toBe(false);
    expect(employees).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
// detectEmployeeReferenceFromText
// ══════════════════════════════════════════════════════════

const detectionEmployees: PierreEmployeeProfile[] = [
  { id: "det-001", full_name: "Alice Dupont", status: "active", tags: [] },
  { id: "det-002", full_name: "Bob Martin",   status: "active", tags: [] },
  { id: "det-003", full_name: "Carol Petit",  status: "active", tags: [] },
  { id: "det-004", full_name: "Jean-Pierre Moreau", status: "active", tags: [] },
];

describe("detectEmployeeReferenceFromText — null / empty cases", () => {
  it("returns null when input is empty", () => {
    expect(detectEmployeeReferenceFromText("", detectionEmployees)).toBeNull();
  });

  it("returns null when input is whitespace only", () => {
    expect(detectEmployeeReferenceFromText("   ", detectionEmployees)).toBeNull();
  });

  it("returns null when employees list is empty", () => {
    expect(detectEmployeeReferenceFromText("Email pour Alice Dupont", [])).toBeNull();
  });

  it("returns null when no name matches", () => {
    expect(
      detectEmployeeReferenceFromText("Prepare a report for Zoe Unknown", detectionEmployees),
    ).toBeNull();
  });
});

describe("detectEmployeeReferenceFromText — exact match", () => {
  it("finds an employee whose full_name appears verbatim in the text", () => {
    const result = detectEmployeeReferenceFromText(
      "Redige un email de bienvenue pour Alice Dupont.",
      detectionEmployees,
    );
    expect(result!.id).toBe("det-001");
  });

  it("is case-insensitive for full_name match", () => {
    const result = detectEmployeeReferenceFromText(
      "Prepare un document pour ALICE DUPONT.",
      detectionEmployees,
    );
    expect(result!.id).toBe("det-001");
  });

  it("matches when name is in lowercase", () => {
    const result = detectEmployeeReferenceFromText(
      "lettre pour bob martin asap",
      detectionEmployees,
    );
    expect(result!.id).toBe("det-002");
  });

  it("finds the correct employee among multiple candidates", () => {
    const result = detectEmployeeReferenceFromText(
      "Convocation entretien Carol Petit semaine prochaine",
      detectionEmployees,
    );
    expect(result!.id).toBe("det-003");
  });
});

describe("detectEmployeeReferenceFromText — partial token match", () => {
  it("matches when all name tokens appear scattered in text", () => {
    const result = detectEmployeeReferenceFromText(
      "Concernant le dossier de Dupont Alice pour son contrat",
      detectionEmployees,
    );
    expect(result).not.toBeNull();
    expect(result!.id).toBe("det-001");
  });

  it("handles hyphenated names via token splitting", () => {
    const result = detectEmployeeReferenceFromText(
      "Preparation du bilan annuel de Jean-Pierre Moreau",
      detectionEmployees,
    );
    expect(result!.id).toBe("det-004");
  });

  it("prefers exact substring match over token match", () => {
    const mixed: PierreEmployeeProfile[] = [
      { id: "x1", full_name: "Ali", status: "active", tags: [] },
      { id: "x2", full_name: "Alice Martin", status: "active", tags: [] },
    ];
    const result = detectEmployeeReferenceFromText(
      "Contrat pour Alice Martin",
      mixed,
    );
    expect(result!.id).toBe("x2");
  });
});

describe("detectEmployeeReferenceFromText — edge cases", () => {
  it("handles extra whitespace in input", () => {
    const result = detectEmployeeReferenceFromText(
      "Email  pour   Alice   Dupont",
      detectionEmployees,
    );
    expect(result).not.toBeNull();
  });

  it("returns first exact match when two employees could match", () => {
    const ambiguous: PierreEmployeeProfile[] = [
      { id: "a1", full_name: "Martin Paul", status: "active", tags: [] },
      { id: "a2", full_name: "Martin Sophie", status: "active", tags: [] },
    ];
    const result = detectEmployeeReferenceFromText(
      "Relance pour Martin Paul",
      ambiguous,
    );
    expect(result!.id).toBe("a1");
  });
});

// ══════════════════════════════════════════════════════════
// buildEmployee360Summary
// ══════════════════════════════════════════════════════════

const summaryEmployee: PierreEmployeeProfile = {
  id: "sum-001",
  full_name: "Alice Dupont",
  status: "active",
  contract_type: "cdi",
  department: "RH",
  tags: [],
};

describe("buildEmployee360Summary — basic counts", () => {
  it("returns zero counts on empty arrays", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.total_missions).toBe(0);
    expect(s.total_tasks).toBe(0);
    expect(s.total_documents).toBe(0);
    expect(s.total_logs).toBe(0);
  });

  it("counts missions, tasks, documents correctly", () => {
    const missions  = [{ id: "m1", created_at: "2024-03-01T10:00:00Z" }];
    const tasks     = [
      { id: "t1", status: "done", approval_required: false, created_at: "2024-03-01T11:00:00Z" },
      { id: "t2", status: "ready", approval_required: false, created_at: "2024-03-01T12:00:00Z" },
    ];
    const documents = [{ id: "d1", created_at: "2024-03-01T13:00:00Z" }];

    const s = buildEmployee360Summary(summaryEmployee, missions, tasks, documents);
    expect(s.total_missions).toBe(1);
    expect(s.total_tasks).toBe(2);
    expect(s.total_documents).toBe(1);
  });

  it("counts logs when provided", () => {
    const logs = [
      { id: "l1", created_at: "2024-03-01T09:00:00Z" },
      { id: "l2", created_at: "2024-03-01T08:00:00Z" },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], [], [], logs);
    expect(s.total_logs).toBe(2);
  });

  it("sets total_logs to 0 when logs not provided", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.total_logs).toBe(0);
  });
});

describe("buildEmployee360Summary — tasks_by_status and approval counts", () => {
  it("groups tasks by status correctly", () => {
    const tasks = [
      { id: "t1", status: "done",     approval_required: false },
      { id: "t2", status: "done",     approval_required: false },
      { id: "t3", status: "blocked",  approval_required: false },
      { id: "t4", status: "ready",    approval_required: false },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], tasks, []);
    expect(s.tasks_by_status.done).toBe(2);
    expect(s.tasks_by_status.blocked).toBe(1);
    expect(s.tasks_by_status.ready).toBe(1);
  });

  it("counts pending_approval_count correctly", () => {
    const tasks = [
      { id: "t1", status: "awaiting_approval", approval_required: true },
      { id: "t2", status: "awaiting_approval", approval_required: true },
      { id: "t3", status: "done",              approval_required: false },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], tasks, []);
    expect(s.pending_approval_count).toBe(2);
    expect(s.tasks_pending_approval).toBe(2);
  });

  it("counts blocked_count correctly", () => {
    const tasks = [
      { id: "t1", status: "blocked" },
      { id: "t2", status: "blocked" },
      { id: "t3", status: "ready" },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], tasks, []);
    expect(s.blocked_count).toBe(2);
  });

  it("counts scheduled_count correctly", () => {
    const tasks = [
      { id: "t1", status: "scheduled" },
      { id: "t2", status: "done" },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], tasks, []);
    expect(s.scheduled_count).toBe(1);
  });

  it("handles tasks with unknown/missing status", () => {
    const tasks = [
      { id: "t1" },
      { id: "t2", status: null },
    ];
    const s = buildEmployee360Summary(summaryEmployee, [], tasks, []);
    expect(s.tasks_by_status.unknown).toBe(2);
  });
});

describe("buildEmployee360Summary — last activity dates", () => {
  it("picks the most recent created_at across missions/tasks/documents as last_activity_at", () => {
    const missions  = [{ id: "m1", created_at: "2024-03-10T10:00:00Z" }];
    const tasks     = [{ id: "t1", status: "done", created_at: "2024-03-12T10:00:00Z" }];
    const documents = [{ id: "d1", created_at: "2024-03-11T10:00:00Z" }];

    const s = buildEmployee360Summary(summaryEmployee, missions, tasks, documents);
    expect(s.last_activity_at).toBe("2024-03-12T10:00:00Z");
    expect(s.last_task_at).toBe("2024-03-12T10:00:00Z");
    expect(s.last_mission_at).toBe("2024-03-10T10:00:00Z");
    expect(s.last_document_at).toBe("2024-03-11T10:00:00Z");
  });

  it("sets all last_*_at to null when arrays are empty", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.last_mission_at).toBeNull();
    expect(s.last_task_at).toBeNull();
    expect(s.last_document_at).toBeNull();
    expect(s.last_activity_at).toBeNull();
  });

  it("uses first element of each array as the most recent (arrays expected desc)", () => {
    const missions = [
      { id: "m1", created_at: "2024-05-01T00:00:00Z" },
      { id: "m2", created_at: "2024-04-01T00:00:00Z" },
    ];
    const s = buildEmployee360Summary(summaryEmployee, missions, [], []);
    expect(s.last_mission_at).toBe("2024-05-01T00:00:00Z");
  });
});

describe("buildEmployee360Summary — employee fields", () => {
  it("maps employee_name from full_name", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.employee_name).toBe("Alice Dupont");
  });

  it("maps employee_status from employee.status", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.employee_status).toBe("active");
  });

  it("maps contract_type and department from employee", () => {
    const s = buildEmployee360Summary(summaryEmployee, [], [], []);
    expect(s.contract_type).toBe("cdi");
    expect(s.department).toBe("RH");
  });

  it("sets contract_type and department to null when absent", () => {
    const minimal: PierreEmployeeProfile = {
      id: "min-001",
      full_name: "Min Imal",
      status: "unknown",
      tags: [],
    };
    const s = buildEmployee360Summary(minimal, [], [], []);
    expect(s.contract_type).toBeNull();
    expect(s.department).toBeNull();
  });
});
