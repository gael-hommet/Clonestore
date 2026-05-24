// src/lib/site-health/__tests__/site-health.test.ts
// B31.6 — Pure unit tests for site-health invariant checks.

import { describe, it, expect } from "vitest";
import {
  checkDefaultPostLoginPath,
  checkPrivatePathsNonEmpty,
  checkNoTokenInUrl,
  checkRedirectIsSafe,
  checkNoUserIdInCheckoutBody,
  checkErrorNotExposedRaw,
  checkPierreTrialDays,
  checkPierrePriceAmount,
  checkTrialingGrantsAccess,
  checkPerformanceBudgetConfig,
} from "../checks";

// ── checkDefaultPostLoginPath ──────────────────────────────────

describe("checkDefaultPostLoginPath", () => {
  it("passes for /profile/agents", () => {
    const result = checkDefaultPostLoginPath("/profile/agents");
    expect(result.status).toBe("pass");
  });

  it("fails for /", () => {
    const result = checkDefaultPostLoginPath("/");
    expect(result.status).toBe("fail");
  });

  it("fails for /profile (generic dashboard)", () => {
    const result = checkDefaultPostLoginPath("/profile");
    expect(result.status).toBe("fail");
  });

  it("fails for /dashboard", () => {
    const result = checkDefaultPostLoginPath("/dashboard");
    expect(result.status).toBe("fail");
  });

  it("includes the actual path in the message", () => {
    const result = checkDefaultPostLoginPath("/wrong-path");
    expect(result.message).toContain("/wrong-path");
  });
});

// ── checkPrivatePathsNonEmpty ──────────────────────────────────

describe("checkPrivatePathsNonEmpty", () => {
  it("passes (PRIVATE_PATHS is never empty)", () => {
    const result = checkPrivatePathsNonEmpty();
    expect(result.status).toBe("pass");
  });
});

// ── checkNoTokenInUrl ──────────────────────────────────────────

describe("checkNoTokenInUrl", () => {
  it("passes for normal path", () => {
    const result = checkNoTokenInUrl("/profile/agents");
    expect(result.status).toBe("pass");
  });

  it("fails when token= is in URL", () => {
    const result = checkNoTokenInUrl("/login?token=abc123");
    expect(result.status).toBe("fail");
  });

  it("fails when access_token= is in URL", () => {
    const result = checkNoTokenInUrl("/callback?access_token=xyz");
    expect(result.status).toBe("fail");
  });

  it("fails when refresh_token= is in URL", () => {
    const result = checkNoTokenInUrl("/callback?refresh_token=xyz");
    expect(result.status).toBe("fail");
  });

  it("passes for /checkout?agent=pierre (no token)", () => {
    const result = checkNoTokenInUrl("/checkout?agent=pierre");
    expect(result.status).toBe("pass");
  });

  it("name is 'no-token-in-url'", () => {
    expect(checkNoTokenInUrl("/safe").name).toBe("no-token-in-url");
  });
});

// ── checkRedirectIsSafe ─────────────────────────────────────────

describe("checkRedirectIsSafe", () => {
  it("passes when redirect is null", () => {
    const result = checkRedirectIsSafe(null);
    expect(result.status).toBe("pass");
  });

  it("passes when redirect is undefined", () => {
    const result = checkRedirectIsSafe(undefined);
    expect(result.status).toBe("pass");
  });

  it("passes for valid relative path", () => {
    const result = checkRedirectIsSafe("/profile/agents");
    expect(result.status).toBe("pass");
  });

  it("fails for http:// URL", () => {
    const result = checkRedirectIsSafe("http://evil.com");
    expect(result.status).toBe("fail");
  });

  it("fails for protocol-relative //evil.com", () => {
    const result = checkRedirectIsSafe("//evil.com");
    expect(result.status).toBe("fail");
  });

  it("fails for javascript: URI", () => {
    const result = checkRedirectIsSafe("javascript:void(0)");
    expect(result.status).toBe("fail");
  });
});

// ── checkNoUserIdInCheckoutBody ────────────────────────────────

describe("checkNoUserIdInCheckoutBody", () => {
  it("passes when body only has agent_slug", () => {
    const result = checkNoUserIdInCheckoutBody({ agent_slug: "pierre" });
    expect(result.status).toBe("pass");
  });

  it("fails when body has user_id", () => {
    const result = checkNoUserIdInCheckoutBody({
      agent_slug: "pierre",
      user_id: "user-abc",
    });
    expect(result.status).toBe("fail");
  });

  it("passes for empty body", () => {
    const result = checkNoUserIdInCheckoutBody({});
    expect(result.status).toBe("pass");
  });
});

// ── checkErrorNotExposedRaw ────────────────────────────────────

describe("checkErrorNotExposedRaw", () => {
  it("passes for generic user-facing error message", () => {
    const result = checkErrorNotExposedRaw(
      "Impossible de démarrer le paiement pour le moment."
    );
    expect(result.status).toBe("pass");
  });

  it("fails when Supabase is mentioned in error", () => {
    const result = checkErrorNotExposedRaw(
      "supabase: invalid JWT"
    );
    expect(result.status).toBe("fail");
  });

  it("fails when PostgREST error code appears", () => {
    const result = checkErrorNotExposedRaw("PGRST301: not found");
    expect(result.status).toBe("fail");
  });

  it("fails when node_modules appears in stack", () => {
    const result = checkErrorNotExposedRaw(
      "Error at Object.fn (node_modules/supabase/dist/main.js:12)"
    );
    expect(result.status).toBe("fail");
  });

  it("passes for connection error user message", () => {
    const result = checkErrorNotExposedRaw("Vérifiez votre connexion internet.");
    expect(result.status).toBe("pass");
  });
});

// ── B31.7 billing checks ───────────────────────────────────────

describe("checkPierreTrialDays", () => {
  it("passes for 7 days", () => {
    expect(checkPierreTrialDays(7).status).toBe("pass");
  });

  it("warns for 0 days (no trial)", () => {
    expect(checkPierreTrialDays(0).status).toBe("warn");
  });

  it("warns for 14 days (wrong value)", () => {
    expect(checkPierreTrialDays(14).status).toBe("warn");
  });
});

describe("checkPierrePriceAmount", () => {
  it("passes for 44900 cents (449 EUR)", () => {
    expect(checkPierrePriceAmount(44900).status).toBe("pass");
  });

  it("fails for 29900 cents (299 EUR)", () => {
    expect(checkPierrePriceAmount(29900).status).toBe("fail");
  });

  it("warns for null (not retrieved)", () => {
    expect(checkPierrePriceAmount(null).status).toBe("warn");
  });
});

describe("checkTrialingGrantsAccess", () => {
  it("passes when trialing is in active statuses", () => {
    expect(checkTrialingGrantsAccess(["active", "trialing"]).status).toBe("pass");
  });

  it("fails when trialing is missing from active statuses", () => {
    expect(checkTrialingGrantsAccess(["active"]).status).toBe("fail");
  });

  it("fails for empty list", () => {
    expect(checkTrialingGrantsAccess([]).status).toBe("fail");
  });
});

// ── B31.9 performance budget config ────────────────────────────

describe("checkPerformanceBudgetConfig", () => {
  it("passes with correct budget constants", () => {
    expect(checkPerformanceBudgetConfig().status).toBe("pass");
  });

  it("name is 'performance-budget-config'", () => {
    expect(checkPerformanceBudgetConfig().name).toBe("performance-budget-config");
  });

  it("message mentions instant threshold", () => {
    const result = checkPerformanceBudgetConfig();
    expect(result.message).toContain("instant=100ms");
  });

  it("message mentions critical threshold", () => {
    const result = checkPerformanceBudgetConfig();
    expect(result.message).toContain("critical=3000ms");
  });
});
