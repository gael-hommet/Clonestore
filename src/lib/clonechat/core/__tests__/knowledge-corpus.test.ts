import { describe, it, expect } from "vitest";
import { buildCorpus, corpus } from "../knowledge-corpus";

describe("CloneChat Unified — knowledge corpus", () => {
  it("builds a non-empty, deterministic corpus", () => {
    const a = buildCorpus();
    const b = buildCorpus();
    expect(a.length).toBeGreaterThan(10);
    expect(a.length).toBe(b.length);
    expect(a.map((u) => u.id)).toEqual(b.map((u) => u.id));
  });

  it("has no duplicate unit ids", () => {
    const ids = corpus().map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes an honest ROI/productivity unit that never invents a number", () => {
    const roi = corpus().find((u) => u.id === "pierre.roi");
    expect(roi).toBeTruthy();
    expect(roi!.text).toMatch(/aucune moyenne/i);
    expect(roi!.text).not.toMatch(/\d+\s*%/); // no fabricated percentage figure
  });

  it("derives pricing from the canonical resolver (no hardcoded duplicate amount)", () => {
    const pricing = corpus().find((u) => u.id === "pricing.catalog");
    expect(pricing).toBeTruthy();
    expect(pricing!.text).toMatch(/449/);
    expect(pricing!.text).toMatch(/499/);
    expect(pricing!.priority).toBe(1); // configuration runtime = highest priority
  });

  it("every unit declares a traceable source", () => {
    for (const u of corpus()) {
      expect(u.source.length).toBeGreaterThan(0);
      expect(u.priority).toBeGreaterThanOrEqual(1);
      expect(u.priority).toBeLessThanOrEqual(4);
    }
  });
});
