// PHASE 8.3-B3-R2.5 — production provider boundary. Proven against a MIGRATIONS-ONLY database
// (the deployable artifact, WITHOUT the harness test-seed): the ingress function accepts ONLY the
// live providers from the registry and REFUSES fake_provider / *_sandbox. The session GUC is no
// longer a gate, and the webhook-ingress role cannot enable a provider (no registry write grant).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

let pg: PGlite;
beforeAll(async () => {
  const MIG = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
  pg = await PGlite.create();
  for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
});
afterAll(async () => { await pg.close(); });

async function ingest(provider: string): Promise<{ ok: boolean; err?: string }> {
  await pg.exec("set role pierre_rt_webhook_ingress");
  try {
    await pg.query(`select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [provider, "evt-" + provider + "-" + randomUUID().slice(0, 6), "request.activated", "hash", 200, randomUUID(), null, true, null]);
    return { ok: true };
  } catch (e) { return { ok: false, err: (e as Error).message }; }
  finally { await pg.exec("reset role"); }
}

describe("B3-R2.5 deployable migration provider boundary (registry, no harness seed)", () => {
  it("the registry declares ONLY the implemented live provider (yousign)", async () => {
    const rows = (await pg.query<{ provider: string; kind: string }>(`select provider, kind from pierre_rt_signature_provider_registry order by provider`)).rows;
    expect(rows.every((r) => r.kind === "live")).toBe(true);
    expect(rows.map((r) => r.provider)).toEqual(["yousign"]); // R3.2 — no forecast/unimplemented providers
  });
  it("yousign (live) is ACCEPTED", async () => { expect((await ingest("yousign")).ok).toBe(true); });
  it("fake_provider is REFUSED", async () => { const r = await ingest("fake_provider"); expect(r.ok).toBe(false); expect(r.err).toMatch(/not allowed/i); });
  it("internal_sandbox / local_sandbox are REFUSED", async () => {
    expect((await ingest("internal_sandbox")).ok).toBe(false);
    expect((await ingest("local_sandbox")).ok).toBe(false);
  });
  it("a forged unknown provider is REFUSED", async () => { expect((await ingest("evilcorp")).ok).toBe(false); });
  it("setting the OLD app.allow_test_provider GUC does NOT re-enable the Fake (the gate is gone)", async () => {
    await pg.exec("set role pierre_rt_webhook_ingress");
    try {
      await pg.query(`select set_config('app.allow_test_provider','true',false)`);
      let blocked = false;
      try { await pg.query(`select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`, ["fake_provider", "evt-guc", "request.activated", "h", 200, randomUUID(), null, true, null]); }
      catch { blocked = true; }
      expect(blocked).toBe(true);
    } finally { await pg.exec("reset role"); }
  });
  it("the webhook-ingress role cannot write the registry (cannot enable a provider)", async () => {
    await pg.exec("set role pierre_rt_webhook_ingress");
    try {
      await expect(pg.query(`insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values ('rogue','test',true)`)).rejects.toThrow(/permission denied/i);
    } finally { await pg.exec("reset role"); }
  });
});
