// src/lib/pierre/v1/__integration__/p83-template-approval-fingerprint.itest.ts
// PHASE 8.3-B2C §5/§6/§7 — approval fingerprint binding, version allocation,
// validator permission separation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
async function approvedVersion() {
  const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
  const v = await createTemplateVersion(h.db, owner, t.id, { body: "Bonjour {{employee.first_name}}", field_schema: schema });
  await submitTemplateForReview(h.db, owner, v.id);
  await approveTemplateVersion(h.db, owner, v.id);
  return { t, v };
}

describe("§5 approval fingerprint binding", () => {
  it("publishes when the fingerprint is unchanged", async () => {
    const { t, v } = await approvedVersion();
    await publishTemplateVersion(h.db, owner, v.id);
    const row = await h.db.query<{ status: string }>(`select status from pierre_rt_document_template_versions where id=$1`, [v.id]);
    expect(row.rows[0].status).toBe("published");
    void t;
  });

  it("blocks publication after the BODY changed (approval invalidated)", async () => {
    const { v } = await approvedVersion();
    await h.db.query(`update pierre_rt_document_template_versions set body='TAMPERED' where id=$1`, [v.id]);
    await expect(publishTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "conflict" });
    const row = await h.db.query<{ status: string; approved_fingerprint: string | null }>(`select status, approved_fingerprint from pierre_rt_document_template_versions where id=$1`, [v.id]);
    expect(row.rows[0].status).toBe("changes_requested"); // explicit invalidation, not silent
    expect(row.rows[0].approved_fingerprint).toBeNull();
    // §3 — the invalidation is audited (old→new fingerprint + reason)
    const audit = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_template_audit where template_version_id=$1 and event='template.approval_invalidated'`, [v.id]);
    expect(audit.rows[0].n).toBe(1);
  });

  it("blocks publication after the FIELD SCHEMA or RENDERER changed", async () => {
    const a = await approvedVersion();
    await h.db.query(`update pierre_rt_document_template_versions set field_schema='[]'::jsonb where id=$1`, [a.v.id]);
    await expect(publishTemplateVersion(h.db, owner, a.v.id)).rejects.toMatchObject({ code: "conflict" });
    const b = await approvedVersion();
    await h.db.query(`update pierre_rt_document_template_versions set renderer='docx' where id=$1`, [b.v.id]);
    await expect(publishTemplateVersion(h.db, owner, b.v.id)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("§7 validator permission separation", () => {
  it("a VALIDATOR with template.approve but NOT template.read can approve", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await submitTemplateForReview(h.db, owner, v.id);
    const validator: TenantContext = { ...owner, role: "viewer", role_keys: ["VALIDATOR"], permissions: ["template.approve"] };
    await approveTemplateVersion(h.db, validator, v.id);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_document_template_versions where id=$1`, [v.id])).rows[0].status).toBe("approved");
  });

  it("a read-only member (template.read only) cannot approve", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await submitTemplateForReview(h.db, owner, v.id);
    const reader: TenantContext = { ...owner, permissions: ["template.read"] };
    await expect(approveTemplateVersion(h.db, reader, v.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("§6 version allocation", () => {
  it("allocates distinct sequential version numbers under a locked template row", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v1 = await createTemplateVersion(h.db, owner, t.id, { body: "a {{employee.first_name}}", field_schema: schema });
    const v2 = await createTemplateVersion(h.db, owner, t.id, { body: "b {{employee.first_name}}", field_schema: schema });
    expect([v1.version_number, v2.version_number].sort()).toEqual([1, 2]);
    const n = await h.db.query<{ n: number }>(`select count(distinct version_number)::int n from pierre_rt_document_template_versions where template_id=$1`, [t.id]);
    expect(n.rows[0].n).toBe(2);
  });
});
