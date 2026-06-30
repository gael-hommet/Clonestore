// PHASE 8.5-R1 §R1.4 — the scheduler role performs NO raw DML of truth. It can not raw-update a runtime
// event or a schedule, nor raw-insert an outbox row. It mutates state ONLY through governed functions
// (apply_runtime_event / complete_schedule), which are compatible with its grants.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { asRole, refused } from "./p84-r1-helpers";
import { gov } from "./p85-helpers";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const sched = (sql: string, p: readonly unknown[] = []) => refused(() => asRole(h, "pierre_rt_runtime_scheduler", h.companyA, (q) => q(sql, p)));

describe("P8.5-R1 scheduler governed writes", () => {
  it("the scheduler role is REFUSED on raw UPDATE/INSERT of runtime truth", async () => {
    expect(await sched(`update pierre_rt_runtime_events set application_status='applied' where company_id=$1`, [h.companyA])).toBe(true);
    expect(await sched(`update pierre_rt_runtime_schedules set status='completed' where company_id=$1`, [h.companyA])).toBe(true);
    expect(await sched(`insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,'x','{}',$3)`, [newUuid(), h.companyA, newUuid()])).toBe(true);
  });

  it("the scheduler applies a runtime event ONLY via the governed function", async () => {
    // ingest an event (definer) so there is a pending row
    await gov(h, owner, `select pierre_rt_ingest_runtime_event($1,$2,$3,$4,$5,$6,$7,$8)`, [h.companyA, "test", "k1", "document.approved", "document", newUuid(), "hh", null]);
    const ev = (await h.db.query<{ id: string }>(`select id from pierre_rt_runtime_events where company_id=$1`, [h.companyA])).rows[0];
    // governed apply (granted to the scheduler) succeeds + marks applied
    await asRole(h, "pierre_rt_runtime_scheduler", h.companyA, (q) => q(`select pierre_rt_apply_runtime_event($1,$2,$3)`, [h.companyA, ev.id, 0]));
    expect((await h.db.query<{ application_status: string }>(`select application_status from pierre_rt_runtime_events where id=$1`, [ev.id])).rows[0].application_status).toBe("ignored");
  });
});
