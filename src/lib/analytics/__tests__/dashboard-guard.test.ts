import { describe, it, expect, beforeEach } from "vitest";
import { resolveAnalyticsDashboardAccess, FUNNEL_V1_STAGE_ORDER } from "../dashboard-guard";
import { CANONICAL_EVENT_NAMES } from "../schema";

describe("analytics dashboard guard — fail-closed by default", () => {
  beforeEach(() => {
    delete process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
    delete process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET;
  });

  it("returns notfound when the slug doesn't match the configured owner cockpit slug", async () => {
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "expected-slug";
    const result = await resolveAnalyticsDashboardAccess({
      slug: "wrong-slug",
      cookieHeader: null,
      loginReturnPath: "/internal/wrong-slug/command-center/analytics",
    });
    expect(result.kind).toBe("notfound");
  });

  it("returns notfound (never a data leak) when the owner cockpit slug is not configured at all", async () => {
    const result = await resolveAnalyticsDashboardAccess({
      slug: "anything",
      cookieHeader: null,
      loginReturnPath: "/internal/anything/command-center/analytics",
    });
    expect(result.kind).toBe("notfound");
  });

  it("returns notfound when the slug matches but the owner gate secret is unconfigured (misconfigured ⇒ never treated as open access)", async () => {
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "expected-slug";
    const result = await resolveAnalyticsDashboardAccess({
      slug: "expected-slug",
      cookieHeader: null,
      loginReturnPath: "/internal/expected-slug/command-center/analytics",
    });
    expect(result.kind).toBe("notfound");
  });

  it("stays notfound (never partially open) when only slug+secret are set but the owner password hash is absent — isOwnerGateConfigured() requires all three (mirrors founder-access's own owner-gate-deployment-contract.test.ts)", async () => {
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "expected-slug";
    process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET = "test-secret";
    const result = await resolveAnalyticsDashboardAccess({
      slug: "expected-slug",
      cookieHeader: null,
      loginReturnPath: "/internal/expected-slug/command-center/analytics",
    });
    // Configuration partielle ⇒ jamais un accès, même partiel : "notfound", pas "ready".
    expect(result.kind).toBe("notfound");
  });

  it("never returns 'ready' data for a tampered/forged owner-gate cookie, regardless of configuration state", async () => {
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG = "expected-slug";
    process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET = "test-secret";
    const result = await resolveAnalyticsDashboardAccess({
      slug: "expected-slug",
      cookieHeader: "cs_owner_gate=forged.notavalidsignature",
      loginReturnPath: "/internal/expected-slug/command-center/analytics",
    });
    expect(result.kind).not.toBe("ready");
  });
});

describe("FUNNEL_V1_STAGE_ORDER", () => {
  it("every stage in the dashboard's stage order is a real canonical event name", () => {
    for (const stage of FUNNEL_V1_STAGE_ORDER) {
      expect((CANONICAL_EVENT_NAMES as readonly string[]).includes(stage)).toBe(true);
    }
  });

  it("has no duplicate stages", () => {
    expect(new Set(FUNNEL_V1_STAGE_ORDER).size).toBe(FUNNEL_V1_STAGE_ORDER.length);
  });
});
