// src/lib/pierre/v1/e2e-test-identity.ts
// PHASE 8.6 — TEST-ONLY signed identity boundary for deterministic LOCAL Playwright E2E. It mints/reads a
// signed cookie carrying ONLY a user_id + verified email — NO role, NO company_id, NO entitlement. Roles,
// permissions, product access, tenants are ALWAYS resolved from the real DB. It is reachable ONLY when
// PIERRE_E2E_TEST_MODE=1, NODE_ENV!=='production', and a non-empty PIERRE_E2E_SECRET is configured; it is
// fail-closed otherwise (verified by p86-e2e-identity-failclosed.itest.ts). It never touches production auth.

import { createHmac, timingSafeEqual } from "crypto";

export const E2E_SESSION_COOKIE = "pierre_e2e_session";

export function isE2EModeEnabled(): boolean {
  return process.env.PIERRE_E2E_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}
function e2eSecret(): string | null {
  const s = process.env.PIERRE_E2E_SECRET;
  return s && s.length >= 8 ? s : null;
}
/** The E2E identity surface is usable only in test mode WITH a configured secret. */
export function isE2EIdentityAvailable(): boolean {
  return isE2EModeEnabled() && e2eSecret() !== null;
}

export type E2EIdentity = { user_id: string; email: string; email_verified: boolean };

/** Sign an identity token (HMAC-SHA256). Throws if the surface is unavailable (fail-closed). */
export function signE2EIdentity(identity: E2EIdentity): string {
  if (!isE2EIdentityAvailable()) throw new Error("E2E identity is not available (mode/secret)");
  const body = Buffer.from(JSON.stringify({
    user_id: identity.user_id, email: identity.email, email_verified: !!identity.email_verified,
  })).toString("base64url");
  const sig = createHmac("sha256", e2eSecret()!).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Verify a signed identity token. Returns null on any failure or when the surface is unavailable. */
export function verifyE2EIdentity(token: string | undefined | null): E2EIdentity | null {
  if (!isE2EIdentityAvailable() || !token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", e2eSecret()!).update(body).digest("base64url");
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<E2EIdentity>;
    if (typeof o.user_id !== "string" || typeof o.email !== "string") return null;
    // hard strip any injected authority: only id + verified email survive.
    return { user_id: o.user_id, email: o.email, email_verified: o.email_verified === true };
  } catch { return null; }
}

/** Read the signed identity from a request's cookies (test mode only). */
export function readE2EIdentityFromRequest(req: Request): E2EIdentity | null {
  if (!isE2EIdentityAvailable()) return null;
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.split(/;\s*/).find((c) => c.startsWith(`${E2E_SESSION_COOKIE}=`));
  if (!m) return null;
  return verifyE2EIdentity(decodeURIComponent(m.slice(E2E_SESSION_COOKIE.length + 1)));
}

/** Constant-time check of the operator E2E secret presented by control-plane routes. Gated by E2E mode
 *  so it is inert outside test mode / in production (defense-in-depth on top of each route's own guard). */
export function checkE2ESecret(presented: string | null | undefined): boolean {
  if (!isE2EModeEnabled()) return false;
  const s = e2eSecret();
  if (!s || !presented) return false;
  const a = Buffer.from(presented); const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}
