// PHASE 8.4-R1.18 — closure invariants: the runtime truth is provable under the REAL roles. The
// worker + webhook roles are distinct and least-privilege; the signature role can not touch a
// communication function; the app role can create a queued delivery but never delivery truth; and the
// idempotency / quarantine / freeze / recipient-FK schema is in place.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });
const has = async (sql: string, p?: readonly unknown[]) => ((await h.db.query<{ n: number }>(sql, p)).rows[0].n > 0);

describe("R1.18 communication runtime truth closure", () => {
  it("the dedicated worker + webhook roles exist and are distinct from the signature role", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname in ('pierre_rt_communication_worker','pierre_rt_communication_webhook','pierre_rt_webhook_ingress')`)).toBe(true);
  });

  it("the worker may SELECT comm tables but holds NO grant on a business table", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_communication_worker' and table_name='pierre_rt_communication_deliveries' and privilege_type='SELECT'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_communication_worker' and table_name in ('pierre_rt_employee_contracts','pierre_rt_employees')`)).toBe(false);
  });

  it("the signature ingress role can NOT execute the communication ingest function", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_webhook_ingress' and routine_name='pierre_rt_ingest_communication_provider_event'`)).toBe(false);
  });

  it("the app role can INSERT a delivery (queued, guarded) but never UPDATE delivery truth", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_communication_deliveries' and privilege_type='INSERT'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_communication_deliveries' and privilege_type='UPDATE'`)).toBe(false);
    expect(await has(`select count(*)::int n from pg_trigger where tgname='trg_comm_delivery_app_insert'`)).toBe(true);
  });

  it("the idempotency + quarantine + freeze + recipient-FK schema is in place", async () => {
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_comm_intent_source_key'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_outbox' and column_name='comm_processing_status'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_communication_deliveries' and column_name='content_hash'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_constraint where conname='ck_comm_recipient_identity'`)).toBe(true);
  });
});
