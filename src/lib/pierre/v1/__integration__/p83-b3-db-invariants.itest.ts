// PHASE 8.3-B3 §B3.13 — DB-level invariants for the signature runtime.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { if (h) await h.close(); });

async function seedRequest(company: string): Promise<{ doc: string; ver: string; req: string }> {
  const doc = newUuid(), ver = newUuid(), req = newUuid();
  await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T')`, [doc, company]);
  await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [ver, company, doc]);
  await h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, provider, provider_request_id, status, idempotency_key) values ($1,$2,$3,$4,'fake_provider',$5,'submitted',$6)`, [req, company, doc, ver, "prov-" + req.slice(0, 8), newUuid()]);
  return { doc, ver, req };
}

describe("B3 DB invariants", () => {
  it("signed_document_version_id must be a version of the same tenant + document", async () => {
    const { doc, req } = await seedRequest(h.companyA);
    const foreign = newUuid();
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,2)`, [foreign, h.companyA, doc]); // same doc → allowed
    await h.db.query(`update pierre_rt_signature_requests set signed_document_version_id=$1 where id=$2`, [foreign, req]);
    // a version of ANOTHER document → refused
    const otherDoc = newUuid(), otherVer = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T2')`, [otherDoc, h.companyA]);
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [otherVer, h.companyA, otherDoc]);
    await expect(h.db.query(`update pierre_rt_signature_requests set signed_document_version_id=$1 where id=$2`, [otherVer, req])).rejects.toThrow(/same tenant . document|document version/);
  });

  it("a (provider, provider_request_id) is unique — no two local requests share one provider request", async () => {
    const a = await seedRequest(h.companyA);
    const sameProvId = (await h.db.query<{ provider_request_id: string }>(`select provider_request_id from pierre_rt_signature_requests where id=$1`, [a.req])).rows[0].provider_request_id;
    const doc = newUuid(), ver = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'employment_contract','T3')`, [doc, h.companyA]);
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number) values ($1,$2,$3,1)`, [ver, h.companyA, doc]);
    await expect(h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, provider, provider_request_id, status, idempotency_key) values ($1,$2,$3,$4,'fake_provider',$5,'submitted',$6)`, [newUuid(), h.companyA, doc, ver, sameProvId, newUuid()]))
      .rejects.toThrow(/duplicate key|unique/i);
  });

  it("a signature event is deduplicated by (company, request, provider_event_id)", async () => {
    const { req } = await seedRequest(h.companyA);
    await h.db.query(`insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type, provider_event_id) values ($1,$2,$3,'request.activated','e1')`, [newUuid(), h.companyA, req]);
    await expect(h.db.query(`insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type, provider_event_id) values ($1,$2,$3,'request.activated','e1')`, [newUuid(), h.companyA, req]))
      .rejects.toThrow(/duplicate key|unique/i);
  });

  it("a signature request cannot reference a cross-tenant document version (B2 guard still in force)", async () => {
    await expect(h.db.query(`insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, status, idempotency_key) values ($1,$2,$3,$4,'submitted',$5)`, [newUuid(), h.companyA, newUuid(), newUuid(), newUuid()]))
      .rejects.toThrow(/cross-tenant|missing|mismatch|foreign key|violates/i);
  });
});
