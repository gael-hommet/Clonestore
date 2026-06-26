// TECH-02 — Employee Runtime Contract Tests
// Static and logic tests only. No Stripe live. No Supabase writes. No real API calls.
// No OpenAI. No Anthropic. No email sends.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib/clonestore/employees", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

// ── 1. File existence ─────────────────────────────────────────────────────────

describe("tech-02 — file existence", () => {
  it("EmployeeRuntimeContract type file exists", () => {
    const content = readSrc("employee-runtime-contract.ts");
    expect(content.length).toBeGreaterThan(500);
  });

  it("registry file exists", () => {
    const content = readSrc("employee-registry.ts");
    expect(content.length).toBeGreaterThan(500);
  });

  it("validator file exists", () => {
    const content = readSrc("employee-registry-validator.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("readiness file exists", () => {
    const content = readSrc("employee-runtime-readiness.ts");
    expect(content.length).toBeGreaterThan(300);
  });

  it("index exports exist", () => {
    const content = readSrc("index.ts");
    expect(content).toContain("EmployeeRuntimeContract");
    expect(content).toContain("employee-registry");
    expect(content).toContain("employee-registry-validator");
    expect(content).toContain("employee-runtime-readiness");
  });
});

// ── 2. Registry — Pierre declared ────────────────────────────────────────────

import {
  EMPLOYEE_RUNTIME_REGISTRY,
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
} from "../employee-registry";

describe("tech-02 — registry contains Pierre", () => {
  it("registry contains Pierre", () => {
    const pierre = EMPLOYEE_RUNTIME_REGISTRY.find((e) => e.slug === "pierre");
    expect(pierre).toBeDefined();
  });

  it("registry contains only Pierre as real active employee", () => {
    const active = EMPLOYEE_RUNTIME_REGISTRY.filter((e) => e.status === "active");
    expect(active.length).toBe(1);
    expect(active[0].slug).toBe("pierre");
  });

  it("Pierre slug is pierre", () => {
    expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.slug).toBe("pierre");
  });

  it("Pierre domain is hr", () => {
    expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.domain).toBe("hr");
  });
});

// ── 3. Pierre technology requirements ────────────────────────────────────────

describe("tech-02 — Pierre technology requirements", () => {
  it("Pierre requires CloneOS (hard requirement)", () => {
    const tech = PIERRE_EMPLOYEE_RUNTIME_CONTRACT.required_technologies.find(
      (t) => t.slug === "cloneos" && t.required === true,
    );
    expect(tech).toBeDefined();
  });

  it("Pierre requires CloneADN (hard requirement)", () => {
    const tech = PIERRE_EMPLOYEE_RUNTIME_CONTRACT.required_technologies.find(
      (t) => t.slug === "cloneadn" && t.required === true,
    );
    expect(tech).toBeDefined();
  });

  it("Pierre requires CloneGuard (hard requirement)", () => {
    const tech = PIERRE_EMPLOYEE_RUNTIME_CONTRACT.required_technologies.find(
      (t) => t.slug === "cloneguard" && t.required === true,
    );
    expect(tech).toBeDefined();
  });

  it("Pierre requires CloneTrace (hard requirement)", () => {
    const tech = PIERRE_EMPLOYEE_RUNTIME_CONTRACT.required_technologies.find(
      (t) => t.slug === "clonetrace" && t.required === true,
    );
    expect(tech).toBeDefined();
  });

  it("Pierre has HR capabilities", () => {
    const expectedCapabilities = [
      "employee_file",
      "hr_documents",
      "recruitment_ops",
      "onboarding",
    ];
    for (const cap of expectedCapabilities) {
      expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.capabilities).toContain(cap);
    }
  });
});

// ── 4. Pierre permissions — structural safety constraints ─────────────────────

describe("tech-02 — Pierre permissions safety", () => {
  it("Pierre cannot make legal decisions", () => {
    expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.permissions.can_make_legal_decision).toBe(false);
  });

  it("Pierre cannot run official payroll", () => {
    expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.permissions.can_run_payroll_officially).toBe(false);
  });

  it("Pierre cannot terminate employee autonomously", () => {
    expect(PIERRE_EMPLOYEE_RUNTIME_CONTRACT.permissions.can_terminate_employee_autonomously).toBe(false);
  });
});

// ── 5. Validator — Pierre accepted ───────────────────────────────────────────

import { validateEmployeeRuntimeContract } from "../employee-registry-validator";

describe("tech-02 — validator accepts Pierre", () => {
  it("validator accepts Pierre with no errors", () => {
    const result = validateEmployeeRuntimeContract(PIERRE_EMPLOYEE_RUNTIME_CONTRACT);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ── 6. Validator — rejection tests ───────────────────────────────────────────

describe("tech-02 — validator rejects invalid contracts", () => {
  it("validator rejects unknown technology", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.required_technologies = [
      { slug: "cloneunknown_fake_xyz", required: true, rationale: "fake", minimum_readiness: 0 },
    ];
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) =>
      e.toLowerCase().includes("cloneunknown_fake_xyz") || e.toLowerCase().includes("unknown"),
    )).toBe(true);
  });

  it("validator rejects duplicate technology", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.required_technologies = [
      { slug: "cloneos", required: true, rationale: "first", minimum_readiness: 60 },
      { slug: "cloneos", required: true, rationale: "duplicate", minimum_readiness: 60 },
    ];
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("validator rejects empty capabilities", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.capabilities = [];
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("capabilities"))).toBe(true);
  });

  it("validator rejects can_make_legal_decision true", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.permissions.can_make_legal_decision = true;
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) =>
      e.toLowerCase().includes("can_make_legal_decision"),
    )).toBe(true);
  });

  it("validator rejects can_run_payroll_officially true", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.permissions.can_run_payroll_officially = true;
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) =>
      e.toLowerCase().includes("can_run_payroll_officially"),
    )).toBe(true);
  });

  it("validator rejects can_terminate_employee_autonomously true", () => {
    const badContract = JSON.parse(JSON.stringify(PIERRE_EMPLOYEE_RUNTIME_CONTRACT));
    badContract.permissions.can_terminate_employee_autonomously = true;
    const result = validateEmployeeRuntimeContract(badContract);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) =>
      e.toLowerCase().includes("can_terminate_employee_autonomously"),
    )).toBe(true);
  });
});

// ── 7. Readiness ──────────────────────────────────────────────────────────────

import {
  buildEmployeeRuntimeReadiness,
  buildAllEmployeeRuntimeReadiness,
} from "../employee-runtime-readiness";

describe("tech-02 — readiness", () => {
  it("readiness returns Pierre", () => {
    const result = buildEmployeeRuntimeReadiness("pierre");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("pierre");
  });

  it("readiness Pierre is not public_launch_ready", () => {
    const result = buildEmployeeRuntimeReadiness("pierre");
    expect(result?.public_launch_ready).toBe(false);
  });

  it("readiness all employees does not include any public_launch_ready true", () => {
    const results = buildAllEmployeeRuntimeReadiness();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.public_launch_ready).toBe(false);
    }
  });

  it("readiness Pierre product_runtime_ready is true", () => {
    const result = buildEmployeeRuntimeReadiness("pierre");
    expect(result?.product_runtime_ready).toBe(true);
  });

  it("readiness Pierre score is above 60", () => {
    const result = buildEmployeeRuntimeReadiness("pierre");
    expect(result?.score).toBeGreaterThan(60);
  });
});

// ── 8. Doc checks ─────────────────────────────────────────────────────────────

describe("tech-02 — doc TECH_02 content", () => {
  let content: string;
  try {
    content = readDoc("TECH_02_EMPLOYEE_RUNTIME_CONTRACT.md");
  } catch {
    content = "";
  }

  it("doc TECH_02 exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(300);
  });

  it("doc says technologies are not employees", () => {
    const hasDistinction =
      content.includes("technologies") &&
      (content.includes("ne sont pas des employés") ||
        content.includes("pas des employés") ||
        content.toLowerCase().includes("technologies are not employees"));
    expect(hasDistinction).toBe(true);
  });

  it("doc mentions Employee Runtime Contract", () => {
    expect(content).toContain("Employee Runtime Contract");
  });

  it("doc mentions domain pack", () => {
    expect(content.toLowerCase()).toContain("domain pack");
  });

  it("doc mentions TECH-03", () => {
    expect(content).toContain("TECH-03");
  });
});

// ── 9. Safety — no forbidden modifications ────────────────────────────────────

describe("tech-02 — no forbidden code modifications", () => {
  it("no OpenAI direct call in employee-registry", () => {
    const content = readSrc("employee-registry.ts");
    expect(content).not.toMatch(/openai\.com\/v1/i);
    expect(content).not.toMatch(/sk-live-/i);
    expect(content).not.toMatch(/new OpenAI\(/i);
  });

  it("no Anthropic direct call in employee-registry", () => {
    const content = readSrc("employee-registry.ts");
    expect(content).not.toMatch(/anthropic\.com\/v1/i);
    expect(content).not.toMatch(/new Anthropic\(/i);
  });

  it("no Stripe live key in employee-registry", () => {
    const content = readSrc("employee-registry.ts");
    expect(content).not.toMatch(/sk_live_/i);
    expect(content).not.toMatch(/pk_live_/i);
  });

  it("no public launch flag set to true in employee-registry", () => {
    const content = readSrc("employee-registry.ts");
    expect(content).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*['"]?true/);
    expect(content).not.toMatch(/public_launch_ready\s*:\s*true/);
  });

  it("no proof auto-verified in employee-registry", () => {
    const content = readSrc("employee-registry.ts");
    expect(content).not.toMatch(/verified\s*:\s*true/);
    expect(content).not.toMatch(/auto.validate/i);
  });
});
