// src/lib/pierre/v1/__integration__/p83-template-audit-security.itest.ts
// PHASE 8.3-B2E §5 — the template audit is append-only + infalsifiable: no UPDATE,
// no DELETE, no direct INSERT by the application role; insert only via the SECURITY
// DEFINER function; tenant-safe + GUC-bound.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { createTemplate } from "../templates";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { if (h) await h.close(); });

describe("§5 append-only infalsifiable template audit", () => {
  it("UPDATE and DELETE are blocked (append-only), even for superuser", async () => {
    await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" }); // writes an audit row
    const row = await h.db.query<{ id: string }>(`select id from pierre_rt_template_audit limit 1`);
    expect(row.rows.length).toBe(1);
    await expect(h.db.query(`update pierre_rt_template_audit set reason='x' where id=$1`, [row.rows[0].id])).rejects.toThrow(/append-only/);
    await expect(h.db.query(`delete from pierre_rt_template_audit where id=$1`, [row.rows[0].id])).rejects.toThrow(/append-only/);
  });

  it("the application role cannot INSERT directly but CAN through the SECURITY DEFINER function", async () => {
    const t = (await h.db.query<{ id: string }>(`select id from pierre_rt_document_templates limit 1`)).rows[0]
      ?? { id: (await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" })).id };
    // direct insert as pierre_rt_app → permission denied (grant revoked)
    await expect(withTenantTransaction(h.db, owner, (tx) => tx.query(
      `insert into pierre_rt_template_audit (id, company_id, event) values ($1,$2,'forged')`, [newUuid(), h.companyA]))).rejects.toBeTruthy();
    // via the function (as pierre_rt_app, GUC bound to company A) → allowed
    await withTenantTransaction(h.db, owner, (tx) => tx.query(
      `select pierre_rt_log_template_event($1,$2,null,$3,'template.created',null,'draft',null,null,null,null,null)`, [h.companyA, t.id, h.userA]));
    const n = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_template_audit where company_id=$1 and event='template.created'`, [h.companyA]);
    expect(n.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("the SECURITY DEFINER function refuses a company that mismatches the tenant binding", async () => {
    const t = (await createTemplate(h.db, owner, { key: `k-${newUuid()}`, name: "N", document_type: "work_certificate" })).id;
    // bound to company A, but trying to log for company B → mismatch
    await expect(withTenantTransaction(h.db, owner, (tx) => tx.query(
      `select pierre_rt_log_template_event($1,$2,null,$3,'template.created',null,'draft',null,null,null,null,null)`, [h.companyB, t, h.userA]))).rejects.toThrow(/company mismatch/);
  });
});
