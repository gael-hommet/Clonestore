// PHASE 8.3-B2G-R1.4 — the contract workflow is unified with the REAL document workflow. A
// contract becomes `final` only once its document version actually passes the governed document
// workflow; signature preparation refuses a document version that is not finalized.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
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

async function approved(): Promise<{ id: string; dv: string }> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const res = await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  return { id: c.id, dv: res.document_version_id };
}
const dvStatus = async (dv: string) => (await h.db.query<{ status: string }>(`select status from pierre_rt_document_versions where id=$1`, [dv])).rows[0].status;

describe("R1.4 document + contract lifecycle unified", () => {
  it("the document version is draft after generation and becomes final via the governed document workflow", async () => {
    const { id, dv } = await approved();
    expect(await dvStatus(dv)).toBe("draft"); // not yet through the document workflow
    await C.finalizeContract(h.db, owner, id);
    expect(await dvStatus(dv)).toBe("final"); // driven through submit→approve→finalize
    const ws = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [id])).rows[0].workflow_status;
    expect(ws).toBe("final");
  });

  it("if the document version cannot be finalized, the contract is NOT finalized", async () => {
    const { id, dv } = await approved();
    // break the document version so the document finalize fails (no content hash / artifact)
    await h.db.query(`update pierre_rt_document_versions set content_hash=null, rendered_pdf_file_id=null, rendered_docx_file_id=null where id=$1`, [dv]);
    await expect(C.finalizeContract(h.db, owner, id)).rejects.toBeTruthy();
    const ws = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [id])).rows[0].workflow_status;
    expect(ws).toBe("approved"); // never reached final
    expect(await dvStatus(dv)).not.toBe("final");
  });

  it("signature preparation refuses a document version that is not finalized", async () => {
    const { id, dv } = await approved();
    await C.finalizeContract(h.db, owner, id);
    // regress the document version (simulating an out-of-band tamper) → prep must refuse
    await h.db.query(`update pierre_rt_document_versions set status='draft' where id=$1`, [dv]);
    await expect(C.prepareContractSignature(h.db, owner, id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("a fully governed contract reaches final with its document version final", async () => {
    const { id, dv } = await approved();
    await C.finalizeContract(h.db, owner, id);
    await C.prepareContractSignature(h.db, owner, id);
    expect(await dvStatus(dv)).toBe("final");
  });
});
