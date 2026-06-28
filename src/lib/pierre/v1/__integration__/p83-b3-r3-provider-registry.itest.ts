// PHASE 8.3-B3-R3.2 — the production provider registry contains ONLY the implemented provider
// (yousign). The forecast/unimplemented providers (docuseal, dropbox_sign, hellosign) are removed;
// fake/sandbox are refused; the webhook role cannot add a provider. Proven against a
// migrations-only database (the deployable artifact, no harness test-seed).
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

describe("B3-R3.2 production registry = yousign only", () => {
  it("the registry contains exactly ['yousign']", async () => {
    const rows = (await pg.query<{ provider: string; kind: string }>(`select provider, kind from pierre_rt_signature_provider_registry order by provider`)).rows;
    expect(rows.map((r) => r.provider)).toEqual(["yousign"]);
    expect(rows[0].kind).toBe("live");
  });
  it("yousign is accepted", async () => { expect((await ingest("yousign")).ok).toBe(true); });
  it("the previously-forecast providers are now REFUSED", async () => {
    for (const p of ["docuseal", "dropbox_sign", "hellosign"]) {
      const r = await ingest(p);
      expect(r.ok).toBe(false);
      expect(r.err).toMatch(/not allowed/i);
    }
  });
  it("fake_provider / *_sandbox are REFUSED", async () => {
    for (const p of ["fake_provider", "local_sandbox", "internal_sandbox"]) {
      expect((await ingest(p)).ok).toBe(false);
    }
  });
  it("the webhook-ingress role cannot add a provider", async () => {
    await pg.exec("set role pierre_rt_webhook_ingress");
    try {
      await expect(pg.query(`insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values ('docuseal','live',true)`)).rejects.toThrow(/permission denied/i);
    } finally { await pg.exec("reset role"); }
  });
});
