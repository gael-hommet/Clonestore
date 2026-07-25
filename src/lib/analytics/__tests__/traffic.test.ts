import { describe, it, expect } from "vitest";
import { classifyTraffic } from "../traffic";

function base() {
  return {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    internalCookieValue: null as string | null,
    internalCookieValid: false,
    isAuthenticatedOwner: false,
    isLocalEnvironment: false,
    isAdminRoute: false,
    testHeaderPresent: false,
    environment: "production" as const,
  };
}

describe("analytics traffic classification", () => {
  it("classifies a plain browser visit in production as external", () => {
    expect(classifyTraffic(base())).toBe("external");
  });

  it("classifies a known bot user-agent as automated, even in production", () => {
    expect(classifyTraffic({ ...base(), userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" })).toBe("automated");
  });

  it("classifies a headless-chrome UA as automated", () => {
    expect(classifyTraffic({ ...base(), userAgent: "Mozilla/5.0 HeadlessChrome/120.0" })).toBe("automated");
  });

  it("classifies an authenticated owner as internal", () => {
    expect(classifyTraffic({ ...base(), isAuthenticatedOwner: true })).toBe("internal");
  });

  it("classifies a valid signed internal cookie as internal", () => {
    expect(classifyTraffic({ ...base(), internalCookieValid: true, internalCookieValue: "on" })).toBe("internal");
  });

  it("does NOT trust an internal cookie value that isn't the exact expected marker", () => {
    expect(classifyTraffic({ ...base(), internalCookieValid: true, internalCookieValue: "anything-else" })).toBe("external");
  });

  it("classifies local/dev environment as internal", () => {
    expect(classifyTraffic({ ...base(), environment: "development", isLocalEnvironment: true })).toBe("internal");
  });

  it("classifies an admin route as internal", () => {
    expect(classifyTraffic({ ...base(), isAdminRoute: true })).toBe("internal");
  });

  it("NEVER classifies as test in production, even with the test header present", () => {
    expect(classifyTraffic({ ...base(), testHeaderPresent: true, environment: "production" })).not.toBe("test");
  });

  it("classifies explicit test header as test outside production", () => {
    expect(classifyTraffic({ ...base(), testHeaderPresent: true, environment: "development" })).toBe("test");
  });

  it("classifies CI/test environment as test", () => {
    expect(classifyTraffic({ ...base(), environment: "test" })).toBe("test");
  });

  it("a bot UA always wins over internal/local signals — never misclassified as internal", () => {
    expect(classifyTraffic({ ...base(), userAgent: "Googlebot", isLocalEnvironment: true, environment: "development" })).toBe("automated");
  });

  it("classifies unknown (no user-agent header at all) distinctly from external", () => {
    expect(classifyTraffic({ ...base(), userAgent: null })).toBe("unknown");
  });
});
