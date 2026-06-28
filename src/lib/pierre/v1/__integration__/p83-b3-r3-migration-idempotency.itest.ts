// PHASE 8.3-B3-R3.7 — the migration chain applies in order v1→v19 on a virgin database and v19 is
// re-applicable (idempotent) without error.
import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V19 = FILES.find((f) => f.includes("pierre_v19"))!;

describe("B3-R3.7 migration chain + idempotent v19", () => {
  it("applies the whole chain in order on a virgin database (v19 present)", async () => {
    const pg = await PGlite.create();
    let applied = 0;
    for (const f of FILES) { await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); applied++; }
    expect(applied).toBe(FILES.length);
    expect(V19).toBeTruthy(); // v19 is part of the applied chain
    await pg.close();
  });
  it("re-applies v19 idempotently (no error)", async () => {
    const pg = await PGlite.create();
    for (const f of FILES) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
    await expect(pg.exec(readFileSync(resolve(MIG, V19), "utf-8"))).resolves.not.toThrow();
    // the registry stays yousign-only after a re-apply (the delete is idempotent)
    const rows = (await pg.query<{ provider: string }>(`select provider from pierre_rt_signature_provider_registry`)).rows;
    expect(rows.map((r) => r.provider)).toEqual(["yousign"]);
    await pg.close();
  });
});
