import { describe, it, expect } from "vitest";
import { resolveNextAction } from "../next-action";

describe("resolveNextAction (prochaine action de démarrage)", () => {
  it("not_started : rien commencé", () => {
    const a = resolveNextAction({ quickStartComplete: false, quickStartProgress: 0, footprintCompletion: 0 });
    expect(a.stage).toBe("not_started");
    expect(a.progress).toBe(0);
    expect(a.estimatedTime).toContain("5 min");
    expect(a.cta.href).toBe("/profile/onboarding");
  });

  it("quick_start_in_progress : Quick Start partiel", () => {
    const a = resolveNextAction({ quickStartComplete: false, quickStartProgress: 0.6, footprintCompletion: 0 });
    expect(a.stage).toBe("quick_start_in_progress");
    expect(a.progress).toBeCloseTo(0.3, 5); // 0.6 * 0.5
  });

  it("quick_start_complete : QS fini, empreinte vide", () => {
    const a = resolveNextAction({ quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0 });
    expect(a.stage).toBe("quick_start_complete");
    expect(a.progress).toBe(0.5);
  });

  it("footprint_in_progress : empreinte partielle sous le seuil", () => {
    const a = resolveNextAction({ quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0.4 });
    expect(a.stage).toBe("footprint_in_progress");
    expect(a.progress).toBeCloseTo(0.7, 5); // 0.5 + 0.4*0.5
  });

  it("footprint_sufficient : empreinte au-dessus du seuil", () => {
    const a = resolveNextAction({ quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0.9 });
    expect(a.stage).toBe("footprint_sufficient");
    expect(a.progress).toBeGreaterThan(0.9);
  });

  it("borne les valeurs aberrantes", () => {
    const a = resolveNextAction({ quickStartComplete: true, quickStartProgress: 5, footprintCompletion: 2 });
    expect(a.progress).toBe(1);
  });

  it("seuil de suffisance configurable", () => {
    const a = resolveNextAction(
      { quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0.5 },
      { sufficientThreshold: 0.5 },
    );
    expect(a.stage).toBe("footprint_sufficient");
  });

  it("chaque action a titre/description/CTA non vides", () => {
    const cases = [
      { quickStartComplete: false, quickStartProgress: 0, footprintCompletion: 0 },
      { quickStartComplete: false, quickStartProgress: 0.5, footprintCompletion: 0 },
      { quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0 },
      { quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0.4 },
      { quickStartComplete: true, quickStartProgress: 1, footprintCompletion: 0.95 },
    ];
    for (const c of cases) {
      const a = resolveNextAction(c);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.cta.label.length).toBeGreaterThan(0);
    }
  });
});
