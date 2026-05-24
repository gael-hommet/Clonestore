// src/lib/checkout/__tests__/checkout-helpers.test.ts
// B31.4 — Pure unit tests for checkout auth helpers.
// No Stripe, no Supabase, no mocking required.

import { describe, it, expect } from "vitest";
import {
  normalizeAgentSlug,
  buildCheckoutBody,
  buildCheckoutAuthHeaders,
  buildConfirmBody,
  sanitizeCheckoutError,
} from "../checkout-helpers";

// ── normalizeAgentSlug ──────────────────────────────────────────

describe("normalizeAgentSlug", () => {
  it("lowercases pierre", () => {
    expect(normalizeAgentSlug("pierre")).toBe("pierre");
  });

  it("lowercases Pierre (mixed case)", () => {
    expect(normalizeAgentSlug("Pierre")).toBe("pierre");
  });

  it("lowercases PIERRE (uppercase)", () => {
    expect(normalizeAgentSlug("PIERRE")).toBe("pierre");
  });

  it("trims whitespace", () => {
    expect(normalizeAgentSlug("  pierre  ")).toBe("pierre");
  });

  it("returns null for null", () => {
    expect(normalizeAgentSlug(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeAgentSlug(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeAgentSlug("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeAgentSlug("   ")).toBeNull();
  });

  it("normalizes other agents too", () => {
    expect(normalizeAgentSlug("Clara")).toBe("clara");
    expect(normalizeAgentSlug("ADRIEN")).toBe("adrien");
  });
});

// ── buildCheckoutBody ───────────────────────────────────────────

describe("buildCheckoutBody", () => {
  it("contains agent_slug", () => {
    const body = buildCheckoutBody("pierre");
    expect(body.agent_slug).toBe("pierre");
  });

  it("does NOT contain user_id — server derives it from Bearer", () => {
    const body = buildCheckoutBody("pierre");
    expect(body).not.toHaveProperty("user_id");
  });

  it("only has agent_slug key", () => {
    const body = buildCheckoutBody("pierre");
    expect(Object.keys(body)).toEqual(["agent_slug"]);
  });

  it("preserves the agent slug verbatim", () => {
    const body = buildCheckoutBody("clara");
    expect(body.agent_slug).toBe("clara");
  });
});

// ── buildCheckoutAuthHeaders ────────────────────────────────────

describe("buildCheckoutAuthHeaders", () => {
  it("returns null for null token (AUTH_REQUIRED signal)", () => {
    expect(buildCheckoutAuthHeaders(null)).toBeNull();
  });

  it("creates Bearer authorization header", () => {
    const headers = buildCheckoutAuthHeaders("tok_abc123");
    expect(headers?.Authorization).toBe("Bearer tok_abc123");
  });

  it("sets Content-Type to application/json", () => {
    const headers = buildCheckoutAuthHeaders("tok_abc123");
    expect(headers?.["Content-Type"]).toBe("application/json");
  });

  it("does not put token in Content-Type or any non-auth key", () => {
    const headers = buildCheckoutAuthHeaders("my-secret-token");
    const values = Object.values(headers ?? {}).join(" ");
    // Token must appear exactly once, in Authorization
    const matches = values.match(/my-secret-token/g);
    expect(matches).toHaveLength(1);
    expect(headers?.Authorization).toContain("my-secret-token");
  });

  it("never leaks token into Content-Type value", () => {
    const headers = buildCheckoutAuthHeaders("sensitive-token");
    expect(headers?.["Content-Type"]).not.toContain("sensitive-token");
  });
});

// ── sanitizeCheckoutError ───────────────────────────────────────

describe("sanitizeCheckoutError", () => {
  it('sanitizes "Missing user_id/agent_slug" — must never show raw to user', () => {
    const result = sanitizeCheckoutError(null, "Missing user_id/agent_slug");
    expect(result).not.toBe("Missing user_id/agent_slug");
    expect(result.toLowerCase()).toContain("connexion");
  });

  it("sanitizes STRIPE_NOT_CONFIGURED code", () => {
    const result = sanitizeCheckoutError("STRIPE_NOT_CONFIGURED", "Missing STRIPE_SECRET_KEY");
    expect(result).toContain("configuré");
    expect(result).not.toContain("STRIPE_SECRET_KEY");
    expect(result).not.toContain("STRIPE_NOT_CONFIGURED");
  });

  it("sanitizes PRICE_NOT_CONFIGURED code", () => {
    const result = sanitizeCheckoutError("PRICE_NOT_CONFIGURED", "No price for agent");
    expect(result).toContain("configuré");
    expect(result).not.toContain("PRICE_NOT_CONFIGURED");
  });

  it("sanitizes AUTH_REQUIRED code", () => {
    const result = sanitizeCheckoutError("AUTH_REQUIRED", "Auth session missing.");
    expect(result.toLowerCase()).toContain("connexion");
    expect(result).not.toContain("AUTH_REQUIRED");
    expect(result).not.toContain("auth session missing");
  });

  it("sanitizes AUTH_INVALID code", () => {
    const result = sanitizeCheckoutError("AUTH_INVALID", "Session invalide.");
    expect(result.toLowerCase()).toContain("connexion");
  });

  it("sanitizes AGENT_SLUG_REQUIRED code", () => {
    const result = sanitizeCheckoutError("AGENT_SLUG_REQUIRED", "Employé IA introuvable.");
    expect(result.toLowerCase()).toContain("agent");
  });

  it("returns fallback for null/null", () => {
    const result = sanitizeCheckoutError(null, null);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns fallback for undefined/undefined", () => {
    const result = sanitizeCheckoutError(undefined, undefined);
    expect(result).toBeTruthy();
  });

  it("passes through unknown user-friendly messages unchanged", () => {
    const msg = "Impossible de démarrer le paiement pour le moment.";
    const result = sanitizeCheckoutError(null, msg);
    expect(result).toBe(msg);
  });

  it("sanitizes CHECKOUT_NOT_CONFIRMED (activation pending)", () => {
    const result = sanitizeCheckoutError("CHECKOUT_NOT_CONFIRMED", null);
    expect(result).not.toContain("CHECKOUT_NOT_CONFIRMED");
    expect(result.length).toBeGreaterThan(10);
  });

  it("sanitizes SUBSCRIPTION_NOT_ACTIVE", () => {
    const result = sanitizeCheckoutError("SUBSCRIPTION_NOT_ACTIVE", null);
    expect(result).not.toContain("SUBSCRIPTION_NOT_ACTIVE");
  });

  it("sanitizes SESSION_USER_MISMATCH (security — never expose details)", () => {
    const result = sanitizeCheckoutError("SESSION_USER_MISMATCH", "user_id mismatch");
    expect(result).not.toContain("user_id");
    expect(result).not.toContain("SESSION_USER_MISMATCH");
    expect(result.toLowerCase()).toContain("session");
  });

  it("sanitizes SESSION_NOT_FOUND", () => {
    const result = sanitizeCheckoutError("SESSION_NOT_FOUND", null);
    expect(result).not.toContain("SESSION_NOT_FOUND");
    expect(result.toLowerCase()).toContain("session");
  });
});

// ── buildConfirmBody ────────────────────────────────────────────

describe("buildConfirmBody", () => {
  it("contains session_id and agent_slug", () => {
    const body = buildConfirmBody("cs_test_abc123", "pierre");
    expect(body.session_id).toBe("cs_test_abc123");
    expect(body.agent_slug).toBe("pierre");
  });

  it("does NOT contain user_id — server derives from Bearer", () => {
    const body = buildConfirmBody("cs_test_abc123", "pierre");
    expect(body).not.toHaveProperty("user_id");
  });

  it("only has session_id and agent_slug keys", () => {
    const body = buildConfirmBody("cs_test_abc123", "pierre");
    expect(Object.keys(body).sort()).toEqual(["agent_slug", "session_id"]);
  });

  it("preserves session_id verbatim", () => {
    const body = buildConfirmBody("cs_live_xyz789", "pierre");
    expect(body.session_id).toBe("cs_live_xyz789");
  });

  it("preserves agent_slug verbatim", () => {
    const body = buildConfirmBody("cs_test_abc", "clara");
    expect(body.agent_slug).toBe("clara");
  });
});
