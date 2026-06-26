// PHASE 8.3-B2G-R1.11 — DB-level invariants that cannot rely on TypeScript. Every incoherence
// is REFUSED (no silent repair).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

describe("R1.11 DB invariants", () => {
  it("a contract version cannot be set `final` without a finalized document version", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    const v = (await h.db.query<{ id: string }>(`select id from pierre_rt_employee_contract_versions where contract_id=$1 order by version desc limit 1`, [c.id])).rows[0];
    // the underlying document version is still draft → forcing the contract version to final is refused
    await expect(h.db.query(`update pierre_rt_employee_contract_versions set workflow_status='final' where id=$1`, [v.id])).rejects.toThrow(/finalized document version/);
  });

  it("a signature request cannot reference a cross-tenant document or a mismatched version", async () => {
    // build a real doc+version in company A
    const doc = newUuid(), ver = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T')`, [doc, h.companyA]);
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [ver, h.companyA, doc]);
    // a cross-tenant request (company B) referencing company A's document → refused
    await expect(h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, status, idempotency_key) values ($1,$2,$3,$4,'ready',$5)`, [newUuid(), h.companyB, doc, ver, newUuid()]))
      .rejects.toThrow(/cross-tenant|missing|mismatch/i);
    // a request whose version belongs to a DIFFERENT document → refused
    const doc2 = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T2')`, [doc2, h.companyA]);
    await expect(h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, status, idempotency_key) values ($1,$2,$3,$4,'ready',$5)`, [newUuid(), h.companyA, doc2, ver, newUuid()]))
      .rejects.toThrow(/mismatch|does not match/i);
  });

  it("a signature recipient cannot belong to a cross-tenant request", async () => {
    const doc = newUuid(), ver = newUuid(), req = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T')`, [doc, h.companyA]);
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [ver, h.companyA, doc]);
    await h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, status, idempotency_key) values ($1,$2,$3,$4,'ready',$5)`, [req, h.companyA, doc, ver, newUuid()]);
    // a recipient row in company B pointing at company A's request → refused
    await expect(h.db.query(`insert into pierre_rt_signature_recipients (id, company_id, signature_request_id, name, email, role) values ($1,$2,$3,'X','x@y.z','employee')`, [newUuid(), h.companyB, req]))
      .rejects.toThrow(/cross-tenant|foreign key|violates/i);
  });

  it("the amendment idempotency key is unique per tenant+parent at the DB level", async () => {
    const p = (await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" })).id;
    await C.createContractAmendment(h.db, owner, p, { reason: "r", effective_from: "2026-07-01", idempotency_key: "K" });
    await expect(h.db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, workflow_status, parent_contract_id, amendment_idempotency_key) values (gen_random_uuid(),$1,$2,'CDI_FULL_TIME','draft','draft',$3,'K')`, [h.companyA, emp, p]))
      .rejects.toThrow(/duplicate key|unique/i);
  });
});
