import { describe, it, expect } from "vitest";
import {
  FOOTPRINT_SECTIONS,
  buildFootprintSections,
  firstIncompleteSectionId,
  footprintOverall,
  isFootprintSufficient,
  sectionStatus,
  type SectionCompletionMap,
} from "../guided-footprint";

describe("Empreinte guidée — sections & complétude", () => {
  it("sectionStatus dérive empty/in_progress/complete", () => {
    expect(sectionStatus(0)).toBe("empty");
    expect(sectionStatus(0.5)).toBe("in_progress");
    expect(sectionStatus(1)).toBe("complete");
    expect(sectionStatus(2)).toBe("complete"); // borné
  });

  it("buildFootprintSections respecte l'ordre canonique et borne les complétudes", () => {
    const inputs: SectionCompletionMap = {
      identity: { completion: 1, savedAt: "2026-07-01T00:00:00.000Z" },
      team: { completion: 0.5 },
      rules: { completion: 3 }, // borné à 1
    };
    const sections = buildFootprintSections(inputs);
    expect(sections.map((s) => s.id)).toEqual(FOOTPRINT_SECTIONS.map((s) => s.id));
    expect(sections[0].status).toBe("complete");
    expect(sections[0].savedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(sections[1].status).toBe("in_progress");
    const rules = sections.find((s) => s.id === "rules")!;
    expect(rules.completion).toBe(1);
    const documents = sections.find((s) => s.id === "documents")!;
    expect(documents.status).toBe("empty"); // absent des inputs
  });

  it("footprintOverall = moyenne des complétudes (helper P9.1)", () => {
    const sections = buildFootprintSections({ identity: { completion: 1 }, team: { completion: 1 } });
    // 2 complètes / 6 sections
    expect(footprintOverall(sections)).toBeCloseTo(2 / 6, 5);
  });

  it("firstIncompleteSectionId ignore les sections optionnelles vides", () => {
    // toutes requises complètes, mission (optionnelle) vide → null
    const allRequired: SectionCompletionMap = {
      identity: { completion: 1 },
      team: { completion: 1 },
      documents: { completion: 1 },
      rules: { completion: 1 },
      technologies: { completion: 1 },
    };
    const sections = buildFootprintSections(allRequired);
    expect(firstIncompleteSectionId(sections)).toBeNull();

    const partial = buildFootprintSections({ identity: { completion: 1 } });
    expect(firstIncompleteSectionId(partial)).toBe("team");
  });

  it("isFootprintSufficient : basé sur les sections REQUISES", () => {
    const low = buildFootprintSections({ identity: { completion: 1 } });
    expect(isFootprintSufficient(low)).toBe(false);
    const high = buildFootprintSections({
      identity: { completion: 1 },
      team: { completion: 1 },
      documents: { completion: 1 },
      rules: { completion: 1 },
      technologies: { completion: 0.5 },
    });
    expect(isFootprintSufficient(high)).toBe(true); // (1+1+1+1+0.5)/5 = 0.9 ≥ 0.7
  });
});
