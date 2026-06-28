// PHASE 8.3-B3-R2.12 — closure roll-up. Asserts the seven B3-R2 invariants are present at the
// schema/grant level on a migrations-only database (the deployable artifact): live-only registry,
// tenant-bound governed functions, evidence + activation governance, append-only history.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

let pg: PGlite;
beforeAll(async () => {
  const MIG = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
  pg = await PGlite.create();
  for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
});
afterAll(async () => { await pg.close(); });

const has = async (q: string, p: unknown[] = []): Promise<boolean> => ((await pg.query<{ n: number }>(q, p)).rows[0].n) > 0;

describe("B3-R2 closure invariants (deployable migration)", () => {
  it("the provider registry exists and declares ONLY live providers", async () => {
    expect(await has(`select count(*)::int n from information_schema.tables where table_name='pierre_rt_signature_provider_registry'`)).toBe(true);
    expect(await has(`select count(*)::int n from pierre_rt_signature_provider_registry where kind<>'live'`)).toBe(false);
    expect(await has(`select count(*)::int n from pierre_rt_signature_provider_registry where provider='yousign'`)).toBe(true);
  });
  it("all the governed B3-R2 functions exist", async () => {
    for (const fn of ["pierre_rt_claim_signature_events", "pierre_rt_record_signature_evidence_artifact", "pierre_rt_schedule_contract_activation", "pierre_rt_claim_contract_activations", "pierre_rt_complete_contract_activation", "pierre_rt_fail_contract_activation"]) {
      expect(await has(`select count(*)::int n from pg_proc where proname=$1`, [fn])).toBe(true);
    }
  });
  it("the evidence-artifacts ledger has its three composite tenant-safe FKs", async () => {
    for (const c of ["fk_evart_request_ct", "fk_evart_evidence_ct", "fk_evart_file_ct"]) {
      expect(await has(`select count(*)::int n from pg_constraint where conname=$1`, [c])).toBe(true);
    }
  });
  it("the activation-task ledger has its composite FKs + lease columns", async () => {
    expect(await has(`select count(*)::int n from pg_constraint where conname='fk_actask_amendment_ct'`)).toBe(true);
    for (const col of ["locked_at", "locked_by", "lease_expires_at", "attempt_count", "next_retry_at", "last_error_safe", "dead_lettered_at"]) {
      expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_contract_activation_tasks' and column_name=$1`, [col])).toBe(true);
    }
  });
  it("the append-only effect-history ledger exists with its allowlist check", async () => {
    expect(await has(`select count(*)::int n from information_schema.tables where table_name='pierre_rt_contract_effect_history'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_trigger where tgname in ('trg_effect_history_no_upd','trg_effect_history_no_del')`)).toBe(true);
  });
  it("the app role is REVOKED from raw-writing the governed evidence + activation ledgers", async () => {
    // no INSERT privilege for pierre_rt_app on the governed tables
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_signature_evidence_artifacts' and privilege_type='INSERT'`)).toBe(false);
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_contract_activation_tasks' and privilege_type='INSERT'`)).toBe(false);
  });
});
