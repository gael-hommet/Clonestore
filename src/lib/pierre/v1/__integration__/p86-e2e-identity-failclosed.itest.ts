// src/lib/pierre/v1/__integration__/p86-e2e-identity-failclosed.itest.ts
// PHASE 8.6 — the deterministic E2E identity boundary is test-only and FAIL-CLOSED: it works only under
// PIERRE_E2E_TEST_MODE=1 + a configured PIERRE_E2E_SECRET + NODE_ENV!=='production'; a wrong/absent
// secret, an absent flag, or production all refuse. The signed token carries ONLY a user id + verified
// email — any injected role/company/entitlement is stripped (never an authority).

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    MODE: process.env.PIERRE_E2E_TEST_MODE, SEC: process.env.PIERRE_E2E_SECRET, NE: process.env.NODE_ENV,
  };
});
afterEach(() => {
  const set = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; };
  set("PIERRE_E2E_TEST_MODE", saved.MODE); set("PIERRE_E2E_SECRET", saved.SEC); set("NODE_ENV", saved.NE);
});

// fresh import each time so the module reads the current env (it reads process.env at call time, so a
// single import is fine — the helpers are pure over env).
async function mod() { return import("../e2e-test-identity"); }

describe("P8.6 E2E identity — availability is fail-closed", () => {
  it("available only with mode + secret, outside production", async () => {
    const m = await mod();
    env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "ephemeral-e2e-secret"; env.NODE_ENV = "test";
    expect(m.isE2EModeEnabled()).toBe(true);
    expect(m.isE2EIdentityAvailable()).toBe(true);
    // no secret → unavailable
    delete env.PIERRE_E2E_SECRET;
    expect(m.isE2EIdentityAvailable()).toBe(false);
    // no flag → unavailable
    env.PIERRE_E2E_SECRET = "ephemeral-e2e-secret"; delete env.PIERRE_E2E_TEST_MODE;
    expect(m.isE2EModeEnabled()).toBe(false);
    expect(m.isE2EIdentityAvailable()).toBe(false);
    // production → unavailable even with mode + secret
    env.PIERRE_E2E_TEST_MODE = "1"; env.NODE_ENV = "production";
    expect(m.isE2EModeEnabled()).toBe(false);
    expect(m.isE2EIdentityAvailable()).toBe(false);
  });

  it("signs + verifies a token, stripping any injected authority", async () => {
    const m = await mod();
    env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "ephemeral-e2e-secret"; env.NODE_ENV = "test";
    // sign accepts only id/email/email_verified
    const token = m.signE2EIdentity({ user_id: "u-1", email: "owner@e2e.test", email_verified: true });
    const id = m.verifyE2EIdentity(token);
    expect(id).toEqual({ user_id: "u-1", email: "owner@e2e.test", email_verified: true });
    // a forged token that smuggles role/company/entitlement: verify returns ONLY id+email+verified
    const forgedBody = Buffer.from(JSON.stringify({ user_id: "u-2", email: "x@e2e.test", email_verified: true, role: "owner", company_id: "c-evil", entitlement: "active", permissions: ["*"] })).toString("base64url");
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", "ephemeral-e2e-secret").update(forgedBody).digest("base64url");
    const stripped = m.verifyE2EIdentity(`${forgedBody}.${sig}`);
    expect(stripped).toEqual({ user_id: "u-2", email: "x@e2e.test", email_verified: true });
    expect((stripped as Record<string, unknown>).role).toBeUndefined();
    expect((stripped as Record<string, unknown>).company_id).toBeUndefined();
    expect((stripped as Record<string, unknown>).entitlement).toBeUndefined();
  });

  it("rejects a wrong-secret token and the operator secret check is constant-time-correct", async () => {
    const m = await mod();
    env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "ephemeral-e2e-secret"; env.NODE_ENV = "test";
    const token = m.signE2EIdentity({ user_id: "u-1", email: "a@e2e.test", email_verified: true });
    // tamper the signature
    expect(m.verifyE2EIdentity(token.slice(0, -2) + "zz")).toBeNull();
    // operator secret check
    expect(m.checkE2ESecret("ephemeral-e2e-secret")).toBe(true);
    expect(m.checkE2ESecret("wrong")).toBe(false);
    expect(m.checkE2ESecret(null)).toBe(false);
  });

  it("signing throws and verifying returns null when the surface is unavailable (production)", async () => {
    const m = await mod();
    env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "ephemeral-e2e-secret"; env.NODE_ENV = "test";
    const token = m.signE2EIdentity({ user_id: "u-1", email: "a@e2e.test", email_verified: true });
    // flip to production: verify must refuse, sign must throw
    env.NODE_ENV = "production";
    expect(m.verifyE2EIdentity(token)).toBeNull();
    expect(() => m.signE2EIdentity({ user_id: "u-1", email: "a@e2e.test", email_verified: true })).toThrow();
    expect(m.checkE2ESecret("ephemeral-e2e-secret")).toBe(false);
  });
});
