// src/lib/pierre/v1/__integration__/p83-template-audit-trace.itest.ts
// PHASE 8.3-B2D §11 — template-specific audit + outbox events.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion, submitTemplateForReview, approveTemplateVersion, publishTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("§11 template audit / CloneTrace / outbox", () => {
  it("records create → version → review → approve → publish with before/after + fingerprint", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await submitTemplateForReview(h.db, owner, v.id);
    await approveTemplateVersion(h.db, owner, v.id);
    await publishTemplateVersion(h.db, owner, v.id);

    const events = (await h.db.query<{ event: string; status_before: string | null; status_after: string | null; fingerprint: string | null }>(`select event, status_before, status_after, fingerprint from pierre_rt_template_audit where company_id=$1 order by occurred_at asc`, [h.companyA])).rows;
    const kinds = events.map((e) => e.event);
    for (const k of ["template.created", "template.version_created", "template.review_requested", "template.approved", "template.published"]) {
      expect(kinds, k).toContain(k);
    }
    const approved = events.find((e) => e.event === "template.approved")!;
    expect(approved.status_after).toBe("approved");
    expect(approved.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    // outbox carries the same template.* events for P8.4 channels
    const outbox = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind like 'template.%'`, [h.companyA])).rows[0].n;
    expect(outbox).toBeGreaterThanOrEqual(4);
  });

  it("records an explicit approval invalidation with old→new fingerprint + reason", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: schema });
    await submitTemplateForReview(h.db, owner, v.id);
    await approveTemplateVersion(h.db, owner, v.id);
    await h.db.query(`update pierre_rt_document_template_versions set body='changed' where id=$1`, [v.id]);
    await expect(publishTemplateVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "conflict" });
    const inv = (await h.db.query<{ reason: string | null; old_fingerprint: string | null; new_fingerprint: string | null }>(`select reason, old_fingerprint, new_fingerprint from pierre_rt_template_audit where template_version_id=$1 and event='template.approval_invalidated'`, [v.id])).rows[0];
    expect(inv.reason).toBe("content_drift_since_approval");
    expect(inv.old_fingerprint).toMatch(/^[a-f0-9]{64}$/); // separate columns, not "old→new"
    expect(inv.new_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(inv.old_fingerprint).not.toBe(inv.new_fingerprint);
  });
});
