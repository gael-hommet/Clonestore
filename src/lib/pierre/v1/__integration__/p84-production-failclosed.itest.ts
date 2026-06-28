// PHASE 8.4.12 — production fail-closed provider resolution. Under NODE_ENV=production the
// Fake/mock is NEVER available; a missing provider / key / from / public URL throws. A live key
// builds the real Resend adapter. The DB webhook ingress accepts ONLY the implemented provider.
import { describe, it, expect, afterEach, vi, beforeEach, afterAll, beforeAll } from "vitest";
import { resolveEmailProvider, isLiveCommunicationConfigured } from "../communication-provider-config";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

function setEnv(env: Record<string, string | undefined>) { for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v === undefined ? "" : v); }

describe("P8.4.12 production fail-closed (config)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("production with NO provider configured → throws (never the Fake)", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_COMMUNICATION_PROVIDER: undefined, EMAIL_PROVIDER: undefined, RESEND_API_KEY: undefined });
    expect(() => resolveEmailProvider()).toThrow(/not configured|never available/i);
  });
  it("production with provider but missing key / from / public url → throws", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_COMMUNICATION_PROVIDER: "resend", RESEND_API_KEY: "re_x", CLONESTORE_FOUNDER_EMAIL_FROM: undefined, CLONESTORE_PUBLIC_APP_URL: undefined });
    expect(() => resolveEmailProvider()).toThrow();
  });
  it("production with a fully-configured live provider builds the real adapter (resend)", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_COMMUNICATION_PROVIDER: "resend", RESEND_API_KEY: "re_live_x", CLONESTORE_FOUNDER_EMAIL_FROM: "CloneStore <hr@clonestore.pro>", CLONESTORE_PUBLIC_APP_URL: "https://clonestore.pro" });
    expect(isLiveCommunicationConfigured()).toBe(true);
    expect(resolveEmailProvider().providerKey).toBe("resend");
  });
  it("non-production with no config falls back to the Fake (never in production)", () => {
    setEnv({ NODE_ENV: "test", CLONESTORE_COMMUNICATION_PROVIDER: undefined });
    expect(resolveEmailProvider().providerKey).toBe("fake_email");
  });
});

describe("P8.4.18 webhook ingress provider boundary (migrations-only DB)", () => {
  let pg: PGlite;
  beforeAll(async () => { const MIG = resolve(process.cwd(), "supabase/migrations"); const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort(); pg = await PGlite.create(); for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
  afterAll(async () => { await pg.close(); });
  it("the ingest function accepts ONLY 'resend'; any other provider is refused", async () => {
    const ok = await pg.query(`select * from pierre_rt_ingest_communication_provider_event('resend',$1,null,'email.delivered','h',100,null,true)`, [randomUUID()]);
    expect(ok.rows.length).toBe(1);
    for (const p of ["fake_email", "sendgrid", "mailgun", "internal"]) {
      let blocked = false;
      try { await pg.query(`select * from pierre_rt_ingest_communication_provider_event($1,$2,null,'email.delivered','h',100,null,true)`, [p, randomUUID()]); } catch { blocked = true; }
      expect(blocked).toBe(true);
    }
  });
  it("an unverified webhook is refused at the DB boundary", async () => {
    let blocked = false;
    try { await pg.query(`select * from pierre_rt_ingest_communication_provider_event('resend',$1,null,'email.delivered','h',100,null,false)`, [randomUUID()]); } catch { blocked = true; }
    expect(blocked).toBe(true);
  });
});
