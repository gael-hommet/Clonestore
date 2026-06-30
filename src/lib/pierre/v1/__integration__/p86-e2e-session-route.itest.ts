// src/lib/pierre/v1/__integration__/p86-e2e-session-route.itest.ts
// PHASE 8.6 STEP 1 — the E2E session route signs an identity cookie (id + verified email only); any
// injected role/company/entitlement is stripped; wrong secret → 403, no mode/production → 404.

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = { M: env.PIERRE_E2E_TEST_MODE, S: env.PIERRE_E2E_SECRET, N: env.NODE_ENV }; env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678"; });
afterEach(() => { const s = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; }; s("PIERRE_E2E_TEST_MODE", saved.M); s("PIERRE_E2E_SECRET", saved.S); s("NODE_ENV", saved.N); });

function post(body: unknown, secret?: string): Request {
  return new Request("http://x/api/internal/e2e/session", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-pierre-e2e-secret": secret } : {}) }, body: JSON.stringify(body) });
}

describe("P8.6 E2E session route", () => {
  it("issues a signed identity cookie with the correct secret", async () => {
    const { POST } = await import("@/app/api/internal/e2e/session/route");
    const res = await POST(post({ user_id: "u-1", email: "owner@e2e.test" }, "s12345678"));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/pierre_e2e_session=/);
    expect(setCookie.toLowerCase()).toMatch(/httponly/);
    // the cookie verifies to ONLY id + verified email
    const token = decodeURIComponent((setCookie.match(/pierre_e2e_session=([^;]+)/) ?? [])[1] ?? "");
    const { verifyE2EIdentity } = await import("../e2e-test-identity");
    expect(verifyE2EIdentity(token)).toEqual({ user_id: "u-1", email: "owner@e2e.test", email_verified: true });
  });

  it("ignores any injected role/company/entitlement (not in the cookie)", async () => {
    const { POST } = await import("@/app/api/internal/e2e/session/route");
    const res = await POST(post({ user_id: "u-2", email: "x@e2e.test", role: "owner", company_id: "c-evil", entitlement: "active", permissions: ["*"] }, "s12345678"));
    expect(res.status).toBe(200);
    const token = decodeURIComponent(((res.headers.get("set-cookie") ?? "").match(/pierre_e2e_session=([^;]+)/) ?? [])[1] ?? "");
    const { verifyE2EIdentity } = await import("../e2e-test-identity");
    const id = verifyE2EIdentity(token) as Record<string, unknown>;
    expect(id.role).toBeUndefined(); expect(id.company_id).toBeUndefined(); expect(id.entitlement).toBeUndefined();
  });

  it("refuses a wrong secret (403) and is invisible in production (404)", async () => {
    const { POST } = await import("@/app/api/internal/e2e/session/route");
    expect((await POST(post({ user_id: "u", email: "e@e2e.test" }, "wrong"))).status).toBe(403);
    env.NODE_ENV = "production";
    expect((await POST(post({ user_id: "u", email: "e@e2e.test" }, "s12345678"))).status).toBe(404);
  });
});
