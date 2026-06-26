// src/lib/pierre/v1/__integration__/p83-template-outbox-idempotency.itest.ts
// PHASE 8.3-B2E §8 — the outbox dedup key is DETERMINISTIC (no random suffix): the
// same logical event produces exactly one outbox row; a different event is accepted.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { emitTemplateEvent } from "../template-state";
import { createTemplate, createTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

describe("§8 deterministic outbox idempotency", () => {
  it("emitting the same event twice yields exactly one outbox row; a different event is added", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: [{ field_key: "employee.first_name", source_path: "employee.first_name" }] });
    const data = { template_id: t.id, version_id: v.id, status_before: "draft", status_after: "review_required", fingerprint: "fp1" };
    // simulate a retry: same logical event emitted twice
    await emitTemplateEvent(h.db, owner, "template.review_requested", data);
    await emitTemplateEvent(h.db, owner, "template.review_requested", data);
    const one = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='template.review_requested'`, [h.companyA]);
    expect(one.rows[0].n).toBe(1); // idempotent — no duplicate
    // a different transition (different status_after) is a distinct event
    await emitTemplateEvent(h.db, owner, "template.review_requested", { ...data, status_after: "approved", fingerprint: "fp2" });
    const two = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='template.review_requested'`, [h.companyA]);
    expect(two.rows[0].n).toBe(2);
  });
});
