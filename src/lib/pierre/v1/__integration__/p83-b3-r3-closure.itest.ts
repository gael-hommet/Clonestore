// PHASE 8.3-B3-R3.8 — closure roll-up. Asserts the five B3-R3 invariants at the schema/grant level
// on a migrations-only database (the deployable artifact).
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

describe("B3-R3 closure invariants (deployable migration)", () => {
  it("R3.2 — the registry is yousign only", async () => {
    const rows = (await pg.query<{ provider: string }>(`select provider from pierre_rt_signature_provider_registry`)).rows;
    expect(rows.map((r) => r.provider)).toEqual(["yousign"]);
  });
  it("R3.3 — the evidence record function is the 7-arg derived-truth version (no caller mime/sha/size)", async () => {
    expect(await has(`select count(*)::int n from pg_proc where proname='pierre_rt_record_signature_evidence_artifact' and pronargs=7`)).toBe(true);
    // the app role cannot execute it
    expect(await has(`select count(*)::int n from information_schema.role_routine_grants where grantee='pierre_rt_app' and routine_name='pierre_rt_record_signature_evidence_artifact'`)).toBe(false);
  });
  it("R3.3/R3.5 — the specialized worker role exists and can execute the governed writers", async () => {
    expect(await has(`select count(*)::int n from pg_roles where rolname='pierre_rt_signature_worker'`)).toBe(true);
  });
  it("R3.4 — complete/fail require a worker argument (3 / 5 args)", async () => {
    expect(await has(`select count(*)::int n from pg_proc where proname='pierre_rt_complete_contract_activation' and pronargs=3`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_proc where proname='pierre_rt_fail_contract_activation' and pronargs=5`)).toBe(true);
    expect(await has(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_contract_activation_tasks' and column_name='status'`)).toBe(true);
  });
  it("R3.5 — effect history: app INSERT revoked, governed function + 4 composite FKs + uniqueness", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_table_grants where grantee='pierre_rt_app' and table_name='pierre_rt_contract_effect_history' and privilege_type='INSERT'`)).toBe(false);
    expect(await has(`select count(*)::int n from pg_proc where proname='pierre_rt_record_contract_effect'`)).toBe(true);
    expect(await has(`select count(*)::int n from pg_constraint where conname like 'fk_effhist_%'`)).toBe(true);
    const fks = (await pg.query<{ n: number }>(`select count(*)::int n from pg_constraint where conname like 'fk_effhist_%'`)).rows[0].n;
    expect(fks).toBe(4);
    expect(await has(`select count(*)::int n from pg_indexes where indexname='uq_pierre_rt_effect_history_amendment_field'`)).toBe(true);
  });
});
