import { describe, it, expect } from "vitest";
import { CLONECHAT_TOUR, CLONECHAT_TOUR_ID } from "../registry/clonechat-tour";
import { PIERRE_COCKPIT_TOUR_ID } from "../registry/pierre-cockpit-tour";
import { MY_CLONESTORE_TOUR_ID } from "../registry/my-clonestore-tour";
import { PUBLIC_DISCOVERY_TOUR_ID } from "../registry/public-discovery-tour";
import { getTour, hasTour } from "../tour-registry";

describe("Tour CloneChat (P9.4)", () => {
  it("id distinct des autres tours (aucune collision)", () => {
    expect(new Set([CLONECHAT_TOUR_ID, PIERRE_COCKPIT_TOUR_ID, MY_CLONESTORE_TOUR_ID, PUBLIC_DISCOVERY_TOUR_ID]).size).toBe(4);
  });
  it("enregistré + résolvable", () => {
    expect(hasTour(CLONECHAT_TOUR_ID)).toBe(true);
    expect(getTour(CLONECHAT_TOUR_ID)).toBe(CLONECHAT_TOUR);
  });
  it("étapes ciblent les zones clonechat-* sur /assistant", () => {
    for (const s of CLONECHAT_TOUR.steps) {
      expect(s.route).toBe("/assistant");
      expect(s.targetId.startsWith("clonechat-")).toBe(true);
    }
    expect(CLONECHAT_TOUR.steps.map((s) => s.targetId)).toContain("clonechat-input");
  });
});
