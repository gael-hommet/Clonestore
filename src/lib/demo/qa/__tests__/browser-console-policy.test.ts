// Deterministic unit tests for the shared QA browser-console policy
// (scripts/qa/browser-console-policy.cjs), consumed by the official /demo Playwright scripts
// demo-visual-matrix.cjs and demo-ch3-interactive.cjs.
//
// Proves the allowlist is EXACTLY {status 429} × {the two optional telemetry routes}, is opt-in and
// injectable, is counted separately and honestly, and can NEVER be used to hide a general error:
// normal JS console errors, pageerrors, HTTP 5xx, non-429 resource failures, and 429s from any other
// route all stay BLOCKING.
//
// The 14-scenes / 8-viewports coverage and the Chapter-3 interaction functionality are NOT unit-testable
// here — they are proven by the official script runs themselves (demo-visual-matrix = 112/112 = 8×14
// with 0 unexpected console; demo-ch3-interactive = all interactive assertions). This suite covers the
// classification contract those scripts rely on.
import { describe, it, expect } from "vitest";
// The policy is a CommonJS module shared with the .cjs QA scripts (single source of truth). This test
// file is excluded from tsc (**/*.test.ts) so the untyped CJS import is fine; vitest resolves it.
import policy from "../../../../../scripts/qa/browser-console-policy.cjs";

const {
  classifyConsole,
  createConsoleGate,
  isOptionalTelemetryRoute,
  statusFromConsoleText,
  OPTIONAL_TELEMETRY_ROUTES,
} = policy as {
  classifyConsole: (m: unknown, o?: unknown) => string;
  createConsoleGate: (o?: unknown) => {
    onConsole: (m: unknown) => void; onPageError: (e: unknown) => void; onResponse: (r: unknown) => void;
    counts: () => Record<string, number>; unexpectedCount: () => number; ok: () => boolean; details: () => Record<string, unknown[]>;
  };
  isOptionalTelemetryRoute: (u: string, routes?: string[]) => boolean;
  statusFromConsoleText: (t: string) => number | null;
  OPTIONAL_TELEMETRY_ROUTES: readonly string[];
};

const ORIGIN = "http://localhost:3000";
const ANALYTICS = `${ORIGIN}/api/analytics/events`;
const CONVERSION = `${ORIGIN}/api/conversion/events`;
const resourceErr = (status: number, url: string) =>
  ({ type: "error", text: `Failed to load resource: the server responded with a status of ${status} (X)`, url });
const jsErr = (text: string, url = `${ORIGIN}/_next/static/chunk.js`) => ({ type: "error", text, url });

describe("QA browser-console policy — status parsing", () => {
  it("parses the HTTP status from a resource-load-failure message", () => {
    expect(statusFromConsoleText("Failed to load resource: the server responded with a status of 429 (Too Many Requests)")).toBe(429);
    expect(statusFromConsoleText("Failed to load resource: the server responded with a status of 500 (Internal Server Error)")).toBe(500);
  });
  it("returns null for a normal JS console error (no resource status)", () => {
    expect(statusFromConsoleText("Uncaught TypeError: x is not a function")).toBeNull();
    expect(statusFromConsoleText("Warning: Text content did not match. Server: ...")).toBeNull();
  });
});

describe("QA browser-console policy — route allowlist (exact, injectable)", () => {
  it("matches EXACTLY the two optional telemetry routes (pathname, query-insensitive)", () => {
    expect(isOptionalTelemetryRoute(ANALYTICS)).toBe(true);
    expect(isOptionalTelemetryRoute(CONVERSION)).toBe(true);
    expect(isOptionalTelemetryRoute(`${ANALYTICS}?t=1`)).toBe(true);
  });
  it("never matches via startsWith / lookalike / other route", () => {
    expect(isOptionalTelemetryRoute(`${ORIGIN}/api/analytics/events-evil`)).toBe(false);
    expect(isOptionalTelemetryRoute(`${ORIGIN}/api/analytics/eventsX`)).toBe(false);
    expect(isOptionalTelemetryRoute(`${ORIGIN}/api/other`)).toBe(false);
    expect(isOptionalTelemetryRoute("")).toBe(false);
    expect(isOptionalTelemetryRoute("not a url")).toBe(false);
  });
  it("respects an injected route list (does not fall back to defaults)", () => {
    expect(isOptionalTelemetryRoute(ANALYTICS, ["/api/only-this"])).toBe(false);
    expect(isOptionalTelemetryRoute(`${ORIGIN}/api/only-this`, ["/api/only-this"])).toBe(true);
  });
  it("the default allowlist is exactly the two known optional routes", () => {
    expect([...OPTIONAL_TELEMETRY_ROUTES].sort()).toEqual(["/api/analytics/events", "/api/conversion/events"]);
  });
});

describe("QA browser-console policy — classifyConsole", () => {
  it("429 on an optional telemetry route → expected (when allowed)", () => {
    expect(classifyConsole(resourceErr(429, ANALYTICS))).toBe("expected_telemetry_429");
    expect(classifyConsole(resourceErr(429, CONVERSION))).toBe("expected_telemetry_429");
  });
  it("429 on any OTHER route → unexpected (blocking)", () => {
    expect(classifyConsole(resourceErr(429, `${ORIGIN}/api/other`))).toBe("unexpected");
    expect(classifyConsole(resourceErr(429, `${ORIGIN}/api/analytics/events-evil`))).toBe("unexpected");
  });
  it("a 429 console error with NO url → unexpected (fail-closed, cannot prove the route)", () => {
    expect(classifyConsole({ type: "error", text: "Failed to load resource: the server responded with a status of 429 (Too Many Requests)", url: "" })).toBe("unexpected");
  });
  it("non-429 resource failures on an optional route stay unexpected (limited to status 429)", () => {
    expect(classifyConsole(resourceErr(500, ANALYTICS))).toBe("unexpected");
    expect(classifyConsole(resourceErr(422, ANALYTICS))).toBe("unexpected");
    expect(classifyConsole(resourceErr(404, ANALYTICS))).toBe("unexpected");
  });
  it("normal JS console error → unexpected", () => {
    expect(classifyConsole(jsErr("Uncaught TypeError: boom"))).toBe("unexpected");
  });
  it("non-error console messages are ignored", () => {
    expect(classifyConsole({ type: "warning", text: "whatever", url: ANALYTICS })).toBe("ignore");
    expect(classifyConsole({ type: "log", text: "info", url: "" })).toBe("ignore");
  });
  it("when the policy is disabled, an optional 429 becomes unexpected (opt-in)", () => {
    expect(classifyConsole(resourceErr(429, ANALYTICS), { allowOptionalTelemetry429: false })).toBe("unexpected");
  });
});

describe("QA browser-console policy — createConsoleGate (blocking vs honest counters)", () => {
  it("passes with ONLY expected optional-telemetry 429s, counted separately and visibly", () => {
    const g = createConsoleGate();
    g.onConsole(resourceErr(429, ANALYTICS));
    g.onConsole(resourceErr(429, CONVERSION));
    g.onResponse({ url: ANALYTICS, status: 429 });
    expect(g.unexpectedCount()).toBe(0);
    expect(g.ok()).toBe(true);
    expect(g.counts().expectedTelemetry429).toBe(2);
    expect(g.counts().expected429Responses).toBe(1);
    expect(g.counts().unexpectedConsole).toBe(0);
  });
  it("a normal JS console error stays BLOCKING", () => {
    const g = createConsoleGate();
    g.onConsole(jsErr("Uncaught ReferenceError: x"));
    expect(g.ok()).toBe(false);
    expect(g.counts().unexpectedConsole).toBe(1);
  });
  it("a pageerror stays BLOCKING", () => {
    const g = createConsoleGate();
    g.onPageError(new Error("render crashed"));
    expect(g.ok()).toBe(false);
    expect(g.counts().pageErrors).toBe(1);
  });
  it("an HTTP 500 response stays BLOCKING", () => {
    const g = createConsoleGate();
    g.onResponse({ url: `${ORIGIN}/api/whatever`, status: 500 });
    expect(g.ok()).toBe(false);
    expect(g.counts().http5xx).toBe(1);
  });
  it("a 429 on an unknown route stays BLOCKING (console AND response level)", () => {
    const g = createConsoleGate();
    g.onConsole(resourceErr(429, `${ORIGIN}/api/other`));
    g.onResponse({ url: `${ORIGIN}/api/other`, status: 429 });
    expect(g.ok()).toBe(false);
    expect(g.counts().unexpectedConsole).toBe(1);
    expect(g.counts().unexpected429).toBe(1);
    expect(g.counts().expected429Responses).toBe(0);
  });
  it("mixed: expected 429s do NOT mask a real error in the same run", () => {
    const g = createConsoleGate();
    g.onConsole(resourceErr(429, ANALYTICS));         // expected
    g.onConsole(jsErr("Uncaught TypeError: real bug")); // real → blocking
    expect(g.ok()).toBe(false);
    expect(g.counts().expectedTelemetry429).toBe(1);
    expect(g.counts().unexpectedConsole).toBe(1);
  });
  it("with the policy disabled, optional 429s become blocking (proving they are real, not hidden)", () => {
    const g = createConsoleGate({ allowOptionalTelemetry429: false });
    g.onConsole(resourceErr(429, ANALYTICS));
    g.onResponse({ url: ANALYTICS, status: 429 });
    expect(g.ok()).toBe(false);
    expect(g.counts().unexpectedConsole).toBe(1);
    expect(g.counts().unexpected429).toBe(1);
  });
});
