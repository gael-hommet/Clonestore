// src/lib/pierre/v1/__integration__/p83-b2g-b2-closure.itest.ts
// PHASE 8.3-B2 — DOCUMENT & CONTRACT CORE closure smoke. Spans the pillars end-to-end: a
// real contract is generated from a published template, governed through to signature
// preparation, with clean artifacts, an immutable final version, a governed signature
// request and a full audit trail — while the B2E/B2F DB protections remain in force.

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

describe("§ B2 document & contract core closure", () => {
  it("a contract goes from creation to signature-ready with clean artifacts, immutable final + full trail", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDD", effective_from: "2026-01-01", effective_to: "2026-12-31" });
    const gen = await C.generateContract(h.db, owner, c.id, { renderers: ["pdf", "docx"], field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    await C.finalizeContract(h.db, owner, c.id);
    const prep = await C.prepareContractSignature(h.db, owner, c.id);

    // clean artifacts attached to a real document version
    const files = await h.db.query<{ upload_status: string; scan_status: string }>(
      `select f.upload_status, f.scan_status from pierre_rt_document_versions dv join pierre_rt_files f on (f.id=dv.rendered_pdf_file_id or f.id=dv.rendered_docx_file_id) and f.company_id=dv.company_id where dv.company_id=$1 and dv.id=$2`, [h.companyA, gen.document_version_id]);
    expect(files.rows.length).toBe(2);
    for (const f of files.rows) expect([f.upload_status, f.scan_status]).toEqual(["clean", "clean"]);

    // immutable final version
    const v = (await h.db.query<{ id: string; workflow_status: string }>(`select id, workflow_status from pierre_rt_employee_contract_versions where contract_id=$1 order by version desc limit 1`, [c.id])).rows[0];
    expect(v.workflow_status).toBe("final");
    await expect(h.db.query(`update pierre_rt_employee_contract_versions set canonical_hash='x' where id=$1`, [v.id])).rejects.toThrow(/immutable/);

    // governed signature request (NOT a live provider) + audit trail
    const sr = (await h.db.query<{ status: string; provider: string }>(`select status, provider from pierre_rt_signature_requests where id=$1`, [prep.signature_request_id])).rows[0];
    expect(sr).toMatchObject({ status: "ready", provider: "local_sandbox" });
    const trail = (await h.db.query<{ n: number }>(`select count(distinct event)::int n from pierre_rt_contract_audit where contract_id=$1`, [c.id])).rows[0].n;
    expect(trail).toBeGreaterThanOrEqual(5);
  });

  it("the B2E/B2F DB protections are still in force (template immutability, contract guards, FK matrix, webhook fn)", async () => {
    const checks = await h.db.query<{ obj: string; present: number }>(`
      select 'tpl_guard' obj, count(*)::int present from pg_trigger where tgname='trg_template_version_guard'
      union all select 'contract_guard', count(*)::int from pg_trigger where tgname='trg_contract_workflow_guard'
      union all select 'fk_composite', count(*)::int from pg_constraint where conname='fk_contract_employee_ct'
      union all select 'webhook_fn', count(*)::int from pg_proc where proname='pierre_rt_ingest_signature_webhook'
      union all select 'contract_audit_fn', count(*)::int from pg_proc where proname='pierre_rt_log_contract_event'`);
    for (const row of checks.rows) expect(row.present).toBeGreaterThanOrEqual(1);
  });
});
