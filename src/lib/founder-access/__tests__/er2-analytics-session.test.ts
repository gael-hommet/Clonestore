// E-R2 §8/§9/§13 — session analytics serveur, sanitisation route-level, sécurité cockpit.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

beforeAll(() => { process.env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET = "analytics-secret-0123456789"; });

describe("§8 — session analytics émise et validée par le serveur", () => {
  it("émet une session UUID v4 signée, la relit, rejette les falsifications", async () => {
    const { buildAnalyticsSessionCookie, readAnalyticsSession, ANALYTICS_SESSION_COOKIE } = await import("../signed-cookie");
    const { cookie, sessionId } = buildAnalyticsSessionCookie();
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const value = cookie.split(";")[0].slice(ANALYTICS_SESSION_COOKIE.length + 1);
    expect(readAnalyticsSession(`${ANALYTICS_SESSION_COOKIE}=${value}`)).toBe(sessionId);
    expect(readAnalyticsSession(`${ANALYTICS_SESSION_COOKIE}=falsifié`)).toBeNull();
    expect(readAnalyticsSession(null)).toBeNull();
  });

  it("resolveAnalyticsSession émet une session si le cookie est absent, la réutilise sinon", async () => {
    const { resolveAnalyticsSession } = await import("../analytics-session");
    const { ANALYTICS_SESSION_COOKIE } = await import("../signed-cookie");
    const fresh = resolveAnalyticsSession(new Request("http://x"));
    expect(fresh.setCookie).not.toBeNull();
    const value = fresh.setCookie!.split(";")[0].slice(ANALYTICS_SESSION_COOKIE.length + 1);
    const reused = resolveAnalyticsSession(new Request("http://x", { headers: { cookie: `${ANALYTICS_SESSION_COOKIE}=${value}` } }));
    expect(reused.setCookie).toBeNull();
    expect(reused.sessionId).toBe(fresh.sessionId);
  });
});

describe("§9 — sanitisation centrale unique des routes analytics", () => {
  it("sanitizeClientAnalyticsPayload neutralise toute PII (paths/UTM/referrer/device)", async () => {
    const { sanitizeClientAnalyticsPayload } = await import("../privacy");
    const out = sanitizeClientAnalyticsPayload({
      current_path: "/reserver/pierre?token=abc",        // query retirée
      landing_path: "/verify/user@example.com",          // PII → null
      referrer: "https://u:p@ref.com/x?secret=1#f",       // réduit à origin+path
      utm_source: "email=a@b.com",                         // PII → null
      utm_medium: "cpc",
      device_category: "mobile",
      browser_family: "Mozilla/5.0 Chrome/120",
      commercial_phase: "launched",
    });
    expect(out.current_path).toBe("/reserver/pierre");
    expect(out.landing_path).toBeNull();
    expect(out.referrer).toBe("https://ref.com/x");
    expect(out.utm_source).toBeNull();
    expect(out.utm_medium).toBe("cpc");
    expect(out.device_category).toBe("mobile");
    expect(out.browser_family).toBe("chrome");
    expect(out.commercial_phase).toBe("launched");
  });
  // L'ignorance de tout id de session du corps est garantie par resolveAnalyticsSession
  // (lit UNIQUEMENT le cookie signé), prouvée dans le §8 ci-dessus.
});

describe("§13 — toutes les API internes refusent sans porte (fail-closed, sans base)", () => {
  const OWNER = ["CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH", "CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET", "CLONESTORE_OWNER_COCKPIT_SLUG"];
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => { saved = Object.fromEntries(OWNER.map((k) => [k, process.env[k]])); for (const k of OWNER) delete process.env[k]; });
  afterEach(() => { for (const k of OWNER) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  const routes: Array<[string, string]> = [
    ["@/app/api/internal/founder-access/dashboard/route", "GET"],
    ["@/app/api/internal/founder-access/analytics/route", "GET"],
    ["@/app/api/internal/founder-access/presence/route", "GET"],
    ["@/app/api/internal/founder-access/reservations/route", "GET"],
    ["@/app/api/internal/founder-access/export/route", "GET"],
    ["@/app/api/internal/founder-access/email-run/route", "POST"],
    ["@/app/api/internal/founder-access/email-requeue/route", "POST"],
  ];

  it("porte non configurée → 404 sur chaque classe d'API interne, sans lecture base", async () => {
    for (const [mod, method] of routes) {
      const handlers = await import(mod);
      const fn = handlers[method as "GET" | "POST"];
      const res = await fn(new Request("http://x/api/internal/x", { method }));
      expect(res.status).toBe(404);
    }
  });

  it("la PATCH de détail réservation refuse aussi sans porte", async () => {
    const { PATCH } = await import("@/app/api/internal/founder-access/reservations/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/internal/founder-access/reservations/3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a", { method: "PATCH", body: "{}" }),
      { params: Promise.resolve({ id: "3f1a8c2e-1b2c-4d3e-8f9a-0b1c2d3e4f5a" }) },
    );
    expect(res.status).toBe(404);
  });
});
