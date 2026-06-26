// src/lib/pierre/v1/__integration__/p83-template-published-immutability.itest.ts
// PHASE 8.3-B2D §2 — DB-level immutability of published template versions. The
// trigger blocks any content mutation AND any status change other than → deprecated,
// even via the application role pierre_rt_app.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function published() {
  const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
  const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
  await submitTemplateForReview(h.db, owner, v.id);
  await approveTemplateVersion(h.db, owner, v.id);
  await publishTemplateVersion(h.db, owner, v.id);
  return v.id;
}

describe("§2 published version DB immutability", () => {
  it("the trigger blocks body / field_schema / renderer / content_hash mutations (superuser)", async () => {
    const id = await published();
    await expect(h.db.query(`update pierre_rt_document_template_versions set body='TAMPERED' where id=$1`, [id])).rejects.toThrow(/immutable/);
    await expect(h.db.query(`update pierre_rt_document_template_versions set field_schema='[]'::jsonb where id=$1`, [id])).rejects.toThrow(/immutable/);
    await expect(h.db.query(`update pierre_rt_document_template_versions set renderer='docx' where id=$1`, [id])).rejects.toThrow(/immutable/);
    await expect(h.db.query(`update pierre_rt_document_template_versions set content_hash='x' where id=$1`, [id])).rejects.toThrow(/immutable/);
  });

  it("the trigger forbids any status change other than → deprecated", async () => {
    const id = await published();
    await expect(h.db.query(`update pierre_rt_document_template_versions set status='draft' where id=$1`, [id])).rejects.toThrow(/transition|deprecated|immutable/);
    await expect(h.db.query(`update pierre_rt_document_template_versions set status='approved' where id=$1`, [id])).rejects.toThrow(/transition|deprecated|immutable/);
    // the one allowed transition succeeds
    await h.db.query(`update pierre_rt_document_template_versions set status='deprecated' where id=$1`, [id]);
    const r = await h.db.query<{ status: string }>(`select status from pierre_rt_document_template_versions where id=$1`, [id]);
    expect(r.rows[0].status).toBe("deprecated");
  });

  it("the application role pierre_rt_app cannot bypass the trigger", async () => {
    const id = await published();
    await expect(withTenantTransaction(h.db, owner, (tx) => tx.query(`update pierre_rt_document_template_versions set body='APP-TAMPER' where company_id=$1 and id=$2`, [h.companyA, id]))).rejects.toThrow(/immutable/);
  });
});
