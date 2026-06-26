// src/lib/pierre/v1/__integration__/p83-template-atomic-events.itest.ts
// PHASE 8.3-B2E §7 — state change + approval + audit + CloneTrace + outbox are written in
// ONE transaction: if any write fails, EVERYTHING rolls back — no partial audit, no orphan
// outbox row, no half-applied state. Proven by injecting a failure inside the unit of work.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { emitTemplateEvent } from "../template-state";
import { createTemplate, createTemplateVersion } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

async function counts(): Promise<{ audit: number; trace: number; outbox: number }> {
  const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_template_audit where company_id=$1 and event='template.approved'`, [h.companyA])).rows[0].n;
  const trace = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1 and action='template.approved'`, [h.companyA])).rows[0].n;
  const outbox = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='template.approved'`, [h.companyA])).rows[0].n;
  return { audit, trace, outbox };
}

describe("§7 atomic template events", () => {
  it("a failure inside the unit of work rolls back the state change AND all three side writes", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: [{ field_key: "employee.first_name", source_path: "employee.first_name" }] });
    const before = await counts();
    // emit the event then force the SAME transaction to fail → the whole tx must roll back.
    await expect(h.db.transaction(async (tx) => {
      await tx.query(`update pierre_rt_document_template_versions set status='review_required' where company_id=$1 and id=$2`, [h.companyA, v.id]);
      await emitTemplateEvent(tx, owner, "template.approved", { template_id: t.id, version_id: v.id, status_before: "draft", status_after: "approved", fingerprint: "fp", new_fingerprint: "fp" });
      throw new Error("boom — injected failure after the side writes");
    })).rejects.toThrow(/boom/);
    // nothing persisted: state unchanged, no audit / trace / outbox rows added.
    const status = (await h.db.query<{ status: string }>(`select status from pierre_rt_document_template_versions where id=$1`, [v.id])).rows[0].status;
    expect(status).toBe("draft");
    expect(await counts()).toEqual(before);
  });

  it("a successful unit of work commits the state change AND exactly one of each side write", async () => {
    const t = await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" });
    const v = await createTemplateVersion(h.db, owner, t.id, { body: "{{employee.first_name}}", field_schema: [{ field_key: "employee.first_name", source_path: "employee.first_name" }] });
    await h.db.transaction(async (tx) => {
      await tx.query(`update pierre_rt_document_template_versions set status='review_required' where company_id=$1 and id=$2`, [h.companyA, v.id]);
      await emitTemplateEvent(tx, owner, "template.approved", { template_id: t.id, version_id: v.id, status_before: "draft", status_after: "approved", fingerprint: "fp", new_fingerprint: "fp" });
    });
    expect(await counts()).toEqual({ audit: 1, trace: 1, outbox: 1 });
  });
});
