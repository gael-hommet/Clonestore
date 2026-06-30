#!/usr/bin/env node
// scripts/check-p87-external-providers-live.mjs — THIN CLI for the P8.7.3 external-providers verifier.
// Wires real env loading + the real fetch (read-only) + the persisted storage proof into the injectable
// engine. Read-only, fail-closed, never prints a secret value.
//   --json   JSON only        --strict  exit 2 unless ready        --environment=local|staging|production
import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const engine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-external-providers-check.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes("--json");
const STRICT = argv.includes("--strict");
const ENVIRONMENT = (argv.find((a) => a.startsWith("--environment=")) || "").split("=")[1]
  || process.env.PIERRE_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");

const { env } = envEngine.loadEnvironment(ENVIRONMENT, {
  cwd: ROOT, processEnv: process.env,
  readFile: (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null), fileExists: (p) => existsSync(p), join,
});

async function fetchJson(url, init = {}) {
  try {
    const r = await fetch(url, { method: init.method || "GET", headers: init.headers || {}, body: init.body });
    let json = null; try { json = await r.json(); } catch { /* */ }
    return { status: r.status, ok: r.ok, json };
  } catch { return { status: 0, ok: false, json: null }; }
}
const readProof = () => { const p = join(ROOT, ".p87-proofs", "step3", "storage-proof.json"); try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null; } catch { return null; } };

const report = await engine.runExternalProvidersCheck({ env, fetchJson, readProof, now: new Date().toISOString() });

if (!JSON_ONLY) {
  process.stderr.write(`\n== P8.7.3 EXTERNAL PROVIDERS LIVE CHECK (${ENVIRONMENT}) ==\n`);
  for (const [k, v] of Object.entries(report.domains)) process.stderr.write(`   - ${k.padEnd(15)} ${v.status}${v.status.startsWith("READY") ? "" : `  (${v.detail})`}\n`);
  process.stderr.write(`\n  ready: ${report.ready}\n  mode: ${STRICT ? "strict" : "report"}\n\n`);
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(STRICT && !report.ready ? 2 : 0);
