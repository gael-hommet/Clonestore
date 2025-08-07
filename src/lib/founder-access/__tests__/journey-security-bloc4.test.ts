// BLOC 4 — Reservation → Email → Auth → Activation closure.
// Non-regression for the journey's proof-of-possession + verification-token contract.
// Pure unit (no DB): exercises signed-cookie.ts and token.ts directly.
//
// Guards the two production defects fixed in BLOC 4:
//   #1 — a missing CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET must FAIL CLOSED (never authorize),
//        and a present secret must bind the proof to EXACTLY one reservation id (anti-IDOR).
//   #2 — verification tokens are single-use by hash + TTL; a replay/tamper is safely rejected.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildReservationCookie,
  reservationCookieAuthorizes,
  reservationCookieSecret,
  RESERVATION_COOKIE,
} from "../signed-cookie";
import { issueVerificationToken, verifyTokenHash, isExpired, hashToken } from "../token";

const SECRET_ENV = "CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let saved: string | undefined;
beforeEach(() => { saved = process.env[SECRET_ENV]; });
afterEach(() => { if (saved === undefined) delete process.env[SECRET_ENV]; else process.env[SECRET_ENV] = saved; });

function cookieHeaderFrom(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const first = setCookie.split(";")[0]; // NAME=VALUE
  return first;
}

describe("BLOC4 — reservation proof-of-possession (defect #1: cookie secret)", () => {
  it("with the secret configured, the cookie authorizes EXACTLY its own reservation id (anti-IDOR)", () => {
    process.env[SECRET_ENV] = "bloc4-test-secret-0123456789abcdef0123456789abcdef";
    expect(reservationCookieSecret()).toBeTruthy();
    const setCookie = buildReservationCookie(A);
    expect(setCookie).toContain(`${RESERVATION_COOKIE}=`);
    const header = cookieHeaderFrom(setCookie);
    expect(reservationCookieAuthorizes(header, A)).toBe(true); // own id → authorized
    expect(reservationCookieAuthorizes(header, B)).toBe(false); // other id → IDOR blocked
  });

  it("FAILS CLOSED when the secret is absent (this was the prod defect: 403 always, cookie never issued)", () => {
    delete process.env[SECRET_ENV];
    expect(reservationCookieSecret()).toBeNull();
    expect(buildReservationCookie(A)).toBeNull(); // no cookie issued at reservation time
    expect(reservationCookieAuthorizes(`${RESERVATION_COOKIE}=anything`, A)).toBe(false); // never authorizes
  });

  it("rejects a tampered cookie value", () => {
    process.env[SECRET_ENV] = "bloc4-test-secret-0123456789abcdef0123456789abcdef";
    const header = cookieHeaderFrom(buildReservationCookie(A));
    const tampered = (header ?? "").slice(0, -3) + "zzz";
    expect(reservationCookieAuthorizes(tampered, A)).toBe(false);
  });

  it("rejects a cookie signed with a different secret (key-substitution)", () => {
    process.env[SECRET_ENV] = "secret-one-0123456789abcdef0123456789abcdef00";
    const header = cookieHeaderFrom(buildReservationCookie(A));
    process.env[SECRET_ENV] = "secret-two-0123456789abcdef0123456789abcdef00";
    expect(reservationCookieAuthorizes(header, A)).toBe(false);
  });
});

describe("BLOC4 — verification token contract (defect #2: token safety / replay)", () => {
  it("issues a token whose hash verifies in constant time; wrong/empty are rejected", () => {
    const t = issueVerificationToken();
    expect(t.token).toBeTruthy();
    expect(t.hash).toBe(hashToken(t.token));
    expect(verifyTokenHash(t.token, t.hash)).toBe(true);
    expect(verifyTokenHash(t.token + "x", t.hash)).toBe(false); // tamper
    expect(verifyTokenHash("", t.hash)).toBe(false);
    expect(verifyTokenHash(t.token, null)).toBe(false); // no stored hash (already consumed) → reject
    expect(verifyTokenHash(t.token, undefined)).toBe(false);
  });

  it("never stores the plaintext token (only its hash) and two issuances differ", () => {
    const a = issueVerificationToken();
    const b = issueVerificationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(a.token); // hash is not the token
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
  });

  it("enforces an explicit TTL (expired/absent → expired; future → valid)", () => {
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isExpired(null)).toBe(true);
    expect(isExpired("not-a-date")).toBe(true);
    const t = issueVerificationToken();
    expect(isExpired(t.expiresAt)).toBe(false); // freshly issued is valid
  });
});
