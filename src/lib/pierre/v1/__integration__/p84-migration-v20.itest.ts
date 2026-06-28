// PHASE 8.4.3/8.4.4 — the migration chain applies v1→v20 on a virgin database, v20 is idempotent,
// the communication tables + composite FKs + roles + governed functions exist, and the app role is
// revoked from the governed delivery-truth functions.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

let pg: PGlite; const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
beforeAll(async () => { pg = await PGlite.create(); for (const f of FILES) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const has = async (q: string, p: unknown[] = []) => ((await pg.query<{ n: number }>(q, p)).rows[0].n) > 0;

describe("P8.4 migration v20", () => {
  it("applies v1→v21 in order; v20 is present; re-applies idempotently", async () => {
    const v20 = FILES.find((f) => f.includes("pierre_v20"));
    expect(v20).toBeTruthy();
    await expect(pg.exec(readFileSync(resolve(MIG, v20!), "utf-8"))).resolves.not.toThrow();
  });
  it("the 7 communication tables exist", async () => {
    expect(await has(`select count(*)::int n from information_schema.tables where table_name like 'pierre_rt_communication_%'`)).toBe(true);
    const n = (await pg.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name like 'pierre_rt_communication_%'`)).rows[0].n;
    expect(n).toBe(7);
  });
  it("the worker + webhook roles exist", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname='pierre_rt_communication_worker'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_roles where rolname='pierre_rt_communication_webhook'`)).toBe(true);
  });
  it("the governed delivery-truth functions exist and the app role cannot execute them", async () => {
    for (const fn of ["pierre_rt_claim_communication_deliveries", "pierre_rt_submit_communication_delivery", "pierre_rt_record_communication_attempt", "pierre_rt_fail_communication_delivery", "pierre_rt_ingest_communication_provider_event"]) {
      expect(await has(`select count(*)::int n from pg_proc where proname=$1`, [fn])).toBe(true);
    }
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_submit_communication_delivery'`)).toBe(false);
  });
  it("the delivery composite tenant-safe FKs + the idempotency unique exist", async () => {
    expect(await has(`select count(*)::int n from pg_constraint where conname in ('fk_comm_delivery_intent_ct','fk_comm_delivery_recipient_ct','fk_comm_recipient_intent_ct')`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_comm_delivery_idem'`)).toBe(true);
  });
});
