import { describe, expect, it } from "vitest";

import {
  sanitizePierreEmployeeProfile,
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  findPierreEmployeeByName,
  buildPierreEmployeeContext,
  resolveEmployeeContext,
  enrichPayloadWithEmployeeContext,
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
