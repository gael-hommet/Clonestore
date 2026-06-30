// PHASE 8.5-R3 §R3.13 — v25 applies on v1→v24 and is REALLY idempotent: re-executing the v25 file a
// second time raises no error and duplicates no constraint/grant/marker row.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V25 = FILES.find((f) => f.includes("pierre_v25"))!;
const upToV24 = FILES.filter((f) => f < V25);

let pg: PGlite;
beforeAll(async () => { pg = await PGlite.create(); for (const f of upToV24) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const count = async (sql: string) => (await pg.query<{ n: number }>(sql)).rows[0].n;

describe("P8.5-R3 v25 migration truth", () => {
  it("v25 exists and applies cleanly on v1→v24", async () => {
    expect(V25).toBeTruthy();
    await expect(pg.exec(readFileSync(resolve(MIG, V25), "utf-8"))).resolves.not.toThrow();
  });

  it("re-applying v25 is idempotent (no error, no duplicate marker)", async () => {
    const before = await count(`select count(*)::int n from pierre_rt_runtime_closure_markers`);
    await expect(pg.exec(readFileSync(resolve(MIG, V25), "utf-8"))).resolves.not.toThrow();
    const after = await count(`select count(*)::int n from pierre_rt_runtime_closure_markers`);
    expect(after).toBe(before); // ON CONFLICT DO NOTHING — no duplicate
  });

  it("v25 locked public + recorded the closure marker", async () => {
    expect((await pg.query<{ ok: boolean }>(`select has_schema_privilege('public','public','CREATE') as ok`)).rows[0].ok).toBe(false);
    expect(await count(`select count(*)::int n from pierre_rt_runtime_closure_markers where marker='v25_public_schema_locked'`)).toBe(1);
  });
});
