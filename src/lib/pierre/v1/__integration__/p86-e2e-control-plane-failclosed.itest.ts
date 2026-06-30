// src/lib/pierre/v1/__integration__/p86-e2e-control-plane-failclosed.itest.ts
// PHASE 8.6 STEP 1 — the E2E control-plane guard is fail-closed: invisible (404) outside E2E mode and in
// production, refuses (403) a wrong/absent secret, and only passes with mode + correct secret + non-prod.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { guardE2E } from "../e2e-control-plane";

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = { M: env.PIERRE_E2E_TEST_MODE, S: env.PIERRE_E2E_SECRET, N: env.NODE_ENV }; });
afterEach(() => { const s = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; }; s("PIERRE_E2E_TEST_MODE", saved.M); s("PIERRE_E2E_SECRET", saved.S); s("NODE_ENV", saved.N); });

const req = (secret?: string) => new Request("http://x/api/internal/e2e/reset", { method: "POST", headers: secret ? { "x-pierre-e2e-secret": secret } : {} });

describe("P8.6 E2E control-plane guard — fail-closed", () => {
  it("404 (invisible) without E2E mode", () => {
    env.NODE_ENV = "test"; delete env.PIERRE_E2E_TEST_MODE; env.PIERRE_E2E_SECRET = "s12345678";
    const r = guardE2E(req("s12345678"));
    expect(r).not.toBeNull(); expect(r!.status).toBe(404);
  });
  it("403 with mode but a wrong or absent secret", () => {
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678";
    expect(guardE2E(req("wrong"))!.status).toBe(403);
    expect(guardE2E(req())!.status).toBe(403);
  });
  it("passes (null) with mode + correct secret, non-production", () => {
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678";
    expect(guardE2E(req("s12345678"))).toBeNull();
  });
  it("404 in production even with mode + secret", () => {
    env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678"; env.NODE_ENV = "production";
    expect(guardE2E(req("s12345678"))!.status).toBe(404);
  });
});
