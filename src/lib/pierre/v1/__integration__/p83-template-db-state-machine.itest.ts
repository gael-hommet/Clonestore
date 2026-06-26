// src/lib/pierre/v1/__integration__/p83-template-db-state-machine.itest.ts
// PHASE 8.3-B2E §3 — the template state machine is enforced AT THE DB LEVEL (trigger),
// for direct SQL by the superuser AND by the application role pierre_rt_app.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { createTemplate, createTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

async function draftId() {
  const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
  return (await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema })).id;
}
const asApp = (sql: string, p: unknown[]) => withTenantTransaction(h.db, owner, (tx) => tx.query(sql, p));

describe("§3 DB-level template state machine", () => {
  it("the trigger blocks illegal transitions via direct superuser SQL", async () => {
    const id = await draftId();
    await expect(h.db.query(`update pierre_rt_document_template_versions set status='approved' where id=$1`, [id])).rejects.toThrow(/illegal template status transition/);
    await expect(h.db.query(`update pierre_rt_document_template_versions set status='published' where id=$1`, [id])).rejects.toThrow(/illegal template status transition/);
    // legal: draft → review_required
    await h.db.query(`update pierre_rt_document_template_versions set status='review_required' where id=$1`, [id]);
  });

  it("the trigger blocks illegal transitions via the application role pierre_rt_app", async () => {
    const id = await draftId();
    await expect(asApp(`update pierre_rt_document_template_versions set status='published' where company_id=$1 and id=$2`, [h.companyA, id])).rejects.toThrow(/illegal template status transition/);
    // legal transition via the app role succeeds
    await asApp(`update pierre_rt_document_template_versions set status='review_required' where company_id=$1 and id=$2`, [h.companyA, id]);
    const r = await h.db.query<{ status: string }>(`select status from pierre_rt_document_template_versions where id=$1`, [id]);
    expect(r.rows[0].status).toBe("review_required");
  });
});
