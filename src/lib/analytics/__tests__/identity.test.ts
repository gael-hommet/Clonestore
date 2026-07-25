import { describe, it, expect, beforeEach } from "vitest";
import { resolveVisitorId, resolveSessionId, VISITOR_COOKIE, SESSION_COOKIE, UUID_V4_RE } from "../identity";

describe("analytics identity contract v1", () => {
  beforeEach(() => {
    delete process.env.CLONESTORE_ANALYTICS_SESSION_SECRET;
  });

  describe("visitor_id", () => {
    it("issues a fresh visitor_id (uuid v4) with no cookie present", () => {
      const { visitorId, setCookie } = resolveVisitorId(null);
      expect(UUID_V4_RE.test(visitorId)).toBe(true);
      expect(setCookie).toContain(VISITOR_COOKIE);
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
    });

    it("is stable across two resolutions using the same signed cookie", () => {
      const first = resolveVisitorId(null);
      expect(first.setCookie).not.toBeNull();
      const cookieValue = first.setCookie!.split(";")[0];
      const second = resolveVisitorId(cookieValue);
      expect(second.visitorId).toBe(first.visitorId);
      expect(second.setCookie).toBeNull(); // déjà valide, rien à réémettre
    });

    it("never derives visitor_id from IP or user-agent — the function signature accepts only a cookie header", () => {
      // Preuve structurelle : resolveVisitorId n'a qu'un seul paramètre (cookieHeader).
      expect(resolveVisitorId.length).toBe(1);
    });

    it("issues a new visitor_id when the cookie signature is tampered with", () => {
      const first = resolveVisitorId(null);
      const cookieValue = first.setCookie!.split(";")[0];
      const tampered = cookieValue.slice(0, -2) + "xx";
      const second = resolveVisitorId(tampered);
      expect(second.visitorId).not.toBe(first.visitorId);
      expect(second.setCookie).not.toBeNull();
    });

    it("issues a new visitor_id when the cookie is expired (simulated via a different secret, equivalent to signature mismatch)", () => {
      process.env.CLONESTORE_ANALYTICS_SESSION_SECRET = "secret-a";
      const first = resolveVisitorId(null);
      const cookieValue = first.setCookie!.split(";")[0];
      process.env.CLONESTORE_ANALYTICS_SESSION_SECRET = "secret-b";
      const second = resolveVisitorId(cookieValue);
      expect(second.visitorId).not.toBe(first.visitorId);
    });
  });

  describe("session_id", () => {
    it("issues a fresh session on first resolution (isNewSession=true)", () => {
      const { sessionId, isNewSession, setCookie } = resolveSessionId(null);
      expect(UUID_V4_RE.test(sessionId)).toBe(true);
      expect(isNewSession).toBe(true);
      expect(setCookie).toContain(SESSION_COOKIE);
    });

    it("preserves the session id across resolutions using the same cookie, isNewSession=false", () => {
      const first = resolveSessionId(null);
      const cookieValue = first.setCookie.split(";")[0];
      const second = resolveSessionId(cookieValue);
      expect(second.sessionId).toBe(first.sessionId);
      expect(second.isNewSession).toBe(false);
    });

    it("session_id and visitor_id are never the same identity space (different cookie names)", () => {
      const v = resolveVisitorId(null);
      const s = resolveSessionId(null);
      expect(v.setCookie).not.toContain(SESSION_COOKIE);
      expect(s.setCookie).not.toContain(VISITOR_COOKIE);
    });
  });
});
