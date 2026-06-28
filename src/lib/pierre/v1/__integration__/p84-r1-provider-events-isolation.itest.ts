// PHASE 8.4-R1.13 — provider events do not leak across tenants. An unresolved (null-company) provider
// event is INVISIBLE to a tenant role (no `company_id is null OR …` policy leak); a resolved event is
// visible only to its own tenant. The app role can not read another tenant's events.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

describe("R1.13 provider-event tenant isolation (no null-company leak)", () => {
  it("an unresolved (null-company) provider event is invisible to a tenant role", async () => {
    // ingest a verified event with no matching delivery → row persisted with company_id null
    await h.db.query(`select * from pierre_rt_ingest_communication_provider_event('resend',$1,null,'email.delivered','h',100,null,true)`, [newUuid()]);
    const total = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_provider_events where company_id is null`)).rows[0].n;
    expect(total).toBe(1); // it exists (kept) — but only visible to the definer/superuser

    // a tenant-bound app role sees ZERO provider events (the null-company row does not leak)
    const visible = await asRole(h, "pierre_rt_app", h.companyA, (q) => q(`select count(*)::int n from pierre_rt_communication_provider_events`));
    expect((visible.rows[0] as { n: number }).n).toBe(0);
  });
});
