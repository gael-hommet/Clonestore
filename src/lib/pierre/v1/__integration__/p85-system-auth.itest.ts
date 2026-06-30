// PHASE 8.5 §43 — the runtime tick/scheduler are SYSTEM operations. A request without the dedicated
// runtime system secret is refused; only a constant-time-verified secret is accepted. The secret is
// read from PIERRE_RUNTIME_SYSTEM_SECRET (falling back to CRON_SECRET); an empty value never authorizes.
import { describe, it, expect, afterEach, vi } from "vitest";
import { runtimeSystemSecret, verifyRuntimeSystemRequest } from "../runtime-system-auth";

const reqWith = (headers: Record<string, string>) => new Request("http://x/api/internal/pierre/runtime/tick", { method: "POST", headers });

describe("P8.5 runtime system-secret gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("a request with no / wrong secret is refused", () => {
    expect(verifyRuntimeSystemRequest(reqWith({}), "s3cr3t")).toBe(false);
    expect(verifyRuntimeSystemRequest(reqWith({ authorization: "Bearer nope" }), "s3cr3t")).toBe(false);
  });
  it("a request with the correct Bearer / header secret is accepted", () => {
    expect(verifyRuntimeSystemRequest(reqWith({ authorization: "Bearer s3cr3t" }), "s3cr3t")).toBe(true);
    expect(verifyRuntimeSystemRequest(reqWith({ "x-pierre-system-secret": "s3cr3t" }), "s3cr3t")).toBe(true);
  });
  it("R1.10 — the secret is the DEDICATED env only (no CRON_SECRET fallback; empty never authorizes)", () => {
    vi.stubEnv("PIERRE_RUNTIME_SYSTEM_SECRET", ""); vi.stubEnv("CRON_SECRET", "cron-x");
    expect(runtimeSystemSecret()).toBeNull(); // a generic cron secret can NOT drive the runtime
    vi.stubEnv("PIERRE_RUNTIME_SYSTEM_SECRET", "primary");
    expect(runtimeSystemSecret()).toBe("primary");
  });
});
