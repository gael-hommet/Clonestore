// src/lib/pierre/v1/__integration__/p83-b2f-cross-tenant-fk.itest.ts
// PHASE 8.3-B2F §1 — the generic fail-closed cross-tenant guard trigger protects the soft
// (ON DELETE SET NULL) references and the employee-360 satellites, where a composite FK
// would force RESTRICT and break the intended soft-delete semantics. Cross-tenant writes are
// refused on INSERT and UPDATE; same-tenant writes pass; delete semantics are unchanged.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { if (h) await h.close(); });

async function seedEmployee(company: string): Promise<string> {
  const id = newUuid();
  await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'A','B')`, [id, company]);
  return id;
}

describe("§1 cross-tenant guard trigger", () => {
  it("an employee-360 satellite cannot reference an employee from another company (INSERT)", async () => {
    const eB = await seedEmployee(h.companyB);
    await expect(h.db.query(`insert into pierre_rt_employee_addresses (id, company_id, employee_id, type, city) values ($1,$2,$3,'home','Paris')`, [newUuid(), h.companyA, eB]))
      .rejects.toThrow(/cross-tenant reference blocked/);
    await expect(h.db.query(`insert into pierre_rt_employee_sensitive_data (company_id, employee_id) values ($1,$2)`, [h.companyA, eB]))
      .rejects.toThrow(/cross-tenant reference blocked/);
  });

  it("a same-tenant satellite reference is accepted", async () => {
    const eA = await seedEmployee(h.companyA);
    await h.db.query(`insert into pierre_rt_employee_addresses (id, company_id, employee_id, type, city) values ($1,$2,$3,'home','Paris')`, [newUuid(), h.companyA, eA]);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_addresses where company_id=$1`, [h.companyA]);
    expect(n.rows[0].n).toBe(1);
  });

  it("a soft reference (contract.document_id) cannot be UPDATED to a cross-tenant document", async () => {
    const eA = await seedEmployee(h.companyA);
    const cA = newUuid();
    await h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status) values ($1,$2,$3,'CDI_FULL_TIME','draft')`, [cA, h.companyA, eA]);
    const dB = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T')`, [dB, h.companyB]);
    await expect(h.db.query(`update pierre_rt_employee_contracts set document_id=$1 where id=$2`, [dB, cA]))
      .rejects.toThrow(/cross-tenant reference blocked/);
    // same-tenant document → accepted
    const dA = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T')`, [dA, h.companyA]);
    await h.db.query(`update pierre_rt_employee_contracts set document_id=$1 where id=$2`, [dA, cA]);
    const r = await h.db.query<{ document_id: string }>(`select document_id from pierre_rt_employee_contracts where id=$1`, [cA]);
    expect(r.rows[0].document_id).toBe(dA);
  });

  it("the guard does not change ON DELETE semantics (deleting the parent still cascades the satellite)", async () => {
    const eA = await seedEmployee(h.companyA);
    await h.db.query(`insert into pierre_rt_employee_addresses (id, company_id, employee_id, type, city) values ($1,$2,$3,'home','Paris')`, [newUuid(), h.companyA, eA]);
    await h.db.query(`delete from pierre_rt_employees where id=$1`, [eA]);
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_addresses where employee_id=$1`, [eA]);
    expect(n.rows[0].n).toBe(0); // CASCADE preserved
  });
});
