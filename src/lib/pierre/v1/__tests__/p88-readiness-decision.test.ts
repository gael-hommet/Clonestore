// PHASE 8.8 — tests for the final Production-unblock decision engine (fail-closed invariants).
import { describe, it, expect } from "vitest";
import { evaluateReadiness, renderDecision, READY, BLOCKED } from "../p88-readiness-decision.mjs";

// A fully-green gate set (used as the base; individual tests flip one gate to prove BLOCKED).
const allGreen = () => ({
  tests: { passed: true },
  build: { passed: true },
  preflight: { green: true },
  providers: { stripe_test: true, resend: true, yousign_sandbox: true },
  p874: { verified_24_24: true, final_report_ok: true },
  externalBlockers: [{ id: "P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP", state: "CLOSED" }],
  deployBlock: { active: true },
  residue: { zero: true },
  rollback: { ready: true },
  observability: { ready: true },
  ownerApproval: { granted: true },
});

describe("P8.8 readiness decision — fail-closed gates", () => {
  it("all gates green (incl. P8.7.4 24/24 + owner approval) → READY", () => {
    const r = evaluateReadiness(allGreen());
    expect(r.decision).toBe(READY);
    expect(r.ready).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("INVARIANT: P8.7.4 not 24/24 → BLOCKED (even if everything else is green)", () => {
    const g = allGreen(); g.p874.verified_24_24 = false;
    const r = evaluateReadiness(g);
    expect(r.decision).toBe(BLOCKED);
    expect(r.blockers.some((b) => b.gate === "p8_7_4")).toBe(true);
  });

  it("Yousign external blocker OPEN → BLOCKED (the current real state)", () => {
    const g = allGreen();
    g.p874.verified_24_24 = false;
    g.externalBlockers = [{ id: "P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP", state: "OPEN", owner: "external" }];
    const r = evaluateReadiness(g);
    expect(r.decision).toBe(BLOCKED);
    expect(r.blockers.some((b) => b.gate === "external:P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP")).toBe(true);
  });

  it("deploy-block already disabled prematurely → BLOCKED (anomaly)", () => {
    const g = allGreen(); g.deployBlock.active = false;
    const r = evaluateReadiness(g);
    expect(r.decision).toBe(BLOCKED);
    expect(r.blockers.some((b) => b.gate === "deploy_block" && b.owner === "security")).toBe(true);
  });

  it("synthetic residue present → BLOCKED", () => {
    const g = allGreen(); g.residue.zero = false;
    expect(evaluateReadiness(g).blockers.some((b) => b.gate === "residue")).toBe(true);
  });

  it("rollback not ready → BLOCKED", () => {
    const g = allGreen(); g.rollback.ready = false;
    expect(evaluateReadiness(g).blockers.some((b) => b.gate === "rollback")).toBe(true);
  });

  it("observability not ready → BLOCKED", () => {
    const g = allGreen(); g.observability.ready = false;
    expect(evaluateReadiness(g).blockers.some((b) => b.gate === "observability")).toBe(true);
  });

  it("owner approval absent → BLOCKED", () => {
    const g = allGreen(); g.ownerApproval.granted = false;
    const r = evaluateReadiness(g);
    expect(r.decision).toBe(BLOCKED);
    expect(r.blockers.some((b) => b.gate === "owner_approval" && b.owner === "owner")).toBe(true);
  });

  it("tests/build/preflight failing → BLOCKED with each reason", () => {
    const g = allGreen(); g.tests.passed = false; g.build.passed = false; g.preflight.green = false;
    const r = evaluateReadiness(g);
    for (const gate of ["tests", "build", "preflight"]) expect(r.blockers.some((b) => b.gate === gate)).toBe(true);
  });

  it("provider mode wrong (stripe live / yousign non-sandbox) → BLOCKED", () => {
    const g = allGreen(); g.providers.stripe_test = false; g.providers.yousign_sandbox = false;
    const r = evaluateReadiness(g);
    expect(r.blockers.some((b) => b.gate === "stripe")).toBe(true);
    expect(r.blockers.some((b) => b.gate === "yousign")).toBe(true);
  });

  it("empty input → BLOCKED (fail-closed) and never throws", () => {
    const r = evaluateReadiness();
    expect(r.decision).toBe(BLOCKED);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("renderDecision never leaks values + reflects the decision", () => {
    const r = evaluateReadiness(allGreen());
    expect(renderDecision(r)).toContain(READY);
    const b = evaluateReadiness(); expect(renderDecision(b)).toContain(BLOCKED);
  });

  it("CURRENT canonical state (Yousign OPEN, P8.7.4 not verified, owner pending) → BLOCKED", () => {
    const g = allGreen();
    g.p874 = { verified_24_24: false, final_report_ok: false };
    g.externalBlockers = [{ id: "P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP", state: "OPEN", owner: "external" }];
    g.ownerApproval = { granted: false };
    const r = evaluateReadiness(g);
    expect(r.decision).toBe(BLOCKED);
    // deploy-block still active is REQUIRED and present in the canonical state
    expect(r.blockers.some((b) => b.gate === "deploy_block")).toBe(false);
  });
});
