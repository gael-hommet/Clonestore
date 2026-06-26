// PHASE 8.3-B3-R1.8 — production fail-closed. In a production runtime the provider is NEVER the
// Fake and is NEVER chosen by a request header; it must be the configured live provider. The DB
// ingress function refuses fake_provider unless an explicit test GUC is set (production never sets
// it). Live providers + the legacy sandboxes remain accepted (B2F unchanged).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveSignatureProvider, resolveWebhookProvider, isProductionRuntime, signatureProviderKey } from "../signature-provider-config";

function setEnv(env: Record<string, string | undefined>) { for (const [k, v] of Object.entries(env)) { if (v === undefined) vi.stubEnv(k, ""); else vi.stubEnv(k, v); } }

describe("B3-R1.8 production fail-closed (config layer)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("production with NO live provider configured → resolveSignatureProvider throws (never falls back to Fake)", () => {
    setEnv({ NODE_ENV: "production", PIERRE_RUNTIME_ENV: undefined, CLONESTORE_SIGNATURE_PROVIDER: undefined });
    expect(isProductionRuntime()).toBe(true);
    expect(signatureProviderKey()).toBeFalsy();
    expect(() => resolveSignatureProvider()).toThrow(/production signature provider is not configured|never available in production/i);
  });

  it("production with provider=fake → throws (the Fake is never available in production)", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_SIGNATURE_PROVIDER: "fake" });
    expect(() => resolveSignatureProvider()).toThrow();
  });

  it("production webhook provider is NOT chosen by the header — it must match the configured live provider", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_SIGNATURE_PROVIDER: "yousign", CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.test", CLONESTORE_SIGNATURE_API_KEY: "k", CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "s" });
    // a header claiming another provider is rejected; a matching/absent header resolves to yousign
    expect(() => resolveWebhookProvider("fake_provider")).toThrow(/does not match/i);
    expect(() => resolveWebhookProvider("docuseal")).toThrow(/does not match/i);
    expect(resolveWebhookProvider("yousign")).toBe("yousign");
    expect(resolveWebhookProvider(null)).toBe("yousign");
  });

  it("production with a live provider builds the real adapter (yousign), never the Fake", () => {
    setEnv({ NODE_ENV: "production", CLONESTORE_SIGNATURE_PROVIDER: "yousign", CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.test", CLONESTORE_SIGNATURE_API_KEY: "k", CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "s" });
    const p = resolveSignatureProvider();
    expect(p.providerKey).toBe("yousign");
  });

  it("test/dev honours the header for the deterministic Fake", () => {
    setEnv({ NODE_ENV: "test", CLONESTORE_SIGNATURE_PROVIDER: undefined });
    expect(isProductionRuntime()).toBe(false);
    expect(resolveWebhookProvider("fake_provider")).toBe("fake_provider");
  });
});

describe("B3-R1.8 production-safe ingress (DB layer)", () => {
  let h: Harness;
  beforeEach(async () => { h = await createHarness(); });
  afterEach(async () => { await h.close(); });

  async function ingest(provider: string, withGuc: boolean): Promise<{ ok: boolean; err?: string }> {
    const req = newUuid();
    // a real signature request so the company resolves (it is fine if absent — the provider gate fires first)
    await h.pg.exec("set role pierre_rt_webhook_ingress");
    try {
      if (withGuc) await h.pg.query(`select set_config('app.allow_test_provider','true',false)`);
      else await h.pg.query(`select set_config('app.allow_test_provider','', false)`); // explicitly unset
      await h.pg.query(`select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [provider, "evt-" + provider + (withGuc ? "-g" : ""), "request.activated", "hash", 200, req, null, true, null]);
      return { ok: true };
    } catch (e) { return { ok: false, err: (e as Error).message }; }
    finally { await h.pg.exec("reset role"); }
  }

  it("fake_provider is REFUSED without the test GUC", async () => {
    const r = await ingest("fake_provider", false);
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/not allowed/i);
  });
  it("fake_provider is ACCEPTED only with the explicit test GUC", async () => {
    const r = await ingest("fake_provider", true);
    expect(r.ok).toBe(true);
  });
  it("a live provider (yousign) is accepted with NO GUC (production path)", async () => {
    const r = await ingest("yousign", false);
    expect(r.ok).toBe(true);
  });
  it("the legacy sandboxes remain accepted with no GUC (B2F unchanged)", async () => {
    expect((await ingest("internal_sandbox", false)).ok).toBe(true);
    expect((await ingest("local_sandbox", false)).ok).toBe(true);
  });
  it("an unknown provider is refused", async () => {
    const r = await ingest("evilcorp", false);
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/not allowed/i);
  });
});
