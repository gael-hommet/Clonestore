// src/lib/pierre/v1/__integration__/p83-b2f-historical-preflight.itest.ts
// PHASE 8.3-B2F §2 — the historical-data preflight is READ-ONLY and fail-closed. A clean
// database verifies `clean`; pre-existing incoherent rows (injected by disabling triggers/
// FKs, the way real legacy data would predate the constraints) produce `blocked`; warnings
// are surfaced without blocking; and the preflight mutates nothing.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { runDataIntegrityPreflight } from "../data-integrity-preflight";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { if (h) await h.close(); });

const NOW = "2026-06-23T12:00:00.000Z";
// Insert "legacy" rows the new constraints would reject, as if they predated B2F.
async function injectBypassingConstraints(fn: () => Promise<void>): Promise<void> {
  await h.db.query(`set session_replication_role = replica`); // disables triggers + FK checks
  try { await fn(); } finally { await h.db.query(`set session_replication_role = origin`); }
}

describe("§2 historical-data preflight", () => {
  it("a clean database verifies as clean (exit-equivalent OK)", async () => {
    const r = await runDataIntegrityPreflight(h.db, NOW);
    expect(r.status).toBe("clean");
    expect(r.counts.blockers).toBe(0);
    expect(r.checked_at).toBe(NOW);
  });

  it("a cross-tenant custom field (legacy) is detected as a blocker", async () => {
    const eB = newUuid();
    await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'B','B')`, [eB, h.companyB]);
    await injectBypassingConstraints(async () => {
      await h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'k','v')`, [h.companyA, eB]);
    });
    const r = await runDataIntegrityPreflight(h.db, NOW);
    expect(r.status).toBe("blocked");
    expect(r.blockers.map((b) => b.key)).toContain("cross_tenant_custom_field");
    expect(r.blockers.find((b) => b.key === "cross_tenant_custom_field")!.count).toBe(1);
  });

  it("a finalized artifact whose file is not clean is a blocker", async () => {
    const doc = newUuid(), ver = newUuid(), file = newUuid();
    await h.db.query(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T')`, [doc, h.companyA]);
    await h.db.query(`insert into pierre_rt_files (id, company_id, storage_provider, bucket, object_key, upload_status, scan_status, sha256) values ($1,$2,'local','b',$3,'quarantined','infected','abc')`, [file, h.companyA, `companies/${h.companyA}/x/${newUuid()}.pdf`]);
    await injectBypassingConstraints(async () => {
      await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number, rendered_pdf_file_id, status, finalized_at) values ($1,$2,$3,1,$4,'final',now())`, [ver, h.companyA, doc, file]);
    });
    const r = await runDataIntegrityPreflight(h.db, NOW);
    expect(r.status).toBe("blocked");
    expect(r.blockers.map((b) => b.key)).toContain("finalized_artifact_not_clean");
  });

  it("a custom field without a canonical definition is a non-blocking warning", async () => {
    const eA = newUuid();
    await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'A','A')`, [eA, h.companyA]);
    await h.db.query(`insert into pierre_rt_employee_custom_fields (company_id, employee_id, field_key, field_value) values ($1,$2,'legacy_key','x')`, [h.companyA, eA]);
    const r = await runDataIntegrityPreflight(h.db, NOW);
    expect(r.status).toBe("clean"); // warning only
    expect(r.warnings.map((w) => w.key)).toContain("custom_field_without_definition");
  });

  it("the preflight mutates nothing", async () => {
    const eA = newUuid();
    await h.db.query(`insert into pierre_rt_employees (id, company_id, first_name, last_name) values ($1,$2,'A','A')`, [eA, h.companyA]);
    const before = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA])).rows[0].n;
    const logsBefore = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1`, [h.companyA])).rows[0].n;
    await runDataIntegrityPreflight(h.db, NOW);
    const after = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1`, [h.companyA])).rows[0].n;
    const logsAfter = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1`, [h.companyA])).rows[0].n;
    expect(after).toBe(before);
    expect(logsAfter).toBe(logsBefore);
  });
});
