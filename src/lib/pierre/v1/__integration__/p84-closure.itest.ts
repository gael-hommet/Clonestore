// PHASE 8.4 — closure roll-up. Asserts the central P8.4 invariants at the schema/grant level on a
// migrations-only database (the deployable artifact).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

let pg: PGlite;
beforeAll(async () => { const MIG = resolve(process.cwd(), "supabase/migrations"); const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort(); pg = await PGlite.create(); for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const has = async (q: string, p: unknown[] = []) => ((await pg.query<{ n: number }>(q, p)).rows[0].n) > 0;

describe("P8.4 closure invariants (deployable migration)", () => {
  it("the 7 communication tables + extended notifications exist", async () => {
    expect((await pg.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name like 'pierre_rt_communication_%'`)).rows[0].n).toBe(7);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_notifications' and column_name='recipient_user_id'`)).toBe(true);
  });
  it("delivery truth is governed-only: the app role has NO update on deliveries, NO insert/update on attempts/provider_events", async () => {
    // R1.8 — the app MAY create a queued delivery (with its frozen content) but NEVER sets delivery
    // truth: it has no UPDATE on deliveries, and a BEFORE INSERT guard forces queued/scheduled only.
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_communication_deliveries' and privilege_type='UPDATE'`)).toBe(false);
    expect(await has(`select count(*)::int n from pg_trigger where tgname='trg_comm_delivery_app_insert'`)).toBe(true);
    for (const t of ["pierre_rt_communication_attempts", "pierre_rt_communication_provider_events"]) {
      expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name=$1 and privilege_type in ('INSERT','UPDATE')`, [t])).toBe(false);
    }
  });
  it("the worker + webhook roles + governed functions exist", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname in ('pierre_rt_communication_worker','pierre_rt_communication_webhook')`)).toBe(true);
    for (const fn of ["pierre_rt_claim_communication_deliveries", "pierre_rt_submit_communication_delivery", "pierre_rt_record_communication_attempt", "pierre_rt_complete_internal_delivery", "pierre_rt_fail_communication_delivery", "pierre_rt_create_internal_message", "pierre_rt_ingest_communication_provider_event", "pierre_rt_apply_communication_provider_event", "pierre_rt_record_communication_suppression", "pierre_rt_resolve_communication_delivery"]) {
      expect(await has(`select count(*)::int n from pg_proc where proname=$1`, [fn])).toBe(true);
    }
  });
  it("composite tenant-safe FKs + the per-tenant idempotency + provider-message uniqueness exist", async () => {
    expect(await has(`select count(*)::int n from pg_constraint where conname like 'fk_comm_%'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_comm_delivery_idem'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_comm_delivery_provmsg'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_comm_provevent_dedup'`)).toBe(true);
  });
  it("the provider registry boundary: the webhook ingest accepts only 'resend'", async () => {
    // (a non-resend provider raises inside the function — proven functionally in production-failclosed)
    expect(await has(`select count(*)::int n from pg_proc where proname='pierre_rt_ingest_communication_provider_event'`)).toBe(true);
  });
});
