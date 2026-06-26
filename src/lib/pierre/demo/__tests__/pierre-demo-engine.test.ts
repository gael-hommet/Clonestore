// PIERRE FINAL INTERACTIVE DEMO — engine + scenario consistency tests.
// Pure unit tests. No AI, no network, no Supabase, no Stripe.

import { describe, it, expect } from "vitest";
import {
  DEMO_SCENARIOS,
  DEFAULT_SCENARIO_ID,
  getScenario,
  getDefaultScenario,
} from "../demo-scenarios";
import {
  GUIDED_STEPS,
  GUIDED_STEP_COUNT,
  computeScenarioMetrics,
  understandingIsConsistent,
  allTasks,
  nextStepIndex,
  prevStepIndex,
  clampStepIndex,
  isLastStep,
  completionPercentage,
  totalGuidedDurationMs,
  stepIndexById,
} from "../demo-engine";

describe("pierre-demo engine — scenarios", () => {
  it("exposes exactly three scenarios", () => {
    expect(DEMO_SCENARIOS).toHaveLength(3);
  });

  it("default scenario is the recommended one", () => {
    const def = getDefaultScenario();
    expect(def.id).toBe(DEFAULT_SCENARIO_ID);
    expect(def.recommended).toBe(true);
  });

  it("exactly one scenario is recommended", () => {
    expect(DEMO_SCENARIOS.filter((s) => s.recommended).length).toBe(1);
  });

  it("scenario ids are unique and resolvable", () => {
    const ids = DEMO_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getScenario(id)?.id).toBe(id);
  });
});

describe("pierre-demo engine — metrics are derived, never invented", () => {
  it("each scenario's understanding matches its structure", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(understandingIsConsistent(s), `understanding inconsistent for ${s.id}`).toBe(true);
    }
  });

  it("informationsInventees is always 0", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(computeScenarioMetrics(s).informationsInventees).toBe(0);
    }
  });

  it("the recommended scenario yields the prescribed headline proof", () => {
    const m = computeScenarioMetrics(getDefaultScenario());
    expect(m).toMatchObject({
      demande: 1,
      missions: 4,
      taches: 11,
      documents: 3,
      communications: 4,
      validations: 2,
      suivis: 2,
      blocages: 1,
      informationsInventees: 0,
    });
  });

  it("task counts equal the sum across missions", () => {
    for (const s of DEMO_SCENARIOS) {
      const total = s.missions.reduce((acc, m) => acc + m.tasks.length, 0);
      expect(allTasks(s).length).toBe(total);
      expect(computeScenarioMetrics(s).taches).toBe(total);
    }
  });
});

describe("pierre-demo engine — guided journey navigation", () => {
  it("has the expected ordered steps ending on result", () => {
    expect(GUIDED_STEP_COUNT).toBe(GUIDED_STEPS.length);
    expect(GUIDED_STEPS[0].id).toBe("composer");
    expect(GUIDED_STEPS[GUIDED_STEP_COUNT - 1].id).toBe("result");
  });

  it("navigation clamps at both ends (no dead ends)", () => {
    expect(prevStepIndex(0)).toBe(0);
    expect(nextStepIndex(GUIDED_STEP_COUNT - 1)).toBe(GUIDED_STEP_COUNT - 1);
    expect(clampStepIndex(-5)).toBe(0);
    expect(clampStepIndex(999)).toBe(GUIDED_STEP_COUNT - 1);
  });

  it("can always reach the last step by going next", () => {
    let i = 0;
    for (let guard = 0; guard < 100 && !isLastStep(i); guard++) i = nextStepIndex(i);
    expect(isLastStep(i)).toBe(true);
    expect(GUIDED_STEPS[i].id).toBe("result");
  });

  it("completion percentage is monotonic 0→100", () => {
    expect(completionPercentage(0)).toBeGreaterThan(0);
    expect(completionPercentage(GUIDED_STEP_COUNT - 1)).toBe(100);
    expect(completionPercentage(2)).toBeGreaterThan(completionPercentage(1));
  });

  it("step lookup resolves and total duration is in the ~2 min band", () => {
    expect(stepIndexById("result")).toBe(GUIDED_STEP_COUNT - 1);
    const total = totalGuidedDurationMs();
    expect(total).toBeGreaterThanOrEqual(110_000);
    expect(total).toBeLessThanOrEqual(180_000);
  });
});
