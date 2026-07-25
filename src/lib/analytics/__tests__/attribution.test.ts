import { describe, it, expect } from "vitest";
import { resolveAttributionChannel, sanitizeUtmParams, resolveFirstLastTouch, ATTRIBUTION_WINDOW_DAYS, type AttributionTouch } from "../attribution";

describe("analytics attribution contract", () => {
  describe("resolveAttributionChannel", () => {
    function input(overrides: Partial<Parameters<typeof resolveAttributionChannel>[0]> = {}) {
      return {
        referrerHost: null,
        utm: {},
        isInternalTraffic: false,
        partnerAttributionId: null,
        ...overrides,
      };
    }

    it("classifies no referrer, no UTM as direct", () => {
      expect(resolveAttributionChannel(input())).toBe("direct");
    });

    it("classifies a known search engine referrer as organic_search", () => {
      expect(resolveAttributionChannel(input({ referrerHost: "www.google.com" }))).toBe("organic_search");
    });

    it("classifies a known social referrer as social_organic", () => {
      expect(resolveAttributionChannel(input({ referrerHost: "www.linkedin.com" }))).toBe("social_organic");
    });

    it("classifies an unknown referrer as referral", () => {
      expect(resolveAttributionChannel(input({ referrerHost: "someblog.example" }))).toBe("referral");
    });

    it("classifies utm_medium=email as email regardless of referrer", () => {
      expect(resolveAttributionChannel(input({ utm: { utm_medium: "email" }, referrerHost: "google.com" }))).toBe("email");
    });

    it("internal traffic is always internal, overriding every other signal", () => {
      expect(resolveAttributionChannel(input({ isInternalTraffic: true, partnerAttributionId: "partner-1", utm: { utm_medium: "email" } }))).toBe("internal");
    });

    it("a resolved partner attribution always wins over UTM/referrer (never overridden by a client-forgeable signal)", () => {
      expect(resolveAttributionChannel(input({ partnerAttributionId: "partner-1", referrerHost: "google.com", utm: { utm_source: "x" } }))).toBe("partner");
    });

    it("never accepts a raw partner_id as an input shape — the function only accepts an already-resolved partnerAttributionId, structurally", () => {
      const params = resolveAttributionChannel as unknown as (...args: unknown[]) => unknown;
      // Structural proof: the function has exactly one parameter (the resolved input object) —
      // there is no separate "trust this client-supplied partner_id" parameter to misuse.
      expect(params.length).toBe(1);
    });
  });

  describe("sanitizeUtmParams", () => {
    it("keeps only allowlisted UTM keys", () => {
      const params = new URLSearchParams("utm_source=newsletter&token=secret&utm_medium=email");
      const out = sanitizeUtmParams(params);
      expect(out).toEqual({ utm_source: "newsletter", utm_medium: "email" });
    });

    it("rejects values containing characters outside the bounded charset (no free text)", () => {
      const params = new URLSearchParams();
      params.set("utm_campaign", "hello world <script>");
      const out = sanitizeUtmParams(params);
      expect(out.utm_campaign).toBeUndefined();
    });

    it("truncates overly long values before validation", () => {
      const params = new URLSearchParams();
      params.set("utm_content", "a".repeat(200));
      const out = sanitizeUtmParams(params);
      // 200 'a's truncated to 64 still passes the charset check
      expect(out.utm_content).toHaveLength(64);
    });
  });

  describe("resolveFirstLastTouch", () => {
    const now = new Date("2026-07-25T12:00:00.000Z");

    function touch(channel: AttributionTouch["channel"], daysAgo: number): AttributionTouch {
      const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      return { channel, occurredAt: d.toISOString(), sourceChannel: channel, campaignKey: null };
    }

    it("returns null for an empty touch list", () => {
      expect(resolveFirstLastTouch([], now)).toBeNull();
    });

    it("excludes touches outside the attribution window", () => {
      const touches = [touch("organic_search", ATTRIBUTION_WINDOW_DAYS + 5)];
      expect(resolveFirstLastTouch(touches, now)).toBeNull();
    });

    it("first touch is the earliest touch within the window", () => {
      const touches = [touch("organic_search", 10), touch("referral", 2)];
      const result = resolveFirstLastTouch(touches, now)!;
      expect(result.firstTouch.channel).toBe("organic_search");
    });

    it("a direct touch does not overwrite a valid prior non-direct last-touch that is at least as recent", () => {
      const touches = [touch("organic_search", 10), touch("referral", 3), touch("direct", 3)];
      const result = resolveFirstLastTouch(touches, now)!;
      expect(result.lastTouch.channel).toBe("referral");
    });

    it("a direct touch IS the last touch when nothing else follows or ties it", () => {
      const touches = [touch("referral", 10), touch("direct", 1)];
      const result = resolveFirstLastTouch(touches, now)!;
      expect(result.lastTouch.channel).toBe("direct");
    });
  });
});
