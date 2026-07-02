// src/lib/pierre/v1/hr-canon/__tests__/canon-registry.test.ts
// PHASE 8.10 — the registry is machine-checked: valid schema, unique namespaced ids, every domain
// covered, target scale met, and the honesty invariants (VERIFIED_EXISTING ⇒ evidence; no dangling
// public promise; gap register partitions all non-verified capabilities).

import { describe, it, expect } from "vitest";
import { HR_CAPABILITIES } from "../capability-registry";
import { validateRegistry, validateCapability } from "../capability-validator";
import { HR_DOMAIN_IDS } from "../domains";
import { verifiedWithoutEvidence } from "../evidence-map";
import { referencelessImplemented } from "../implementation-map";
import { computeCoverage } from "../coverage";
import { GAP_REGISTRY } from "../gap-registry";

describe("HR capability registry", () => {
  it("is structurally valid with no duplicate ids", () => {
    const r = validateRegistry([...HR_CAPABILITIES]);
    if (!r.ok) console.error(JSON.stringify(r.errors.slice(0, 10), null, 1));
    expect(r.ok).toBe(true);
    expect(r.duplicateIds).toEqual([]);
  });

  it("has a genuinely exhaustive canon (>= 150 atomic capabilities)", () => {
    expect(HR_CAPABILITIES.length).toBeGreaterThanOrEqual(150);
  });

  it("covers all 22 canonical domains", () => {
    const covered = new Set(HR_CAPABILITIES.map((c) => c.domain));
    for (const d of HR_DOMAIN_IDS) expect(covered.has(d), `domain ${d} uncovered`).toBe(true);
    expect(computeCoverage(HR_CAPABILITIES).domainsCovered).toBe(HR_DOMAIN_IDS.length);
  });

  it("namespaces every id by its domain", () => {
    for (const c of HR_CAPABILITIES) expect(c.id.startsWith(`${c.domain}.`), c.id).toBe(true);
  });

  it("every capability carries at least one certification criterion and a workflow", () => {
    for (const c of HR_CAPABILITIES) {
      expect(c.certificationCriteria.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.workflow.steps.length, c.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("HONESTY: every VERIFIED_EXISTING capability has real evidence", () => {
    expect(verifiedWithoutEvidence()).toEqual([]);
  });

  it("HONESTY: every VERIFIED_EXISTING capability targets ALREADY_VERIFIED", () => {
    for (const c of HR_CAPABILITIES) if (c.implementation === "VERIFIED_EXISTING") expect(c.targetPhase, c.id).toBe("ALREADY_VERIFIED");
  });

  it("HONESTY: HUMAN_ONLY capabilities are never given an executing autonomy", () => {
    for (const c of HR_CAPABILITIES) if (c.implementation === "HUMAN_ONLY") expect(["human_only", "forbidden", "observe_only", "suggest", "prepare_draft"]).toContain(c.autonomy);
  });

  it("gap register partitions exactly the non-verified capabilities", () => {
    const nonVerified = HR_CAPABILITIES.filter((c) => c.implementation !== "VERIFIED_EXISTING").length;
    expect(GAP_REGISTRY.length).toBe(nonVerified);
  });

  it("a deliberately-broken capability is rejected by the validator", () => {
    const broken = { ...HR_CAPABILITIES[0], id: "BAD", domain: "nope" } as never;
    expect(validateCapability(broken as never).some((i) => i.severity === "error")).toBe(true);
  });

  it("VERIFIED_EXISTING requires evidence (validator rule)", () => {
    const noEvidence = { ...HR_CAPABILITIES.find((c) => c.implementation === "VERIFIED_EXISTING")!, evidence: [] };
    expect(validateCapability(noEvidence).some((i) => i.field === "evidence" && i.severity === "error")).toBe(true);
  });
});
