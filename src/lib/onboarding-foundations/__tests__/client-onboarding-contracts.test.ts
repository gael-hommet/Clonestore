import { describe, it, expect } from "vitest";
import { deriveOverallCompletion } from "../client-onboarding-contracts";
import type { FootprintSectionState } from "../client-onboarding-contracts";

const section = (completion: number): FootprintSectionState => ({
  id: "s",
  label: "S",
  status: "in_progress",
  completion,
});

describe("deriveOverallCompletion (fondation onboarding client)", () => {
  it("0 sans section", () => {
    expect(deriveOverallCompletion([])).toBe(0);
  });

  it("moyenne bornée [0,1]", () => {
    expect(deriveOverallCompletion([section(0), section(1)])).toBe(0.5);
    expect(deriveOverallCompletion([section(1), section(1)])).toBe(1);
  });

  it("borne les valeurs aberrantes", () => {
    expect(deriveOverallCompletion([section(-2), section(5)])).toBe(0.5);
    expect(deriveOverallCompletion([section(Number.NaN)])).toBe(0);
  });
});
