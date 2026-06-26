// src/lib/pierre/v1/__integration__/p83-template-real-concurrency.itest.ts
// PHASE 8.3-B2D §4 — version allocation is collision-free under concurrent calls.
// Each createTemplateVersion runs BEGIN → SELECT template FOR UPDATE → INSERT → COMMIT.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { createTemplate, createTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
const schema = [{ field_key: "employee.first_name", source_path: "employee.first_name", required: true }];
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("§4 concurrent version allocation", () => {
  it("10 concurrent createTemplateVersion calls produce versions 1..10 with no collision/loss", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createTemplateVersion(h.db, owner, t.id, { body: `v${i} {{employee.first_name}}`, field_schema: schema })),
    );
    const nums = results.map((r) => r.version_number).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // unique, ordered, none lost
    const distinct = await h.db.query<{ n: number }>(`select count(distinct version_number)::int n from pierre_rt_document_template_versions where template_id=$1`, [t.id]);
    expect(distinct.rows[0].n).toBe(10);
    // the unique (template_id, version_number) constraint guarantees no duplicate slipped through
    const total = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_template_versions where template_id=$1`, [t.id]);
    expect(total.rows[0].n).toBe(10);
  });
});
