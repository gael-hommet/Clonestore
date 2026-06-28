// PHASE 8.3-B3-R2.4/R2.7/R2.9/R2.10 — least-privilege DB roles. The application role can NEVER
// raw-write a proof, an activation task, the provider registry, or a signature event; it can read
// its own tenant's tasks (RLS) but writes go only through the governed SECURITY DEFINER functions.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

async function asApp<T>(fn: () => Promise<T>): Promise<{ ok: boolean; err?: string; value?: T }> {
  await h.pg.exec("set role pierre_rt_app");
  try { const value = await fn(); return { ok: true, value }; }
  catch (e) { return { ok: false, err: (e as Error).message }; }
  finally { await h.pg.exec("reset role"); }
}

describe("B3-R2 least-privilege DB roles (pierre_rt_app)", () => {
  it("cannot raw-INSERT a signature evidence artifact", async () => {
    const r = await asApp(() => h.pg.query(`insert into pierre_rt_signature_evidence_artifacts (id, company_id, signature_request_id, artifact_type, sha256) values (gen_random_uuid(),$1,$2,'certificate',$3)`, [h.companyA, newUuid(), "a".repeat(64)]));
    expect(r.ok).toBe(false); expect(r.err).toMatch(/permission denied/i);
  });
  it("cannot raw-INSERT / UPDATE / DELETE an activation task", async () => {
    const ins = await asApp(() => h.pg.query(`insert into pierre_rt_contract_activation_tasks (id, company_id, amendment_contract_id, execute_at, status) values (gen_random_uuid(),$1,$2,'2027-01-01','scheduled')`, [h.companyA, newUuid()]));
    expect(ins.ok).toBe(false); expect(ins.err).toMatch(/permission denied/i);
    const upd = await asApp(() => h.pg.query(`update pierre_rt_contract_activation_tasks set status='applied'`));
    expect(upd.ok).toBe(false); expect(upd.err).toMatch(/permission denied/i);
    const del = await asApp(() => h.pg.query(`delete from pierre_rt_contract_activation_tasks`));
    expect(del.ok).toBe(false); expect(del.err).toMatch(/permission denied/i);
  });
  it("cannot write the provider registry", async () => {
    const r = await asApp(() => h.pg.query(`insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values ('rogue','test',true)`));
    expect(r.ok).toBe(false); expect(r.err).toMatch(/permission denied/i);
  });
  it("cannot raw-INSERT a signature event (only the governed ingress may)", async () => {
    const r = await asApp(() => h.pg.query(`insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type) values (gen_random_uuid(),$1,$2,'x')`, [h.companyA, newUuid()]));
    expect(r.ok).toBe(false); expect(r.err).toMatch(/permission denied/i);
  });
  it("cannot UPDATE or DELETE effect history (append-only)", async () => {
    const upd = await asApp(() => h.pg.query(`update pierre_rt_contract_effect_history set new_value='x'`));
    expect(upd.ok).toBe(false); // permission denied (no grant) or append-only trigger
    const del = await asApp(() => h.pg.query(`delete from pierre_rt_contract_effect_history`));
    expect(del.ok).toBe(false);
  });
  it("CAN read its own tenant's activation tasks (RLS), seeing none of another tenant's", async () => {
    // seed a task for B directly (superuser; FK/triggers bypassed for the isolated seed only)
    await h.pg.exec("set session_replication_role=replica");
    await h.pg.query(`insert into pierre_rt_contract_activation_tasks (id, company_id, amendment_contract_id, execute_at, status) values (gen_random_uuid(),$1,$2,'2027-01-01','scheduled')`, [h.companyB, newUuid()]);
    await h.pg.exec("set session_replication_role=default");
    const r = await h.db.transaction(async (tx) => {
      await tx.query("set local role pierre_rt_app");
      await tx.query("select set_config('app.current_company',$1,true)", [h.companyA]);
      return (await tx.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_activation_tasks`)).rows[0].n;
    });
    expect(r).toBe(0); // A sees none of B's tasks
  });
});
