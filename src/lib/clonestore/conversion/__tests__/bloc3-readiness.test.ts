import { describe, it, expect } from "vitest";
import { buildB3ConversionVerdict } from "../readiness";

describe("BLOC 3 — readiness gate", () => {
  it("verdict par défaut CODE_READY + blocages externes listés", () => {
    const r = buildB3ConversionVerdict();
    expect(r.verdict).toBe("V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED");
    expect(r.leadforge_commit).toBe("db9b166");
    expect(r.contract_version).toBe("1.0.0");
    expect(r.price_match).toBe(true);
    expect(r.contract_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(r.blocking_external.length).toBeGreaterThan(0);
    expect(r.blocking_external.join("|")).toMatch(/Stripe live|prospect|campagne|grants|secret/i);
  });

  it("claims : verified ≥ 5, pending ≥ 1 (company_adaptation)", () => {
    const r = buildB3ConversionVerdict();
    expect(r.claims.verified).toBeGreaterThanOrEqual(5);
    expect(r.claims.pending).toBeGreaterThanOrEqual(1);
    expect(r.claims.pending_ids).toContain("company_adaptation");
  });
});
