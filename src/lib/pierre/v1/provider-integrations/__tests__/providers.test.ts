// src/lib/pierre/v1/provider-integrations/__tests__/providers.test.ts
// PHASE 8.12 — providers are governed + fail-closed: none is usable without real config, Yousign is
// blocked regardless of config (P8.7.4), submission NEVER simulates success (routes to manual), and
// webhooks are rejected without a configured secret.

import { describe, it, expect } from "vitest";
import { PROVIDER_ADAPTERS, preflightAll, providerSummary, getProvider } from "../registry";
import { preflight } from "../preflight";
import { submit } from "../submission";
import { verifyProviderWebhook } from "../webhook-security";

const EMPTY_ENV = {} as NodeJS.ProcessEnv;
const NOW = "2026-07-02T10:00:00.000Z";

describe("provider integrations (P8.12, all governed)", () => {
  it("no provider is usable without real credentials + explicit live mode", () => {
    for (const pf of preflightAll(EMPTY_ENV)) expect(pf.usable, pf.provider).toBe(false);
    expect(providerSummary(EMPTY_ENV).usable).toBe(0);
  });

  it("Yousign is BLOCKED regardless of credentials (P8.7.4)", () => {
    const env = { YOUSIGN_API_KEY: "k", YOUSIGN_BASE_URL: "https://x", YOUSIGN_LIVE: "1" } as unknown as NodeJS.ProcessEnv;
    const pf = preflight(getProvider("yousign")!, env);
    expect(pf.status).toBe("blocked");
    expect(pf.usable).toBe(false);
    expect(pf.blockedReason).toMatch(/P8\.7\.4/);
  });

  it("submission NEVER simulates success — it routes to the governed manual handoff", () => {
    for (const a of PROVIDER_ADAPTERS) {
      const r = submit(a, `corr-${a.id}`, NOW, EMPTY_ENV);
      expect(r.outcome).toBe("routed_to_manual");
      expect(r.reference).toBeNull();          // no fabricated provider reference
      expect(r.manualHandoffId).toBeTruthy();
    }
  });

  it("every provider has a governed manual handoff (missions never dead-end)", () => {
    expect(providerSummary(EMPTY_ENV).allHaveManualPath).toBe(true);
    for (const a of PROVIDER_ADAPTERS) expect(a.manualHandoff.steps.length).toBeGreaterThan(0);
  });

  it("webhook verification is fail-closed without a configured secret", () => {
    const a = getProvider("payroll")!;
    expect(verifyProviderWebhook(a, Buffer.from("{}"), "sig", EMPTY_ENV).verified).toBe(false);
    // with a secret, a wrong signature is still rejected
    const env = { PAYROLL_WEBHOOK_SECRET: "s3cret" } as unknown as NodeJS.ProcessEnv;
    expect(verifyProviderWebhook(a, Buffer.from("{}"), "wrong", env).verified).toBe(false);
  });

  it("a live-configured non-blocked provider would require a real adapter (never faked)", () => {
    const env = { PAYROLL_PROVIDER_API_KEY: "k", PAYROLL_PROVIDER_BASE_URL: "https://x", PAYROLL_LIVE: "1" } as unknown as NodeJS.ProcessEnv;
    const a = getProvider("payroll")!;
    expect(preflight(a, env).usable).toBe(true);
    expect(() => submit(a, "corr", NOW, env)).toThrow(/real adapter/);  // no simulated live call
  });
});
