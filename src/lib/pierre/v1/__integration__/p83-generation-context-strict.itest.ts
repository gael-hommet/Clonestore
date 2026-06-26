// src/lib/pierre/v1/__integration__/p83-generation-context-strict.itest.ts
// PHASE 8.3-B2E §13 — strict generation context. Only the requested fields are loaded;
// every referenced site/contract is verified to belong to the tenant and the employee;
// a cross-tenant or mismatched reference is refused; unknown fields are fail-closed.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { defineCustomField } from "../custom-fields";
import { buildStrictGenerationContext } from "../generation-context";

let h: Harness; let owner: TenantContext;
let employeeId: string; let siteId: string; let contractId: string;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  siteId = newUuid(); employeeId = newUuid(); contractId = newUuid();
  await h.db.query(`insert into pierre_rt_sites (id, company_id, name, code) values ($1,$2,'Paris HQ','PAR')`, [siteId, h.companyA]);
  await h.db.query(`insert into pierre_rt_employees (id, company_id, site_id, first_name, last_name, email, role_title, hired_at) values ($1,$2,$3,'Ada','Lovelace','ada@ex.com','Engineer','2024-01-15')`, [employeeId, h.companyA, siteId]);
  await h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status) values ($1,$2,$3,'CDI_FULL_TIME','draft')`, [contractId, h.companyA, employeeId]);
});
afterEach(async () => { if (h) await h.close(); });

describe("§13 strict generation context", () => {
  it("loads ONLY the requested fields (no blanket record dump)", async () => {
    const ctx = await buildStrictGenerationContext(h.db, owner, { document_type: "work_certificate", employee_id: employeeId, site_id: siteId, requested_fields: ["employee.first_name", "employee.role_title", "site.name"] });
    expect(Object.keys(ctx.values).sort()).toEqual(["employee.first_name", "employee.role_title", "site.name"]);
    expect(ctx.values["employee.first_name"]).toBe("Ada");
    expect(ctx.values["site.name"]).toBe("Paris HQ");
    // a field that exists on the row but was NOT requested is absent.
    expect(ctx.values["employee.professional_email"]).toBeUndefined();
  });

  it("refuses an unknown field (fail-closed)", async () => {
    await expect(buildStrictGenerationContext(h.db, owner, { document_type: "work_certificate", employee_id: employeeId, requested_fields: ["employee.secret"] })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("refuses a cross-tenant site and a cross-tenant / mismatched contract", async () => {
    const otherSite = newUuid();
    await h.db.query(`insert into pierre_rt_sites (id, company_id, name, code) values ($1,$2,'B site','BSI')`, [otherSite, h.companyB]);
    await expect(buildStrictGenerationContext(h.db, owner, { document_type: "work_certificate", employee_id: employeeId, site_id: otherSite, requested_fields: ["site.name"] })).rejects.toMatchObject({ code: "validation_failed" });
    // a contract that belongs to a different employee of the SAME tenant → refused
    const otherEmp = newUuid();
    await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'Bob','X')`, [otherEmp, h.companyA]);
    const otherContract = newUuid();
    await h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status) values ($1,$2,$3,'CDD','draft')`, [otherContract, h.companyA, otherEmp]);
    await expect(buildStrictGenerationContext(h.db, owner, { document_type: "work_certificate", employee_id: employeeId, contract_id: otherContract, requested_fields: ["employee.first_name"] })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("flags sensitive requested fields and resolves validated custom fields strictly", async () => {
    await defineCustomField(h.db, owner, { field_key: "bonus_target", label: "Bonus", data_type: "number", sensitivity: "sensitive" });
    await h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'bonus_target','1500')`, [h.companyA, employeeId]);
    const ctx = await buildStrictGenerationContext(h.db, owner, { document_type: "interview_report", employee_id: employeeId, requested_fields: ["employee.first_name", "validated_custom_fields.bonus_target"] });
    expect(ctx.values["validated_custom_fields.bonus_target"]).toBe("1500");
    expect(ctx.sensitive_fields).toContain("validated_custom_fields.bonus_target");
    expect(ctx.custom_field_keys).toEqual(["bonus_target"]);
  });
});
