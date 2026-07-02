// src/lib/pierre/v1/p87-run-guards.mjs
// PHASE 8.7.4 — REMEDIATION guards for the controlled-live journey runner. Pure, dependency-free
// (node builtins only) and unit-tested. They exist because the incident produced (a) real emails
// whose secure links pointed at http://localhost:3000, and (b) EIGHT distinct runs, each sending
// one real email. These guards make the runner fail-closed BEFORE any external effect, strictly
// single-run, single-real-email, and hard-bounded in wall-clock. No secret or secure token is
// ever returned or logged by any function here.

import { createHmac, createHash } from "crypto";
import { existsSync, readFileSync, openSync, writeSync, closeSync, unlinkSync } from "fs";

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 4 — secure-link / public base URL guard
// A controlled-live run that sends a REAL email MUST resolve a Production HTTPS base URL. localhost,
// loopback, plain http and a wrong host are all refused BEFORE any tenant/document/email is created.
// ─────────────────────────────────────────────────────────────────────────────
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function assertProductionBaseUrl(rawUrl, opts = {}) {
  const { expectedHosts = [], requireExpectedHost = true } = opts;
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new Error("controlled-live public base URL is empty — refuse (no silent localhost fallback for a real-email run)");
  }
  let u;
  try { u = new URL(rawUrl.trim()); } catch { throw new Error("controlled-live public base URL is not a valid absolute URL"); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:") throw new Error(`controlled-live public base URL must be HTTPS (got ${u.protocol}//)`);
  if (LOOPBACK_HOSTS.has(host) || host.endsWith(".local")) throw new Error(`controlled-live public base URL must not be localhost/loopback (got host="${host}")`);
  const expected = expectedHosts.map((h) => String(h).toLowerCase()).filter(Boolean);
  if (expected.length) {
    if (!expected.includes(host)) throw new Error(`controlled-live public base URL host "${host}" does not match the expected Production domain(s): ${expected.join(", ")}`);
  } else if (requireExpectedHost) {
    throw new Error("no expected Production host configured (set P87_EXPECTED_APP_HOST) — refuse to send real email against an unverified domain");
  }
  return { origin: u.origin, host, https: true };
}

// In-memory secure-link preflight: builds a SYNTHETIC token replicating the canonical scheme
// (base64url(JSON claims) + "." + HMAC-SHA256 base64url) purely to prove the secret is configured
// and the structure is well-formed. The token is NEVER returned, logged, or transmitted, and NO
// document/email is created. Returns only booleans + the token length.
export function previewSecureLinkPreflight({ base, secret, expectedHosts = [], requireExpectedHost = true }) {
  const { host } = assertProductionBaseUrl(base, { expectedHosts, requireExpectedHost });
  if (!secret || typeof secret !== "string" || secret.length < 16) throw new Error("secure-link secret is not configured (need CLONESTORE_COMMUNICATION_LINK_SECRET or CLONESTORE_SIGNATURE_WEBHOOK_SECRET)");
  const claims = { c: "00000000-0000-0000-0000-000000000000", ot: "document", oid: "00000000-0000-0000-0000-000000000000", r: "preflight", exp: 0 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const token = `${payload}.${sig}`; // stays in this scope; never escapes
  const structureOk = token.split(".").length === 2 && payload.length > 0 && sig.length >= 24;
  return { ok: structureOk, host_is_production: true, host, secret_present: true, token_length: token.length, token_never_logged: true, token_transmitted: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 5 — atomic single-run lock (local, cross-process safe via O_EXCL)
// Reclaims a lock only if it is terminal (completed/failed/cleaned), orphaned (pid dead) or stale
// (older than ttl). Otherwise a second run is refused.
// ─────────────────────────────────────────────────────────────────────────────
const TERMINAL_LOCK_STATUSES = new Set(["completed", "failed", "cleaned"]);

function pidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === "EPERM"; }
}

export function readRunLock(lockPath) {
  try { return JSON.parse(readFileSync(lockPath, "utf8")); } catch { return null; }
}

export function acquireSingleRunLock(lockPath, { runId, pid, ttlMs = 30 * 60 * 1000, now = Date.now() } = {}) {
  const rec = { run_id: runId, pid, status: "running", acquired_at: now, updated_at: now };
  const body = JSON.stringify(rec, null, 2);
  try {
    const fd = openSync(lockPath, "wx"); // atomic create; throws EEXIST if held
    writeSync(fd, body); closeSync(fd);
    return { lockPath, ...rec, reclaimed: false };
  } catch (e) {
    if (!e || e.code !== "EEXIST") throw e;
  }
  const prev = readRunLock(lockPath);
  const age = prev && prev.acquired_at ? now - prev.acquired_at : Infinity;
  const terminal = !!prev && TERMINAL_LOCK_STATUSES.has(prev.status);
  const orphan = !!(prev && prev.pid) && !pidAlive(prev.pid);
  const stale = age > ttlMs;
  if (!terminal && !orphan && !stale) {
    throw new Error(`another P8.7.4 controlled run holds the lock (run=${prev?.run_id ?? "?"} status=${prev?.status ?? "?"} pid=${prev?.pid ?? "?"} age=${Number.isFinite(age) ? Math.round(age / 1000) : "?"}s). No second run until it is terminal AND cleaned — clear after audit.`);
  }
  unlinkSync(lockPath);
  const fd = openSync(lockPath, "wx"); writeSync(fd, body); closeSync(fd);
  return { lockPath, ...rec, reclaimed: true, reclaimed_from: { run_id: prev?.run_id ?? null, status: prev?.status ?? null, reason: terminal ? "terminal" : orphan ? "orphan_pid" : "stale_ttl" } };
}

export function updateRunLockStatus(lockPath, status, { now = Date.now() } = {}) {
  const rec = readRunLock(lockPath); if (!rec) return null;
  rec.status = status; rec.updated_at = now;
  const fd = openSync(lockPath, "w"); writeSync(fd, JSON.stringify(rec, null, 2)); closeSync(fd);
  return rec;
}

// Release = mark terminal (kept as an audit tombstone; a future run reclaims it as "terminal").
export function releaseSingleRunLock(lockPath, { status = "cleaned", now = Date.now() } = {}) {
  return updateRunLockStatus(lockPath, TERMINAL_LOCK_STATUSES.has(status) ? status : "cleaned", { now });
}

export function clearRunLock(lockPath, { force = false } = {}) {
  const rec = readRunLock(lockPath);
  if (rec && !force && !TERMINAL_LOCK_STATUSES.has(rec.status)) {
    throw new Error(`refusing to clear a non-terminal lock (status=${rec.status}); audit then pass { force: true }`);
  }
  try { unlinkSync(lockPath); return true; } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 6 — single real-email budget (real_email_send_count === 1)
// ─────────────────────────────────────────────────────────────────────────────
export function makeRealEmailBudget(max = 1) {
  let count = 0;
  return {
    charge(context = "") {
      count += 1;
      if (count > max) throw new Error(`real email budget exceeded: attempted send #${count} (max ${max})${context ? ` at ${context}` : ""}`);
      return count;
    },
    count: () => count,
    assertExactlyOne() { if (count !== 1) throw new Error(`real_email_send_count must be exactly 1, got ${count}`); return true; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 7 — global journey deadline / hard stop (<= 30 min); never self-relaunch
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_JOURNEY_MS = 30 * 60 * 1000;

export function makeGlobalDeadline(ms = MAX_JOURNEY_MS, { nowFn = Date.now } = {}) {
  const budgetMs = Math.max(1, Math.min(ms, MAX_JOURNEY_MS));
  const start = nowFn();
  const deadline = start + budgetMs;
  return {
    start, deadline, budgetMs,
    remainingMs: () => Math.max(0, deadline - nowFn()),
    expired: () => nowFn() >= deadline,
    assertAlive(stage = "") {
      if (nowFn() >= deadline) throw new Error(`P8.7.4 global journey deadline (${Math.round(budgetMs / 60000)}min) exceeded${stage ? ` before stage "${stage}"` : ""} — HARD STOP: cleanup, NOT_VERIFIED, non-zero exit, no automatic relaunch`);
    },
    // clamp any per-step wait so a single external wait can never exceed the remaining global budget
    clampWaitMs(requestedMs) { return Math.max(0, Math.min(requestedMs, deadline - nowFn())); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: deterministic, provider-safe external id (mirrors the Yousign adapter's conformance),
// exposed so the runner/preflight can stamp a correlatable run_id anchor without importing TS.
// ─────────────────────────────────────────────────────────────────────────────
export function safeCorrelationAnchor(prefix, raw) {
  const s = `${prefix}:${raw}`;
  return `cs-${createHash("sha256").update(s).digest("hex").slice(0, 32)}`;
}
