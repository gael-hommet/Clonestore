// src/lib/pierre/v1/__tests__/p83-document-type-registry.test.ts
// PHASE 8.3-B2 §6 — canonical document type registry governance.

import { describe, it, expect } from "vitest";
import {
  DOCUMENT_TYPES, ALL_DOCUMENT_TYPE_KEYS, getDocumentTypePolicy, validateDocumentType,
  calculateDocumentRequirements, canRoleUseDocumentType, canRoleReadDocumentType, canRoleApproveDocumentType,
} from "../document-types";

const REQUIRED = [
  "employment_contract", "contract_amendment", "job_offer", "onboarding_pack", "policy_acknowledgement",
  "absence_justification", "payroll_variable_document", "interview_report", "training_certificate",
  "disciplinary_document", "employee_certificate", "work_certificate", "offboarding_document", "generic_hr_document",
];

describe("§6 document type registry", () => {
  it("defines all 14 mandatory HR types with complete policies", () => {
    for (const k of REQUIRED) {
      const p = getDocumentTypePolicy(k);
      expect(p, k).toBeTruthy();
      expect(p!.key).toBe(k);
      expect(Array.isArray(p!.required_fields)).toBe(true);
      expect(p!.allowed_roles.length).toBeGreaterThan(0);
      expect(["none", "acknowledgement", "simple", "advanced"]).toContain(p!.signature_requirement);
    }
    expect(ALL_DOCUMENT_TYPE_KEYS.sort()).toEqual([...REQUIRED].sort());
  });

  it("refuses an unknown type (non-bypassable)", () => {
    expect(getDocumentTypePolicy("totally_made_up")).toBeNull();
    expect(() => validateDocumentType("totally_made_up")).toThrowError(/unknown_document_type/);
  });

  it("computes requirements; contracts require advanced signature + an approval", () => {
    const c = calculateDocumentRequirements("employment_contract");
    expect(c.signature_requirement).toBe("advanced");
    expect(c.required_approvals).toBeGreaterThanOrEqual(1);
    expect(c.required_fields).toContain("employee_id");
    expect(calculateDocumentRequirements("generic_hr_document").required_approvals).toBe(0);
  });

  it("payroll + interview + disciplinary are high-sensitivity with restricted visibility", () => {
    expect(DOCUMENT_TYPES.payroll_variable_document.default_sensitivity).toBe("high");
    expect(DOCUMENT_TYPES.payroll_variable_document.employee_visibility).toBe("never");
    expect(DOCUMENT_TYPES.interview_report.default_sensitivity).toBe("high");
    expect(DOCUMENT_TYPES.disciplinary_document.manager_visibility).toBe("never");
  });

  it("role gates: use / read / approve", () => {
    expect(canRoleUseDocumentType(["HR_OPERATOR"], "employment_contract")).toBe(true);
    expect(canRoleUseDocumentType(["MANAGER"], "employment_contract")).toBe(false);
    expect(canRoleUseDocumentType(["PAYROLL_MANAGER"], "payroll_variable_document")).toBe(true);
    expect(canRoleUseDocumentType(["HR_OPERATOR"], "payroll_variable_document")).toBe(false);
    expect(canRoleReadDocumentType(["AUDITOR"], "employment_contract")).toBe(true);
    expect(canRoleApproveDocumentType(["VALIDATOR"], "employment_contract")).toBe(true);
    expect(canRoleApproveDocumentType(["VALIDATOR"], "disciplinary_document")).toBe(false); // HR_DIRECTOR only
    expect(canRoleApproveDocumentType(["HR_DIRECTOR"], "disciplinary_document")).toBe(true);
    expect(canRoleApproveDocumentType(["HR_OPERATOR"], "employment_contract")).toBe(false);
  });
});
