// src/lib/pierre/v1/__integration__/p83-b2g-contract-generation.itest.ts
// PHASE 8.3-B2G §4 — real contract generation: strict context → readiness → document +
// version → clean PDF/DOCX artifacts → hashes → linked contract version → events. Then the
// full governed lifecycle through finalization and signature preparation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let employeeId: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  employeeId = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

describe("§4 contract generation + lifecycle", () => {
  it("generates real PDF+DOCX artifacts with distinct hashes and links them to the contract version", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const res = await C.generateContract(h.db, owner, c.id, { renderers: ["pdf", "docx"], field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    expect(res.document_version_id).toBeTruthy();
    expect(res.canonical_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.pdf_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.docx_hash).toMatch(/^[a-f0-9]{64}$/);
    // the three hashes are genuinely distinct (canonical business vs PDF bytes vs DOCX bytes)
    expect(new Set([res.canonical_hash, res.pdf_hash, res.docx_hash]).size).toBe(3);
    // the rendered files are clean and attached to a real document version
    const files = await h.db.query<{ upload_status: string; scan_status: string }>(
      `select f.upload_status, f.scan_status from pierre_rt_document_versions dv
         join pierre_rt_files f on (f.id=dv.rendered_pdf_file_id or f.id=dv.rendered_docx_file_id) and f.company_id=dv.company_id
       where dv.company_id=$1 and dv.id=$2`, [h.companyA, res.document_version_id]);
    expect(files.rows.length).toBe(2);
    for (const f of files.rows) { expect(f.upload_status).toBe("clean"); expect(f.scan_status).toBe("clean"); }
  });

  it("runs the full governed lifecycle: generate → review → approve → finalize → prepare signature", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    const finalized = await C.finalizeContract(h.db, owner, c.id);
    expect(finalized.workflow_status).toBe("final");
    const prep = await C.prepareContractSignature(h.db, owner, c.id);
    expect(prep.signature_request_id).toBeTruthy();
    const cc = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [c.id])).rows[0];
    expect(cc.workflow_status).toBe("ready_for_signature");
    // a real signature request row exists, governed (status ready, approval approved)
    const sr = (await h.db.query<{ status: string; approval_status: string }>(`select status, approval_status from pierre_rt_signature_requests where id=$1`, [prep.signature_request_id])).rows[0];
    expect(sr).toMatchObject({ status: "ready", approval_status: "approved" });
  });

  it("a CDD without an end date is refused at generation (fail-closed readiness)", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDD", effective_from: "2026-01-01" });
    await expect(C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps())).rejects.toMatchObject({ code: "validation_failed" });
    // a generation_blocked event was recorded
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.generation_blocked'`, [c.id]);
    expect(n.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
