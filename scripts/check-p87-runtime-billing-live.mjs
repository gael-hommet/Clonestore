#!/usr/bin/env node
// scripts/check-p87-runtime-billing-live.mjs
// PHASE 8.7.2 — THIN CLI for the live runtime+billing infrastructure verifier. Wires real env loading +
// the real pg driver (TLS) into the injectable engine. Read-only, fail-closed, never prints a value.
//
//   --json    JSON only          --strict  exit non-zero unless ready    --environment=local|staging|production
//
// Default mode (report) exits 0 and emits the JSON even with blockers; --strict exits 2 when not ready.

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const engine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-runtime-billing-check.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const STRICT = argv.includes("--strict");
const PROBE = !argv.includes("--no-probe");
const ENVIRONMENT = (argv.find((a) => a.startsWith("--environment=")) || "").split("=")[1]
  || process.env.PIERRE_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");
const NET_TIMEOUT_MS = 10000;

const { env } = envEngine.loadEnvironment(ENVIRONMENT, {
  cwd: ROOT, processEnv: process.env,
  readFile: (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null), fileExists: (p) => existsSync(p), join,
});

async function pgConnect(dsn) {
  const pg = await import("pg");
  // TLS REQUIRED for the verdict; rejectUnauthorized:false tolerates the managed-PG chain while still
  // negotiating TLS (the check independently asserts pg_stat_ssl.ssl=true). Supabase direct is IPv6-only and
  // intermittent on this host → retry transient connect failures with backoff (auth/permission NOT retried).
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const pool = new pg.default.Pool({ connectionString: dsn, max: 1, application_name: "p87_runtime_billing_live", connectionTimeoutMillis: NET_TIMEOUT_MS, ssl: { rejectUnauthorized: false } });
    try { const client = await pool.connect(); return { query: (sql, params) => client.query(sql, params ? [...params] : undefined), end: async () => { client.release(); await pool.end(); } }; }
    catch (e) {
      lastErr = e; await pool.end().catch(() => {});
      const transient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|timeout|terminated/i.test(e?.message || "") || /ETIMEDOUT|ECONNRESET/.test(e?.code || "");
      if (!transient || attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

const report = await engine.runRuntimeBillingCheck({ env, probe: PROBE, pgConnect, now: new Date().toISOString() });

if (!JSON_ONLY) {
  process.stderr.write(`\n== P8.7.2 RUNTIME + BILLING LIVE CHECK (${ENVIRONMENT}) ==\n  roles:\n`);
  for (const [r, v] of Object.entries(report.roles)) process.stderr.write(`   - ${r.padEnd(36)} ${v.status}\n`);
  process.stderr.write(`  proof:\n`);
  for (const [k, v] of Object.entries(report.proof)) process.stderr.write(`   - ${k.padEnd(12)} ${v.status}\n`);
  if (report.blockers.length) { process.stderr.write(`\n  BLOCKERS:\n`); for (const b of report.blockers) process.stderr.write(`   - ${b.area}: ${b.status} (${b.reason})\n`); }
  process.stderr.write(`\n  ready: ${report.ready}\n  mode: ${STRICT ? "strict" : "report"}\n\n`);
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(STRICT && !report.ready ? 2 : 0);
