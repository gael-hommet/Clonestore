// P8.7.3 — regression proof for the signature webhook route fail-closed fix. Before the fix, a POST with no
// live signature provider configured under NODE_ENV=production threw a plain Error → HTTP 500 (forbidden). The
// fix returns a graceful 503 "webhook_unconfigured" (deployed route observed 500 → must become 503).
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const SIG_VARS = [
  "CLONESTORE_SIGNATURE_PROVIDER", "CLONESTORE_SIGNATURE_API_URL",
  "CLONESTORE_SIGNATURE_API_KEY", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET",
];

describe("signature webhook route — fail-closed (never 500)", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved.NODE_ENV = process.env.NODE_ENV;
    for (const k of SIG_VARS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.NODE_ENV;
    for (const k of SIG_VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  it("production + no live signature provider → 503 webhook_unconfigured (NOT 500)", async () => {
    process.env.NODE_ENV = "production";
    const { POST } = await import("@/app/api/webhooks/pierre/signature/route");
    const res = await POST(new Request("https://www.clonestore.pro/api/webhooks/pierre/signature", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }));
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("webhook_unconfigured");
  });

  it("non-production + webhook secret absent → 503 (fail-closed, NOT 500)", async () => {
    process.env.NODE_ENV = "test"; // non-production: provider resolves to the deterministic fake, but no secret
    const { POST } = await import("@/app/api/webhooks/pierre/signature/route");
    const res = await POST(new Request("https://www.clonestore.pro/api/webhooks/pierre/signature", {
      method: "POST", headers: { "content-type": "application/json", "x-webhook-provider": "fake_provider" }, body: "{}",
    }));
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(503);
  });
});
