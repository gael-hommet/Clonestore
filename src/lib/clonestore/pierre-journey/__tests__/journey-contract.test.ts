// src/lib/clonestore/pierre-journey/__tests__/journey-contract.test.ts
// P9.6 §6 — test #1 : le contrat de parcours est complet et cohérent.
import { describe, it, expect } from "vitest";
import {
  JOURNEY_STEPS,
  SECURITY_INVARIANTS,
  ALLOWED_TEST_SHORTCUTS,
  FORBIDDEN_SHORTCUTS,
  journeyContract,
  isContractComplete,
  coveredSteps,
  type JourneyStepId,
} from "../journey-contract";

describe("P9.6 journey contract", () => {
  it("covers the full journey 1..16 with no gap and unique ids/orders", () => {
    expect(isContractComplete()).toBe(true);
    expect(JOURNEY_STEPS).toHaveLength(16);
    const ids = new Set(JOURNEY_STEPS.map((s) => s.id));
    expect(ids.size).toBe(16);
    const orders = JOURNEY_STEPS.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("names the real product surfaces & API proof points (no placeholders)", () => {
    for (const s of JOURNEY_STEPS) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.uiSurface.length).toBeGreaterThan(0);
      expect(s.apiProofPoint.length).toBeGreaterThan(0);
    }
    // The three load-bearing security steps must carry an explicit invariant.
    for (const id of ["company", "execute", "no_double_execute"] as JourneyStepId[]) {
      expect(JOURNEY_STEPS.find((s) => s.id === id)?.securityInvariant).toBeTruthy();
    }
  });

  it("encodes the non-negotiable security invariants", () => {
    const blob = SECURITY_INVARIANTS.join(" ").toLowerCase();
    expect(blob).toContain("companyresolved:true");
    expect(blob).toContain("u:<userid>"); // named as the thing NEVER to use for the main proof
    expect(blob).toContain("proposalid");
    expect(blob).toContain("double exécution");
    expect(blob).toContain("gardes dures");
  });

  it("lists the allowed test setup and the forbidden shortcuts", () => {
    const forbidden = FORBIDDEN_SHORTCUTS.join(" ").toLowerCase();
    expect(forbidden).toContain("u:<userid>");
    expect(forbidden).toContain("companyresolved:false");
    expect(forbidden).toContain("/api/assistant/execute");
    expect(forbidden).toContain("2e cerveau rh");
    const allowed = ALLOWED_TEST_SHORTCUTS.join(" ").toLowerCase();
    expect(allowed).toContain("uuid");
    expect(allowed).toContain("pglite");
  });

  it("never frames Pierre as an assistant/copilote in the contract text", () => {
    const all = [
      ...JOURNEY_STEPS.flatMap((s) => [s.label, s.uiSurface, s.apiProofPoint, s.securityInvariant ?? ""]),
      ...SECURITY_INVARIANTS,
      ...ALLOWED_TEST_SHORTCUTS,
    ].join(" ").toLowerCase();
    // "assistant" appears ONLY as the technical route path /api/assistant/* and /assistant surface — never as Pierre's role.
    const roleClaims = all.replace(/\/api\/assistant/g, "").replace(/\/assistant/g, "");
    expect(roleClaims).not.toMatch(/pierre[^.]{0,20}(assistant|copilote)/);
  });

  it("coveredSteps reports missing steps precisely", () => {
    const partial: JourneyStepId[] = ["access", "company", "membership"];
    const r = coveredSteps(partial);
    expect(r.complete).toBe(false);
    expect(r.missing).toContain("execute");
    expect(r.missing).toContain("mission_created");
    const full = JOURNEY_STEPS.map((s) => s.id);
    expect(coveredSteps(full)).toEqual({ complete: true, missing: [] });
  });

  it("journeyContract() bundles steps + invariants + allowed + forbidden", () => {
    const c = journeyContract();
    expect(c.steps).toHaveLength(16);
    expect(c.invariants.length).toBeGreaterThanOrEqual(6);
    expect(c.allowed.length).toBeGreaterThanOrEqual(4);
    expect(c.forbidden.length).toBeGreaterThanOrEqual(6);
  });
});
