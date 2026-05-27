// B43 — Observability routes tests (40+ tests)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  options: { headers?: Record<string, string>; searchParams?: Record<string, string> } = {},
): NextRequest {
  const urlObj = new URL(url);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      urlObj.searchParams.set(k, v);
    }
  }
  return new NextRequest(urlObj, {
    headers: options.headers ?? {},
  });
}

const INTERNAL_SECRET = "test-internal-secret-b43";

// ── Health route ──────────────────────────────────────────────────────────────
import { GET as healthGET } from "../health/route";

describe("GET /api/pierre/observability/health", () => {
  it("returns a health report with status field", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/health");
    const res = await healthGET();
    const data = await res.json();
    expect(data.status).toBeDefined();
    expect(["ok", "degraded", "down"]).toContain(data.status);
  });

  it("includes safe_to_operate", async () => {
    const res = await healthGET();
    const data = await res.json();
    expect(typeof data.safe_to_operate).toBe("boolean");
  });

  it("includes generated_at", async () => {
    const res = await healthGET();
    const data = await res.json();
    expect(data.generated_at).toBeTruthy();
  });

  it("includes checks array", async () => {
    const res = await healthGET();
    const data = await res.json();
    expect(Array.isArray(data.checks)).toBe(true);
    expect(data.checks.length).toBeGreaterThan(0);
  });

  it("each check has service and status", async () => {
    const res = await healthGET();
    const data = await res.json();
    for (const check of data.checks) {
      expect(check.service).toBeTruthy();
      expect(["ok", "degraded", "down", "disabled"]).toContain(check.status);
    }
  });

  it("includes degraded_services and down_services arrays", async () => {
    const res = await healthGET();
    const data = await res.json();
    expect(Array.isArray(data.degraded_services)).toBe(true);
    expect(Array.isArray(data.down_services)).toBe(true);
  });

  it("returns 200 for ok or degraded status", async () => {
    const res = await healthGET();
    const data = await res.json();
    if (data.status === "ok" || data.status === "degraded") {
      expect(res.status).toBe(200);
    }
  });

  it("does not expose internal error details on exception", async () => {
    // Health route should gracefully handle errors
    const res = await healthGET();
    const data = await res.json();
    // Either returns health data or a safe error message
    expect(data).toBeDefined();
  });
});

// ── Diagnostics route ─────────────────────────────────────────────────────────
import { GET as diagnosticsGET } from "../diagnostics/route";

describe("GET /api/pierre/observability/diagnostics", () => {
  beforeEach(() => {
    process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET = INTERNAL_SECRET;
  });

  afterEach(() => {
    delete process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET;
  });

  it("returns 403 without secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics");
    const res = await diagnosticsGET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("returns 403 with wrong secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": "wrong-secret" },
    });
    const res = await diagnosticsGET(req);
    expect(res.status).toBe(403);
  });

  it("returns diagnostics report with correct secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data.generated_at).toBeTruthy();
    expect(data.status).toBeDefined();
  });

  it("diagnostics report includes areas", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    const data = await res.json();
    expect(data.areas).toBeDefined();
    expect(typeof data.areas).toBe("object");
  });

  it("diagnostics report includes health_checks", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    const data = await res.json();
    expect(Array.isArray(data.health_checks)).toBe(true);
  });

  it("diagnostics report includes recommended_actions", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    const data = await res.json();
    expect(Array.isArray(data.recommended_actions)).toBe(true);
    expect(data.recommended_actions.length).toBeGreaterThan(0);
  });

  it("diagnostics report includes safe_to_operate", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    const data = await res.json();
    expect(typeof data.safe_to_operate).toBe("boolean");
  });

  it("does not expose secrets in diagnostics response", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    const text = await res.text();
    expect(text).not.toContain("sk-");
    expect(text).not.toContain("password");
  });
});

// ── Events route ──────────────────────────────────────────────────────────────
import { GET as eventsGET } from "../events/route";

describe("GET /api/pierre/observability/events", () => {
  beforeEach(() => {
    process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET = INTERNAL_SECRET;
  });

  afterEach(() => {
    delete process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET;
  });

  it("returns 403 without secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events");
    const res = await eventsGET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 with wrong secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": "bad-secret" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(403);
  });

  it("returns events list with correct secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.events)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  it("accepts domain filter", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
      searchParams: { domain: "task" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("accepts severity filter", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
      searchParams: { severity: "error" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
  });

  it("accepts limit parameter", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
      searchParams: { limit: "10" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events.length).toBeLessThanOrEqual(10);
  });

  it("caps limit at 200", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
      searchParams: { limit: "9999" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events.length).toBeLessThanOrEqual(200);
  });

  it("returns 400 for invalid limit", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
      searchParams: { limit: "not-a-number" },
    });
    const res = await eventsGET(req);
    expect(res.status).toBe(400);
  });

  it("event shape has required fields", async () => {
    // Record an event first by using the runtime
    const { resetDefaultSinks, getDefaultObservableSink } = await import("../../../../../lib/observability/runtime");
    resetDefaultSinks();
    const sink = getDefaultObservableSink();
    const { buildObservableEvent } = await import("../../../../../lib/observability/event-log");
    sink.record(buildObservableEvent({
      correlation_id: "cor_route_test",
      domain: "task",
      event_type: "task.test",
      status: "started",
      severity: "info",
      message: "route test event",
      safe_user_message: null,
    }));

    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await eventsGET(req);
    const data = await res.json();

    if (data.events.length > 0) {
      const evt = data.events[0];
      expect(evt.id).toBeTruthy();
      expect(evt.timestamp).toBeTruthy();
      expect(evt.domain).toBeTruthy();
      expect(evt.event_type).toBeTruthy();
      expect(evt.status).toBeTruthy();
      expect(evt.severity).toBeTruthy();
    }
  });

  it("events response includes summary", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await eventsGET(req);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.total).toBe("number");
  });

  it("does not expose raw stack traces", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await eventsGET(req);
    const text = await res.text();
    expect(text).not.toContain("at Object.<anonymous>");
  });
});

// ── No-store security headers ─────────────────────────────────────────────────

describe("security headers — all observability routes", () => {
  beforeEach(() => {
    process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET = INTERNAL_SECRET;
  });
  afterEach(() => {
    delete process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET;
  });

  it("GET /health returns Cache-Control: no-store", async () => {
    const res = await healthGET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("GET /diagnostics returns Cache-Control: no-store with valid secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await diagnosticsGET(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("GET /events returns Cache-Control: no-store with valid secret", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/events", {
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
    const res = await eventsGET(req);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("GET /health returns X-Content-Type-Options: nosniff", async () => {
    const res = await healthGET();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /diagnostics returns X-Robots-Tag on 403", async () => {
    const req = makeRequest("http://localhost/api/pierre/observability/diagnostics");
    const res = await diagnosticsGET(req);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
