// src/lib/clonestore/production/__tests__/p11-provider-readiness.test.ts
// P11 §9 — provider (Yousign/signature) readiness: fail-closed, sandbox blocks, manual = warning.
import { describe, it, expect } from "vitest";
import { evaluateProviderReadiness, detectSignatureMode } from "../p11-provider-readiness";

const SANDBOX_ENV = {
  CLONESTORE_SIGNATURE_PROVIDER: "yousign",
  CLONESTORE_SIGNATURE_API_URL: "https://api-sandbox.yousign.app",
  CLONESTORE_SIGNATURE_API_KEY: "k",
  CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "w",
} as unknown as NodeJS.ProcessEnv;

describe("P11 provider readiness", () => {
  it("detectSignatureMode: sandbox URL → sandbox, yousign live host → live, empty → unknown", () => {
    expect(detectSignatureMode({ CLONESTORE_SIGNATURE_API_URL: "https://api-sandbox.yousign.app" } as never)).toBe("sandbox");
    expect(detectSignatureMode({ CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.com" } as never)).toBe("live");
    expect(detectSignatureMode({} as never)).toBe("unknown");
  });

  it("sandbox Yousign → NOT ready, PROVIDER_SIGNATURE_NOT_LIVE + sandbox blocker", () => {
    const r = evaluateProviderReadiness(SANDBOX_ENV);
    expect(r.ready).toBe(false);
    expect(r.signature.mode).toBe("sandbox");
    expect(r.signature.live).toBe(false);
    expect(r.blockers.some((b) => b.includes("PROVIDER_SIGNATURE_NOT_LIVE"))).toBe(true);
    expect(r.blockers.some((b) => /SANDBOX/i.test(b))).toBe(true);
  });

  it("missing signature API key → blocker", () => {
    const r = evaluateProviderReadiness({ ...SANDBOX_ENV, CLONESTORE_SIGNATURE_API_KEY: "" } as never);
    expect(r.signature.apiKeyPresent).toBe(false);
    expect(r.blockers.some((b) => /API_KEY/i.test(b))).toBe(true);
  });

  it("missing signature webhook secret → blocker", () => {
    const r = evaluateProviderReadiness({ ...SANDBOX_ENV, CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "" } as never);
    expect(r.signature.webhookConfigured).toBe(false);
    expect(r.blockers.some((b) => /WEBHOOK/i.test(b))).toBe(true);
  });

  it("no owner live attestation → NOT ready even with a live-shaped URL", () => {
    const liveShaped = { ...SANDBOX_ENV, CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.com" } as never;
    const r = evaluateProviderReadiness(liveShaped);
    expect(r.ready).toBe(false); // owner attestation flag absent
    expect(r.blockers.some((b) => /attestation owner/i.test(b))).toBe(true);
  });

  it("manual fallback present → warning, not full readiness", () => {
    const r = evaluateProviderReadiness(SANDBOX_ENV);
    // manual path is a warning, never flips ready true
    if (r.signature.manualPathAvailable) expect(r.warnings.some((w) => /manuel/i.test(w))).toBe(true);
    expect(r.ready).toBe(false);
  });

  it("covers FR/BE/LU/CH in the (documentary) country coverage", () => {
    const r = evaluateProviderReadiness(SANDBOX_ENV);
    expect(r.signature.countryCoverage).toEqual({ FR: true, BE: true, LU: true, CH: true });
  });
});
