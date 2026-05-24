// src/lib/auth/__tests__/redirects.test.ts
// B31.5 — Pure unit tests for auth redirect helpers.

import { describe, it, expect } from "vitest";
import {
  getDefaultPostLoginPath,
  buildLoginRedirect,
  isPrivatePath,
} from "../redirects";

// ── getDefaultPostLoginPath ────────────────────────────────────

describe("getDefaultPostLoginPath", () => {
  it("returns /profile/agents (cockpit, not home)", () => {
    expect(getDefaultPostLoginPath()).toBe("/profile/agents");
  });

  it("does not return / (home)", () => {
    expect(getDefaultPostLoginPath()).not.toBe("/");
  });

  it("does not return /profile (generic dashboard)", () => {
    expect(getDefaultPostLoginPath()).not.toBe("/profile");
  });
});

// ── buildLoginRedirect ──────────────────────────────────────────

describe("buildLoginRedirect", () => {
  it("returns /login for empty string", () => {
    expect(buildLoginRedirect("")).toBe("/login");
  });

  it("returns /login for /", () => {
    expect(buildLoginRedirect("/")).toBe("/login");
  });

  it("encodes /agents/pierre/use", () => {
    expect(buildLoginRedirect("/agents/pierre/use")).toBe(
      "/login?redirect=%2Fagents%2Fpierre%2Fuse"
    );
  });

  it("encodes /profile", () => {
    expect(buildLoginRedirect("/profile")).toBe("/login?redirect=%2Fprofile");
  });

  it("encodes checkout path with query string", () => {
    const result = buildLoginRedirect("/checkout?agent=pierre");
    expect(result).toMatch(/^\/login\?redirect=/);
    // The raw query string must be encoded — never raw in URL
    expect(result).not.toContain("?agent=pierre");
    expect(result).toContain("%3F");
  });

  it("never puts a token or secret in the redirect URL", () => {
    const result = buildLoginRedirect("/profile/agents");
    expect(result).not.toContain("token");
    expect(result).not.toContain("Bearer");
  });

  it("preserves the path in the redirect param", () => {
    const result = buildLoginRedirect("/profile/agents");
    expect(decodeURIComponent(result.split("redirect=")[1])).toBe(
      "/profile/agents"
    );
  });
});

// ── isPrivatePath ──────────────────────────────────────────────

describe("isPrivatePath", () => {
  it("/agents/pierre/use is private", () => {
    expect(isPrivatePath("/agents/pierre/use")).toBe(true);
  });

  it("/profile is private", () => {
    expect(isPrivatePath("/profile")).toBe(true);
  });

  it("/profile/agents is private", () => {
    expect(isPrivatePath("/profile/agents")).toBe(true);
  });

  it("/profile/messages is private", () => {
    expect(isPrivatePath("/profile/messages")).toBe(true);
  });

  it("/profile sub-paths are private", () => {
    expect(isPrivatePath("/profile/agents/detail")).toBe(true);
    expect(isPrivatePath("/profile/messages/123")).toBe(true);
  });

  it("/ is NOT private", () => {
    expect(isPrivatePath("/")).toBe(false);
  });

  it("/login is NOT private", () => {
    expect(isPrivatePath("/login")).toBe(false);
  });

  it("/signup is NOT private", () => {
    expect(isPrivatePath("/signup")).toBe(false);
  });

  it("/agents is NOT private (public catalog)", () => {
    expect(isPrivatePath("/agents")).toBe(false);
  });

  it("/checkout is NOT private (payment flow shows its own auth gate)", () => {
    expect(isPrivatePath("/checkout")).toBe(false);
  });

  it("/questions is NOT private", () => {
    expect(isPrivatePath("/questions")).toBe(false);
  });
});
