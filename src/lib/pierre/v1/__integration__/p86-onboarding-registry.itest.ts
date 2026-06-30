// src/lib/pierre/v1/__integration__/p86-onboarding-registry.itest.ts
// PHASE 8.6 — the versioned, server-authoritative ONBOARDING registry is the single source of the
// canonical Pierre onboarding (the ordered steps, which are required, the permission needed to
// complete each, dependencies, re-openability and sensitivity). The provisioning function seeds
// pierre_rt_onboarding_steps from it and the onboarding service validates completion against it, so
// the registry's SHAPE is load-bearing. This is a pure shape contract — no DB is required — but we
// still spin the harness up to mirror the suite's structure and prove the seed matches the registry.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import {
  PIERRE_ONBOARDING_STEPS,
  ONBOARDING_SCHEMA_VERSION,
  onboardingStepSeed,
  getOnboardingStep,
  getOnboardingRegistry,
  type OnboardingStepDefinition,
} from "../onboarding-registry";

// The ten canonical onboarding steps, in canonical order.
const CANONICAL_STEP_KEYS = [
  "company_identity",
  "company_legal_information",
  "hr_contacts",
  "approval_responsibilities",
  "signature_configuration",
  "communication_preferences",
  "team_members",
  "employee_data",
  "hr_policies",
  "first_mission_ready",
] as const;

const VALID_SENSITIVITY = new Set(["normal", "sensitive"]);

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 onboarding registry — schema version", () => {
  it("exposes a stable, non-empty schema version", () => {
    expect(typeof ONBOARDING_SCHEMA_VERSION).toBe("string");
    expect(ONBOARDING_SCHEMA_VERSION.length).toBeGreaterThan(0);
    expect(ONBOARDING_SCHEMA_VERSION).toBe("1");
  });
});

describe("P8.6 onboarding registry — canonical step set", () => {
  it("includes EXACTLY the canonical step keys (no extras, no omissions, no dupes)", () => {
    const keys = PIERRE_ONBOARDING_STEPS.map((s) => s.step_key);
    // every canonical key is present
    for (const canonical of CANONICAL_STEP_KEYS) {
      expect(keys, `missing canonical step '${canonical}'`).toContain(canonical);
    }
    // the registry is exactly the canonical set (same membership, same cardinality)
    expect([...keys].sort()).toEqual([...CANONICAL_STEP_KEYS].sort());
    // no duplicate step keys
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(CANONICAL_STEP_KEYS.length);
  });

  it("preserves the canonical ORDER of the steps", () => {
    const keys = PIERRE_ONBOARDING_STEPS.map((s) => s.step_key);
    expect(keys).toEqual([...CANONICAL_STEP_KEYS]);
  });
});

describe("P8.6 onboarding registry — per-step shape", () => {
  it("every step declares step_key/version/required/permission/dependencies/can_reopen/sensitivity (+title) with correct types", () => {
    for (const step of PIERRE_ONBOARDING_STEPS) {
      const where = `step '${step.step_key}'`;
      // presence of every contract field
      for (const field of [
        "step_key", "version", "required", "permission",
        "dependencies", "can_reopen", "sensitivity", "title",
      ] as Array<keyof OnboardingStepDefinition>) {
        expect(step, `${where} missing field '${String(field)}'`).toHaveProperty(field);
      }
      // types
      expect(typeof step.step_key, where).toBe("string");
      expect(step.step_key.length, where).toBeGreaterThan(0);
      expect(typeof step.version, where).toBe("string");
      expect(step.version.length, where).toBeGreaterThan(0);
      expect(typeof step.required, where).toBe("boolean");
      expect(typeof step.permission, where).toBe("string");
      expect(step.permission.length, where).toBeGreaterThan(0);
      expect(Array.isArray(step.dependencies), where).toBe(true);
      expect(typeof step.can_reopen, where).toBe("boolean");
      expect(VALID_SENSITIVITY.has(step.sensitivity), `${where} sensitivity='${step.sensitivity}'`).toBe(true);
      expect(typeof step.title, where).toBe("string");
      expect(step.title.length, where).toBeGreaterThan(0);
    }
  });

  it("dependency arrays contain only string keys, with no self-reference and no duplicates", () => {
    for (const step of PIERRE_ONBOARDING_STEPS) {
      const where = `step '${step.step_key}'`;
      for (const dep of step.dependencies) {
        expect(typeof dep, `${where} dep`).toBe("string");
      }
      // a step never depends on itself
      expect(step.dependencies, where).not.toContain(step.step_key);
      // no duplicate dependencies
      expect(new Set(step.dependencies).size, where).toBe(step.dependencies.length);
    }
  });
});

describe("P8.6 onboarding registry — dependency integrity", () => {
  it("every dependency references an EXISTING step key in the registry", () => {
    const known = new Set(PIERRE_ONBOARDING_STEPS.map((s) => s.step_key));
    for (const step of PIERRE_ONBOARDING_STEPS) {
      for (const dep of step.dependencies) {
        expect(known.has(dep), `step '${step.step_key}' depends on unknown step '${dep}'`).toBe(true);
      }
    }
  });

  it("dependencies are acyclic and each dependency appears EARLIER in canonical order", () => {
    const indexOf = new Map(PIERRE_ONBOARDING_STEPS.map((s, i) => [s.step_key, i]));
    for (const step of PIERRE_ONBOARDING_STEPS) {
      const self = indexOf.get(step.step_key)!;
      for (const dep of step.dependencies) {
        const di = indexOf.get(dep)!;
        // a dependency that comes before guarantees a DAG that respects the ordering
        expect(di, `step '${step.step_key}' depends on later step '${dep}'`).toBeLessThan(self);
      }
    }
  });

  it("first_mission_ready depends on approval_responsibilities + signature_configuration + hr_policies", () => {
    const fmr = PIERRE_ONBOARDING_STEPS.find((s) => s.step_key === "first_mission_ready");
    expect(fmr).toBeDefined();
    expect([...fmr!.dependencies].sort()).toEqual(
      ["approval_responsibilities", "hr_policies", "signature_configuration"],
    );
    // it is itself a required, re-openable gating step
    expect(fmr!.required).toBe(true);
  });

  it("the first step (company_identity) has NO dependencies — it is the registry root", () => {
    const root = PIERRE_ONBOARDING_STEPS[0];
    expect(root.step_key).toBe("company_identity");
    expect(root.dependencies).toEqual([]);
  });
});

describe("P8.6 onboarding registry — required steps", () => {
  it("a strict subset is required, and at least the gating spine is required", () => {
    const required = PIERRE_ONBOARDING_STEPS.filter((s) => s.required).map((s) => s.step_key);
    // there IS at least one optional step (so 'required' is a meaningful distinction)
    expect(required.length).toBeLessThan(PIERRE_ONBOARDING_STEPS.length);
    expect(required.length).toBeGreaterThan(0);
    // the activation-gating steps must be required
    for (const key of ["company_identity", "approval_responsibilities", "signature_configuration", "hr_policies", "first_mission_ready"]) {
      expect(required, `'${key}' must be required`).toContain(key);
    }
    // employee_data is the optional one in the canonical registry
    expect(getOnboardingStep("employee_data")!.required).toBe(false);
  });
});

describe("P8.6 onboarding registry — onboardingStepSeed", () => {
  it("maps the registry to compact {step_key, required} seed rows, preserving order and 1:1 fidelity", () => {
    const seed = onboardingStepSeed();
    const registry = getOnboardingRegistry();
    expect(seed).toHaveLength(registry.length);
    // exactly {step_key, required} — no extra fields leak into the seed
    for (const row of seed) {
      expect(Object.keys(row).sort()).toEqual(["required", "step_key"]);
    }
    // every seed row matches the corresponding registry step, in order
    seed.forEach((row, i) => {
      expect(row.step_key).toBe(registry[i].step_key);
      expect(row.required).toBe(registry[i].required);
    });
    // the seed step keys are the canonical set
    expect(seed.map((r) => r.step_key)).toEqual([...CANONICAL_STEP_KEYS]);
  });
});

describe("P8.6 onboarding registry — lookup helpers", () => {
  it("getOnboardingStep returns the matching definition for every canonical key", () => {
    for (const key of CANONICAL_STEP_KEYS) {
      const step = getOnboardingStep(key);
      expect(step, `lookup '${key}'`).not.toBeNull();
      expect(step!.step_key).toBe(key);
    }
  });

  it("getOnboardingStep returns null for an unknown key", () => {
    expect(getOnboardingStep("does_not_exist")).toBeNull();
    expect(getOnboardingStep("")).toBeNull();
  });

  it("getOnboardingRegistry returns the canonical Pierre registry and REFUSES an unknown product", () => {
    expect(getOnboardingRegistry()).toBe(PIERRE_ONBOARDING_STEPS);
    expect(getOnboardingRegistry("pierre")).toBe(PIERRE_ONBOARDING_STEPS);
    // P8.6 contract: an unknown product is REFUSED — it must NOT silently fall back to the Pierre registry.
    expect(() => getOnboardingRegistry("unknown_product")).toThrow(/unknown onboarding product/);
  });
});
