// src/lib/pierre/v1/__integration__/p83-b2g-contract-policy.itest.ts
// PHASE 8.3-B2G §1 — the contract policy registry is canonical and non-bypassable.

import { describe, it, expect } from "vitest";
import { getContractPolicy, validateContractType, canRoleCreateContract, canRoleApproveContract, isRendererAllowedForContract, ALL_CONTRACT_TYPE_KEYS } from "../contract-policies";

describe("§1 contract policy registry", () => {
  it("covers every contract_type present in the schema CHECK", () => {
    expect(ALL_CONTRACT_TYPE_KEYS).toEqual(expect.arrayContaining(["CDI_FULL_TIME", "CDI_PART_TIME", "CDD", "CDD_REPLACEMENT", "CDD_TEMPORARY_INCREASE", "APPRENTICESHIP", "PROFESSIONAL_TRAINING", "INTERNSHIP", "SEASONAL", "TEMPORARY", "OTHER"]));
  });

  it("refuses an unknown contract type (free strings are not accepted)", () => {
    expect(getContractPolicy("HACKED_TYPE")).toBeNull();
    expect(() => validateContractType("HACKED_TYPE")).toThrow(/unknown_contract_type/);
  });

  it("fixed-term contracts require an end date; CDI does not", () => {
    expect(getContractPolicy("CDD")!.requires_end_date).toBe(true);
    expect(getContractPolicy("CDD")!.conditional_fields).toContain("employment.end_date");
    expect(getContractPolicy("CDI_FULL_TIME")!.requires_end_date).toBe(false);
  });

  it("gates create + approve by role, and contracts never auto-execute", () => {
    expect(canRoleCreateContract(["HR_OPERATOR"], "CDI_FULL_TIME")).toBe(true);
    expect(canRoleCreateContract(["AUDITOR"], "CDI_FULL_TIME")).toBe(false);
    expect(canRoleApproveContract(["HR_DIRECTOR"], "CDI_FULL_TIME")).toBe(true);
    expect(canRoleApproveContract(["HR_OPERATOR"], "CDI_FULL_TIME")).toBe(false);
    expect(getContractPolicy("CDI_FULL_TIME")!.auto_execution_allowed).toBe(false);
  });

  it("refuses a renderer outside both the contract and the document-type policy", () => {
    expect(isRendererAllowedForContract("CDI_FULL_TIME", "pdf")).toBe(true);
    expect(isRendererAllowedForContract("CDI_FULL_TIME", "docx")).toBe(true);
    // an unknown type → no renderer allowed
    expect(isRendererAllowedForContract("HACKED_TYPE", "pdf")).toBe(false);
  });
});
