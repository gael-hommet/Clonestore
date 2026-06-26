// src/lib/pierre/v1/__integration__/p83-custom-field-definitions.itest.ts
// PHASE 8.3-B2E §12 — canonical custom field definitions store + service. The company
// HR config is the source of truth; values are validated against it before they can
// ever enter a generation context; inactive/unknown keys are refused.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { defineCustomField, loadValidatedCustomFieldDefinitions, validateCustomFieldValue, loadValidatedCustomFieldsForGeneration } from "../custom-fields";

let h: Harness; let owner: TenantContext; let employeeId: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  employeeId = newUuid();
  await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'Ada','Lovelace')`, [employeeId, h.companyA]);
});
afterEach(async () => { if (h) await h.close(); });

describe("§12 custom field definitions", () => {
  it("defines a canonical field and loads it back as a definition map", async () => {
    const def = await defineCustomField(h.db, owner, { field_key: "bonus_target", label: "Objectif de bonus", data_type: "number", sensitivity: "sensitive", required_provenance: "payroll_system" });
    expect(def.field_key).toBe("bonus_target");
    const defs = await loadValidatedCustomFieldDefinitions(h.db, owner);
    expect(defs.get("bonus_target")?.sensitivity).toBe("sensitive");
    expect(defs.get("bonus_target")?.required_provenance).toBe("payroll_system");
  });

  it("rejects an invalid key and validates values against the declared data type", async () => {
    await expect(defineCustomField(h.db, owner, { field_key: "Bad Key!", label: "x" })).rejects.toMatchObject({ code: "validation_failed" });
    const def = { field_key: "age", data_type: "number" as const, sensitivity: "normal" as const, active: true };
    expect(validateCustomFieldValue(def, "42")).toBe("42");
    expect(() => validateCustomFieldValue(def, "NaN")).toThrow();
  });

  it("loads ONLY the requested keys for generation; inactive and unknown keys are refused", async () => {
    await defineCustomField(h.db, owner, { field_key: "bonus_target", label: "Bonus", data_type: "number", sensitivity: "sensitive", required_provenance: "payroll_system" });
    await defineCustomField(h.db, owner, { field_key: "old_field", label: "Old", active: false });
    await h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'bonus_target','1500')`, [h.companyA, employeeId]);
    const resolved = await loadValidatedCustomFieldsForGeneration(h.db, owner, employeeId, ["bonus_target"], { provenance: { bonus_target: "payroll_system" } });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ field_key: "bonus_target", value: "1500", sensitivity: "sensitive", provenance_ok: true });
    // wrong provenance → flagged not-ok (the caller/guard refuses it for a final)
    const badProv = await loadValidatedCustomFieldsForGeneration(h.db, owner, employeeId, ["bonus_target"]);
    expect(badProv[0].provenance_ok).toBe(false);
    // inactive key refused
    await expect(loadValidatedCustomFieldsForGeneration(h.db, owner, employeeId, ["old_field"])).rejects.toMatchObject({ code: "validation_failed" });
    // unknown key refused
    await expect(loadValidatedCustomFieldsForGeneration(h.db, owner, employeeId, ["ghost"])).rejects.toMatchObject({ code: "validation_failed" });
  });
});
