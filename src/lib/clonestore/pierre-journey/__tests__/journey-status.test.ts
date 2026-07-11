// src/lib/clonestore/pierre-journey/__tests__/journey-status.test.ts
// P9.6 §6 — le résumé de préparation est HONNÊTE (dérivé des signaux réels, pas de logique RH).
import { describe, it, expect } from "vitest";
import { computeJourneyReadiness, type JourneyReadinessInput } from "../journey-status";

const base: JourneyReadinessInput = {
  companyResolved: true,
  autonomy: { productModeId: "validation", label: "Validation" },
  missionCount: 0,
  activeMission: null,
  pendingValidations: 0,
  evidenceCount: 0,
  latestResult: null,
};

describe("P9.6 journey readiness", () => {
  it("BLOCKED when no company is resolved (never claims operability)", () => {
    const r = computeJourneyReadiness({ ...base, companyResolved: false, autonomy: null });
    expect(r.level).toBe("blocked");
    expect(r.canOperate).toBe(false);
    expect(r.items.find((i) => i.id === "company")?.state).toBe("blocked");
    // autonomy is not claimed done without a company
    expect(r.items.find((i) => i.id === "autonomy")?.state).not.toBe("done");
  });

  it("ONBOARDING when company resolved but no mission yet", () => {
    const r = computeJourneyReadiness(base);
    expect(r.level).toBe("onboarding");
    expect(r.canOperate).toBe(true);
    expect(r.items.find((i) => i.id === "company")?.state).toBe("done");
    expect(r.items.find((i) => i.id === "autonomy")?.state).toBe("done");
    expect(r.items.find((i) => i.id === "mission")?.state).toBe("todo");
  });

  it("OPERATING with an active mission and pending validation surfaced", () => {
    const r = computeJourneyReadiness({
      ...base,
      missionCount: 2,
      activeMission: { id: "m1", title: "Contrat CDI", statusLabel: "En cours" },
      pendingValidations: 1,
      evidenceCount: 3,
      latestResult: { id: "m0", title: "Attestation", statusLabel: "Terminé" },
    });
    expect(r.level).toBe("operating");
    expect(r.items.find((i) => i.id === "mission")?.state).toBe("pending");
    expect(r.items.find((i) => i.id === "validation")?.state).toBe("pending");
    expect(r.items.find((i) => i.id === "evidence")?.state).toBe("done");
    expect(r.items.find((i) => i.id === "result")?.state).toBe("done");
    expect(r.summary.toLowerCase()).toContain("décision");
  });

  it("no pending validations → validation item is done, not fabricated", () => {
    const r = computeJourneyReadiness({ ...base, missionCount: 1, pendingValidations: 0 });
    expect(r.items.find((i) => i.id === "validation")?.state).toBe("done");
    expect(r.items.find((i) => i.id === "evidence")?.state).toBe("todo"); // honest: no evidence yet
  });

  it("always emits exactly 6 items in canonical order", () => {
    const r = computeJourneyReadiness(base);
    expect(r.items.map((i) => i.id)).toEqual(["company", "autonomy", "mission", "validation", "evidence", "result"]);
  });
});
