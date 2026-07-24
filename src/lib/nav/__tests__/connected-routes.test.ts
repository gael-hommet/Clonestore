import { describe, it, expect } from "vitest";
import { isConnectedRoute, isAdminCockpitRoute, CONNECTED_ROUTE_PREFIXES } from "../connected-routes";

describe("isConnectedRoute", () => {
  it("matches every declared connected prefix, exactly and as a sub-path", () => {
    for (const prefix of CONNECTED_ROUTE_PREFIXES) {
      expect(isConnectedRoute(prefix)).toBe(true);
      expect(isConnectedRoute(`${prefix}/sub`)).toBe(true);
    }
  });

  it("does not match public marketing routes", () => {
    expect(isConnectedRoute("/")).toBe(false);
    expect(isConnectedRoute("/demo")).toBe(false);
  });

  it("is null/undefined-safe", () => {
    expect(isConnectedRoute(null)).toBe(false);
    expect(isConnectedRoute(undefined)).toBe(false);
  });
});

describe("isAdminCockpitRoute", () => {
  it("matches /founder and /internal, exactly and as a sub-path", () => {
    expect(isAdminCockpitRoute("/founder")).toBe(true);
    expect(isAdminCockpitRoute("/founder/readiness")).toBe(true);
    expect(isAdminCockpitRoute("/internal")).toBe(true);
    expect(isAdminCockpitRoute("/internal/some-slug/command-center")).toBe(true);
  });

  it("does not match public or connected-space routes", () => {
    expect(isAdminCockpitRoute("/")).toBe(false);
    expect(isAdminCockpitRoute("/demo")).toBe(false);
    expect(isAdminCockpitRoute("/profile")).toBe(false);
    expect(isAdminCockpitRoute("/cockpit")).toBe(false);
  });

  it("is null/undefined-safe", () => {
    expect(isAdminCockpitRoute(null)).toBe(false);
    expect(isAdminCockpitRoute(undefined)).toBe(false);
  });

  it("is disjoint from isConnectedRoute — no prefix satisfies both", () => {
    const adminPaths = ["/founder", "/founder/x", "/internal", "/internal/x"];
    for (const p of adminPaths) {
      expect(isConnectedRoute(p)).toBe(false);
    }
  });
});
