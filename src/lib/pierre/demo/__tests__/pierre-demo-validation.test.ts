// PIERRE FINAL INTERACTIVE DEMO — validation / no-dishonesty tests.
import { describe, it, expect } from "vitest";
import { DEMO_SCENARIOS } from "../demo-scenarios";
import {
  validateScenario,
  validateAllScenarios,
  demoIsHealthy,
  DEMO_CTA_ALLOWED_HREFS,
  DEMO_CTA_DESTINATIONS,
  FORBIDDEN_CLAIM_PATTERNS,
} from "../demo-validation";

describe("pierre-demo validation — honesty invariants", () => {
  it("all scenarios pass every invariant", () => {
    const issues = validateAllScenarios();
    expect(issues, JSON.stringify(issues, null, 2)).toHaveLength(0);
    expect(demoIsHealthy()).toBe(true);
  });

  it("each scenario individually has no issues", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(validateScenario(s), s.id).toHaveLength(0);
    }
  });

  it("CTA destinations are real, allow-listed routes", () => {
    expect([...DEMO_CTA_ALLOWED_HREFS].every((h) => h.startsWith("/"))).toBe(true);
    expect(DEMO_CTA_DESTINATIONS.reserve).toBe("/reserver/pierre");
    expect(DEMO_CTA_DESTINATIONS.discover).toBe("/agents/pierre");
  });

  it("no forbidden commercial claim appears anywhere in scenario copy", () => {
    const blob = JSON.stringify(DEMO_SCENARIOS);
    for (const re of FORBIDDEN_CLAIM_PATTERNS) {
      expect(re.test(blob), `forbidden: ${re.source}`).toBe(false);
    }
  });

  it("detects an injected undeclared capability (negative control)", () => {
    const broken = structuredClone(DEMO_SCENARIOS[0]);
    broken.missions[0].tasks[0].capabilityId = "totally_made_up";
    expect(validateScenario(broken).some((i) => i.kind === "undeclared_capability")).toBe(true);
  });

  it("detects a demo-only capability shown as active (negative control)", () => {
    const broken = structuredClone(DEMO_SCENARIOS[0]);
    broken.missions[0].tasks[0].capabilityId = "voice_call";
    expect(
      validateScenario(broken).some((i) => i.kind === "demo_only_capability_shown_active"),
    ).toBe(true);
  });

  it("detects a dead document link (negative control)", () => {
    const broken = structuredClone(DEMO_SCENARIOS[0]);
    broken.messages[0].actions = [{ id: "x", label: "x", kind: "view_document", documentId: "ghost" }];
    expect(validateScenario(broken).some((i) => i.kind === "dead_document_link")).toBe(true);
  });
});
