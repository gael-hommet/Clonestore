// PHASE 8.3-B3-R3.1 — the contract-policy signature level maps to the provider tier through ONE
// canonical, explicit conversion that NEVER weakens the requirement (no advanced → SES). The
// standard policies declare their REAL requirement (SES); APPRENTICESHIP keeps AES (Choice A).
import { describe, it, expect } from "vitest";
import { providerLevelForPolicy } from "../signature-security";
import { CONTRACT_POLICIES, getContractPolicy } from "../contract-policies";

describe("B3-R3.1 canonical policy → provider level (no downgrade)", () => {
  it("the canonical conversion is exact and never weakens", () => {
    expect(providerLevelForPolicy("none")).toBeNull();
    expect(providerLevelForPolicy("acknowledgement")).toBe("acknowledgement");
    expect(providerLevelForPolicy("simple")).toBe("simple");
    expect(providerLevelForPolicy("advanced")).toBe("advanced_provider_managed");
    expect(providerLevelForPolicy("qualified")).toBe("qualified_provider_managed");
  });
  it("advanced NEVER maps to a SES level", () => {
    expect(providerLevelForPolicy("advanced")).not.toBe("simple");
    expect(providerLevelForPolicy("advanced")).not.toBe("acknowledgement");
  });
  it("qualified NEVER maps to AES or SES", () => {
    expect(providerLevelForPolicy("qualified")).not.toBe("advanced_provider_managed");
    expect(providerLevelForPolicy("qualified")).not.toBe("simple");
  });
  it("standard employment policies declare SES (the real requirement, no over-specification)", () => {
    for (const key of ["CDI_FULL_TIME", "CDI_PART_TIME", "CDD", "CDD_REPLACEMENT", "SEASONAL", "TEMPORARY", "PROFESSIONAL_TRAINING", "INTERNSHIP", "OTHER"]) {
      expect(getContractPolicy(key)?.signature_level).toBe("simple");
      expect(providerLevelForPolicy(getContractPolicy(key)!.signature_level)).toBe("simple");
    }
  });
  it("APPRENTICESHIP keeps the stronger AES requirement (Choice A) and resolves to AES", () => {
    expect(CONTRACT_POLICIES.APPRENTICESHIP.signature_level).toBe("advanced");
    expect(providerLevelForPolicy(CONTRACT_POLICIES.APPRENTICESHIP.signature_level)).toBe("advanced_provider_managed");
  });
  it("no policy silently uses a level that downgrades to SES from a stronger tier", () => {
    for (const p of Object.values(CONTRACT_POLICIES)) {
      const resolved = providerLevelForPolicy(p.signature_level);
      if (p.signature_level === "advanced") expect(resolved).toBe("advanced_provider_managed");
      if (p.signature_level === "qualified") expect(resolved).toBe("qualified_provider_managed");
    }
  });
});
