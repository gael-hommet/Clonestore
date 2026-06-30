#!/usr/bin/env node
// scripts/check-p87-live-infrastructure-preflight.mjs
// PHASE 8.7.1 (hardened) — THIN CLI for the live-infrastructure preflight engine.
//
// It wires the REAL dependencies (explicit ordered .env loading, the pg driver, global fetch, the DNS
// resolver, and on-disk webhook-route existence) into the injectable engine in
// ../src/lib/pierre/v1/live-infrastructure-preflight.mjs. All policy/probe logic + the single source of
// truth live in the engine + contract; this file only wires I/O and prints. It never logs a value.
//
//   --environment=local|staging|production   choose the env-file set
//   --no-probe                               config-only (no network/DB)
//   --json                                   JSON only (no human summary)
//   --strict                                 exit non-zero unless ready_for_p87_2 (used by check:; report: omits it)

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const engine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);
const contract = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const STRICT = argv.includes("--strict");
const PROBE = !argv.includes("--no-probe");
const ENVIRONMENT = (argv.find((a) => a.startsWith("--environment=")) || "").split("=")[1]
  || process.env.PIERRE_ENV || (process.env.VERCEL_ENV === "preview" ? "staging" : process.env.VERCEL_ENV) || (process.env.NODE_ENV === "production" ? "production" : "local");
const NET_TIMEOUT_MS = 8000;

// ── real env loading (explicit ordered files; process.env wins; values never printed) ─────────
const { env, loadedFiles } = engine.loadEnvironment(ENVIRONMENT, {
  cwd: ROOT,
  processEnv: process.env,
  readFile: (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null),
  fileExists: (p) => existsSync(p),
  join,
});

// ── real injectable deps ──────────────────────────────────────────────────────────────────────
async function httpGet(url, headers) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), NET_TIMEOUT_MS);
  try { const r = await fetch(url, { method: "GET", headers, signal: ac.signal }); let body = null; try { body = await r.json(); } catch { /* non-json */ } return { ok: r.ok, status: r.status, body }; }
  finally { clearTimeout(t); }
}
async function pgConnect(dsn) {
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: dsn, max: 1, application_name: "p87_preflight", connectionTimeoutMillis: NET_TIMEOUT_MS });
  const client = await pool.connect();
  return { query: (sql, params) => client.query(sql, params ? [...params] : undefined), end: async () => { client.release(); await pool.end(); } };
}
async function dnsResolveTxt(host) { const dns = await import("dns/promises"); return dns.resolveTxt(host); }
// authoritative: the compiled BUILD artifact must exist; the src file is only a secondary diagnostic.
function webhookRoute(domain) {
  const inBuild = existsSync(resolve(ROOT, contract.BUILD_ROUTE_ARTIFACTS[domain]));
  if (inBuild) return "build";
  const inSrc = existsSync(resolve(ROOT, contract.EXPECTED_WEBHOOK_ROUTES[domain]));
  return inSrc ? "src_only" : "absent";
}

const report = await engine.runPreflight({
  env, environment: ENVIRONMENT, env_files_loaded: loadedFiles.length, probe: PROBE,
  httpGet, pgConnect, dnsResolveTxt, webhookRoute,
});

if (!JSON_ONLY) {
  process.stderr.write(`\n== P8.7.1 LIVE INFRASTRUCTURE PREFLIGHT (${report.environment}; ${report.env_files_loaded} env file(s) loaded) ==\n`);
  for (const [name, dm] of Object.entries(report.domains)) process.stderr.write(`  ${name.padEnd(15)} ${dm.status}\n`);
  process.stderr.write(`\n  legacy checks:\n`);
  for (const [n, l] of Object.entries(report.legacy_checks)) process.stderr.write(`   - ${n}: ${l.status}\n`);
  if (report.blockers.length) { process.stderr.write(`\n  BLOCKERS:\n`); for (const b of report.blockers) process.stderr.write(`   - ${b.domain}: ${b.status} (${b.reason})\n`); }
  process.stderr.write(`\n  ready_for_p87_2: ${report.ready_for_p87_2}\n  mode: ${STRICT ? "strict" : "report"}\n\n`);
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(STRICT && !report.ready_for_p87_2 ? 2 : 0);
