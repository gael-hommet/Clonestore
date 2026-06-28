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

  // R2.5 — the boundary is now the service-only provider REGISTRY (no session GUC). In the
  // harness the live providers + the test-seeded Fake/sandbox are registered; an unknown one is
  // refused. (The DEPLOYABLE-migration-only rejection of the Fake/sandbox is proven separately in
  // p83-b3-r2-webhook-provider-production.itest.ts against a migrations-only database.)
  async function ingest(provider: string): Promise<{ ok: boolean; err?: string }> {
    const req = newUuid();
    await h.pg.exec("set role pierre_rt_webhook_ingress");
    try {
      await h.pg.query(`select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [provider, "evt-" + provider, "request.activated", "hash", 200, req, null, true, null]);
      return { ok: true };
    } catch (e) { return { ok: false, err: (e as Error).message }; }
    finally { await h.pg.exec("reset role"); }
  }

  it("a live provider (yousign) is accepted (in the registry)", async () => {
    expect((await ingest("yousign")).ok).toBe(true);
  });
  it("the harness-seeded test providers are accepted (test-only registry rows)", async () => {
    expect((await ingest("fake_provider")).ok).toBe(true);
    expect((await ingest("internal_sandbox")).ok).toBe(true);
    expect((await ingest("local_sandbox")).ok).toBe(true);
  });
  it("an unknown provider is refused", async () => {
    const r = await ingest("evilcorp");
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/not allowed/i);
  });
  it("the webhook-ingress role CANNOT enable a provider (no registry write grant — the GUC gate is gone)", async () => {
    await h.pg.exec("set role pierre_rt_webhook_ingress");
    try {
      await expect(h.pg.query(`insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values ('rogue','test',true)`)).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
});
