// PHASE 8.7.3 — DI tests for the live external-providers check engine. Every branch is exercised with a
// mocked fetchJson + env (no real account). Asserts: real-evidence gating, no var-presence pass, sandbox is
// never promoted to live, blockers roll up correctly.
import { describe, it, expect } from "vitest";
import { runExternalProvidersCheck, STRIPE_REQUIRED_EVENTS } from "../live-external-providers-check.mjs";

const PRICE_OK = { unit_amount: 44900, currency: "eur", active: true, recurring: { interval: "month" }, product: { active: true } };
const mkFetch = (routes: Record<string, { status: number; ok: boolean; json: any }>) =>
  async (url: string) => {
    for (const k of Object.keys(routes)) if (url.includes(k)) return routes[k];
    return { status: 404, ok: false, json: null };
  };
const HTTPS = "https://www.clonestore.pro";

describe("P8.7.3 external-providers check (DI, real-evidence)", () => {
  it("STRIPE_REQUIRED_EVENTS holds the 5 canonical events", () => {
    expect(STRIPE_REQUIRED_EVENTS).toHaveLength(5);
    expect(STRIPE_REQUIRED_EVENTS).toContain("checkout.session.completed");
    expect(STRIPE_REQUIRED_EVENTS).toContain("invoice.payment_failed");
  });

  it("application: localhost BLOCKED; https + fail-closed routes READY_LIVE; a 500 route BLOCKS", async () => {
    const blocked = await runExternalProvidersCheck({ env: { CLONESTORE_PUBLIC_APP_URL: "http://localhost:3000" }, fetchJson: mkFetch({}) });
    expect(blocked.domains.application.status).toBe("BLOCKED_CONFIGURATION");
    const okRoutes = {
      "/api/webhooks/stripe": { status: 400, ok: false, json: null },
      "/api/webhooks/pierre/communications": { status: 503, ok: false, json: null },
      "/api/webhooks/pierre/signature": { status: 400, ok: false, json: null },
    };
    const ok = await runExternalProvidersCheck({ env: { NEXT_PUBLIC_APP_URL: HTTPS }, fetchJson: mkFetch(okRoutes) });
    expect(ok.domains.application.status).toBe("READY_LIVE");
    const bad = await runExternalProvidersCheck({ env: { NEXT_PUBLIC_APP_URL: HTTPS }, fetchJson: mkFetch({ ...okRoutes, "/api/webhooks/pierre/signature": { status: 500, ok: false, json: null } }) });
    expect(bad.domains.application.status).toBe("BLOCKED_CONFIGURATION");
  });

  it("stripe: missing key blocks; test+valid+5-event webhook = READY_SANDBOX; incomplete webhook BLOCKS", async () => {
    const miss = await runExternalProvidersCheck({ env: {}, fetchJson: mkFetch({}) });
    expect(miss.domains.stripe.status).toBe("BLOCKED_MISSING_SECRET");
    const wh5 = { data: [{ url: `${HTTPS}/api/webhooks/stripe`, status: "enabled", enabled_events: STRIPE_REQUIRED_EVENTS }] };
    const sandbox = await runExternalProvidersCheck({
      env: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PIERRE: "price_1", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/v1/prices/": { status: 200, ok: true, json: PRICE_OK }, "/v1/webhook_endpoints": { status: 200, ok: true, json: wh5 } }),
    });
    expect(sandbox.domains.stripe.status).toBe("READY_SANDBOX");
    const incomplete = await runExternalProvidersCheck({
      env: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PIERRE: "price_1", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/v1/prices/": { status: 200, ok: true, json: PRICE_OK }, "/v1/webhook_endpoints": { status: 200, ok: true, json: { data: [] } } }),
    });
    expect(incomplete.domains.stripe.status).toBe("BLOCKED_CONFIGURATION");
  });

  it("stripe: live key + valid price + webhook with the 5 events is READY_LIVE; missing webhook blocks", async () => {
    const wh = { data: [{ url: `${HTTPS}/api/webhooks/stripe`, status: "enabled", enabled_events: STRIPE_REQUIRED_EVENTS }] };
    const live = await runExternalProvidersCheck({
      env: { STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_PIERRE: "price_1", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/v1/prices/": { status: 200, ok: true, json: PRICE_OK }, "/v1/webhook_endpoints": { status: 200, ok: true, json: wh } }),
    });
    expect(live.domains.stripe.status).toBe("READY_LIVE");
    const noWh = await runExternalProvidersCheck({
      env: { STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_PIERRE: "price_1", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/v1/prices/": { status: 200, ok: true, json: PRICE_OK }, "/v1/webhook_endpoints": { status: 200, ok: true, json: { data: [] } } }),
    });
    expect(noWh.domains.stripe.status).toBe("BLOCKED_CONFIGURATION");
  });

  it("communications: invalid key → permission; scope-limited 400 → config blocker; verified domain → READY_LIVE", async () => {
    const invalid = await runExternalProvidersCheck({
      env: { RESEND_API_KEY: "re_x", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro" },
      fetchJson: mkFetch({ "api.resend.com/domains": { status: 400, ok: false, json: { name: "validation_error", message: "API key is invalid" } } }),
    });
    expect(invalid.domains.communications.status).toBe("BLOCKED_PERMISSION");
    const scope = await runExternalProvidersCheck({
      env: { RESEND_API_KEY: "re_x", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro" },
      fetchJson: mkFetch({ "api.resend.com/domains": { status: 400, ok: false, json: null } }),
    });
    expect(scope.domains.communications.status).toBe("BLOCKED_CONFIGURATION");
    const ok = await runExternalProvidersCheck({
      env: { RESEND_API_KEY: "re_x", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro", CLONESTORE_COMMUNICATION_PROVIDER: "resend", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "api.resend.com/domains": { status: 200, ok: true, json: { data: [{ name: "clonestore.pro", status: "verified" }] } }, "/api/webhooks/pierre/communications": { status: 401, ok: false, json: null } }),
    });
    expect(ok.domains.communications.status).toBe("READY_LIVE");
    // domain verified but the deployed route still unconfigured (503) → blocked, not READY_LIVE
    const noRoute = await runExternalProvidersCheck({
      env: { RESEND_API_KEY: "re_x", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro", CLONESTORE_COMMUNICATION_PROVIDER: "resend", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "api.resend.com/domains": { status: 200, ok: true, json: { data: [{ name: "clonestore.pro", status: "verified" }] } }, "/api/webhooks/pierre/communications": { status: 503, ok: false, json: null } }),
    });
    expect(noRoute.domains.communications.status).toBe("BLOCKED_CONFIGURATION");
  });

  it("signature: no key → missing-secret; sandbox URL → READY_SANDBOX; prod URL → READY_LIVE; bad key → permission", async () => {
    const none = await runExternalProvidersCheck({ env: {}, fetchJson: mkFetch({}) });
    expect(none.domains.signature.status).toBe("BLOCKED_MISSING_SECRET");
    const sb = await runExternalProvidersCheck({
      env: { YOUSIGN_API_KEY: "ys_x", YOUSIGN_API_URL: "https://api-sandbox.yousign.app/v3", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/users": { status: 200, ok: true, json: {} }, "/api/webhooks/pierre/signature": { status: 401, ok: false, json: null } }),
    });
    expect(sb.domains.signature.status).toBe("READY_SANDBOX");
    const prod = await runExternalProvidersCheck({
      env: { YOUSIGN_API_KEY: "ys_x", YOUSIGN_API_URL: "https://api.yousign.app/v3", NEXT_PUBLIC_APP_URL: HTTPS },
      fetchJson: mkFetch({ "/users": { status: 200, ok: true, json: {} }, "/api/webhooks/pierre/signature": { status: 401, ok: false, json: null } }),
    });
    expect(prod.domains.signature.status).toBe("READY_LIVE");
    const bad = await runExternalProvidersCheck({
      env: { YOUSIGN_API_KEY: "ys_x", YOUSIGN_API_URL: "https://api.yousign.app/v3" },
      fetchJson: mkFetch({ "/users": { status: 401, ok: false, json: null } }),
    });
    expect(bad.domains.signature.status).toBe("BLOCKED_PERMISSION");
  });

  it("storage: private bucket + passed round-trip proof → READY_LIVE; public bucket blocks; no proof blocks", async () => {
    const base = { NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srk", SUPABASE_STORAGE_BUCKET: "pierre-private-documents" };
    const listPrivate = { "/storage/v1/bucket": { status: 200, ok: true, json: [{ name: "pierre-private-documents", public: false }] } };
    const ready = await runExternalProvidersCheck({ env: base, fetchJson: mkFetch(listPrivate), readProof: () => ({ ok: true }) });
    expect(ready.domains.storage.status).toBe("READY_LIVE");
    const noProof = await runExternalProvidersCheck({ env: base, fetchJson: mkFetch(listPrivate), readProof: () => null });
    expect(noProof.domains.storage.status).toBe("BLOCKED_CONFIGURATION");
    const pub = await runExternalProvidersCheck({ env: base, fetchJson: mkFetch({ "/storage/v1/bucket": { status: 200, ok: true, json: [{ name: "pierre-private-documents", public: true }] } }), readProof: () => ({ ok: true }) });
    expect(pub.domains.storage.status).toBe("BLOCKED_PERMISSION");
  });

  it("overall ready is false when any domain is blocked, and blockers roll up", async () => {
    const r = await runExternalProvidersCheck({ env: { NEXT_PUBLIC_APP_URL: HTTPS }, fetchJson: mkFetch({}) });
    expect(r.ready).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.blockers.find((b: any) => b.area === "signature")).toBeTruthy();
  });

  const fullGreen = (stripeKey: string) => ({
    env: {
      NEXT_PUBLIC_APP_URL: HTTPS,
      STRIPE_SECRET_KEY: stripeKey, STRIPE_PRICE_PIERRE: "price_1",
      RESEND_API_KEY: "re_x", CLONESTORE_EMAIL_FROM: "pierre@clonestore.pro", CLONESTORE_COMMUNICATION_PROVIDER: "resend",
      YOUSIGN_API_KEY: "ys_x", YOUSIGN_API_URL: "https://api-sandbox.yousign.app/v3",
      NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srk", SUPABASE_STORAGE_BUCKET: "pierre-private-documents",
    },
    readProof: () => ({ ok: true }),
    fetchJson: mkFetch({
      "/api/webhooks/stripe": { status: 400, ok: false, json: null },
      "/api/webhooks/pierre/communications": { status: 401, ok: false, json: null },
      "/api/webhooks/pierre/signature": { status: 401, ok: false, json: null },
      "/v1/prices/": { status: 200, ok: true, json: PRICE_OK },
      "/v1/webhook_endpoints": { status: 200, ok: true, json: { data: [{ url: `${HTTPS}/api/webhooks/stripe`, status: "enabled", enabled_events: STRIPE_REQUIRED_EVENTS }] } },
      "api.resend.com/domains": { status: 200, ok: true, json: { data: [{ name: "clonestore.pro", status: "verified" }] } },
      "/users": { status: 200, ok: true, json: {} },
      "/storage/v1/bucket": { status: 200, ok: true, json: [{ name: "pierre-private-documents", public: false }] },
    }),
  });

  it("gates: prelaunch true + live false with Stripe sandbox; live true only with Stripe live", async () => {
    const sandbox = await runExternalProvidersCheck(fullGreen("sk_test_x"));
    expect(sandbox.domains.stripe.status).toBe("READY_SANDBOX");
    expect(sandbox.prelaunch_ready).toBe(true);
    expect(sandbox.live_ready).toBe(false);
    expect(sandbox.stripe_live_flip_required).toBe(true);
    const live = await runExternalProvidersCheck(fullGreen("sk_live_x"));
    expect(live.domains.stripe.status).toBe("READY_LIVE");
    expect(live.live_ready).toBe(true);
    expect(live.stripe_live_flip_required).toBe(false);
  });
});
