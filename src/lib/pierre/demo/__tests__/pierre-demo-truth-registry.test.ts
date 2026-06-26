// PIERRE FINAL INTERACTIVE DEMO — truth registry tests.
import { describe, it, expect } from "vitest";
import {
  DEMO_CAPABILITIES,
  DEMO_TECHNOLOGIES,
  DEMO_ONLY_CAPABILITY_IDS,
  SCENARIO_ALLOWED_CAPABILITY_IDS,
  getCapability,
  isCapabilityDeclared,
  disclosureFor,
} from "../demo-truth-registry";

const VALID_STATUSES = new Set([
  "available",
  "available_with_validation",
  "prepared_not_executed",
  "demo_only",
]);

describe("pierre-demo truth registry", () => {
  it("every capability has a valid status and a non-empty disclosure", () => {
    for (const c of DEMO_CAPABILITIES) {
      expect(VALID_STATUSES.has(c.productionStatus), `${c.id} status`).toBe(true);
      expect(c.demoDisclosure.length).toBeGreaterThan(8);
      expect(c.label.length).toBeGreaterThan(2);
    }
  });

  it("capability ids are unique", () => {
    const ids = DEMO_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("voice and live external signature are demo_only (never shown active)", () => {
    expect(getCapability("voice_call")?.productionStatus).toBe("demo_only");
    expect(getCapability("live_external_signature")?.productionStatus).toBe("demo_only");
    expect(DEMO_ONLY_CAPABILITY_IDS.has("voice_call")).toBe(true);
    expect(DEMO_ONLY_CAPABILITY_IDS.has("live_external_signature")).toBe(true);
  });

  it("real email send is gated by human validation", () => {
    expect(getCapability("real_email_send")?.productionStatus).toBe("available_with_validation");
  });

  it("core RH capabilities are available", () => {
    for (const id of ["document_generation", "human_approval", "email_preparation", "traceability"]) {
      expect(getCapability(id)?.productionStatus).toBe("available");
    }
  });

  it("allowed scenario capabilities exclude demo-only ones", () => {
    for (const id of DEMO_ONLY_CAPABILITY_IDS) {
      expect(SCENARIO_ALLOWED_CAPABILITY_IDS.has(id)).toBe(false);
    }
  });

  it("declared capabilities resolve; unknown ones degrade safely", () => {
    expect(isCapabilityDeclared("document_generation")).toBe(true);
    expect(isCapabilityDeclared("nope")).toBe(false);
    expect(disclosureFor("nope")).toMatch(/démonstration/i);
  });

  it("surfaces the six narrated technologies", () => {
    const names = DEMO_TECHNOLOGIES.map((t) => t.name);
    expect(names).toEqual(["CloneOS", "CloneADN", "CloneGuard", "CloneTrust", "CloneContinuum", "CloneTrace"]);
  });
});
