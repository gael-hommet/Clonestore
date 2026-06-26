// src/lib/pierre/v1/__integration__/p83-b2f-fk-matrix-integrity.itest.ts
// PHASE 8.3-B2F §1 — the template/contract/custom-field/file-integrity spine is bound to a
// SINGLE tenant by composite (company_id, fk) foreign keys. A cross-tenant reference cannot
// be stored even via direct SQL; a same-tenant reference is accepted.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { if (h) await h.close(); });

const COMPOSITE_FKS = ["fk_tplver_template_ct", "fk_tplappr_version_ct", "fk_tplfield_version_ct", "fk_ecf_employee_ct", "fk_contract_employee_ct", "fk_cv_contract_ct", "fk_dal_document_ct", "fk_fsr_file_ct", "fk_fic_file_ct"];

async function seedEmployee(company: string): Promise<string> {
  const id = newUuid();
  await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'A','B')`, [id, company]);
  return id;
}

describe("§1 FK matrix — composite tenant binding", () => {
  it("every critical composite FK is present in the database", async () => {
    const { rows } = await h.db.query<{ conname: string }>(`select conname from pg_constraint where conname = any($1)`, [COMPOSITE_FKS]);
    expect(new Set(rows.map((r) => r.conname))).toEqual(new Set(COMPOSITE_FKS));
  });

  it("custom_field → employee cannot cross tenants (composite FK), same-tenant is accepted", async () => {
    const eA = await seedEmployee(h.companyA);
    const eB = await seedEmployee(h.companyB);
    // company A custom field pointing at company B's employee → rejected by the composite FK
    await expect(h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'k','v')`, [h.companyA, eB]))
      .rejects.toThrow(/foreign key|fk_ecf_employee_ct|violates/i);
    // same-tenant → accepted
    await h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'k','v')`, [h.companyA, eA]);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_custom_fields where company_id=$1`, [h.companyA]);
    expect(n.rows[0].n).toBe(1);
  });

  it("contract → employee and contract_version → contract cannot cross tenants", async () => {
    const eA = await seedEmployee(h.companyA);
    const eB = await seedEmployee(h.companyB);
    await expect(h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status) values ($1,$2,$3,'CDI_FULL_TIME','draft')`, [newUuid(), h.companyA, eB]))
      .rejects.toThrow(/foreign key|violates/i);
    const cA = newUuid();
    await h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status) values ($1,$2,$3,'CDI_FULL_TIME','draft')`, [cA, h.companyA, eA]);
    // a contract_version in company B referencing company A's contract → rejected
    await expect(h.db.query(`insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version) values ($1,$2,$3,1)`, [newUuid(), h.companyB, cA]))
      .rejects.toThrow(/foreign key|violates/i);
  });

  it("template_version → template cannot cross tenants", async () => {
    const tA = newUuid();
    await h.db.query(`insert into pierre_rt_document_templates (id, company_id, key, name, document_type) values ($1,$2,$3,'N','work_certificate')`, [tA, h.companyA, `k-${newUuid()}`]);
    await expect(h.db.query(`insert into pierre_rt_document_template_versions (id, company_id, template_id, version_number, body, renderer, field_schema, status) values ($1,$2,$3,1,'b','pdf','[]','draft')`, [newUuid(), h.companyB, tA]))
      .rejects.toThrow(/foreign key|violates/i);
  });
});
