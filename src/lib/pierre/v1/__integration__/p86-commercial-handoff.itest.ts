// src/lib/pierre/v1/__integration__/p86-commercial-handoff.itest.ts
// PHASE 8.6 — the commercial handoff + Paid-Customer-Test mode are non-forgeable. A handoff token is
// HMAC-signed, short-TTL, and carries NO paid/owner/company authority. Paid-Customer-Test mode is
// available ONLY outside production (NODE_ENV=test or non-prod + explicit flag). In production with no
// valid token, NO commercial proof resolves → no activation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  signHandoffToken, verifyHandoffToken, resolveActivationProof, isPaidCustomerTestModeEnabled, isProductionEnv,
} from "../activation-handoff";

// process.env.NODE_ENV is typed readonly; this writable view lets the test simulate prod/non-prod.
const env = process.env as Record<string, string | undefined>;
const SECRET = "test-handoff-secret-please-rotate";
let savedSecret: string | undefined;
let savedNodeEnv: string | undefined;
let savedFlag: string | undefined;

beforeAll(() => {
  savedSecret = process.env.PIERRE_HANDOFF_TOKEN_SECRET;
  savedNodeEnv = process.env.NODE_ENV;
  savedFlag = process.env.PIERRE_PAID_CUSTOMER_TEST_MODE;
  process.env.PIERRE_HANDOFF_TOKEN_SECRET = SECRET;
});
afterAll(() => {
  if (savedSecret === undefined) delete process.env.PIERRE_HANDOFF_TOKEN_SECRET; else process.env.PIERRE_HANDOFF_TOKEN_SECRET = savedSecret;
  if (savedNodeEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = savedNodeEnv;
  if (savedFlag === undefined) delete process.env.PIERRE_PAID_CUSTOMER_TEST_MODE; else process.env.PIERRE_PAID_CUSTOMER_TEST_MODE = savedFlag;
});

const future = () => Math.floor(Date.now() / 1000) + 3600;

describe("P8.6 handoff token is signed + non-forgeable", () => {
  it("round-trips a valid token and carries no paid/owner/company authority", () => {
    const token = signHandoffToken({ commercial_reference: "sub_123", product_key: "pierre", account_email: "a@b.c", exp: future() });
    const claims = verifyHandoffToken(token);
    expect(claims).not.toBeNull();
    expect(claims!.commercial_reference).toBe("sub_123");
    // the claims shape has no paid/owner/company fields (the only authority is a commercial reference)
    expect(Object.keys(claims!).sort()).toEqual(["account_email", "commercial_reference", "exp", "product_key"]);
    expect((claims as Record<string, unknown>).paid).toBeUndefined();
    expect((claims as Record<string, unknown>).owner_user_id).toBeUndefined();
    expect((claims as Record<string, unknown>).company_id).toBeUndefined();
  });

  it("rejects a tampered signature and an expired token", () => {
    const token = signHandoffToken({ commercial_reference: "sub_x", product_key: "pierre", exp: future() });
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(verifyHandoffToken(tampered)).toBeNull();
    // forged body with a valid-looking structure but wrong signature
    const forged = Buffer.from(JSON.stringify({ commercial_reference: "evil", product_key: "pierre", exp: future() })).toString("base64url") + ".deadbeef";
    expect(verifyHandoffToken(forged)).toBeNull();
    // expired
    const expired = signHandoffToken({ commercial_reference: "sub_old", product_key: "pierre", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifyHandoffToken(expired)).toBeNull();
  });

  it("without a configured secret, verification fails closed", () => {
    const token = signHandoffToken({ commercial_reference: "sub_y", product_key: "pierre", exp: future() });
    delete process.env.PIERRE_HANDOFF_TOKEN_SECRET;
    expect(verifyHandoffToken(token)).toBeNull();
    process.env.PIERRE_HANDOFF_TOKEN_SECRET = SECRET;
  });
});

describe("P8.6 Paid-Customer-Test mode is non-production only", () => {
  it("is enabled under NODE_ENV=test, disabled in production even with the flag set", () => {
    env.NODE_ENV = "test";
    expect(isPaidCustomerTestModeEnabled()).toBe(true);
    env.NODE_ENV = "production";
    process.env.PIERRE_PAID_CUSTOMER_TEST_MODE = "1";
    expect(isProductionEnv()).toBe(true);
    expect(isPaidCustomerTestModeEnabled()).toBe(false); // never in production, even with the flag
    env.NODE_ENV = "development";
    expect(isPaidCustomerTestModeEnabled()).toBe(true); // non-prod + explicit flag
    delete process.env.PIERRE_PAID_CUSTOMER_TEST_MODE;
    expect(isPaidCustomerTestModeEnabled()).toBe(false); // non-prod without the flag
    env.NODE_ENV = "test";
  });
});

describe("P8.6 resolveActivationProof", () => {
  it("resolves from a valid handoff token (stripe_subscription source)", () => {
    env.NODE_ENV = "test";
    const token = signHandoffToken({ commercial_reference: "sub_resolve", product_key: "pierre", exp: future() });
    const proof = resolveActivationProof({ handoff_token: token });
    expect(proof).toEqual({ commercial_reference: "sub_resolve", product_key: "pierre", source_type: "stripe_subscription" });
  });

  it("resolves a test reference ONLY in test mode (paid_customer_test source)", () => {
    env.NODE_ENV = "test";
    const proof = resolveActivationProof({ test_commercial_reference: "test_ref_1" });
    expect(proof?.source_type).toBe("paid_customer_test");
    // in production, the same test reference resolves to NOTHING (no activation possible)
    env.NODE_ENV = "production";
    delete process.env.PIERRE_PAID_CUSTOMER_TEST_MODE;
    expect(resolveActivationProof({ test_commercial_reference: "test_ref_1" })).toBeNull();
    // and a tampered/absent token in production also yields nothing
    expect(resolveActivationProof({ handoff_token: "not-a-real-token" })).toBeNull();
    env.NODE_ENV = "test";
  });
});
