// scripts/qa/browser-console-policy.cjs
//
// HONEST browser-console gate policy shared by the official /demo Playwright scripts
// (demo-visual-matrix.cjs, demo-ch3-interactive.cjs).
//
// Problem it solves: the /demo page fires OPTIONAL, fire-and-forget telemetry beacons
// (analytics + conversion funnel). The server legitimately rate-limits `/api/analytics/events`
// (60 requests / 60s per IP → HTTP 429). Under a QA matrix that loads /demo across 8 viewports ×
// 14 scenes from a single IP, that budget is exceeded and the browser logs
// "Failed to load resource: the server responded with a status of 429 (Too Many Requests)"
// console errors. This is EXPECTED backpressure, not a product defect: the page degrades gracefully
// (beacons are fire-and-forget) and real users never approach the limit.
//
// This policy classifies EXACTLY {HTTP 429} × {the two optional telemetry routes} as
// "expected telemetry backpressure" — counted separately and honestly, non-blocking — while EVERY
// other signal stays BLOCKING: any other console error (JS errors, hydration, any non-429 resource
// failure), any 429 from a non-optional route, any 4xx surfaced as a console resource error, any
// HTTP 5xx, any pageerror.
//
// Guarantees required of the allowlist (all unit-tested in
// src/lib/demo/qa/__tests__/browser-console-policy.test.ts):
//   • limited EXACTLY to the proven optional routes (exact pathname match, never startsWith);
//   • limited EXACTLY to status 429 (a 500/422/404 on the same route stays blocking);
//   • documented as expected backpressure;
//   • impossible to use to hide a general error (fail-closed when the route can't be proven);
//   • opt-in / injectable (`allowOptionalTelemetry429`, `optionalTelemetryRoutes`);
//   • counted separately and visibly (honest).
//
// It performs NO network interception, NO stubbing, NO generic console suppression, NO empty catch.
// The exit code is still driven by real validation: unexpectedCount() must be 0.

"use strict";

// The two OPTIONAL fire-and-forget telemetry beacons. Only `/api/analytics/events` is observed to
// rate-limit (429) in practice; `/api/conversion/events` currently returns 204, but it is the same
// class of optional telemetry, so a 429 from it (e.g. under a distributed limiter) is equally expected.
// No other route may ever be added here.
const OPTIONAL_TELEMETRY_ROUTES = Object.freeze(["/api/analytics/events", "/api/conversion/events"]);

/** Extract a pathname from a possibly-relative URL; null if not parseable. */
function pathnameOf(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  try { return new URL(url, "http://localhost").pathname; } catch (_e) { return null; }
}

/** EXACT pathname membership (never startsWith) — `/api/analytics/events-evil` must NOT match. */
function isOptionalTelemetryRoute(url, routes) {
  const list = Array.isArray(routes) && routes.length ? routes : OPTIONAL_TELEMETRY_ROUTES;
  const p = pathnameOf(url);
  return p !== null && list.indexOf(p) !== -1;
}

/**
 * Parse the HTTP status from the canonical browser resource-load-failure console message
 * ("Failed to load resource: the server responded with a status of NNN (...)"). Returns null for a
 * normal JS console error (no such pattern) — which therefore stays BLOCKING.
 */
function statusFromConsoleText(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/status of (\d{3})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Classify a console message.
 * @returns {"ignore"|"expected_telemetry_429"|"unexpected"}
 *   ignore  → not an error-level message
 *   expected_telemetry_429 → HTTP 429 resource failure on an optional telemetry route AND policy allows
 *   unexpected → everything else (BLOCKING)
 */
function classifyConsole(msg, opts) {
  const options = opts || {};
  const allow = options.allowOptionalTelemetry429 !== false; // default true
  const routes = options.optionalTelemetryRoutes;
  if (!msg || msg.type !== "error") return "ignore";
  const status = statusFromConsoleText(msg.text);
  if (status === 429 && allow && isOptionalTelemetryRoute(msg.url, routes)) return "expected_telemetry_429";
  return "unexpected";
}

/**
 * Stateful gate accumulating evidence from Playwright console / pageerror / response events.
 * Blocking = unexpectedConsole + pageErrors + http5xx + unexpected429. Expected telemetry 429s are
 * kept as separate, honest, non-blocking counters.
 */
function createConsoleGate(opts) {
  const options = opts || {};
  const allow = options.allowOptionalTelemetry429 !== false;
  const routes = options.optionalTelemetryRoutes;
  const state = {
    unexpectedConsole: [],    // BLOCKING
    pageErrors: [],           // BLOCKING
    http5xx: [],              // BLOCKING (response-level; catches 5xx even without a console error)
    unexpected429: [],        // BLOCKING (429 on a non-optional route, response-level)
    expectedTelemetry429: [], // non-blocking, honest (console-level)
    expected429Responses: [], // non-blocking, honest (response-level)
  };
  return {
    onConsole(msg) {
      const verdict = classifyConsole(msg, { allowOptionalTelemetry429: allow, optionalTelemetryRoutes: routes });
      if (verdict === "expected_telemetry_429") state.expectedTelemetry429.push({ text: msg && msg.text, url: msg && msg.url });
      else if (verdict === "unexpected") state.unexpectedConsole.push({ text: msg && msg.text, url: msg && msg.url });
    },
    onPageError(err) { state.pageErrors.push(String((err && err.message) || err)); },
    onResponse(res) {
      if (!res || typeof res.status !== "number") return;
      if (res.status >= 500) { state.http5xx.push({ url: res.url, status: res.status }); return; }
      if (res.status === 429) {
        if (allow && isOptionalTelemetryRoute(res.url, routes)) state.expected429Responses.push({ url: res.url });
        else state.unexpected429.push({ url: res.url });
      }
    },
    counts() {
      return {
        unexpectedConsole: state.unexpectedConsole.length,
        pageErrors: state.pageErrors.length,
        http5xx: state.http5xx.length,
        unexpected429: state.unexpected429.length,
        expectedTelemetry429: state.expectedTelemetry429.length,
        expected429Responses: state.expected429Responses.length,
      };
    },
    unexpectedCount() {
      return state.unexpectedConsole.length + state.pageErrors.length + state.http5xx.length + state.unexpected429.length;
    },
    ok() { return this.unexpectedCount() === 0; },
    details() { return state; },
    summaryLine() {
      const c = this.counts();
      return `unexpectedConsole=${c.unexpectedConsole} pageErrors=${c.pageErrors} http5xx=${c.http5xx} unexpected429=${c.unexpected429}`
        + ` | expected-telemetry-429(console=${c.expectedTelemetry429},resp=${c.expected429Responses})`;
    },
  };
}

module.exports = {
  OPTIONAL_TELEMETRY_ROUTES,
  pathnameOf,
  isOptionalTelemetryRoute,
  statusFromConsoleText,
  classifyConsole,
  createConsoleGate,
};
