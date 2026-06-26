// src/lib/pierre/v1/__tests__/p83-template-security-corrections.test.ts
// PHASE 8.3-B2C §1/§2 — unknown fields NEVER render; canonical sensitivity wins.

import { describe, it, expect } from "vitest";
import { mergeTemplate, type TemplateField } from "../templates";
import type { CustomFieldDefinition } from "../field-policies";

// A context that DOES contain values the template must not be able to siphon out
// just by referencing them when they are not declared in the schema.
const ctx = () => ({
  company: { display_name: "Acme", legal_name: "Acme SAS", registration_number: "RCS-123" },
  employee: { first_name: "Hélène", last_name: "Émard", professional_email: "h@acme.test", personal_email: "perso@gmail.com", employee_number: "E001" },
  validated_custom_fields: { bonus: "9999", note: "n" },
  dates: { today: "2026-06-16" }, employment: {}, contract: {}, site: {}, manager: {},
});
const declare = (...paths: string[]): TemplateField[] => paths.map((p) => ({ field_key: p, source_path: p }));

describe("§1 unknown fields never render (no value siphoning)", () => {
  it("a context value absent from the schema is NOT rendered", () => {
    const r = mergeTemplate("{{employee.first_name}} / {{employee.last_name}}", ctx(), declare("employee.first_name"), { canReadSensitive: true });
    expect(r.rendered_text).toContain("Hélène");
    expect(r.rendered_text).toContain("{{employee.last_name}}"); // present in context, undeclared → withheld
    expect(r.rendered_text).not.toContain("Émard");
    expect(r.unknown_fields).toContain("employee.last_name");
    expect(r.ready_for_preview).toBe(false);
    expect(r.ready_for_final_generation).toBe(false);
  });

  it("professional/personal email cannot be siphoned when undeclared", () => {
    const r = mergeTemplate("{{employee.professional_email}} {{employee.personal_email}}", ctx(), declare(), { canReadSensitive: true });
    expect(r.rendered_text).not.toContain("h@acme.test");
    expect(r.rendered_text).not.toContain("perso@gmail.com");
    expect(r.unknown_fields).toEqual(expect.arrayContaining(["employee.professional_email", "employee.personal_email"]));
  });

  it("an undeclared custom field is not rendered even though present in context", () => {
    const r = mergeTemplate("Bonus: {{validated_custom_fields.bonus}}", ctx(), declare(), { canReadSensitive: true });
    expect(r.rendered_text).not.toContain("9999");
    expect(r.unknown_fields).toContain("validated_custom_fields.bonus");
  });

  it("unknown + valid in the same template: valid renders, unknown withheld", () => {
    const r = mergeTemplate("{{company.display_name}} — {{company.registration_number}}", ctx(), declare("company.display_name"), { canReadSensitive: true });
    expect(r.rendered_text).toContain("Acme");
    expect(r.rendered_text).not.toContain("RCS-123");
    expect(r.unknown_fields).toContain("company.registration_number");
  });

  it("no arbitrary context field is reachable by a bare placeholder (proto/constructor invalid)", () => {
    const r = mergeTemplate("{{__proto__.polluted}} {{constructor}} {{employee.__proto__.x}}", ctx(), declare("employee.first_name"), { canReadSensitive: true });
    expect(r.invalid_fields.length).toBeGreaterThanOrEqual(2);
    expect(r.rendered_text).not.toContain("undefined");
  });
});

describe("§2 canonical sensitivity overrides a lying template", () => {
  it("a sensitive custom field declared 'sensitive:false' is still withheld without permission", () => {
    const defs = new Map<string, CustomFieldDefinition>([["bonus", { field_key: "bonus", data_type: "string", sensitivity: "restricted", active: true }]]);
    const sch: TemplateField[] = [{ field_key: "validated_custom_fields.bonus", source_path: "validated_custom_fields.bonus", sensitive: false }];
    const without = mergeTemplate("{{validated_custom_fields.bonus}}", ctx(), sch, { canReadSensitive: false, customDefs: defs });
    expect(without.rendered_text).not.toContain("9999");
    expect(without.missing_fields).toContain("validated_custom_fields.bonus");
    const withPerm = mergeTemplate("{{validated_custom_fields.bonus}}", ctx(), sch, { canReadSensitive: true, customDefs: defs });
    expect(withPerm.sensitive_fields_used).toContain("validated_custom_fields.bonus");
    expect(withPerm.rendered_text).toContain("9999");
  });

  it("an inactive custom field definition is treated as not a valid field", () => {
    const defs = new Map<string, CustomFieldDefinition>([["bonus", { field_key: "bonus", data_type: "string", sensitivity: "normal", active: false }]]);
    const sch: TemplateField[] = [{ field_key: "validated_custom_fields.bonus", source_path: "validated_custom_fields.bonus" }];
    const r = mergeTemplate("{{validated_custom_fields.bonus}}", ctx(), sch, { canReadSensitive: true, customDefs: defs });
    expect(r.invalid_fields).toContain("validated_custom_fields.bonus"); // declared but no active policy → invalid
    expect(r.rendered_text).not.toContain("9999");
  });
});
