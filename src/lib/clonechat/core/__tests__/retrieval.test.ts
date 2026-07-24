import { describe, it, expect } from "vitest";
import { retrieve, formatRetrievedContext } from "../retrieval";

describe("CloneChat Unified — retrieval (pure, lexical, no model)", () => {
  it("retrieves the ROI unit — not just pricing — for the failing production question", () => {
    const results = retrieve("en moyenne pierre fait gagner combien de temps à une entreprise, et combien d'argent", 6);
    const ids = results.map((r) => r.unit.id);
    expect(ids).toContain("pierre.roi");
  });

  it("retrieves pricing for an explicit price question", () => {
    const results = retrieve("combien coûte Pierre en France ?", 6);
    const ids = results.map((r) => r.unit.id);
    expect(ids).toContain("pricing.catalog");
  });

  it("is accent/case-insensitive (French normalization)", () => {
    const withAccents = retrieve("Où réserver Pierre ?", 6).map((r) => r.unit.id);
    const withoutAccents = retrieve("ou reserver pierre", 6).map((r) => r.unit.id);
    expect(withAccents).toEqual(withoutAccents);
  });

  it("returns nothing for an empty/stopword-only question (no false positives)", () => {
    expect(retrieve("le la de", 6)).toHaveLength(0);
  });

  it("formats a bounded context block (cost control)", () => {
    const ctx = formatRetrievedContext(retrieve("Pierre capacités limites gouvernance", 6));
    expect(ctx.length).toBeLessThanOrEqual(4000);
  });
});
