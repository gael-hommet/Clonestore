// src/lib/pierre/v1/__integration__/p83-template-ever-published-immutability.itest.ts
// PHASE 8.3-B2E §1 — once published, a version's content is frozen FOREVER (even
// after deprecation/archival); only published→deprecated→archived status changes.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion, deprecateTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

async function publishedId() {
  const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
  const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
  await submitTemplateForReview(h.db, owner, v.id);
  await approveTemplateVersion(h.db, owner, v.id);
  await publishTemplateVersion(h.db, owner, v.id);
  return v.id;
}
const upd = (id: string, sql: string) => h.db.query(`update pierre_rt_document_template_versions set ${sql} where id=$1`, [id]);

describe("§1 ever-published immutability", () => {
  it("freezes content while published", async () => {
    const id = await publishedId();
    for (const col of ["body='x'", "field_schema='[]'::jsonb", "renderer='docx'", "content_hash='x'", "schema_hash='x'", "locale='en-US'", "approved_by=gen_random_uuid()", "published_at=now()", "created_at=now()"]) {
      await expect(upd(id, col)).rejects.toThrow(/immutable/);
    }
  });

  it("stays frozen AFTER deprecation and archival (ever-published)", async () => {
    const id = await publishedId();
    await deprecateTemplateVersion(h.db, owner, id); // published → deprecated
    await expect(upd(id, "body='after-deprecate'")).rejects.toThrow(/immutable/);
    await h.db.query(`update pierre_rt_document_template_versions set status='archived' where id=$1`, [id]); // deprecated → archived
    await expect(upd(id, "body='after-archive'")).rejects.toThrow(/immutable/);
    await expect(upd(id, "approved_fingerprint='x'")).rejects.toThrow(/immutable/);
  });

  it("forbids changing company_id of a published version", async () => {
    const id = await publishedId();
    await expect(upd(id, `company_id='${h.companyB}'`)).rejects.toThrow(/immutable|transition/);
  });
});
