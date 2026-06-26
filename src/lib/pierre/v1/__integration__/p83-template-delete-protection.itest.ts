// src/lib/pierre/v1/__integration__/p83-template-delete-protection.itest.ts
// PHASE 8.3-B2E §2 — published / referenced template versions cannot be hard-deleted.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

describe("§2 template version delete protection", () => {
  it("no version is freely hard-deletable: audit history blocks it; published adds an explicit guard", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const draft = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    // even a draft has append-only audit history (version_created) → the audit FK blocks deletion
    await expect(h.db.query(`delete from pierre_rt_document_template_versions where id=$1`, [draft.id])).rejects.toThrow(/foreign key|referenced|append-only/i);
    await submitTemplateForReview(h.db, owner, draft.id); await approveTemplateVersion(h.db, owner, draft.id); await publishTemplateVersion(h.db, owner, draft.id);
    await expect(h.db.query(`delete from pierre_rt_document_template_versions where id=$1`, [draft.id])).rejects.toThrow(/cannot be deleted|published|foreign key/i);
  });

  it("a version referenced by a document cannot be deleted", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    // reference it from a document version (draft template version, but referenced)
    const docId = (await h.db.query<{ id: string }>(`insert into pierre_rt_documents (id, company_id, document_type, title) values ($1,$2,'work_certificate','T') returning id`, [newUuid(), h.companyA])).rows[0].id;
    await h.db.query(`insert into pierre_rt_document_versions (id, company_id, document_id, version_number, template_version_id) values ($1,$2,$3,1,$4)`, [newUuid(), h.companyA, docId, v.id]);
    await expect(h.db.query(`delete from pierre_rt_document_template_versions where id=$1`, [v.id])).rejects.toThrow(/referenced by a document/);
  });
});
