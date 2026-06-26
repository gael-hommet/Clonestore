// src/lib/pierre/v1/__integration__/p83-field-policy-enforcement.itest.ts
// PHASE 8.3-B2E §11 — the canonical field policy governs preview/final eligibility,
// required permissions, denied document types and provenance. A template author can
// never relax any of it.

import { describe, it, expect } from "vitest";
import { evaluateFieldUsage, resolveFieldPolicy, isFieldSensitive, type CustomFieldDefinition } from "../field-policies";

describe("§11 field policy enforcement", () => {
  it("a sensitive compensation field is barred from previews and needs the sensitive permission in a final", () => {
    const preview = evaluateFieldUsage("compensation.base_salary", { stage: "preview", document_type: "employment_contract", permissions: ["employee.sensitive.read"] });
    expect(preview.allowed).toBe(false);
    expect(preview.reason_code).toBe("field_not_allowed_in_preview");
    const noPerm = evaluateFieldUsage("compensation.base_salary", { stage: "final", document_type: "employment_contract", permissions: [] });
    expect(noPerm.allowed).toBe(false);
    expect(noPerm.reason_code).toBe("field_missing_permission");
    expect(noPerm.required_permissions).toContain("employee.sensitive.read");
    const ok = evaluateFieldUsage("compensation.base_salary", { stage: "final", document_type: "employment_contract", permissions: ["employee.sensitive.read"] });
    expect(ok.allowed).toBe(true);
  });

  it("a field denied for a document type is refused regardless of permissions", () => {
    const d = evaluateFieldUsage("compensation.base_salary", { stage: "final", document_type: "work_certificate", permissions: ["employee.sensitive.read"] });
    expect(d.allowed).toBe(false);
    expect(d.reason_code).toBe("field_denied_for_document_type");
  });

  it("an unknown field is fail-closed", () => {
    const d = evaluateFieldUsage("employee.secret_backdoor", { stage: "preview", document_type: "work_certificate", permissions: ["document.sensitive.read"] });
    expect(d.allowed).toBe(false);
    expect(d.reason_code).toBe("unknown_field");
  });

  it("custom-field sensitivity comes from the validated definition, never the template", () => {
    const defs = new Map<string, CustomFieldDefinition>([["bonus_target", { field_key: "bonus_target", data_type: "number", sensitivity: "sensitive", active: true }]]);
    expect(isFieldSensitive("validated_custom_fields.bonus_target", defs)).toBe(true);
    const pol = resolveFieldPolicy("validated_custom_fields.bonus_target", defs);
    expect(pol?.required_permissions_final).toContain("document.sensitive.read");
    // an inactive definition resolves to nothing (unknown field)
    const inactive = new Map<string, CustomFieldDefinition>([["bonus_target", { field_key: "bonus_target", data_type: "number", sensitivity: "sensitive", active: false }]]);
    expect(resolveFieldPolicy("validated_custom_fields.bonus_target", inactive)).toBeNull();
    const usage = evaluateFieldUsage("validated_custom_fields.bonus_target", { stage: "final", document_type: "interview_report", permissions: [] }, defs);
    expect(usage.allowed).toBe(false);
    expect(usage.required_permissions).toContain("document.sensitive.read");
  });

  it("a custom field restricted to certain document types is refused elsewhere", () => {
    const defs = new Map<string, CustomFieldDefinition>([["clause_x", { field_key: "clause_x", data_type: "string", sensitivity: "normal", active: true, allowed_document_types: ["employment_contract"] }]]);
    expect(evaluateFieldUsage("validated_custom_fields.clause_x", { stage: "final", document_type: "work_certificate", permissions: [] }, defs).reason_code).toBe("field_not_allowed_for_document_type");
    expect(evaluateFieldUsage("validated_custom_fields.clause_x", { stage: "final", document_type: "employment_contract", permissions: [] }, defs).allowed).toBe(true);
  });
});
