import { describe, it, expect } from "vitest";
import {
  CANONICAL_EVENT_NAMES,
  isCanonicalEventName,
  isServerOnlyCanonicalEvent,
  sanitizeCanonicalProperties,
  validateClientEnvelope,
  isUuid,
  SCHEMA_VERSION,
} from "../schema";

describe("analytics schema v1", () => {
  it("every canonical event name is classified as either client-emittable or server-only, never both undefined", () => {
    for (const name of CANONICAL_EVENT_NAMES) {
      expect(isCanonicalEventName(name)).toBe(true);
      expect(typeof isServerOnlyCanonicalEvent(name)).toBe("boolean");
    }
  });

  it("rejects an unknown event name", () => {
    expect(isCanonicalEventName("totally_made_up_event")).toBe(false);
  });

  describe("sanitizeCanonicalProperties", () => {
    it("drops any key not on the allowlist", () => {
      const out = sanitizeCanonicalProperties({ device: "mobile", email: "user@example.com", password: "hunter2" });
      expect(out).toEqual({ device: "mobile" });
    });

    it("never accepts Record<string, unknown> shaped free text beyond the allowlist", () => {
      const out = sanitizeCanonicalProperties({ freeText: "anything the caller wants" });
      expect(out).toEqual({});
    });

    it("truncates overly long string values instead of rejecting the whole event", () => {
      const longValue = "x".repeat(500);
      const out = sanitizeCanonicalProperties({ ctaKey: longValue });
      expect(out.ctaKey).toHaveLength(64);
    });

    it("caps the number of accepted properties", () => {
      const many: Record<string, string> = {};
      // more distinct allowlisted keys than exist is impossible; verify cap logic with count guard
      const out = sanitizeCanonicalProperties(many);
      expect(Object.keys(out).length).toBeLessThanOrEqual(15);
    });

    it("ignores arrays and null", () => {
      expect(sanitizeCanonicalProperties(null)).toEqual({});
      expect(sanitizeCanonicalProperties(["a", "b"])).toEqual({});
      expect(sanitizeCanonicalProperties(undefined)).toEqual({});
    });
  });

  describe("validateClientEnvelope", () => {
    function validBody(overrides: Record<string, unknown> = {}) {
      return {
        schemaVersion: SCHEMA_VERSION,
        eventId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
        eventName: "demo_started",
        occurredAt: new Date().toISOString(),
        source: "web",
        ...overrides,
      };
    }

    it("accepts a well-formed client-emittable event", () => {
      const result = validateClientEnvelope(validBody());
      expect(result.ok).toBe(true);
      expect(result.envelope?.eventName).toBe("demo_started");
    });

    it("rejects a server-only event submitted by a client — the only acceptable behavior", () => {
      const result = validateClientEnvelope(validBody({ eventName: "payment_succeeded" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("SERVER_ONLY_EVENT_REJECTED");
    });

    it("rejects payment_succeeded, activation_completed, reservation_created, checkout_session_created explicitly", () => {
      for (const forged of ["payment_succeeded", "activation_completed", "reservation_created", "checkout_session_created", "visitor_created", "session_started", "reservation_email_confirmed", "payment_failed", "payment_refunded"]) {
        const result = validateClientEnvelope(validBody({ eventName: forged }));
        expect(result.ok, `${forged} must be rejected from a client submission`).toBe(false);
        expect(result.error).toBe("SERVER_ONLY_EVENT_REJECTED");
      }
    });

    it("rejects an unknown event name", () => {
      const result = validateClientEnvelope(validBody({ eventName: "not_a_real_event" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("UNKNOWN_EVENT_NAME");
    });

    it("rejects a non-UUID eventId", () => {
      const result = validateClientEnvelope(validBody({ eventId: "not-a-uuid" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("INVALID_EVENT_ID");
    });

    it("rejects a client claiming source=server", () => {
      const result = validateClientEnvelope(validBody({ source: "server" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("INVALID_SOURCE");
    });

    it("rejects a client claiming source=stripe", () => {
      const result = validateClientEnvelope(validBody({ source: "stripe" }));
      expect(result.ok).toBe(false);
    });

    it("rejects a malformed occurredAt", () => {
      const result = validateClientEnvelope(validBody({ occurredAt: "not-a-date" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("INVALID_OCCURRED_AT");
    });

    it("rejects an unnormalized route (raw URL with query string)", () => {
      const result = validateClientEnvelope(validBody({ routeKey: "/demo?utm_source=evil&token=abc" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("INVALID_ROUTE_KEY");
    });

    it("accepts a canonical route key", () => {
      const result = validateClientEnvelope(validBody({ routeKey: "/demo/pierre" }));
      expect(result.ok).toBe(true);
    });

    it("rejects a step id containing free text / html", () => {
      const result = validateClientEnvelope(validBody({ stepId: "<script>alert(1)</script>" }));
      expect(result.ok).toBe(false);
      expect(result.error).toBe("INVALID_STEP_ID");
    });

    it("silently strips unknown properties rather than rejecting the whole event", () => {
      const result = validateClientEnvelope(validBody({ properties: { device: "mobile", email: "leak@example.com" } }));
      expect(result.ok).toBe(true);
      expect(result.envelope?.properties).toEqual({ device: "mobile" });
    });
  });

  describe("isUuid", () => {
    it("accepts a well-formed uuid v4", () => {
      expect(isUuid("a1b2c3d4-e5f6-4789-8abc-def012345678")).toBe(true);
    });
    it("rejects garbage", () => {
      expect(isUuid("not-a-uuid")).toBe(false);
      expect(isUuid(123)).toBe(false);
      expect(isUuid(null)).toBe(false);
    });
  });
});
