// src/lib/pierre/v1/p89-load-guards.mjs
// PHASE 8.9 — anti-Production guards for the load/performance harness. Pure, node-builtin-only,
// unit-tested. They REFUSE, fail-closed, before any load work touches Production, clonestore.pro,
// a real provider, or a non-synthetic tenant. Load tests may run ONLY against the local PGlite
// synthetic environment with `p89-load-*` tenants and simulated provider adapters.

import { createHash } from "crypto";

const PROD_HOSTS = new Set(["clonestore.pro", "www.clonestore.pro"]);
export const SYNTHETIC_TENANT_PREFIX = "p89-load-";

/** True if a URL/host points at Production (clonestore.pro or a non-local DB host). */
export function isProductionTarget(value) {
  if (!value) return false;
  let host = String(value).trim().toLowerCase();
  try { host = new URL(host.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { /* not a URL — treat raw */ }
  if (PROD_HOSTS.has(host)) return true;
  if (/(\.supabase\.co|\.supabase\.com|pooler\.|\.vercel\.app|\.neon\.tech|amazonaws\.com)$/.test(host)) return true; // managed/prod DB or host
  return false;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
export function isLocalTarget(value) {
  if (!value) return false;
  let host = String(value).trim().toLowerCase();
  try { host = new URL(host.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { return false; }
  return LOCAL_HOSTS.has(host);
}

/**
 * Fail-closed gate for the load harness. `mode` must be 'dry-run' or 'local'. Refuses if any
 * production target or real-provider request is present. Returns a small acknowledgement object.
 */
export function assertSyntheticBenchEnv(opts = {}) {
  const { mode, env = {}, allowRealProviders = false } = opts;
  if (mode !== "dry-run" && mode !== "local") throw new Error(`P8.9 harness refuses mode "${mode}" — only dry-run|local (PGlite synthetic) allowed`);
  // no production target may be configured for USE by the harness
  for (const key of ["P89_TARGET_URL", "P89_DATABASE_URL"]) {
    if (env[key] && isProductionTarget(env[key])) throw new Error(`P8.9 harness refuses a Production target in ${key}`);
    if (env[key] && !isLocalTarget(env[key])) throw new Error(`P8.9 harness target ${key} is neither local nor recognized-synthetic — refuse`);
  }
  // never against clonestore.pro
  if (env.CLONESTORE_PUBLIC_APP_URL && isProductionTarget(env.CLONESTORE_PUBLIC_APP_URL) && mode === "local") {
    // allowed to be set (prod url) but the harness must NOT issue HTTP to it — enforced by design (no fetch to app);
    // we still refuse if a caller explicitly asks to target it:
    if (env.P89_ALLOW_APP_HTTP === "1") throw new Error("P8.9 harness must never issue HTTP load to clonestore.pro");
  }
  if (!allowRealProviders) {
    // real provider live-smoke flags must not be enabled during load tests
    for (const flag of ["CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED", "CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED"]) {
      if (env[flag] === "true") throw new Error(`P8.9 harness refuses real-provider live smoke (${flag}=true)`);
    }
  }
  return { ok: true, mode, engine: "pglite-synthetic", providers: "simulated" };
}

/** Deterministic synthetic tenant id (prefixed + seeded), never a real company. */
export function syntheticTenantId(runId, index) {
  const h = createHash("sha256").update(`${runId}:${index}`).digest("hex").slice(0, 12);
  return `${SYNTHETIC_TENANT_PREFIX}${runId}-${index}-${h}`;
}

export function assertSyntheticTenant(name) {
  if (!name || !String(name).startsWith(SYNTHETIC_TENANT_PREFIX)) throw new Error(`refuse to operate on non-synthetic tenant "${name}" (must be ${SYNTHETIC_TENANT_PREFIX}*)`);
  return true;
}

/** percentile helper used by benches (pure). */
export function percentile(samples, p) {
  if (!samples.length) return 0;
  const s = [...samples].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}
export function stats(samples) {
  return { n: samples.length, p50: +percentile(samples, 50).toFixed(3), p95: +percentile(samples, 95).toFixed(3), p99: +percentile(samples, 99).toFixed(3), max: +(samples.length ? Math.max(...samples) : 0).toFixed(3) };
}
