// PHASE 8.7.4 — unit tests for the controlled-live runner remediation guards.
import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, rmSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
// The guards ship as .mjs + .d.mts (the p87 convention). Static import resolves via the declaration.
import {
  assertProductionBaseUrl, previewSecureLinkPreflight,
  acquireSingleRunLock, readRunLock, releaseSingleRunLock, clearRunLock,
  makeRealEmailBudget, makeGlobalDeadline, MAX_JOURNEY_MS,
} from "../p87-run-guards.mjs";

const PROD = "https://app.pierre.example";
const HOSTS = ["app.pierre.example"];
const locks: string[] = [];
const lock = () => { const p = join(tmpdir(), `p87lock-${randomUUID()}.json`); locks.push(p); return p; };
afterEach(() => { for (const p of locks.splice(0)) { try { if (existsSync(p)) rmSync(p); } catch { /* noop */ } } });

describe("ÉTAPE 4 — base URL guard (refuse localhost / http / wrong host)", () => {
  it("refuses the incident value http://localhost:3000", () => {
    expect(() => assertProductionBaseUrl("http://localhost:3000", { expectedHosts: HOSTS })).toThrow();
  });
  it("refuses 127.0.0.1 and ::1 loopback", () => {
    expect(() => assertProductionBaseUrl("https://127.0.0.1", { expectedHosts: HOSTS })).toThrow();
    expect(() => assertProductionBaseUrl("https://[::1]", { expectedHosts: HOSTS })).toThrow();
  });
  it("refuses plain http even on the right host", () => {
    expect(() => assertProductionBaseUrl("http://app.pierre.example", { expectedHosts: HOSTS })).toThrow(/HTTPS/i);
  });
  it("refuses an empty base URL (no silent localhost fallback)", () => {
    expect(() => assertProductionBaseUrl("", { expectedHosts: HOSTS })).toThrow();
    expect(() => assertProductionBaseUrl(null, { expectedHosts: HOSTS })).toThrow();
  });
  it("refuses a host that is not the expected production domain", () => {
    expect(() => assertProductionBaseUrl("https://evil.example", { expectedHosts: HOSTS })).toThrow(/expected Production/i);
  });
  it("refuses when no expected host is configured (fail-closed)", () => {
    expect(() => assertProductionBaseUrl(PROD, { expectedHosts: [] })).toThrow();
  });
  it("accepts a real HTTPS production URL matching the expected host", () => {
    const r = assertProductionBaseUrl(`${PROD}/`, { expectedHosts: HOSTS });
    expect(r.https).toBe(true);
    expect(r.host).toBe("app.pierre.example");
  });
});

describe("ÉTAPE 4 — secure-link token preflight (never exposes the token)", () => {
  it("validates structure + secret + prod host and NEVER returns/logs the token", () => {
    const r = previewSecureLinkPreflight({ base: PROD, secret: "x".repeat(40), expectedHosts: HOSTS });
    expect(r.ok).toBe(true);
    expect(r.secret_present).toBe(true);
    expect(r.token_never_logged).toBe(true);
    expect(r.token_transmitted).toBe(false);
    expect(r.host_is_production).toBe(true);
    // the result must not carry the token itself
    expect((r as Record<string, unknown>).token).toBeUndefined();
    expect(typeof r.token_length).toBe("number");
  });
  it("refuses when the secret is missing/too short", () => {
    expect(() => previewSecureLinkPreflight({ base: PROD, secret: "short", expectedHosts: HOSTS })).toThrow();
  });
  it("refuses when the base URL is localhost", () => {
    expect(() => previewSecureLinkPreflight({ base: "http://localhost:3000", secret: "x".repeat(40), expectedHosts: HOSTS })).toThrow();
  });
});

describe("ÉTAPE 5 — atomic single-run lock", () => {
  it("acquires on a fresh path and refuses a concurrent live run", () => {
    const p = lock();
    const a = acquireSingleRunLock(p, { runId: "rAAA", pid: process.pid });
    expect(a.reclaimed).toBe(false);
    expect(readRunLock(p)?.status).toBe("running");
    // same pid is alive → a second acquire must refuse
    expect(() => acquireSingleRunLock(p, { runId: "rBBB", pid: process.pid })).toThrow(/single-run|holds the lock/i);
  });
  it("reclaims a terminal lock", () => {
    const p = lock();
    acquireSingleRunLock(p, { runId: "rAAA", pid: process.pid });
    releaseSingleRunLock(p, { status: "cleaned" });
    const b = acquireSingleRunLock(p, { runId: "rCCC", pid: process.pid });
    expect(b.reclaimed).toBe(true);
    expect(b.reclaimed_from?.reason).toBe("terminal");
  });
  it("reclaims an orphaned lock (dead pid)", () => {
    const p = lock();
    writeFileSync(p, JSON.stringify({ run_id: "rDEAD", pid: 2147483646, status: "running", acquired_at: Date.now() }));
    const b = acquireSingleRunLock(p, { runId: "rEEE", pid: process.pid });
    expect(b.reclaimed).toBe(true);
    expect(b.reclaimed_from?.reason).toBe("orphan_pid");
  });
  it("reclaims a stale lock (past ttl)", () => {
    const p = lock();
    const past = Date.now() - 60 * 60 * 1000;
    writeFileSync(p, JSON.stringify({ run_id: "rOLD", pid: process.pid, status: "running", acquired_at: past }));
    const b = acquireSingleRunLock(p, { runId: "rFFF", pid: process.pid, ttlMs: 30 * 60 * 1000 });
    expect(b.reclaimed).toBe(true);
    expect(b.reclaimed_from?.reason).toBe("stale_ttl");
  });
  it("clearRunLock refuses a non-terminal lock without force", () => {
    const p = lock();
    acquireSingleRunLock(p, { runId: "rAAA", pid: process.pid });
    expect(() => clearRunLock(p)).toThrow();
    expect(clearRunLock(p, { force: true })).toBe(true);
    expect(existsSync(p)).toBe(false);
  });
});

describe("ÉTAPE 6 — single real-email budget", () => {
  it("allows exactly one send and throws on a second", () => {
    const b = makeRealEmailBudget(1);
    expect(b.charge("first")).toBe(1);
    expect(b.assertExactlyOne()).toBe(true);
    expect(() => b.charge("second")).toThrow(/budget exceeded/i);
  });
  it("assertExactlyOne fails when zero sends occurred", () => {
    const b = makeRealEmailBudget(1);
    expect(() => b.assertExactlyOne()).toThrow(/exactly 1/i);
  });
});

describe("ÉTAPE 7 — global deadline / hard stop", () => {
  it("caps the budget at 30 minutes and reports remaining", () => {
    const t = 1_000_000;
    const d = makeGlobalDeadline(60 * 60 * 1000, { nowFn: () => t }); // ask for 60 min
    expect(d.budgetMs).toBe(MAX_JOURNEY_MS); // capped to 30 min
    expect(d.expired()).toBe(false);
    expect(d.remainingMs()).toBe(MAX_JOURNEY_MS);
  });
  it("assertAlive throws once the deadline passes; clampWaitMs shrinks to remaining", () => {
    let t = 0;
    const d = makeGlobalDeadline(1000, { nowFn: () => t });
    expect(() => d.assertAlive("stage")).not.toThrow();
    expect(d.clampWaitMs(10_000)).toBe(1000); // clamped to remaining budget
    t = 1500; // past deadline
    expect(d.expired()).toBe(true);
    expect(() => d.assertAlive("stripe-wait")).toThrow(/deadline|HARD STOP/i);
    expect(d.clampWaitMs(10_000)).toBe(0);
  });
});
