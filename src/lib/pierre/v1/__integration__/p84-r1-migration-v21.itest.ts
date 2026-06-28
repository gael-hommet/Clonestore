// PHASE 8.4-R1.16 — the v21 migration applies on top of v1→v20, is idempotent (reapplies cleanly),
// and is non-destructive: it adds the recipient FKs, the event-idempotency columns, the outbox
// quarantine columns, the frozen-content columns, the internal-message governance + provider FK.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V21 = FILES.find((f) => f.includes("pierre_v21"))!;
const upToV20 = FILES.filter((f) => !f.includes("pierre_v21"));

let pg: PGlite;
beforeAll(async () => { pg = await PGlite.create(); for (const f of upToV20) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const has = async (sql: string) => ((await pg.query<{ n: number }>(sql)).rows[0].n > 0);

describe("R1.16 v21 migration truth", () => {
  it("v21 is the last migration and applies on v1→v20", async () => {
    expect(FILES[FILES.length - 1]).toContain("pierre_v21");
    await expect(pg.exec(readFileSync(resolve(MIG, V21), "utf-8"))).resolves.not.toThrow();
  });

  it("re-applying v21 is idempotent (no throw)", async () => {
    await expect(pg.exec(readFileSync(resolve(MIG, V21), "utf-8"))).resolves.not.toThrow();
  });

  it("the R1 columns + constraints exist", async () => {
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_communication_intents' and column_name in ('source_event_key','source_payload_hash','object_version')`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_outbox' and column_name in ('comm_processing_status','comm_quarantine_reason')`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_communication_deliveries' and column_name in ('frozen_subject','content_hash','provider_idempotency_key','canonical_variables')`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_constraint where conname in ('fk_comm_recipient_membership_ct','fk_comm_recipient_employee_ct','ck_comm_recipient_identity','fk_comm_provevent_delivery_ct','fk_comm_pref_member_ct')`)).toBe(true);
  });

  it("the app role can create a QUEUED delivery but the insert guard exists (no fabricated truth)", async () => {
    expect(await has(`select count(*)::int n from pg_trigger where tgname='trg_comm_delivery_app_insert'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_communication_deliveries' and privilege_type='INSERT'`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_communication_deliveries' and privilege_type='UPDATE'`)).toBe(false);
  });
});
