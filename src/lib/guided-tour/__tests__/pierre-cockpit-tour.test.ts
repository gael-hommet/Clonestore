import { describe, it, expect } from "vitest";
import { PIERRE_COCKPIT_TOUR, PIERRE_COCKPIT_TOUR_ID } from "../registry/pierre-cockpit-tour";
import { MY_CLONESTORE_TOUR_ID } from "../registry/my-clonestore-tour";
import { PUBLIC_DISCOVERY_TOUR_ID } from "../registry/public-discovery-tour";
import { getTour, hasTour } from "../tour-registry";

describe("Tour cockpit Pierre (P9.3)", () => {
  it("id distinct des autres tours (aucune collision)", () => {
    expect(PIERRE_COCKPIT_TOUR_ID).toBe("pierre-cockpit");
    expect(new Set([PIERRE_COCKPIT_TOUR_ID, MY_CLONESTORE_TOUR_ID, PUBLIC_DISCOVERY_TOUR_ID]).size).toBe(3);
  });

  it("enregistré et résolvable via le registre", () => {
    expect(hasTour(PIERRE_COCKPIT_TOUR_ID)).toBe(true);
    expect(getTour(PIERRE_COCKPIT_TOUR_ID)).toBe(PIERRE_COCKPIT_TOUR);
  });

  it("8 étapes ciblant les zones pierre-* du cockpit, toutes sur /agents/pierre/use", () => {
    const targets = PIERRE_COCKPIT_TOUR.steps.map((s) => s.targetId);
    expect(targets).toEqual([
      "pierre-cockpit-header", "pierre-attention", "pierre-missions",
      "pierre-validations", "pierre-documents", "pierre-employees",
      "pierre-activity", "pierre-settings",
    ]);
    for (const s of PIERRE_COCKPIT_TOUR.steps) {
      expect(s.route).toBe("/agents/pierre/use");
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });

  it("copy sans emoji, versionnée", () => {
    expect(PIERRE_COCKPIT_TOUR.version).toBe(1);
    const allText = PIERRE_COCKPIT_TOUR.steps.map((s) => `${s.title} ${s.body}`).join(" ");
    // eslint-disable-next-line no-control-regex
    expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(allText)).toBe(false);
  });
});
