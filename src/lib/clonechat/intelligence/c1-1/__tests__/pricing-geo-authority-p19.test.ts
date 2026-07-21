// src/lib/clonechat/intelligence/c1-1/__tests__/pricing-geo-authority-p19.test.ts
// P19 — the server-resolved legal country overrides any country word in the message. A known company's
// price/currency can never be imposed by the user's text.

import { describe, it, expect } from "vitest";
import { pricingChunk } from "../parrain-product-index";

describe("P19 — CloneChat pricing uses the server geo authority (not the message text)", () => {
  it("server country CH → CH pricing, flagged server-authoritative", () => {
    const c = pricingChunk("c'est combien ?", "CH");
    expect(c.text).toContain("Pour CH");
    expect(c.text).toMatch(/CHF/);
    expect(c.text).toContain("résolu côté serveur");
  });

  it("server FR beats a 'prix en Suisse' text (server wins, no CH)", () => {
    const c = pricingChunk("quel est le prix en Suisse ?", "FR");
    expect(c.text).toContain("Pour FR");
    expect(c.text).not.toContain("Pour CH");
  });

  it("no server country (public/anon) → falls back to the text country", () => {
    const c = pricingChunk("le prix en suisse", null);
    expect(c.text).toContain("Pour CH");
    expect(c.text).not.toContain("résolu côté serveur");
  });

  it("BE/LU server country → EUR pricing", () => {
    expect(pricingChunk("combien ?", "BE").text).toContain("Pour BE");
    expect(pricingChunk("combien ?", "LU").text).toContain("Pour LU");
  });

  it("backward compatible: no server country arg preserves the legacy text-only behavior", () => {
    const legacy = pricingChunk("prix en france");
    expect(legacy.text).toContain("Pour FR");
    expect(legacy.text).not.toContain("résolu côté serveur");
  });
});
