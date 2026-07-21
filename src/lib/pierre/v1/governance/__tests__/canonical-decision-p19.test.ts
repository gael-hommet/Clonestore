// src/lib/pierre/v1/governance/__tests__/canonical-decision-p19.test.ts
// P19 — the canonical governance decision composes Guard + Trust + Policy/Country + Access with
// STRICTEST-WINS. No layer may grant more autonomy than the most restrictive layer allows.

import { describe, it, expect } from "vitest";
import { decideCanonicalGovernance, strictest } from "../canonical-decision";

describe("P19 — strictest-wins ordering", () => {
  it("returns the more restrictive of two decisions", () => {
    expect(strictest("allow_execute", "require_validation")).toBe("require_validation");
    expect(strictest("human_only", "allow_prepare")).toBe("human_only");
    expect(strictest("block", "refuse")).toBe("refuse");
    expect(strictest("allow_execute", "allow_prepare")).toBe("allow_prepare");
  });
});

describe("P19 — HUMAN_ONLY hard floors (never autonomous, any mode)", () => {
  for (const action of ["termination", "sanction", "dismissal", "discrimination_flagged", "harassment_flagged", "final_recruitment_decision"] as const) {
    it(`${action} → human_only even in enterprise_autonomous`, () => {
      const d = decideCanonicalGovernance({ action, risk: "high", sensitivity: "restricted", mode: "enterprise_autonomous", external_side_effect: true });
      expect(d.decision).toBe("human_only");
      expect(d.autonomyGranted).toBe("draft"); // clamped to draft
      expect(d.validationsRequired).toBe(true);
    });
  }
});

describe("P19 — autonomy never exceeds requested and drops on restriction", () => {
  it("low-risk operational in enterprise_autonomous → allow_execute keeps requested autonomy", () => {
    const d = decideCanonicalGovernance({ action: "status_update", risk: "low", sensitivity: "normal", mode: "enterprise_autonomous", external_side_effect: false });
    expect(d.decision).toBe("allow_execute");
    expect(d.autonomyGranted).toBe("enterprise_autonomous");
  });
  it("a require_validation drops granted autonomy to draft", () => {
    const d = decideCanonicalGovernance({ action: "contract", risk: "medium", sensitivity: "sensitive", mode: "high_autonomy", external_side_effect: true });
    expect(["require_validation", "human_only"]).toContain(d.decision);
    expect(d.autonomyGranted).toBe("draft");
  });
});

describe("P19 — country fail-closed (jurisdictional)", () => {
  it("jurisdictional action with no legal country → block (no France fallback)", () => {
    const d = decideCanonicalGovernance({
      action: "contract", risk: "low", sensitivity: "normal", mode: "normal", external_side_effect: true,
      country: { legalCountry: null, jurisdictional: true, verified: false },
    });
    // contract is APPROVAL_ONLY anyway (require_validation), but country pushes to block (stricter).
    expect(d.decision).toBe("block");
    expect(d.appliedRules).toContain("ClonePolicy:country_required");
  });
  it("jurisdictional action, country known but not VERIFIED → require_validation (never auto)", () => {
    const d = decideCanonicalGovernance({
      action: "standard_report", risk: "low", sensitivity: "normal", mode: "enterprise_autonomous", external_side_effect: false,
      country: { legalCountry: "CH", jurisdictional: true, verified: false },
    });
    expect(d.decision).toBe("require_validation");
    expect(d.autonomyGranted).toBe("draft");
  });
  it("non-jurisdictional low-risk action is unaffected by country", () => {
    const d = decideCanonicalGovernance({
      action: "status_update", risk: "low", sensitivity: "normal", mode: "normal", external_side_effect: false,
      country: { legalCountry: "CH", jurisdictional: false, verified: false },
    });
    expect(d.decision).toBe("allow_execute");
  });
});

describe("P19 — access: permission / suspension / revocation", () => {
  it("missing base permission → refuse (strictest)", () => {
    const d = decideCanonicalGovernance({ action: "status_update", risk: "low", sensitivity: "normal", mode: "normal", external_side_effect: false, access: { permissionGranted: false, missing: ["mission.write"] } });
    expect(d.decision).toBe("refuse");
    expect(d.permissionsOk).toBe(false);
  });
  it("suspended → block", () => {
    const d = decideCanonicalGovernance({ action: "status_update", risk: "low", sensitivity: "normal", mode: "normal", external_side_effect: false, access: { permissionGranted: true, suspended: true } });
    expect(d.decision).toBe("block");
  });
  it("revoked mid-flight → block", () => {
    const d = decideCanonicalGovernance({ action: "status_update", risk: "low", sensitivity: "normal", mode: "high_autonomy", external_side_effect: false, access: { permissionGranted: true, revoked: true } });
    expect(d.decision).toBe("block");
  });
});

describe("P19 — indirect HUMAN_ONLY via lexical net still escalates", () => {
  it("benign-looking action whose text implies termination is caught by Guard", () => {
    const d = decideCanonicalGovernance({ action: "standard_report", risk: "low", sensitivity: "normal", mode: "enterprise_autonomous", external_side_effect: false, text: "prépare la lettre pour licencier Paul" });
    expect(["require_validation", "human_only"]).toContain(d.decision);
    expect(d.decision).not.toBe("allow_execute");
  });
});
