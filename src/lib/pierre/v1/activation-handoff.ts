// src/lib/pierre/v1/activation-handoff.ts
// PHASE 8.6 — non-forgeable commercial handoff for customer activation (spec §4/§14).
//
// The activation requestor's IDENTITY comes from the authenticated session (never a body field). The
// commercial proof comes from EITHER a signed, short-TTL handoff token (bound to a persisted commercial
// reference + product) OR the explicit Paid-Customer-Test mode (non-production only). The handoff token
// carries NO authoritative paid status, NO owner role, NO company_id — only a reference to a persisted
// commercial event/order. In production, with no valid proof, NO activation is possible.

import { createHmac, timingSafeEqual } from "crypto";

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Paid-Customer-Test mode: allowed ONLY in NODE_ENV=test, or non-production + an explicit server flag.
 *  NEVER in production. */
export function isPaidCustomerTestModeEnabled(): boolean {
  if (isProductionEnv()) return false;
  if (process.env.NODE_ENV === "test") return true;
  return process.env.PIERRE_PAID_CUSTOMER_TEST_MODE === "1";
}

/** Handoff claims — deliberately NO paid/owner/company fields (those are never client authorities). */
export type HandoffClaims = {
  commercial_reference: string;
  product_key: string;
  account_email?: string | null;
  /** Unix seconds expiry. */
  exp: number;
};

function handoffSecret(): string | null {
  return process.env.PIERRE_HANDOFF_TOKEN_SECRET ?? null;
}

/** Sign a handoff token (HMAC-SHA256). Throws if the secret is unset (fail-closed). */
export function signHandoffToken(claims: HandoffClaims): string {
  const s = handoffSecret();
  if (!s) throw new Error("handoff token secret not configured (PIERRE_HANDOFF_TOKEN_SECRET)");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", s).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Verify a handoff token: signature (constant-time) + expiry. Returns null on any failure. */
export function verifyHandoffToken(token: string, nowMs = Date.now()): HandoffClaims | null {
  const s = handoffSecret();
  if (!s || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", s).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: HandoffClaims;
  try { claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as HandoffClaims; } catch { return null; }
  if (!claims || typeof claims.commercial_reference !== "string" || typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(nowMs / 1000)) return null;
  return claims;
}

export type ResolvedActivationProof = {
  commercial_reference: string;
  product_key: string;
  source_type: "stripe_subscription" | "paid_customer_test";
};

/**
 * Resolve the commercial proof that authorizes an activation. A signed handoff token wins; else, only in
 * Paid-Customer-Test mode, an explicit test reference is accepted. Production without a valid token → null
 * (no activation). The owner/requestor identity is NOT part of this — it always comes from the session.
 */
export function resolveActivationProof(input: {
  handoff_token?: string | null;
  test_commercial_reference?: string | null;
  product_key?: string;
}): ResolvedActivationProof | null {
  if (input.handoff_token) {
    const claims = verifyHandoffToken(input.handoff_token);
    if (!claims) return null;
    return { commercial_reference: claims.commercial_reference, product_key: claims.product_key || "pierre", source_type: "stripe_subscription" };
  }
  if (isPaidCustomerTestModeEnabled() && input.test_commercial_reference) {
    return { commercial_reference: input.test_commercial_reference, product_key: input.product_key || "pierre", source_type: "paid_customer_test" };
  }
  return null;
}
