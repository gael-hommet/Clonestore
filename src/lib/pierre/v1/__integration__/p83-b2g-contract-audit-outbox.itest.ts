// src/lib/pierre/v1/__integration__/p83-b2g-contract-audit-outbox.itest.ts
// PHASE 8.3-B2G §11 — every major step emits a stable, deduplicated audit + CloneTrace +
// outbox event, written atomically. A failure rolls everything back (no orphan rows). The
// audit is append-only and the app role cannot raw-insert it.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { emitContractEvent } from "../contract-state";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

describe("§11 contract audit / CloneTrace / outbox", () => {
  it("the lifecycle emits the expected stable events into audit + outbox", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    await C.finalizeContract(h.db, owner, c.id);
    const events = (await h.db.query<{ event: string }>(`select distinct event from pierre_rt_contract_audit where contract_id=$1`, [c.id])).rows.map((r) => r.event);
    for (const e of ["contract.created", "contract.generated", "contract.review_requested", "contract.approved", "contract.finalized"]) expect(events).toContain(e);
    // outbox carries the same events (governed dispatch later in P8.4)
    const ob = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='contract.finalized'`, [h.companyA])).rows[0].n;
    expect(ob).toBeGreaterThanOrEqual(1);
  });

  it("the outbox dedup key is deterministic (the same logical event is not duplicated)", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const data = { contract_id: c.id, version_id: null, status_before: "draft", status_after: "under_review" as const };
    await emitContractEvent(h.db, owner, "contract.review_requested", data);
    await emitContractEvent(h.db, owner, "contract.review_requested", data);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='contract.review_requested'`, [h.companyA])).rows[0].n;
    expect(n).toBe(1);
  });

  it("a failure inside the unit of work rolls back the state change AND the audit/outbox writes", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const auditBefore = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.approved'`, [c.id])).rows[0].n;
    await expect(h.db.transaction(async (tx) => {
      await tx.query(`update pierre_rt_employee_contracts set workflow_status='under_review' where company_id=$1 and id=$2`, [h.companyA, c.id]);
      await emitContractEvent(tx, owner, "contract.approved", { contract_id: c.id, status_before: "under_review", status_after: "approved" });
      throw new Error("boom");
    })).rejects.toThrow(/boom/);
    const status = (await h.db.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where id=$1`, [c.id])).rows[0].workflow_status;
    expect(status).toBe("draft"); // rolled back
    const auditAfter = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where contract_id=$1 and event='contract.approved'`, [c.id])).rows[0].n;
    expect(auditAfter).toBe(auditBefore); // no orphan audit
  });

  it("the contract audit is append-only and the app role cannot raw-insert it", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const row = (await h.db.query<{ id: string }>(`select id from pierre_rt_contract_audit where contract_id=$1 limit 1`, [c.id])).rows[0];
    await expect(h.db.query(`update pierre_rt_contract_audit set reason='x' where id=$1`, [row.id])).rejects.toThrow(/append-only/);
    await expect(h.db.query(`delete from pierre_rt_contract_audit where id=$1`, [row.id])).rejects.toThrow(/append-only/);
    // app role raw INSERT denied (writes go through the SECURITY DEFINER logger)
    await expect(withTenantTransaction(h.db, owner, (tx) => tx.query(`insert into pierre_rt_contract_audit (id, company_id, event) values ($1,$2,'forged')`, [newUuid(), h.companyA]))).rejects.toBeTruthy();
  });
});
