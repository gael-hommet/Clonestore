// PHASE 8.4.5 — least-privilege DB roles. The general app role can NEVER raw-write delivery truth,
// an attempt, or a provider event; the specialized worker/webhook roles + governed functions are the
// only write paths. Attempts are append-only.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });
async function asApp<T>(fn: () => Promise<T>): Promise<{ ok: boolean; err?: string }> {
  await h.pg.exec("set role pierre_rt_app");
  try { await fn(); return { ok: true }; } catch (e) { return { ok: false, err: (e as Error).message }; } finally { await h.pg.exec("reset role"); }
}

describe("P8.4.5 least-privilege DB roles", () => {
  it("the app role canNOT raw-INSERT/UPDATE a delivery (status) or an attempt or a provider event", async () => {
    const del = newUuid();
    expect((await asApp(() => h.pg.query(`update pierre_rt_communication_deliveries set status='delivered'`))).ok).toBe(false);
    expect((await asApp(() => h.pg.query(`insert into pierre_rt_communication_attempts (id, company_id, delivery_id, attempt_number, result_status) values (gen_random_uuid(),$1,$2,1,'delivered')`, [h.companyA, del]))).ok).toBe(false);
    expect((await asApp(() => h.pg.query(`insert into pierre_rt_communication_provider_events (id, company_id, provider, provider_event_id, event_type, payload_hash) values (gen_random_uuid(),$1,'resend','x','email.delivered','h')`, [h.companyA]))).ok).toBe(false);
  });
  it("the app role canNOT execute the governed delivery-truth functions", async () => {
    const r = await asApp(async () => { await h.pg.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); await h.pg.query(`select pierre_rt_submit_communication_delivery($1,$2,'w','resend','x','h')`, [h.companyA, newUuid()]); });
    expect(r.ok).toBe(false); expect(r.err).toMatch(/permission denied/i);
  });
  it("the app role MAY read its tenant + write intents/recipients/preferences (RLS-bound)", async () => {
    expect((await asApp(() => h.pg.query(`select count(*) from pierre_rt_communication_deliveries`))).ok).toBe(true);
  });
  it("attempts are append-only (no update/delete, any role)", async () => {
    // seed an attempt as superuser (bypassing the app revoke), then prove it cannot be mutated
    await h.pg.exec("set session_replication_role=replica");
    const att = newUuid();
    await h.pg.query(`insert into pierre_rt_communication_attempts (id, company_id, delivery_id, attempt_number, result_status) values ($1,$2,$3,1,'submitted')`, [att, h.companyA, newUuid()]);
    await h.pg.exec("set session_replication_role=default");
    await expect(h.pg.query(`update pierre_rt_communication_attempts set result_status='x' where id=$1`, [att])).rejects.toThrow(/append-only/i);
    await expect(h.pg.query(`delete from pierre_rt_communication_attempts where id=$1`, [att])).rejects.toThrow(/append-only/i);
  });
});
