// src/lib/pierre/cockpit/__tests__/cockpit-api-state.test.ts
// Tests for cockpit auth detection helpers — B31.2.

import { describe, it, expect } from "vitest";
import { isAuthFailure } from "../auth-helpers";

describe("isAuthFailure", () => {
  // ── 401 status ─────────────────────────────────────────────
  it("returns true for status 401 with any error", () => {
    expect(isAuthFailure(401, "anything")).toBe(true);
  });

  it("returns true for status 401 with null error", () => {
    expect(isAuthFailure(401, null)).toBe(true);
  });

  it("returns true for status 401 with undefined error", () => {
    expect(isAuthFailure(401, undefined)).toBe(true);
  });

  it("returns true for status 401 with empty string", () => {
    expect(isAuthFailure(401, "")).toBe(true);
  });

  // ── Auth error strings ─────────────────────────────────────
  it('returns true for "Auth session missing."', () => {
    expect(isAuthFailure(403, "Auth session missing.")).toBe(true);
  });

  it('returns true for "auth session missing" (lowercase)', () => {
    expect(isAuthFailure(403, "auth session missing")).toBe(true);
  });

  it('returns true for "AUTH SESSION MISSING" (uppercase)', () => {
    expect(isAuthFailure(200, "AUTH SESSION MISSING")).toBe(true);
  });

  it('returns true for "unauthorized"', () => {
    expect(isAuthFailure(403, "unauthorized")).toBe(true);
  });

  it('returns true for "Unauthorized" mixed case', () => {
    expect(isAuthFailure(0, "Unauthorized access")).toBe(true);
  });

  it('returns true for "no session"', () => {
    expect(isAuthFailure(0, "no session found")).toBe(true);
  });

  it('returns true for "not authenticated"', () => {
    expect(isAuthFailure(0, "user is not authenticated")).toBe(true);
  });

  it("returns true when message contains auth pattern among other text", () => {
    expect(isAuthFailure(500, "Internal error: Auth session missing. Please re-login.")).toBe(true);
  });

  // ── Non-auth errors ────────────────────────────────────────
  it("returns false for status 403 with non-auth error", () => {
    expect(isAuthFailure(403, "Access denied by policy")).toBe(false);
  });

  it("returns false for status 500 with server error", () => {
    expect(isAuthFailure(500, "Internal server error")).toBe(false);
  });

  it("returns false for status 0 with network error", () => {
    expect(isAuthFailure(0, "Erreur réseau")).toBe(false);
  });

  it("returns false for status 404 with not found", () => {
    expect(isAuthFailure(404, "Resource not found")).toBe(false);
  });

  it("returns false for status 422 with validation error", () => {
    expect(isAuthFailure(422, "Invalid input: mission required")).toBe(false);
  });

  it("returns false for status 200 with empty error", () => {
    expect(isAuthFailure(200, "")).toBe(false);
  });

  it("returns false for status 200 with null error", () => {
    expect(isAuthFailure(200, null)).toBe(false);
  });

  it("returns false for status 200 with undefined error", () => {
    expect(isAuthFailure(200, undefined)).toBe(false);
  });

  // ── Edge cases ─────────────────────────────────────────────
  it("returns false for status 0 with null error (pure network timeout)", () => {
    expect(isAuthFailure(0, null)).toBe(false);
  });

  it("returns false for partial match that is not an auth pattern", () => {
    expect(isAuthFailure(200, "Authorization header set correctly")).toBe(false);
  });

  it("returns true for status 401 regardless of a valid-looking response body", () => {
    expect(isAuthFailure(401, "Erreur 401")).toBe(true);
  });

  it("handles very long error strings containing auth pattern", () => {
    const longMsg = "x".repeat(500) + "auth session missing" + "y".repeat(500);
    expect(isAuthFailure(0, longMsg)).toBe(true);
  });

  it("handles very long error strings with no auth pattern", () => {
    const longMsg = "x".repeat(1000);
    expect(isAuthFailure(200, longMsg)).toBe(false);
  });
});
