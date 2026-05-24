// src/lib/auth/__tests__/login-helpers.test.ts
// B31.6 — Pure unit tests for login redirect validation helpers.

import { describe, it, expect } from "vitest";
import {
  isSafeRelativeRedirect,
  sanitizeAuthRedirect,
  resolvePostLoginRedirect,
} from "../login-helpers";

// ── isSafeRelativeRedirect ─────────────────────────────────────

describe("isSafeRelativeRedirect", () => {
  it("accepts /profile/agents", () => {
    expect(isSafeRelativeRedirect("/profile/agents")).toBe(true);
  });

  it("accepts /agents/pierre/use", () => {
    expect(isSafeRelativeRedirect("/agents/pierre/use")).toBe(true);
  });

  it("accepts /profile/messages", () => {
    expect(isSafeRelativeRedirect("/profile/messages")).toBe(true);
  });

  it("accepts /checkout?agent=pierre (relative with query)", () => {
    expect(isSafeRelativeRedirect("/checkout?agent=pierre")).toBe(true);
  });

  it("rejects // (protocol-relative, open redirect)", () => {
    expect(isSafeRelativeRedirect("//evil.com")).toBe(false);
  });

  it("rejects //evil.com/path (protocol-relative)", () => {
    expect(isSafeRelativeRedirect("//evil.com/path")).toBe(false);
  });

  it("rejects http://evil.com", () => {
    expect(isSafeRelativeRedirect("http://evil.com")).toBe(false);
  });

  it("rejects https://evil.com", () => {
    expect(isSafeRelativeRedirect("https://evil.com")).toBe(false);
  });

  it("rejects javascript:alert(1)", () => {
    expect(isSafeRelativeRedirect("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeRelativeRedirect("data:text/html,<h1>xss</h1>")).toBe(false);
  });

  it("rejects null", () => {
    expect(isSafeRelativeRedirect(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isSafeRelativeRedirect(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeRelativeRedirect("")).toBe(false);
  });

  it("rejects /", () => {
    expect(isSafeRelativeRedirect("/")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isSafeRelativeRedirect("   ")).toBe(false);
  });

  it("accepts path with leading/trailing spaces after trim", () => {
    expect(isSafeRelativeRedirect("  /profile  ")).toBe(true);
  });
});

// ── sanitizeAuthRedirect ──────────────────────────────────────

describe("sanitizeAuthRedirect", () => {
  it("returns trimmed path for valid input", () => {
    expect(sanitizeAuthRedirect("  /profile/agents  ")).toBe("/profile/agents");
  });

  it("returns null for protocol-relative URL", () => {
    expect(sanitizeAuthRedirect("//evil.com")).toBeNull();
  });

  it("returns null for http URL", () => {
    expect(sanitizeAuthRedirect("http://evil.com")).toBeNull();
  });

  it("returns null for javascript: URI", () => {
    expect(sanitizeAuthRedirect("javascript:void(0)")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(sanitizeAuthRedirect(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(sanitizeAuthRedirect(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(sanitizeAuthRedirect("")).toBeNull();
  });

  it("preserves /checkout?agent=pierre", () => {
    expect(sanitizeAuthRedirect("/checkout?agent=pierre")).toBe("/checkout?agent=pierre");
  });
});

// ── resolvePostLoginRedirect ──────────────────────────────────

describe("resolvePostLoginRedirect", () => {
  it("returns the default path for null", () => {
    const result = resolvePostLoginRedirect(null);
    expect(result).toBe("/profile/agents");
  });

  it("returns the default path for undefined", () => {
    expect(resolvePostLoginRedirect(undefined)).toBe("/profile/agents");
  });

  it("returns the default path for empty string", () => {
    expect(resolvePostLoginRedirect("")).toBe("/profile/agents");
  });

  it("returns sanitized valid path", () => {
    expect(resolvePostLoginRedirect("/profile/messages")).toBe("/profile/messages");
  });

  it("returns default path for malicious input, not the malicious URL", () => {
    const result = resolvePostLoginRedirect("http://evil.com");
    expect(result).toBe("/profile/agents");
    expect(result).not.toContain("evil");
  });

  it("returns default path for javascript: URI", () => {
    const result = resolvePostLoginRedirect("javascript:alert(1)");
    expect(result).toBe("/profile/agents");
  });

  it("returns /checkout?agent=pierre when given that redirect", () => {
    expect(resolvePostLoginRedirect("/checkout?agent=pierre")).toBe(
      "/checkout?agent=pierre"
    );
  });

  it("never returns a path starting with //", () => {
    const result = resolvePostLoginRedirect("//evil.com");
    expect(result.startsWith("//")).toBe(false);
  });
});
