import { describe, it, expect } from "vitest";
import { COCKPIT_NAV, isCockpitView, parseCockpitView } from "../shell-nav";

describe("cockpit shell-nav", () => {
  it("expose exactement les 6 vues, dans l'ordre", () => {
    expect(COCKPIT_NAV.map((n) => n.view)).toEqual([
      "overview", "missions", "validations", "documents", "employees", "activity",
    ]);
  });

  it("chaque vue porte une cible de tour pierre-*", () => {
    for (const n of COCKPIT_NAV) {
      expect(n.tourId.startsWith("pierre-")).toBe(true);
      expect(n.label.length).toBeGreaterThan(0);
    }
  });

  it("parseCockpitView : valeur valide conservée, sinon overview", () => {
    expect(parseCockpitView("validations")).toBe("validations");
    expect(parseCockpitView("documents")).toBe("documents");
    expect(parseCockpitView("nope")).toBe("overview");
    expect(parseCockpitView(null)).toBe("overview");
    expect(parseCockpitView(undefined)).toBe("overview");
  });

  it("isCockpitView garde le typage", () => {
    expect(isCockpitView("overview")).toBe(true);
    expect(isCockpitView("settings")).toBe(false);
    expect(isCockpitView("")).toBe(false);
  });
});
