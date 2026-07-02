// src/lib/pierre/v1/final-certification/__tests__/certification.test.ts
// PHASE 8.13 — the final certification keeps the two dimensions strictly separate and honest:
// FUNCTIONAL completeness (every capability has a governed certified path) is CERTIFIED, while
// COUNTRY authorization is 0/4 and PRODUCTION stays NOT_AUTHORIZED. No scenario fabricates a result,
// invents law, or auto-takes a human decision.

import { describe, it, expect } from "vitest";
import { certifyAllCapabilities, classifyCapability } from "../functional-coverage";
import { runAllScenarios, runScenario } from "../scenario-runner";
import { CERTIFICATION_SCENARIOS } from "../scenario-registry";
import { validateAllOutcomes } from "../outcome-validator";
import { validateAllEvidence } from "../evidence-validator";
import { countryReadiness } from "../country-readiness";
import { providerReadiness } from "../provider-readiness";
import { assessCustomerAcceptance } from "../customer-acceptance";
import { buildLaunchDecision } from "../launch-decision";
import { HR_CAPABILITIES, getCapability } from "../../hr-canon/capability-registry";

describe("DIMENSION A — functional completeness", () => {
  it("every one of the 215 capabilities has a governed certified path (0 NOT_CERTIFIED)", () => {
    const cov = certifyAllCapabilities();
    expect(cov.totalCapabilities).toBe(HR_CAPABILITIES.length);
    expect(cov.uncertifiedIds).toEqual([]);
    expect(cov.functionallyComplete).toBe(true);
  });
  it("every VERIFIED_EXISTING capability certifies with evidence", () => {
    for (const c of HR_CAPABILITIES.filter((x) => x.implementation === "VERIFIED_EXISTING")) {
      const e = classifyCapability(c);
      expect(e.state.startsWith("CERTIFIED"), c.id).toBe(true);
      expect(e.evidenceRefs.length, c.id).toBeGreaterThan(0);
    }
  });
  it("HUMAN_ONLY capabilities certify as human-decision (never automated)", () => {
    for (const c of HR_CAPABILITIES.filter((x) => x.implementation === "HUMAN_ONLY")) {
      expect(classifyCapability(c).state).toBe("CERTIFIED_HUMAN_DECISION");
    }
  });
  it("evidence validator passes (no CERTIFIED_* without evidence)", () => {
    expect(validateAllEvidence(certifyAllCapabilities().entries).ok).toBe(true);
  });
});

describe("certification scenarios (real runtime, no fabrication)", () => {
  it("every scenario runs, compiles, hits its expected terminal state, and shows NO forbidden effect", () => {
    const r = runAllScenarios();
    expect(r.total).toBeGreaterThan(0);
    expect(r.failed).toEqual([]);
    expect(r.passed).toBe(r.total);
  });
  it("outcome validator finds no violation", () => {
    const pairs = CERTIFICATION_SCENARIOS.map((sc) => ({ sc, out: runScenario(sc) }));
    expect(validateAllOutcomes(pairs).ok).toBe(true);
  });
  it("country scenarios are ALL blocked (fail-closed) — no invented law", () => {
    for (const sc of CERTIFICATION_SCENARIOS.filter((s) => s.country !== "GENERIC")) {
      const out = runScenario(sc);
      expect(out.terminalState, sc.id).toBe("BLOCKED");
      expect(out.forbiddenEffectsObserved).toEqual([]);
    }
  });
});

describe("DIMENSION B — country/provider authorization (kept SEPARATE)", () => {
  it("0/4 countries are launch-grade (0 VERIFIED rules)", () => {
    const cr = countryReadiness({} as NodeJS.ProcessEnv);
    expect(cr.launchGradeCount).toBe(0);
    for (const c of cr.countries) { expect(c.rulesVerified).toBe(0); expect(c.launchGrade).toBe(false); expect(c.blockers.length).toBeGreaterThan(0); }
  });
  it("0 providers are launch-grade; manual path is NOT counted as integration", () => {
    const pr = providerReadiness({} as NodeJS.ProcessEnv);
    expect(pr.liveGrade).toBe(0);
    expect(pr.manualPaths).toBe(6);
    expect(pr.providers.find((p) => p.provider === "yousign")?.status).toBe("blocked");
  });
});

describe("customer acceptance + owner decision (honest separation)", () => {
  it("functional backend is customer-usable without technical intervention", () => {
    expect(assessCustomerAcceptance().ok).toBe(true);
  });
  it("decision: functional CERTIFIED, but production NOT_AUTHORIZED and no country authorized", () => {
    const d = buildLaunchDecision({} as NodeJS.ProcessEnv);
    expect(d.functionalCertification).toBe("CERTIFIED");
    expect(d.productionUnblock).toBe("NOT_AUTHORIZED");
    expect(Object.values(d.countryAuthorization).every((v) => v === false)).toBe(true);
  });
  it("sanity: canon not regressed (215 capabilities present)", () => {
    expect(getCapability("contract.create")).toBeTruthy();
    expect(HR_CAPABILITIES.length).toBe(215);
  });
});
